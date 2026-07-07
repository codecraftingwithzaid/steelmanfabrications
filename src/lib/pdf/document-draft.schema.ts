import { z } from "zod";
import type { DocumentDraft } from "@/lib/types";

/**
 * Validation schema for the PDF payload. It mirrors {@link DocumentDraft}
 * exactly enough to render safely: known fields are coerced/defaulted so the
 * template always receives well-formed data, unknown fields are stripped, and
 * the item count is bounded to keep the encoded request within safe limits.
 *
 * It stays intentionally lenient on free-text fields to preserve the existing
 * client → API contract (no valid document should be rejected).
 */

/** Hard cap on line items — a single A4 page never needs anywhere near this. */
export const MAX_LINE_ITEMS = 200;

const lineItemSchema = z.object({
  key: z.string().default(""),
  category: z.string().default("fabrication"),
  description: z.string().default(""),
  isOther: z.boolean().default(false),
  qty: z.string().default(""),
  unit: z.string().default(""),
  rate: z.string().default(""),
});

export const documentDraftSchema = z.object({
  docType: z.enum(["invoice", "quotation"]),
  docNumber: z.string().default(""),
  docDate: z.string().default(""),
  validityOrDueDate: z.string().default(""),
  customerName: z.string().default(""),
  customerGstin: z.string().default(""),
  customerPhone: z.string().default(""),
  customerAddress: z.string().default(""),
  items: z.array(lineItemSchema).max(MAX_LINE_ITEMS).default([]),
  gstPercent: z.string().default(""),
  terms: z.string().default(""),
  contact: z
    .object({
      name: z.string().default(""),
      email: z.string().default(""),
      phone: z.string().default(""),
    })
    .default({ name: "", email: "", phone: "" }),
});

export type ValidatedDraft = z.infer<typeof documentDraftSchema>;

/** Narrow the validated payload to the app's DocumentDraft shape. */
export function toDocumentDraft(value: ValidatedDraft): DocumentDraft {
  return value as unknown as DocumentDraft;
}
