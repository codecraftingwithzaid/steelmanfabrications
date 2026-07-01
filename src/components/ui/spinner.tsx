import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({
  className,
}: {
  className?: string;
}) {
  return (
    <Loader2
      className={cn("size-5 animate-spin text-primary", className)}
      aria-hidden
    />
  );
}

/** Centered spinner with an optional label — used for full-route loading. */
export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-8" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
