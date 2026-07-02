import { FilePlus2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { SpinnerLink } from "@/components/ui/spinner-link";
import { DocumentsTable } from "@/components/documents/documents-table";
import type { DocumentRecord } from "@/lib/types";

export const metadata = { title: "Documents · Steelman" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("documents")
    .select(
      "id, doc_type, doc_number, customer_name, doc_date, validity_or_due_date, status, grand_total, converted_to, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (data ?? []) as unknown as DocumentRecord[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Documents</h1>
          <p className="text-sm text-muted-foreground">
            All invoices and quotations you can access.
          </p>
        </div>
        <SpinnerLink href="/documents/new" className={cn(buttonVariants({ size: "sm" }), "shrink-0")}>
          <FilePlus2 className="size-4" /> New Document
        </SpinnerLink>
      </div>
      <DocumentsTable rows={rows} />
    </div>
  );
}
