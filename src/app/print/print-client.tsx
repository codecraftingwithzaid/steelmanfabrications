"use client";

import { DocumentPreview } from "@/components/document/document-preview";
import type { DocumentDraft } from "@/lib/types";

export function PrintClient({ draft }: { draft: DocumentDraft }) {
  return (
    <div style={{ margin: 0, padding: 0, background: "#fff" }}>
      <DocumentPreview draft={draft} printMode />
    </div>
  );
}
