import { PrintClient } from "./print-client";
import type { DocumentDraft } from "@/lib/types";

export const dynamic = "force-dynamic";

const EMPTY: DocumentDraft = {
  docType: "invoice",
  docNumber: "",
  docDate: "",
  validityOrDueDate: "",
  customerName: "",
  customerGstin: "",
  items: [],
  gstPercent: "",
  terms: "",
  contact: { name: "", email: "", phone: "" },
};

/**
 * Standalone print canvas consumed by the PDF engine (Puppeteer) and by the
 * browser "Print" action. Reads a base64url-encoded draft from `?d=`.
 * It renders nothing but the A4 document, and DocumentPreview flags
 * `data-ready="1"` once the shrink-to-fit density has settled.
 */
export default function PrintPage({
  searchParams,
}: {
  searchParams: { d?: string };
}) {
  let draft = EMPTY;
  if (searchParams.d) {
    try {
      const json = Buffer.from(searchParams.d, "base64url").toString("utf8");
      draft = { ...EMPTY, ...(JSON.parse(json) as DocumentDraft) };
    } catch {
      draft = EMPTY;
    }
  }
  return <PrintClient draft={draft} />;
}
