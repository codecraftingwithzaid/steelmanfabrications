import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except static assets, the print route (rendered by the
  // PDF engine with its own auth token) and Next internals.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|print|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
