import Link from "next/link";
import {
  AlertTriangle,
  CircleDollarSign,
  FileText,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/format";
import { Badge, Card } from "@/components/ui/misc";
import { buttonVariants } from "@/components/ui/button";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import type { CategorySlug } from "@/lib/catalog";

export const metadata = { title: "Dashboard · Steelman" };
export const dynamic = "force-dynamic";

function monthKey(d: string) {
  return d?.slice(0, 7) || "";
}

export default async function DashboardPage() {
  const supabase = createClient();

  const [{ data: docs }, { data: payments }, { data: items }] =
    await Promise.all([
      supabase
        .from("documents")
        .select(
          "id, doc_number, doc_type, doc_date, status, grand_total, customer_name, validity_or_due_date, converted_to",
        )
        .order("created_at", { ascending: false }),
      supabase.from("payments").select("amount"),
      supabase.from("document_items").select("document_id, category, total"),
    ]);

  const allDocs = docs ?? [];
  const invoices = allDocs.filter((d) => d.doc_type === "invoice");
  const quotations = allDocs.filter((d) => d.doc_type === "quotation");

  const totalInvoiced = invoices.reduce(
    (s, d) => s + Number(d.grand_total || 0),
    0,
  );
  const totalCollected = (payments ?? []).reduce(
    (s, p) => s + Number(p.amount || 0),
    0,
  );
  const outstanding = Math.max(0, totalInvoiced - totalCollected);

  const converted = quotations.filter((q) => q.converted_to).length;
  const conversionRate = quotations.length
    ? Math.round((converted / quotations.length) * 100)
    : 0;

  // Category split per document (fabrication vs aluminium)
  const invoiceIds = new Set(invoices.map((d) => d.id));
  const catByDoc = new Map<string, Record<CategorySlug, number>>();
  for (const it of items ?? []) {
    if (!invoiceIds.has(it.document_id)) continue;
    const cur = catByDoc.get(it.document_id) ?? {
      fabrication: 0,
      aluminium: 0,
    };
    cur[(it.category as CategorySlug) ?? "fabrication"] += Number(it.total || 0);
    catByDoc.set(it.document_id, cur);
  }

  // Monthly revenue split
  const monthly = new Map<string, { fabrication: number; aluminium: number }>();
  for (const inv of invoices) {
    const key = monthKey(inv.doc_date);
    if (!key) continue;
    const bucket = monthly.get(key) ?? { fabrication: 0, aluminium: 0 };
    const split = catByDoc.get(inv.id);
    if (split) {
      bucket.fabrication += split.fabrication;
      bucket.aluminium += split.aluminium;
    } else {
      bucket.fabrication += Number(inv.grand_total || 0);
    }
    monthly.set(key, bucket);
  }
  const chartData = Array.from(monthly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([month, v]) => ({
      month,
      Fabrication: Math.round(v.fabrication),
      Aluminium: Math.round(v.aluminium),
    }));

  // Top customers
  const custMap = new Map<string, number>();
  for (const inv of invoices) {
    const name = inv.customer_name || "Unknown";
    custMap.set(name, (custMap.get(name) ?? 0) + Number(inv.grand_total || 0));
  }
  const topCustomers = Array.from(custMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Overdue invoices
  const todayStr = new Date().toISOString().slice(0, 10);
  const overdue = invoices.filter(
    (d) =>
      d.status === "overdue" ||
      (d.status !== "paid" &&
        d.validity_or_due_date &&
        d.validity_or_due_date < todayStr),
  );

  const recent = allDocs.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Revenue overview and recent activity.
          </p>
        </div>
        <Link href="/documents/new" className={buttonVariants({ size: "sm" })}>
          New Document
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={CircleDollarSign}
          label="Total Invoiced"
          value={formatINR(totalInvoiced)}
        />
        <Kpi
          icon={Wallet}
          label="Collected"
          value={formatINR(totalCollected)}
          tone="success"
        />
        <Kpi
          icon={AlertTriangle}
          label="Outstanding"
          value={formatINR(outstanding)}
          tone="warning"
        />
        <Kpi
          icon={TrendingUp}
          label="Quotation Conversion"
          value={`${conversionRate}%`}
          sub={`${converted}/${quotations.length} converted`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">
            Monthly revenue · Fabrication vs Aluminium
          </h2>
          {chartData.length ? (
            <RevenueChart data={chartData} />
          ) : (
            <EmptyBlock text="No invoice revenue yet." />
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Top customers</h2>
          {topCustomers.length ? (
            <ul className="space-y-2">
              {topCustomers.map(([name, total]) => (
                <li
                  key={name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate">{name}</span>
                  <span className="tabular-nums font-medium">
                    {formatINR(total)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyBlock text="No customers yet." />
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Recent documents</h2>
          {recent.length ? (
            <ul className="divide-y divide-border">
              {recent.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="font-medium">{d.doc_number ?? "—"}</span>
                    <span className="text-muted-foreground">
                      {d.customer_name || "—"}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums">
                      {formatINR(Number(d.grand_total || 0))}
                    </span>
                    <Badge variant="muted">{d.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyBlock text="No documents yet — create your first one." />
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 text-amber-500" /> Overdue invoices
          </h2>
          {overdue.length ? (
            <ul className="space-y-2">
              {overdue.slice(0, 6).map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium">{d.doc_number}</span>
                  <span className="text-muted-foreground">
                    due {d.validity_or_due_date}
                  </span>
                  <span className="tabular-nums">
                    {formatINR(Number(d.grand_total || 0))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyBlock text="Nothing overdue. 🎉" />
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-500"
      : tone === "warning"
        ? "text-amber-500"
        : "text-primary";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <Icon className={`size-4 ${toneClass}`} />
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
      {text}
    </div>
  );
}
