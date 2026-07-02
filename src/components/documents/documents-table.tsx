"use client";

import { useMemo, useState, useTransition, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  CircleDot,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge, Card, Select } from "@/components/ui/misc";
import { Button, buttonVariants } from "@/components/ui/button";
import { SpinnerLink } from "@/components/ui/spinner-link";
import {
  convertToInvoice,
  deleteDocument,
  updateDocumentStatus,
} from "@/app/(app)/documents/actions";
import {
  STATUSES_BY_TYPE,
  STATUS_LABELS,
  type DocumentRecord,
  type DocumentStatus,
} from "@/lib/types";

const STATUS_VARIANT: Record<
  string,
  "default" | "muted" | "success" | "warning" | "destructive"
> = {
  draft: "muted",
  sent: "default",
  paid: "success",
  accepted: "success",
  overdue: "destructive",
  rejected: "destructive",
  expired: "warning",
};

export function DocumentsTable({ rows }: { rows: DocumentRecord[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return rows.filter((r) => {
      if (type !== "all" && r.doc_type !== type) return false;
      if (status !== "all" && r.status !== status) return false;
      if (
        q &&
        !r.doc_number.toLowerCase().includes(q) &&
        !(r.customer_name || "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [rows, query, type, status]);

  function convert(id: string) {
    startTransition(async () => {
      const res = await convertToInvoice(id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Created ${res.docNumber}`);
        router.refresh();
      }
    });
  }

  function remove(doc: DocumentRecord) {
    const ok = window.confirm(
      `Delete ${doc.doc_number}? This permanently removes the document and its items. This cannot be undone.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteDocument(doc.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Deleted ${doc.doc_number}`);
        router.refresh();
      }
    });
  }

  function changeStatus(doc: DocumentRecord, status: DocumentStatus) {
    if (status === doc.status) return;
    startTransition(async () => {
      const res = await updateDocumentStatus(doc.id, status);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${doc.doc_number} marked ${status}`);
        router.refresh();
      }
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search number or customer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          className="flex-1 sm:w-40 sm:flex-none"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">All types</option>
          <option value="invoice">Invoices</option>
          <option value="quotation">Quotations</option>
        </Select>
        <Select
          className="flex-1 sm:w-40 sm:flex-none"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="overdue">Overdue</option>
          <option value="expired">Expired</option>
        </Select>
      </div>

      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2 text-left">Number</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-12 text-center text-muted-foreground"
                >
                  No documents match your filters.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border/70 last:border-0 hover:bg-secondary/30"
              >
                <td className="px-3 py-2 font-medium">{r.doc_number}</td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "capitalize",
                      r.doc_type === "invoice"
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {r.doc_type}
                  </span>
                </td>
                <td className="px-3 py-2">{r.customer_name || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.doc_date}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatINR(Number(r.grand_total))}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={STATUS_VARIANT[r.status] || "muted"}>
                    {r.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    {r.doc_type === "quotation" && !r.converted_to && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => convert(r.id)}
                        className="gap-1.5 text-xs"
                        title="Convert to Invoice"
                      >
                        <ArrowRightLeft className="size-3.5" /> To Invoice
                      </Button>
                    )}
                    <StatusMenu
                      doc={r}
                      disabled={pending}
                      onSelect={(s) => changeStatus(r, s)}
                    />
                    <SpinnerLink
                      href={`/documents/${r.id}/edit`}
                      replaceContent
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon" }),
                        "size-8",
                      )}
                      title="Edit"
                    >
                      <Pencil className="size-3.5" />
                    </SpinnerLink>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      disabled={pending}
                      onClick={() => remove(r)}
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * A normal icon button that opens a dropdown of all valid statuses for the
 * document type. The menu is rendered in a portal (fixed-positioned under the
 * button) so it is never clipped by the table's horizontal-scroll container.
 * Clicking an option updates the status immediately.
 */
function StatusMenu({
  doc,
  disabled,
  onSelect,
}: {
  doc: DocumentRecord;
  disabled?: boolean;
  onSelect: (status: DocumentStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(
    null,
  );
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const options = STATUSES_BY_TYPE[doc.doc_type] ?? [];

  function place() {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }

  function toggle() {
    if (!open) place();
    setOpen((o) => !o);
  }

  useLayoutEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        !btnRef.current?.contains(t) &&
        !menuRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onReflow() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  return (
    <>
      <Button
        ref={btnRef}
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Update status"
      >
        <CircleDot className="size-3.5" />
      </Button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: "fixed", top: coords.top, right: coords.right }}
            className="z-50 min-w-[9rem] overflow-hidden rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
          >
            <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Set status
            </div>
            {options.map((s) => {
              const active = s === doc.status;
              return (
                <button
                  key={s}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    setOpen(false);
                    onSelect(s);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-sm transition-colors hover:bg-secondary",
                    active
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {STATUS_LABELS[s]}
                  {active && <CircleDot className="size-3 text-primary" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
