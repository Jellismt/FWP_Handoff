/**
 * @file printRoutes.ts
 * @module engage-mt/server/routes
 * @description Print-export endpoints (staff): a one-click server-rendered PDF (headless
 *              Chromium), an instant HTML proof (browser Print → PDF), and the ICML story
 *              package (zip) the print designer flows into the InDesign template. All three
 *              render the same 5.5×8.5 book model for a season year.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-07
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { FastifyInstance } from "fastify";
import { requireAuth, requireNotMustReset } from "../auth/rbac.js";
import { buildBookModel } from "../services/print/bookModel.js";
import { renderProofHtml } from "../services/print/proofHtml.js";
import { buildIcmlPackage } from "../services/print/icml.js";
import { buildZip } from "../services/print/zip.js";
import {
  renderBookPdf,
  ChromiumUnavailableError,
} from "../services/print/pdf.js";
import { PROOF_CSP } from "../security/headers.js";

export async function printRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireNotMustReset);

  // The staff console previews this inline in a same-origin <iframe> (PrintScreen),
  // so it opts out of the app-wide `frame-ancestors 'none'` / `X-Frame-Options: DENY`.
  // Framing is still restricted to our own origin. The proof is a self-contained
  // document — one inline <style>, no scripts, no external refs — so its CSP is
  // tighter than the global one everywhere else.
  app.get("/season-years/:year/print/proof.html", async (request, reply) => {
    const year = Number((request.params as { year: string }).year);
    const book = await buildBookModel(year);
    reply
      .header("Content-Type", "text/html; charset=utf-8")
      .header("X-Frame-Options", "SAMEORIGIN")
      .header("Content-Security-Policy", PROOF_CSP);
    return reply.send(renderProofHtml(book));
  });

  app.get("/season-years/:year/print/icml.zip", async (request, reply) => {
    const year = Number((request.params as { year: string }).year);
    const book = await buildBookModel(year);
    const pkg = buildIcmlPackage(book);
    const zip = buildZip(pkg.entries);
    reply
      .header("Content-Type", "application/zip")
      .header(
        "Content-Disposition",
        `attachment; filename="dea-regs-${year}-icml.zip"`,
      );
    return reply.send(zip);
  });

  // One-click PDF (headless Chromium renders the same proof HTML at 5.5×8.5).
  app.get("/season-years/:year/print/book.pdf", async (request, reply) => {
    const year = Number((request.params as { year: string }).year);
    const book = await buildBookModel(year);
    try {
      const pdf = await renderBookPdf(book);
      reply
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="dea-regs-${year}.pdf"`,
        );
      return reply.send(pdf);
    } catch (err) {
      if (err instanceof ChromiumUnavailableError) {
        return reply.code(503).send({ ok: false, error: err.message });
      }
      request.log.error({ err }, "PDF render failed");
      return reply.code(500).send({ ok: false, error: "PDF render failed" });
    }
  });
}
