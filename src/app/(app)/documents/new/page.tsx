import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DocumentEditor } from "@/components/document/document-editor";
import {
  DESCRIPTIONS_BY_CATEGORY,
  type CategorySlug,
} from "@/lib/catalog";
import type { DocType } from "@/lib/types";

export const metadata = { title: "New Document · Steelman" };
export const dynamic = "force-dynamic";

/**
 * Previews the next document number (current sequence value + 1) for display
 * in the editor/PDF before saving. The authoritative number is still assigned
 * atomically on save via the `next_doc_number` RPC. Reads the RLS-protected
 * sequence table with a server-only admin client; falls back gracefully.
 */
async function peekNextDocNumber(docType: DocType): Promise<string | undefined> {
  const admin = createAdminClient();
  if (!admin) return undefined;
  const { data, error } = await admin
    .from("document_sequences")
    .select("current_number")
    .eq("doc_type", docType)
    .single();
  if (error || !data) return undefined;
  const next = (Number(data.current_number) || 0) + 1;
  const prefix = docType === "invoice" ? "INV" : "QTN";
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", user.id)
        .single()
    : { data: null };

  // Live catalog from DB (admins can edit); fall back to seed constants.
  const { data: rows } = await supabase
    .from("item_descriptions")
    .select("label, sort_order, is_active, item_categories!inner(name)")
    .eq("is_active", true)
    .order("sort_order");

  const descriptions: Record<CategorySlug, string[]> = {
    fabrication: [],
    aluminium: [],
  };
  if (rows && rows.length) {
    for (const r of rows as unknown as {
      label: string;
      item_categories: { name: CategorySlug };
    }[]) {
      const slug = r.item_categories?.name;
      if (slug && descriptions[slug]) descriptions[slug].push(r.label);
    }
  }
  if (!descriptions.fabrication.length)
    descriptions.fabrication = DESCRIPTIONS_BY_CATEGORY.fabrication;
  if (!descriptions.aluminium.length)
    descriptions.aluminium = DESCRIPTIONS_BY_CATEGORY.aluminium;

  const initialDocType: DocType =
    searchParams.type === "quotation" ? "quotation" : "invoice";

  // Preview the next number for both types so the field/PDF show a real value
  // and stay correct if the user toggles the document type before saving.
  const [invoiceNo, quotationNo] = await Promise.all([
    peekNextDocNumber("invoice"),
    peekNextDocNumber("quotation"),
  ]);
  const previewDocNumbers: Partial<Record<DocType, string>> = {
    invoice: invoiceNo,
    quotation: quotationNo,
  };

  return (
    <DocumentEditor
      initialDocType={initialDocType}
      previewDocNumbers={previewDocNumbers}
      descriptions={descriptions}
      contact={{
        name: profile?.full_name || "",
        email: profile?.email || user?.email || "",
        phone: profile?.phone || "",
      }}
    />
  );
}
