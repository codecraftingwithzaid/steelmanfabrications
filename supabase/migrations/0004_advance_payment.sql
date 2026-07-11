-- =====================================================================
-- Steelman Billing — advance payment received on a document
-- Document-level figure shown on the invoice/quotation; balance due is
-- derived as grand_total - advance_amount.
-- =====================================================================

alter table public.documents
  add column if not exists advance_amount numeric(14,2) not null default 0;

-- Refresh PostgREST's schema cache so the new column is usable immediately.
notify pgrst, 'reload schema';
