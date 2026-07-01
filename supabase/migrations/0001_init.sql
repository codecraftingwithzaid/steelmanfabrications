-- =====================================================================
-- Steelman Billing — initial schema
-- Postgres / Supabase. RLS enabled on every table.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type doc_type as enum ('invoice', 'quotation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type category_slug as enum ('fabrication', 'aluminium');
exception when duplicate_object then null; end $$;

-- Statuses kept as text with a check so invoice + quotation states coexist.
-- invoice : draft | sent | paid | overdue
-- quotation: draft | sent | accepted | rejected | expired

-- ---------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  email      text,
  phone      text,
  role       user_role not null default 'staff',
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER helper so policies can check admin without RLS recursion.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Auto-create a profile row whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'staff')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  gstin      text,
  phone      text,
  email      text,
  address    text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- item catalog (editable by admins)
-- ---------------------------------------------------------------------
create table if not exists public.item_categories (
  id   uuid primary key default gen_random_uuid(),
  name category_slug not null unique
);

create table if not exists public.item_descriptions (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.item_categories (id) on delete cascade,
  label       text not null,
  is_active   boolean not null default true,
  sort_order  int not null default 0
);
create index if not exists idx_item_descriptions_category
  on public.item_descriptions (category_id, sort_order);

-- ---------------------------------------------------------------------
-- document numbering (atomic, gapless per type, never renumbered)
-- ---------------------------------------------------------------------
create table if not exists public.document_sequences (
  doc_type       doc_type primary key,
  current_number int not null default 0
);
insert into public.document_sequences (doc_type, current_number)
values ('invoice', 0), ('quotation', 0)
on conflict (doc_type) do nothing;

-- Returns the next formatted number (e.g. INV-0001 / QTN-0001) atomically.
create or replace function public.next_doc_number(p_doc_type doc_type)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  prefix text;
begin
  update public.document_sequences
     set current_number = current_number + 1
   where doc_type = p_doc_type
  returning current_number into n;

  prefix := case p_doc_type when 'invoice' then 'INV' else 'QTN' end;
  return prefix || '-' || lpad(n::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- documents + items
-- ---------------------------------------------------------------------
create table if not exists public.documents (
  id                    uuid primary key default gen_random_uuid(),
  doc_type              doc_type not null,
  doc_number            text not null,
  customer_id           uuid references public.customers (id) on delete set null,
  customer_name         text,          -- snapshot for an immutable printed doc
  customer_gstin        text,
  doc_date              date not null default current_date,
  validity_or_due_date  date,
  gst_percent           numeric(5,2),  -- null => no GST
  subtotal              numeric(14,2) not null default 0,
  gst_amount            numeric(14,2) not null default 0,
  grand_total           numeric(14,2) not null default 0,
  status                text not null default 'draft',
  terms_and_conditions  text,
  contact_person_id     uuid references public.profiles (id) on delete set null,
  converted_to          uuid references public.documents (id) on delete set null,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (doc_type, doc_number),
  constraint status_valid check (
    (doc_type = 'invoice'   and status in ('draft','sent','paid','overdue')) or
    (doc_type = 'quotation' and status in ('draft','sent','accepted','rejected','expired'))
  )
);
create index if not exists idx_documents_created_by on public.documents (created_by);
create index if not exists idx_documents_type_status on public.documents (doc_type, status);

create table if not exists public.document_items (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  sr_order    int not null,
  category    category_slug not null,
  description text not null,
  qty         numeric(14,3) not null default 0,
  unit        text not null default 'PCS',
  rate        numeric(14,2) not null default 0,
  -- server-authoritative row total (generated, never trusted from client)
  total       numeric(14,2) generated always as (round(qty * rate, 2)) stored
);
create index if not exists idx_document_items_doc on public.document_items (document_id, sr_order);

-- ---------------------------------------------------------------------
-- payments (feeds revenue reports)
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  amount      numeric(14,2) not null,
  paid_at     timestamptz not null default now(),
  method      text,
  notes       text,
  created_by  uuid references public.profiles (id) on delete set null
);
create index if not exists idx_payments_doc on public.payments (document_id);

