"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Download,
  Eye,
  EyeOff,
  Loader2,
  Printer,
  Save,
} from "lucide-react";
import {
  CATEGORY_LABELS,
  DEFAULT_TERMS,
  GST_QUICK_SLABS,
  type CategorySlug,
} from "@/lib/catalog";
import { computeTotals } from "@/lib/calc";
import { amountToWords, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createDocument, updateDocument } from "@/app/(app)/documents/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Label, Textarea } from "@/components/ui/misc";
import { LineItemsTable } from "./line-items-table";
import { PreviewPane } from "./preview-pane";
import type {
  DocType,
  DocumentDraft,
  EditorLineItem,
} from "@/lib/types";

const DRAFT_KEY = "steelman:new-document-draft";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newItem(category: CategorySlug): EditorLineItem {
  return {
    key:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    category,
    description: "",
    isOther: false,
    qty: "1",
    unit: "PCS",
    rate: "",
  };
}

export function DocumentEditor({
  mode = "create",
  documentId,
  initialDocType = "invoice",
  initialDraft,
  contact,
  descriptions,
}: {
  mode?: "create" | "edit";
  documentId?: string;
  initialDocType?: DocType;
  initialDraft?: DocumentDraft;
  contact: { name: string; email: string; phone: string };
  descriptions?: Record<CategorySlug, string[]>;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [defaultCategory, setDefaultCategory] =
    useState<CategorySlug>("fabrication");
  const [draft, setDraft] = useState<DocumentDraft>(
    () =>
      initialDraft ?? {
        docType: initialDocType,
        docNumber: "(auto)",
        docDate: today(),
        validityOrDueDate: "",
        customerName: "",
        customerGstin: "",
        items: [newItem("fabrication")],
        gstPercent: "",
        terms: DEFAULT_TERMS,
        contact,
      },
  );
  const [showPreview, setShowPreview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const restored = useRef(false);

  // Restore autosaved draft once (create mode only).
  useEffect(() => {
    if (isEdit || restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DocumentDraft;
        if (parsed.items?.length) setDraft((d) => ({ ...d, ...parsed, contact }));
      }
    } catch {
      /* ignore */
    }
  }, [contact, isEdit]);

  // Autosave every 2.5s when the draft changes (create mode only).
  useEffect(() => {
    if (isEdit) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setSavedAt(new Date().toLocaleTimeString());
      } catch {
        /* ignore */
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [draft, isEdit]);

  const patch = useCallback((p: Partial<DocumentDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  const updateItem = useCallback(
    (key: string, p: Partial<EditorLineItem>) => {
      setDraft((d) => ({
        ...d,
        items: d.items.map((i) => (i.key === key ? { ...i, ...p } : i)),
      }));
    },
    [],
  );

  const addItem = useCallback(() => {
    setDraft((d) => ({ ...d, items: [...d.items, newItem(defaultCategory)] }));
  }, [defaultCategory]);

  const duplicateItem = useCallback((key: string) => {
    setDraft((d) => {
      const idx = d.items.findIndex((i) => i.key === key);
      if (idx < 0) return d;
      const clone = { ...d.items[idx], key: newItem(d.items[idx].category).key };
      const items = [...d.items];
      items.splice(idx + 1, 0, clone);
      return { ...d, items };
    });
  }, []);

  const deleteItem = useCallback((key: string) => {
    setDraft((d) => {
      if (d.items.length <= 1) return d;
      const removed = d.items.find((i) => i.key === key);
      const items = d.items.filter((i) => i.key !== key);
      // undo-on-delete snackbar
      toast("Row deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            if (!removed) return;
            setDraft((cur) => ({ ...cur, items: [...cur.items, removed] }));
          },
        },
        duration: 5000,
      });
      return { ...d, items };
    });
  }, []);

  const reorder = useCallback((items: EditorLineItem[]) => {
    setDraft((d) => ({ ...d, items }));
  }, []);

  const totals = computeTotals(
    draft.items.map((i) => ({ qty: Number(i.qty), rate: Number(i.rate) })),
    draft.gstPercent === "" ? null : Number(draft.gstPercent),
  );

  const isInvoice = draft.docType === "invoice";

  async function onSave() {
    setSaving(true);
    const res =
      isEdit && documentId
        ? await updateDocument(documentId, draft)
        : await createDocument(draft);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (!isEdit) localStorage.removeItem(DRAFT_KEY);
    toast.success(isEdit ? "Document updated" : `Saved ${res.docNumber}`);
    router.push(`/documents`);
    router.refresh();
  }

  async function onDownloadPdf() {
    setPdfLoading(true);
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("PDF failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${draft.docNumber || draft.docType}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not generate PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  function onPrint() {
    const encoded =
      typeof window !== "undefined"
        ? btoa(unescape(encodeURIComponent(JSON.stringify(draft))))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "")
        : "";
    const w = window.open(`/print?d=${encoded}`, "_blank");
    if (w) {
      w.addEventListener("load", () => setTimeout(() => w.print(), 400));
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">
            {isEdit
              ? `Edit ${draft.docNumber}`
              : `New ${isInvoice ? "Invoice" : "Quotation"}`}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isEdit
              ? "Changes apply on save · number is preserved"
              : savedAt
                ? `Draft saved · ${savedAt}`
                : "Autosaving…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview((s) => !s)}
          >
            {showPreview ? <EyeOff /> : <Eye />}
            {showPreview ? "Hide" : "Show"} preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onPrint}
            className="gap-1.5"
          >
            <Printer className="size-4" /> Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadPdf}
            disabled={pdfLoading}
            className="gap-1.5"
          >
            {pdfLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            PDF
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving} className="gap-1.5">
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-4",
          showPreview ? "lg:grid-cols-[1fr_minmax(360px,42%)]" : "grid-cols-1",
        )}
      >
        {/* ---------------- Left: form ---------------- */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="space-y-1.5">
                <Label>Document Type</Label>
                <Segmented
                  value={draft.docType}
                  disabled={isEdit}
                  options={[
                    { value: "invoice", label: "Invoice" },
                    { value: "quotation", label: "Quotation" },
                  ]}
                  onChange={(v) => patch({ docType: v as DocType })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Default category for new rows</Label>
                <Segmented
                  value={defaultCategory}
                  options={[
                    { value: "fabrication", label: CATEGORY_LABELS.fabrication },
                    { value: "aluminium", label: CATEGORY_LABELS.aluminium },
                  ]}
                  onChange={(v) => setDefaultCategory(v as CategorySlug)}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={isInvoice ? "Invoice No" : "Quotation No"}>
                <Input value={draft.docNumber} disabled />
              </Field>
              <Field label={isInvoice ? "Invoice Date" : "Date"}>
                <Input
                  type="date"
                  value={draft.docDate}
                  onChange={(e) => patch({ docDate: e.target.value })}
                />
              </Field>
              <Field label={isInvoice ? "Due Date" : "Quotation Validity"}>
                <Input
                  type="date"
                  value={draft.validityOrDueDate}
                  onChange={(e) =>
                    patch({ validityOrDueDate: e.target.value })
                  }
                />
              </Field>
              <Field label="Customer GSTIN">
                <Input
                  value={draft.customerGstin}
                  placeholder="URP if unregistered"
                  onChange={(e) => patch({ customerGstin: e.target.value })}
                />
              </Field>
              <Field
                label={isInvoice ? "Invoice For (Customer)" : "Quotation For (Customer)"}
                className="sm:col-span-2"
              >
                <Input
                  value={draft.customerName}
                  placeholder="Customer / company name"
                  onChange={(e) => patch({ customerName: e.target.value })}
                />
              </Field>
            </div>
          </Card>

          <LineItemsTable
            items={draft.items}
            descriptions={descriptions}
            onChange={updateItem}
            onDelete={deleteItem}
            onDuplicate={duplicateItem}
            onAdd={addItem}
            onReorder={reorder}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <Label>Terms &amp; Conditions</Label>
              <Textarea
                className="mt-1.5"
                rows={4}
                value={draft.terms}
                onChange={(e) => patch({ terms: e.target.value })}
              />
            </Card>

            <Card className="p-4">
              <Label>Totals</Label>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">
                    {formatINR(totals.subtotal)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">GST %</span>
                    <Input
                      type="number"
                      min={0}
                      max={28}
                      step="any"
                      placeholder="—"
                      className="h-8 w-24 text-right"
                      value={draft.gstPercent}
                      onChange={(e) => patch({ gstPercent: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {GST_QUICK_SLABS.map((s) => (
                      <button
                        key={s}
                        onClick={() => patch({ gstPercent: String(s) })}
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-xs transition-colors",
                          Number(draft.gstPercent) === s
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-secondary",
                        )}
                      >
                        {s}%
                      </button>
                    ))}
                  </div>
                </div>
                {draft.gstPercent !== "" && Number(draft.gstPercent) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      GST Amount
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatINR(totals.gstAmount)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-2 text-base">
                  <span className="font-semibold">Grand Total</span>
                  <span className="font-bold tabular-nums text-primary">
                    {formatINR(totals.grandTotal)}
                  </span>
                </div>
                <p className="text-xs italic text-muted-foreground">
                  {amountToWords(totals.grandTotal)}
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* ---------------- Right: live preview ---------------- */}
        {showPreview && (
          <div className="lg:sticky lg:top-20 lg:self-start">
            <Card className="overflow-hidden bg-muted/40 p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Live preview · A4
                </span>
              </div>
              <PreviewPane draft={draft} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-border bg-secondary/50 p-0.5",
        disabled && "opacity-60",
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-200",
            disabled && "cursor-not-allowed",
            value === o.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
