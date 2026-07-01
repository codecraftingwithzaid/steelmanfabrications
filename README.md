# Steelman Billing

Invoice & Quotation platform for **Steelman Fabrication & Aluminium Windows Works** (Indore, MP).

Staff create GST-ready Invoices and Quotations from category-aware dropdowns, totals auto-calculate (Indian ₹ formatting + amount-in-words), and each document exports as a **pixel-clean single-page A4 PDF** that matches the on-screen preview exactly.

## Tech stack

- **Next.js 14** (App Router, TypeScript) + **Tailwind CSS**
- **Supabase** — Postgres, Auth, Row Level Security
- **Puppeteer** (headless Chromium) for server-side HTML→PDF, plus browser `Print`
- **Zod / react-hook-form** patterns, **Recharts** dashboard, **@dnd-kit** row reordering
- **sonner** toasts (undo-on-delete, autosave indicator)

## Architecture overview

```
src/
  app/
    login/                 # branded sign-in (Supabase email/password)
    (app)/                 # authenticated shell (nav, theme, command palette)
      dashboard/           # KPIs + revenue chart (Fab vs Aluminium) + widgets
      documents/           # list + filters + convert-to-invoice
      documents/new/       # the document editor (server loads catalog + profile)
    print/                 # standalone A4 canvas consumed by Puppeteer / browser
    api/pdf/               # POST -> single-page A4 PDF (renders /print)
  components/
    document/              # DocumentPreview (A4 template + shrink-to-fit),
                           # PreviewPane, LineItemsTable, DocumentEditor
    dashboard/ documents/ ui/ ...
  lib/
    format.ts              # Indian ₹ grouping + Lakh/Crore amount-in-words
    calc.ts                # authoritative totals math (mirrors DB trigger)
    fit-to-page.ts         # density step-down for one-page fit
    catalog.ts types.ts    # seed catalog + domain types
    supabase/              # browser / server / middleware clients
supabase/migrations/       # schema + RLS + seed (see below)
scripts/seed-admin.mjs     # provisions the first admin account
```

**Business-critical guarantees**

- **Totals math** lives in `src/lib/calc.ts` (client, for live UX) and is mirrored
  by a Postgres trigger (`recalc_document_totals`) so stored totals are never
  trusted from the client. Currency + words are centralised in `src/lib/format.ts`.
- **Single-page PDF**: the `.doc-page` is a fixed A4 canvas (210×297mm, `@page` margin 0).
  Header + footer are fixed; the line-items area flex-grows and the footer is anchored
  to the bottom. `DocumentPreview` measures content and steps a density scale down
  (100% → … → ~8pt min) until it fits, then flags `data-ready="1"`. The same React
  component powers the preview **and** the PDF, so downloads are WYSIWYG.

## Setup

1. **Install**

   ```bash
   npm install
   ```

2. **Create a Supabase project**, then copy env:

   ```bash
   cp .env.example .env.local
   ```

   Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` (from Supabase → Project Settings → API).

3. **Run migrations** (schema + RLS + seed). Either paste the files in the SQL
   editor in order, or use the Supabase CLI:

   ```bash
   supabase db push        # applies supabase/migrations/*.sql
   ```

   - `0001_init.sql` — tables, enums, `next_doc_number` RPC, totals triggers, RLS
   - `0002_seed_catalog.sql` — Fabrication + Aluminium description lists

4. **Provision the first admin** (no public sign-up):

   ```bash
   npm run seed:admin      # uses SEED_ADMIN_* from .env.local
   ```

5. **Run**

   ```bash
   npm run dev             # http://localhost:3000
   ```

## PDF rendering

- **Local / any Node host**: uses the Chromium bundled with `puppeteer` — works out of the box.
- **Vercel / serverless**: Chromium isn't bundled. Install the serverless pair and
  flip the flag:

  ```bash
  npm install @sparticuz/chromium puppeteer-core
  # .env: PDF_USE_SERVERLESS_CHROMIUM=1
  ```

  `src/app/api/pdf/route.ts` already branches on that flag. Also set
  `NEXT_PUBLIC_APP_URL` to the deployed origin so the engine can load `/print`.

The in-app **Print** button opens `/print` and triggers the browser dialog
(Save as PDF) — a zero-dependency fallback that is byte-for-byte the same layout.

## Roles & access

- **Admin** — full access: all documents, reports, manage item descriptions/users.
- **Staff** — create/view/edit their own documents, read-only reports.
- RLS enforces ownership (`created_by = auth.uid()`) with an `is_admin()` override.
  Unauthenticated requests are redirected to `/login` by middleware.

## Formatting

All currency uses Indian grouping (`₹1,20,000.00`) and amount-in-words uses the
Indian system (`Rupees One Lakh Twenty Thousand Only`), consistently across the
UI and the PDF.

## Notes / next steps

Implemented end-to-end: auth, RLS schema + seed, atomic numbering, the full
document editor (type/category toggles, category-aware dropdowns with free-text
"Other", drag reorder, duplicate, undo-delete, autosave, GST slabs, live totals),
the single-page A4 PDF pipeline, documents list with convert-to-invoice, and the
analytics dashboard.

Natural extensions not yet wired: an admin settings screen to edit
`item_descriptions`/users from the UI, per-document edit/reopen route, payment
entry UI (the `payments` table + reports already exist), and CSV/Excel export of
report data.
