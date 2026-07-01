import { NextRequest, NextResponse } from "next/server";
import type { DocumentDraft } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Renders the shared /print template to a pixel-identical single-page A4 PDF
 * using headless Chromium. The same React component powers the on-screen
 * preview, so downloads are WYSIWYG.
 *
 * Local/dev: uses the Chromium bundled with `puppeteer`.
 * Serverless (Vercel): set PDF_USE_SERVERLESS_CHROMIUM=1 and install
 * `@sparticuz/chromium` + `puppeteer-core` (see README).
 */
export async function POST(req: NextRequest) {
  let draft: DocumentDraft;
  try {
    draft = (await req.json()) as DocumentDraft;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    req.nextUrl.origin ??
    "http://localhost:3000";

  const encoded = Buffer.from(JSON.stringify(draft), "utf8").toString(
    "base64url",
  );
  const printUrl = `${baseUrl}/print?d=${encoded}`;

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 30000 });
    // Wait until shrink-to-fit density has settled.
    await page
      .waitForSelector('[data-doc-page][data-ready="1"]', { timeout: 10000 })
      .catch(() => {
        /* proceed even if it didn't flag ready */
      });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    const fileName = `${draft.docNumber || draft.docType}.pdf`;
    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error("PDF generation failed:", err);
    return NextResponse.json(
      { error: "PDF generation failed" },
      { status: 500 },
    );
  } finally {
    await browser?.close();
  }
}

async function launchBrowser() {
  if (process.env.PDF_USE_SERVERLESS_CHROMIUM === "1") {
    // Serverless path (Vercel). Requires @sparticuz/chromium + puppeteer-core.
    // Specifiers are held in variables so the bundler doesn't try to resolve
    // these optional deps at build time when they aren't installed.
    const chromiumPkg = "@sparticuz/chromium";
    const puppeteerCorePkg = "puppeteer-core";
    const chromium = (await import(/* webpackIgnore: true */ chromiumPkg)).default;
    const puppeteerCore = await import(/* webpackIgnore: true */ puppeteerCorePkg);
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}
