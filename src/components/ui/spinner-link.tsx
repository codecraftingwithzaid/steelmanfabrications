"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A Link that shows a spinner immediately on click and keeps it until the
 * target route finishes rendering (via React transition), so navigation never
 * feels unresponsive.
 */
export function SpinnerLink({
  href,
  className,
  children,
  title,
  replaceContent = false,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
  /** When true, the spinner replaces the content instead of prefixing it. */
  replaceContent?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Link
      href={href}
      title={title}
      aria-busy={pending}
      onClick={(e) => {
        e.preventDefault();
        startTransition(() => router.push(href));
      }}
      className={cn(className, pending && "pointer-events-none opacity-90")}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {!replaceContent && children}
        </>
      ) : (
        children
      )}
    </Link>
  );
}
