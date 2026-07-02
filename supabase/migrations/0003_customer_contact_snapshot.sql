-- =====================================================================
-- Steelman Billing — add customer phone/address snapshot to documents
-- Mirrors customer_name/customer_gstin: an immutable copy on the doc.
-- =====================================================================

alter table public.documents
  add column if not exists customer_phone   text,
  add column if not exists customer_address text;

-- Force PostgREST to refresh its schema cache so the new columns are
-- immediately usable via the REST API (clears the
-- "Could not find the 'customer_address' column ... in the schema cache" error).
notify pgrst, 'reload schema';
