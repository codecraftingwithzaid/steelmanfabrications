"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightLeft, Pencil, Search, Trash2 } from "lucide-react";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge, Card, Select } from "@/components/ui/misc";
import { Button, buttonVariants } from "@/components/ui/button";
import { SpinnerLink } from "@/components/ui/spinner-link";
import { convertToInvoice, deleteDocument } from "@/app/(app)/documents/actions";
import type { DocumentRecord } from "@/lib/types";

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

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search number or customer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          className="w-40"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">All types</option>
          <option value="invoice">Invoices</option>
          <option value="quotation">Quotations</option>
        </Select>
        <Select
          className="w-40"
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
