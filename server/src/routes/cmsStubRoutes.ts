/**
 * @file cmsStubRoutes.ts
 * @module engage-mt/server/routes
 * @description STUB-035 — the placeholder CMS asset server. Serves a deterministic SVG
 *              map plate per Bloomreach docId so staff can attach + preview region/area
 *              maps before FWP Bloomreach access exists. Replaced transparently once
 *              BLOOMREACH_BASE_URL/CHANNEL are set (pickCmsProvider swaps the client).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { FastifyInstance } from "fastify";
import { placeholderMapSvg } from "../services/cms/provider.js";

export async function cmsStubRoutes(app: FastifyInstance): Promise<void> {
  app.get("/cms-stub/assets/:docId", async (request, reply) => {
    const docId = (request.params as { docId: string }).docId;
    // Defense-in-depth: the docId is escaped in placeholderMapSvg (primary fix),
    // and this response is additionally locked down so that even a crafted SVG
    // navigated to directly cannot execute script — nosniff + a per-response CSP
    // that forbids everything but inline styles and sandboxes the document.
    reply
      .header("Content-Type", "image/svg+xml")
      .header("Cache-Control", "max-age=3600")
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    return reply.send(placeholderMapSvg(docId));
  });
}
