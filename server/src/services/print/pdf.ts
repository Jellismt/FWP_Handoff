/**
 * @file pdf.ts
 * @module engage-mt/server/services/print
 * @description Renders the print-ready proof HTML to a 5.5in × 8.5in PDF via headless Chromium
 *              (puppeteer-core). Reuses the SAME `renderProofHtml(bookModel)` as the in-browser
 *              proof, so the PDF and the HTML preview are the one source of truth. Chromium is
 *              resolved from PUPPETEER_EXECUTABLE_PATH (the Docker image installs the alpine
 *              `chromium` package there; locally point it at Chrome). If Chromium is absent the
 *              caller gets a clear error and the HTML-proof / ICML paths keep working.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { existsSync } from "node:fs";
import type { BookModel } from "./bookModel.js";
import { renderProofHtml } from "./proofHtml.js";

/** Common Chromium locations — env override first, then the alpine image path, then macOS Chrome. */
function chromiumPath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    "/usr/bin/chromium-browser", // alpine `chromium`
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  return candidates.find((p) => existsSync(p));
}

export class ChromiumUnavailableError extends Error {
  constructor() { super("PDF export needs Chromium — set PUPPETEER_EXECUTABLE_PATH (the Docker image installs it at /usr/bin/chromium-browser)."); this.name = "ChromiumUnavailableError"; }
}

/** Render a season's book model to a 5.5×8.5 PDF buffer. Launches + closes Chromium per call. */
export async function renderBookPdf(book: BookModel): Promise<Buffer> {
  const executablePath = chromiumPath();
  if (!executablePath) throw new ChromiumUnavailableError();

  // Lazy import so `puppeteer-core` is only touched on the PDF path (never at boot).
  const puppeteer = (await import("puppeteer-core")).default;
  const html = renderProofHtml(book);

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
    const footer = `<div style="width:100%;font-size:6pt;color:#888;text-align:center;font-family:Arial;">` +
      `${book.seasonYear} Deer · Elk · Antelope — page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`;
    const pdf = await page.pdf({
      preferCSSPageSize: true, // honour the @page 5.5in 8.5in from the proof CSS
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: footer,
      timeout: 120_000,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
