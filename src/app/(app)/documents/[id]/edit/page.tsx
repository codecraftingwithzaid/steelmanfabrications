import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentEditor } from "@/components/document/document-editor";
import {
  DESCRIPTIONS_BY_CATEGORY,
  DEFAULT_TERMS,
  type CategorySlug,
} from "@/lib/catalog";
import type { DocumentDraft, EditorLineItem } from "@/lib/types";

export const metadata = { title: "Edit Document · Steelman" };
export const dynamic = "force-dynamic";

export default async function EditDocumentPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!doc) notFound();

  const { data: itemRows } = await supabase
    .from("document_items")
    .select("id, sr_order, category, description, qty, unit, rate")
    .eq("document_id", params.id)
    .order("sr_order");

  // Live catalog (fallback to seed) — also used to decide "Other" free-text.
  const { data: catRows } = await supabase
    .from("item_descriptions")
    .select("label, sort_order, is_active, item_categories!inner(name)")
    .eq("is_active", true)
    .order("sort_order");

  const descriptions: Record<CategorySlug, string[]> = {
    fabrication: [],
    aluminium: [],
  };
  for (const r of (catRows ?? []) as unknown as {
    label: string;
    item_categories: { name: CategorySlug };
  }[]) {
    const slug = r.item_categories?.name;
    if (slug && descriptions[slug]) descriptions[slug].push(r.label);
  }
  if (!descriptions.fabrication.length)
    descriptions.fabrication = DESCRIPTIONS_BY_CATEGORY.fabrication;
  if (!descriptions.aluminium.length)
    descriptions.aluminium = DESCRIPTIONS_BY_CATEGORY.aluminium;

  // Contact person snapshot (falls back to current user).
  const contactId = doc.contact_person_id || user?.id;
  const { data: contactProfile } = contactId
    ? await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", contactId)
        .single()
    : { data: null };

  const items: EditorLineItem[] = (itemRows ?? []).map((r) => {
    const category = (r.category as CategorySlug) ?? "fabrication";
    const isOther = !descriptions[category].includes(r.description);
    return {
      key: r.id,
      category,
      description: r.description ?? "",
      isOther,
      qty: r.qty != null ? String(Number(r.qty)) : "",
      unit: r.unit ?? "PCS",
      rate: r.rate != null ? String(Number(r.rate)) : "",
    };
  });

  const initialDraft: DocumentDraft = {
    docType: doc.doc_type,
    docNumber: doc.doc_number,
    docDate: doc.doc_date ?? "",
    validityOrDueDate: doc.validity_or_due_date ?? "",
    customerName: doc.customer_name ?? "",
    customerGstin: doc.customer_gstin ?? "",
    customerPhone: doc.customer_phone ?? "",
    customerAddress: doc.customer_address ?? "",
    items: items.length
      ? items
      : [
          {
            key: "row-1",
            category: "fabrication" as CategorySlug,
            description: "",
            isOther: false,
            qty: "1",
            unit: "PCS",
            rate: "",
          },
        ],
    gstPercent: doc.gst_percent != null ? String(Number(doc.gst_percent)) : "",
    advancePayment:
      doc.advance_amount != null && Number(doc.advance_amount) > 0
        ? String(Number(doc.advance_amount))
        : "",
    terms: doc.terms_and_conditions ?? DEFAULT_TERMS,
    contact: {
      name: contactProfile?.full_name || "",
      email: contactProfile?.email || user?.email || "",
      phone: contactProfile?.phone || "",
    },
  };

  return (
    <DocumentEditor
      mode="edit"
      documentId={params.id}
      initialDraft={initialDraft}
      descriptions={descriptions}
      contact={initialDraft.contact}
    />
  );
}
