import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { COMPANY } from "@/lib/catalog";

export const metadata = { title: "Sign in · Steelman Billing" };

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* subtle industrial steel texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, #000 0 2px, transparent 2px 22px), repeating-linear-gradient(45deg, #000 0 1px, transparent 1px 16px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-2xl font-black text-primary-foreground shadow-lg">
            S
          </div>
          <h1 className="text-xl font-bold leading-tight">{COMPANY.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invoice & Quotation Platform · Indore, MP
          </p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Accounts are provisioned by an administrator.
        </p>
      </div>
    </div>
  );
}
