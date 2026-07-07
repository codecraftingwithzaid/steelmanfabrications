import type { Browser } from "puppeteer-core";
import type { Logger } from "@/lib/logger";
import { PdfError } from "./errors";

/**
 * Environment-aware headless-browser provider.
 *
 * Chooses how to obtain a Chromium instance based on the runtime, so the same
 * code works on a developer laptop and on serverless/production hosting without
 * depending on any machine-specific Chrome installation:
 *
 *   - `system-chrome`        → PUPPETEER_EXECUTABLE_PATH (explicit operator
 *                              override; highest priority when set).
 *   - `chromium-serverless`  → @sparticuz/chromium + puppeteer-core
 *                              (production / serverless — no host Chrome needed).
 *   - `puppeteer-local`      → the Chromium bundled with `puppeteer`
 *                              (local development).
 *
 * Providers are attempted in order with graceful fallback, and the selected
 * provider / executable / launch duration are logged for observability.
 */

export type BrowserProvider =
  | "system-chrome"
  | "chromium-serverless"
  | "puppeteer-local";

export interface PdfEnvironment {
  name: "development" | "production" | "serverless";
  isProduction: boolean;
  isServerless: boolean;
}

export interface BrowserHandle {
  browser: Browser;
  provider: BrowserProvider;
  executablePath: string;
  environment: PdfEnvironment["name"];
  launchMs: number;
}

/** Standard flags for launching Chromium reliably in constrained sandboxes. */
const SAFE_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

/** Detects the runtime environment across common hosting platforms. */
export function detectEnvironment(): PdfEnvironment {
  const isServerless =
    process.env.PDF_USE_SERVERLESS_CHROMIUM === "1" ||
    !!process.env.VERCEL ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.LAMBDA_TASK_ROOT ||
    !!process.env.FUNCTION_TARGET; // Google Cloud Functions

  const isProduction = process.env.NODE_ENV === "production";
  const name = isServerless
    ? "serverless"
    : isProduction
      ? "production"
      : "development";

  return { name, isProduction, isServerless };
}

/**
 * Ordered list of providers to attempt for the given environment.
 *
 *   - True serverless (Vercel/Lambda): serverless Chromium only — never depend
 *     on a host Chrome install.
 *   - Local production (`next start` off-platform): serverless Chromium first,
 *     with the bundled `puppeteer` as a cross-platform fallback (the sparticuz
 *     binary is Linux-only) so `npm run build && npm start` works anywhere.
 *   - Development: the bundled `puppeteer` Chromium.
 *
 * An explicit `PUPPETEER_EXECUTABLE_PATH` always takes priority when set.
 */
function providerChain(env: PdfEnvironment): BrowserProvider[] {
  const chain: BrowserProvider[] = [];
  if (process.env.PUPPETEER_EXECUTABLE_PATH) chain.push("system-chrome");

  if (env.isServerless) {
    chain.push("chromium-serverless");
  } else if (env.isProduction) {
    chain.push("chromium-serverless", "puppeteer-local");
  } else {
    chain.push("puppeteer-local");
  }
  return chain;
}

async function launchWith(
  provider: BrowserProvider,
): Promise<{ browser: Browser; executablePath: string }> {
  switch (provider) {
    case "chromium-serverless": {
      const chromium = (await import("@sparticuz/chromium")).default;
      const puppeteer = await import("puppeteer-core");
      const executablePath = await chromium.executablePath();
      if (!executablePath) {
        throw new Error(
          "@sparticuz/chromium resolved an empty executablePath (binary missing from the deployment bundle)",
        );
      }
      const browser = await puppeteer.launch({
        args: chromium.args, // already includes --no-sandbox / --disable-dev-shm-usage
        executablePath,
        headless: true,
      });
      return { browser, executablePath };
    }

    case "system-chrome": {
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH!;
      const puppeteer = await import("puppeteer-core");
      const browser = await puppeteer.launch({
        executablePath,
        args: SAFE_ARGS,
        headless: true,
      });
      return { browser, executablePath };
    }

    case "puppeteer-local":
    default: {
      // Full `puppeteer` is a dev dependency. The specifier is held in a
      // variable so the bundler never traces it into the production build.
      const puppeteerPkg = "puppeteer";
      const puppeteer = (await import(/* webpackIgnore: true */ puppeteerPkg))
        .default;
      const browser = (await puppeteer.launch({
        headless: true,
        args: SAFE_ARGS,
      })) as Browser;
      let executablePath = "(puppeteer-bundled)";
      try {
        executablePath = puppeteer.executablePath?.() ?? executablePath;
      } catch {
        /* best-effort only */
      }
      return { browser, executablePath };
    }
  }
}

/**
 * Resolves and launches a browser for the current environment, trying each
 * candidate provider in order and returning the first that succeeds.
 * Throws a {@link PdfError} (stage `launch`) if every provider fails.
 */
export async function getBrowser(logger: Logger): Promise<BrowserHandle> {
  const environment = detectEnvironment();
  const chain = providerChain(environment);
  logger.info("resolving browser provider", {
    environment: environment.name,
    providerChain: chain,
  });

  let lastError: unknown;
  for (const provider of chain) {
    const start = Date.now();
    try {
      const { browser, executablePath } = await launchWith(provider);
      const launchMs = Date.now() - start;
      logger.info("browser launched", {
        environment: environment.name,
        browserProvider: provider,
        executablePath,
        launchMs,
      });
      return {
        browser,
        provider,
        executablePath,
        environment: environment.name,
        launchMs,
      };
    } catch (error) {
      lastError = error;
      logger.warn("browser provider failed; trying next", {
        provider,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw new PdfError(
    "Failed to launch headless browser (all providers exhausted)",
    "launch",
    lastError,
  );
}
