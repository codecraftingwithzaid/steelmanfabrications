"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, FileText, LayoutDashboard, Search } from "lucide-react";

interface Action {
  label: string;
  hint?: string;
  run: () => void;
  icon: React.ComponentType<{ className?: string }>;
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const actions: Action[] = useMemo(
    () => [
      {
        label: "New Invoice",
        hint: "Create",
        icon: FilePlus2,
        run: () => router.push("/documents/new?type=invoice"),
      },
      {
        label: "New Quotation",
        hint: "Create",
        icon: FilePlus2,
        run: () => router.push("/documents/new?type=quotation"),
      },
      {
        label: "Dashboard",
        hint: "Go to",
        icon: LayoutDashboard,
        run: () => router.push("/dashboard"),
      },
      {
        label: "All Documents",
        hint: "Go to",
        icon: FileText,
        run: () => router.push("/documents"),
      },
    ],
    [router],
  );

  const filtered = actions.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh] backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actions, customers, documents…"
            className="h-12 w-full bg-transparent text-sm outline-none"
          />
          <kbd className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>
        <ul className="max-h-72 overflow-auto p-2">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matching actions
            </li>
          )}
          {filtered.map((a) => {
            const Icon = a.icon;
            return (
              <li key={a.label}>
                <button
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-secondary"
                  onClick={() => {
                    a.run();
                    onOpenChange(false);
                  }}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="flex-1">{a.label}</span>
                  {a.hint && (
                    <span className="text-xs text-muted-foreground">
                      {a.hint}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
