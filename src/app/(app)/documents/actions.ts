"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DocumentDraft, DocType } from "@/lib/types";

interface SaveResult {
  id?: string;
  docNumber?: string;
  error?: string;
}

/**
 * Persists a new document. The document number is issued by the atomic
 * `next_doc_number` RPC (no races, never reused). Totals are recomputed
 * server-side by triggers, so client totals are never trusted.
 */
export async function createDocument(
  draft: DocumentDraft,
): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: docNumber, error: numErr } = await supabase.rpc(
    "next_doc_number",
    { p_doc_type: draft.docType },
  );
  if (numErr || !docNumber) {
    return { error: numErr?.message || "Could not allocate a document number" };
  }

  const gst =
    draft.gstPercent.trim() === "" ? null : Number(draft.gstPercent) || null;

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      doc_type: draft.docType,
      doc_number: docNumber,
      customer_name: draft.customerName || null,
      customer_gstin: draft.customerGstin || null,
      doc_date: draft.docDate || new Date().toISOString().slice(0, 10),
      validity_or_due_date: draft.validityOrDueDate || null,
      gst_percent: gst,
      status: "draft",
      terms_and_conditions: draft.terms || null,
      contact_person_id: user.id,
      created_by: user.id,
    })
    .select("id, doc_number")
    .single();

  if (docErr || !doc) {
    return { error: docErr?.message || "Could not create document" };
  }

  const items = draft.items
    .filter((i) => i.description.trim() !== "" || Number(i.rate) > 0)
    .map((i, idx) => ({
      document_id: doc.id,
      sr_order: idx + 1,
      category: i.category,
      description: i.description,
      qty: Number(i.qty) || 0,
      unit: i.unit || "PCS",
      rate: Number(i.rate) || 0,
    }));

  if (items.length > 0) {
    const { error: itemsErr } = await supabase
      .from("document_items")
      .insert(items);
    if (itemsErr) return { error: itemsErr.message };
  }

  revalidatePath("/documents");
  revalidatePath("/dashboard");
  return { id: doc.id, docNumber: doc.doc_number };
}

/** Clones a quotation into a new invoice, preserving its items. */
export async function convertToInvoice(
  quotationId: string,
): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: q, error: qErr } = await supabase
    .from("documents")
    .select("*")
    .eq("id", quotationId)
    .single();
  if (qErr || !q) return { error: "Quotation not found" };

  const { data: docNumber, error: numErr } = await supabase.rpc(
    "next_doc_number",
    { p_doc_type: "invoice" as DocType },
  );
  if (numErr || !docNumber) return { error: "Could not allocate number" };

  const { data: inv, error: invErr } = await supabase
    .from("documents")
    .insert({
      doc_type: "invoice",
      doc_number: docNumber,
      customer_id: q.customer_id,
      customer_name: q.customer_name,
      customer_gstin: q.customer_gstin,
      doc_date: new Date().toISOString().slice(0, 10),
      gst_percent: q.gst_percent,
      status: "draft",
      terms_and_conditions: q.terms_and_conditions,
      contact_person_id: user.id,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (invErr || !inv) return { error: invErr?.message || "Convert failed" };

  const { data: qItems } = await supabase
    .from("document_items")
    .select("sr_order, category, description, qty, unit, rate")
    .eq("document_id", quotationId);

  if (qItems && qItems.length > 0) {
    await supabase
      .from("document_items")
      .insert(qItems.map((i) => ({ ...i, document_id: inv.id })));
  }

  await supabase
    .from("documents")
    .update({ converted_to: inv.id, status: "accepted" })
    .eq("id", quotationId);

  revalidatePath("/documents");
  revalidatePath("/dashboard");
  return { id: inv.id, docNumber: docNumber as string };
}

/**
 * Updates an existing document and replaces its line items. The document
 * number and type are preserved (numbers are never reused/renumbered).
 * Totals are recomputed server-side by triggers.
 */
export async function updateDocument(
  id: string,
  draft: DocumentDraft,
): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const gst =
    draft.gstPercent.trim() === "" ? null : Number(draft.gstPercent) || null;

  const { error: updErr } = await supabase
    .from("documents")
    .update({
      customer_name: draft.customerName || null,
      customer_gstin: draft.customerGstin || null,
      doc_date: draft.docDate || new Date().toISOString().slice(0, 10),
      validity_or_due_date: draft.validityOrDueDate || null,
      gst_percent: gst,
      terms_and_conditions: draft.terms || null,
    })
    .eq("id", id);
  if (updErr) return { error: updErr.message };

  // Replace items (simplest correct approach; triggers recalc totals).
  const { error: delErr } = await supabase
    .from("document_items")
    .delete()
    .eq("document_id", id);
  if (delErr) return { error: delErr.message };

  const items = draft.items
    .filter((i) => i.description.trim() !== "" || Number(i.rate) > 0)
    .map((i, idx) => ({
      document_id: id,
      sr_order: idx + 1,
      category: i.category,
      description: i.description,
      qty: Number(i.qty) || 0,
      unit: i.unit || "PCS",
      rate: Number(i.rate) || 0,
    }));

  if (items.length > 0) {
    const { error: insErr } = await supabase
      .from("document_items")
      .insert(items);
    if (insErr) return { error: insErr.message };
  } else {
    // No items left — reset totals explicitly since no item trigger fires.
    await supabase.rpc("recalc_document_totals", { p_document_id: id });
  }

  revalidatePath("/documents");
  revalidatePath("/dashboard");
  return { id };
}

/** Permanently deletes a document (items cascade). Owner/admin only via RLS. */
export async function deleteDocument(id: string): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/documents");
  revalidatePath("/dashboard");
  return { id };
}