-- ---------------------------------------------------------------------
-- Server-authoritative totals: recompute document totals whenever its
-- items change. Client totals are for UX only.
-- ---------------------------------------------------------------------
create or replace function public.recalc_document_totals(p_document_id uuid)
returns void
language plpgsql
as $$
declare
  v_subtotal numeric(14,2);
  v_gst      numeric(5,2);
  v_gst_amt  numeric(14,2);
begin
  select coalesce(sum(total), 0) into v_subtotal
    from public.document_items where document_id = p_document_id;

  select gst_percent into v_gst
    from public.documents where id = p_document_id;

  v_gst_amt := case
    when v_gst is null or v_gst <= 0 then 0
    else round(v_subtotal * v_gst / 100.0, 2)
  end;

  update public.documents
     set subtotal    = v_subtotal,
         gst_amount  = v_gst_amt,
         grand_total = round(v_subtotal + v_gst_amt, 2),
         updated_at  = now()
   where id = p_document_id;
end;
$$;

create or replace function public.trg_document_items_recalc()
returns trigger
language plpgsql
as $$
begin
  perform public.recalc_document_totals(coalesce(new.document_id, old.document_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists document_items_recalc on public.document_items;
create trigger document_items_recalc
  after insert or update or delete on public.document_items
  for each row execute function public.trg_document_items_recalc();

-- Recompute when gst_percent itself changes.
create or replace function public.trg_documents_gst_recalc()
returns trigger
language plpgsql
as $$
begin
  if new.gst_percent is distinct from old.gst_percent then
    perform public.recalc_document_totals(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists documents_gst_recalc on public.documents;
create trigger documents_gst_recalc
  after update on public.documents
  for each row execute function public.trg_documents_gst_recalc();

-- keep updated_at fresh on direct document edits
create or replace function public.trg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.trg_set_updated_at();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles          enable row level security;
alter table public.customers          enable row level security;
alter table public.item_categories    enable row level security;
alter table public.item_descriptions  enable row level security;
alter table public.documents          enable row level security;
alter table public.document_items     enable row level security;
alter table public.payments           enable row level security;
alter table public.document_sequences enable row level security;
-- document_sequences: no policies => only reachable through the
-- SECURITY DEFINER next_doc_number() function.

-- profiles
create policy profiles_select_self_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_self_or_admin on public.profiles
  for update using (id = auth.uid() or public.is_admin());
create policy profiles_admin_insert on public.profiles
  for insert with check (public.is_admin());

-- customers (shared read for authenticated; owner/admin write)
create policy customers_select_all on public.customers
  for select using (auth.uid() is not null);
create policy customers_insert on public.customers
  for insert with check (auth.uid() is not null);
create policy customers_update_owner_or_admin on public.customers
  for update using (created_by = auth.uid() or public.is_admin());
create policy customers_delete_owner_or_admin on public.customers
  for delete using (created_by = auth.uid() or public.is_admin());

-- item catalog: everyone authenticated can read; only admins write
create policy item_categories_select on public.item_categories
  for select using (auth.uid() is not null);
create policy item_categories_admin_write on public.item_categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy item_descriptions_select on public.item_descriptions
  for select using (auth.uid() is not null);
create policy item_descriptions_admin_write on public.item_descriptions
  for all using (public.is_admin()) with check (public.is_admin());

-- documents: staff see/edit their own; admins everything
create policy documents_select on public.documents
  for select using (created_by = auth.uid() or public.is_admin());
create policy documents_insert on public.documents
  for insert with check (created_by = auth.uid());
create policy documents_update on public.documents
  for update using (created_by = auth.uid() or public.is_admin());
create policy documents_delete on public.documents
  for delete using (created_by = auth.uid() or public.is_admin());

-- document_items: access governed by parent document ownership
create policy document_items_all on public.document_items
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = document_items.document_id
        and (d.created_by = auth.uid() or public.is_admin())
    )
  ) with check (
    exists (
      select 1 from public.documents d
      where d.id = document_items.document_id
        and (d.created_by = auth.uid() or public.is_admin())
    )
  );

-- payments: governed by parent document ownership
create policy payments_all on public.payments
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = payments.document_id
        and (d.created_by = auth.uid() or public.is_admin())
    )
  ) with check (
    exists (
      select 1 from public.documents d
      where d.id = payments.document_id
        and (d.created_by = auth.uid() or public.is_admin())
    )
  );
