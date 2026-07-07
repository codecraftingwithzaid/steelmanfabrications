import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createLogger } from "@/lib/logger";
import { pdfFileName } from "@/lib/format";
import {
  documentDraftSchema,
  toDocumentDraft,
} from "@/lib/pdf/document-draft.schema";
import {
  renderDocumentPdf,
  isServerlessRuntime,
  PdfError,
} from "@/lib/pdf/render-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/pdf
 *
 * Generates a single-page A4 PDF from a document draft and streams it back
 * in-memory (no disk writes). The heavy lifting lives in the PDF render
 * service; this handler is a thin controller responsible for correlation,
 * validation, response shaping, and sanitized error handling.
 */
export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? randomUUID();
  const log = createLogger({ requestId, route: "POST /api/pdf" });
  const startedAt = Date.now();

  log.info("pdf request received", { serverless: isServerlessRuntime() });

  // 1) Parse body ----------------------------------------------------------
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    log.warn("request body was not valid JSON");
    return errorResponse("Invalid request body.", 400, requestId);
  }

  // 2) Validate payload ----------------------------------------------------
  const parsed = documentDraftSchema.safeParse(raw);
  if (!parsed.success) {
    log.warn("payload validation failed", {
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join(".") || "(root)",
        code: i.code,
      })),
    });
    return errorResponse(
      "The document data is invalid and could not be rendered.",
      422,
      requestId,
    );
  }

  const draft = toDocumentDraft(parsed.data);
  log.info("payload validated", {
    docType: draft.docType,
    docNumber: draft.docNumber || "(unassigned)",
    itemCount: draft.items.length,
  });

  // 3) Render --------------------------------------------------------------
  const baseUrl = resolveBaseUrl(req);
  log.info("resolved print origin", { baseUrl });

  try {
    const { buffer, bytes, fitted, durationsMs } = await renderDocumentPdf(
      draft,
      {
        baseUrl,
        logger: log,
        bypassSecret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET || undefined,
      },
    );

    if (!fitted) {
      log.warn("document may not have fit a single page (proceeding)");
    }

    const fileName = `${pdfFileName(draft)}.pdf`;
    log.info("streaming pdf response", {
      bytes,
      totalMs: Date.now() - startedAt,
      durationsMs,
    });

    // 4) Stream the in-memory buffer to the client ------------------------
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(fileName),
        "Content-Length": String(bytes),
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    });
  } catch (err) {
    const stage = err instanceof PdfError ? err.stage : "unknown";
    const cause =
      err instanceof PdfError && err.cause instanceof Error
        ? err.cause
        : err instanceof Error
          ? err
          : undefined;
    // Full detail server-side only — never returned to the client.
    log.error("pdf generation failed", {
      stage,
      message: err instanceof Error ? err.message : String(err),
      causeMessage: cause?.message,
      stack: cause?.stack,
      totalMs: Date.now() - startedAt,
    });
    return errorResponse(
      "Unable to generate PDF. Please try again.",
      500,
      requestId,
      stage,
    );
  }
}

/**
 * Sanitized JSON error carrying the correlation id (and a coarse, non-sensitive
 * stage label) for support/debugging. No stack traces or internal messages are
 * ever exposed to the client.
 */
function errorResponse(
  message: string,
  status: number,
  requestId: string,
  stage?: string,
) {
  return NextResponse.json(
    { error: message, requestId, ...(stage ? { stage } : {}) },
    { status, headers: { "X-Request-Id": requestId } },
  );
}

/**
 * Builds a robust `Content-Disposition` value: an ASCII-safe fallback plus an
 * RFC 5987 UTF-8 encoding so names with spaces/unicode download correctly on
 * Chrome, Edge, and mobile browsers.
 */
function contentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  const encoded = encodeURIComponent(fileName);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * Resolves the origin used to fetch the `/print` template.
 *
 * Priority:
 *   1. An explicit, valid, NEXT_PUBLIC_APP_URL — but a localhost value is
 *      ignored outside development (a common production misconfiguration that
 *      makes the server fetch localhost and fail at the navigate stage).
 *   2. VERCEL_URL (platform-provided public origin).
 *   3. The incoming request's own origin — always correct for the deployment.
 */
function resolveBaseUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const isDevelopment = process.env.NODE_ENV !== "production";
  const isLocalhost = (u: string) => /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(u);

  if (
    env &&
    /^https?:\/\//i.test(env) &&
    (isDevelopment || !isLocalhost(env))
  ) {
    return env.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return req.nextUrl.origin;
}
