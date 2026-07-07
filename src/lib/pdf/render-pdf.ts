import type { DocumentDraft } from "@/lib/types";
import type { Logger } from "@/lib/logger";
import { getBrowser, detectEnvironment } from "./browser-provider";
import { PdfError } from "./errors";

/**
 * PDF rendering service.
 *
 * Renders the shared `/print` template (the same React component that powers
 * the on-screen preview) to a single-page A4 PDF using headless Chromium, and
 * returns it as an in-memory Buffer — no files are ever written to disk.
 *
 * Browser provisioning is delegated to the environment-aware
 * {@link getBrowser} provider, so this service stays focused on the render
 * pipeline. It is stateless, launches an isolated browser per invocation
 * (safe under concurrency / horizontal scaling), and always closes the browser
 * in a `finally` block to avoid orphaned processes and memory leaks.
 */

export { PdfError } from "./errors";
export type { PdfStage } from "./errors";
export { detectEnvironment } from "./browser-provider";

/** Backwards-compatible helper retained for callers/tests. */
export function isServerlessRuntime(): boolean {
  return detectEnvironment().isServerless;
}

export interface RenderOptions {
  /** Absolute origin used to load the `/print` template (no trailing slash). */
  baseUrl: string;
  logger: Logger;
  /** Vercel deployment-protection bypass secret, if the deployment is guarded. */
  bypassSecret?: string;
  navigateTimeoutMs?: number;
  fitTimeoutMs?: number;
}

export interface RenderResult {
  buffer: Buffer;
  bytes: number;
  /** Whether the shrink-to-fit density settled (single-page guaranteed). */
  fitted: boolean;
  /** Which browser provider produced the PDF (for diagnostics). */
  browserProvider: string;
  durationsMs: {
    launch: number;
    navigate: number;
    fit: number;
    render: number;
    total: number;
  };
}

export async function renderDocumentPdf(
  draft: DocumentDraft,
  opts: RenderOptions,
): Promise<RenderResult> {
  const { baseUrl, logger } = opts;
  const navigateTimeoutMs = opts.navigateTimeoutMs ?? 30_000;
  const fitTimeoutMs = opts.fitTimeoutMs ?? 10_000;

  const encoded = Buffer.from(JSON.stringify(draft), "utf8").toString(
    "base64url",
  );
  const printUrl = `${baseUrl}/print?d=${encoded}`;

  const t0 = Date.now();
  const handle = await getBrowser(logger); // throws PdfError("launch") on failure
  const { browser, provider, launchMs } = handle;
  const tLaunch = Date.now();

  try {
    const page = await browser.newPage();

    // Support protected (SSO/password) deployments so the browser can fetch
    // the same app's /print route without hitting an auth wall.
    if (opts.bypassSecret) {
      await page.setExtraHTTPHeaders({
        "x-vercel-protection-bypass": opts.bypassSecret,
        "x-vercel-set-bypass-cookie": "true",
      });
    }

    try {
      await page.goto(printUrl, {
        waitUntil: "networkidle0",
        timeout: navigateTimeoutMs,
      });
    } catch (e) {
      throw new PdfError("Failed to load the print template", "navigate", e);
    }
    const tNavigate = Date.now();

    // Wait until the client-side shrink-to-fit density has settled.
    let fitted = true;
    try {
      await page.waitForSelector('[data-doc-page][data-ready="1"]', {
        timeout: fitTimeoutMs,
      });
    } catch {
      fitted = false;
      logger.warn("shrink-to-fit did not signal ready; rendering anyway");
    }
    const tFit = Date.now();

    let pdf: Uint8Array;
    try {
      pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
    } catch (e) {
      throw new PdfError("Failed to render the PDF", "render", e);
    }
    const tRender = Date.now();

    const buffer = Buffer.from(pdf);
    const durationsMs = {
      launch: launchMs,
      navigate: tNavigate - tLaunch,
      fit: tFit - tNavigate,
      render: tRender - tFit,
      total: tRender - t0,
    };
    logger.info("pdf rendered", {
      bytes: buffer.length,
      fitted,
      browserProvider: provider,
      durationsMs,
    });

    return {
      buffer,
      bytes: buffer.length,
      fitted,
      browserProvider: provider,
      durationsMs,
    };
  } finally {
    // Always release the browser to avoid orphaned processes / memory leaks.
    try {
      await browser.close();
    } catch (e) {
      logger.warn("failed to close browser", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
