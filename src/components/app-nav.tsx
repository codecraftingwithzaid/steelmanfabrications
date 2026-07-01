"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  FilePlus2,
  LayoutDashboard,
  FileText,
  LogOut,
  Command,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/documents/new", label: "New", icon: FilePlus2 },
];

export function AppNav({
  userName,
  role,
}: {
  userName: string;
  role: "admin" | "staff";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Clear the per-link spinner once the navigation settles.
  useEffect(() => {
    if (!pending) setPendingHref(null);
  }, [pending]);

  function navigate(href: string) {
    if (href === pathname) return;
    setPendingHref(href);
    startTransition(() => router.push(href));
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      {/* top navigation progress bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden">
        {pending && (
          <div className="h-full w-1/3 animate-[nav-progress_1s_ease-in-out_infinite] bg-primary" />
        )}
      </div>

      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-4 md:px-8">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-black text-primary-foreground">
            S
          </span>
          <span className="hidden sm:inline">Steelman</span>
        </Link>

        <nav className="ml-4 flex items-center gap-1">
          {LINKS.map((l) => {
            const active =
              pathname === l.href ||
              (l.href !== "/dashboard" && pathname.startsWith(l.href));
            const isPending = pending && pendingHref === l.href;
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(l.href);
                }}
                aria-busy={isPending}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Icon className="size-4" />
                )}
                <span className="hidden md:inline">{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden gap-2 text-muted-foreground sm:inline-flex"
            onClick={() => setPaletteOpen(true)}
          >
            <Command className="size-3.5" />
            <span className="text-xs">Search</span>
            <kbd className="rounded bg-muted px-1.5 text-[10px]">⌘K</kbd>
          </Button>
          <div className="hidden items-center gap-2 md:flex">
            <span className="text-sm text-muted-foreground">{userName}</span>
            <Badge variant="muted">{role}</Badge>
          </div>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
            <LogOut />
          </Button>
        </div>
      </div>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNavigate={navigate}
      />
    </header>
  );
}
