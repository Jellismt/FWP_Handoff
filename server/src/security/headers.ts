/**
 * @file headers.ts
 * @module engage-mt/server/security
 * @description The regs-manager security-header contract (API + staff SPA), in one
 *              place so it is auditable and testable without booting the DB-backed
 *              app. Applied as a single onSend hook rather than a helmet dependency
 *              so the exact contract is visible in-repo with zero added supply-chain.
 *
 *              Two headers are set only when a route has not already set its own:
 *              the CSP (the CMS-stub SVG route ships a stricter sandboxed policy)
 *              and X-Frame-Options (the print proof opts into same-origin framing
 *              so the staff console can preview it inline). Both must win over the
 *              defaults here.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-24
 * @updated 2026-07-24
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { FastifyInstance } from "fastify";

// The staff SPA loads only same-origin `/assets/*`, so a tight CSP (`script-src
// 'self'`, no unsafe-inline on scripts) is achievable. CORP is `cross-origin`
// deliberately — the public read API (`/api/v1/fwp/*`) is fetched cross-origin by
// engage-mt-web and the CMS-stub SVG is embedded cross-origin as an <img>;
// `same-origin` would break both.
export const REGS_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

// The print proof is a self-contained document — one inline <style>, no scripts,
// no external references — so its policy is tighter than the global one in every
// respect except `frame-ancestors`, which allows our own origin to preview it.
export const PROOF_CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src 'self' data:",
  "frame-ancestors 'self'",
].join("; ");

export const REGS_SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "no-referrer"],
  [
    "Permissions-Policy",
    "geolocation=(), camera=(), microphone=(), payment=()",
  ],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["Cross-Origin-Resource-Policy", "cross-origin"],
];

/**
 * Security headers on every response (API JSON + staff SPA + static assets) plus
 * off-radar hardening (noindex on non-public routes).
 */
export function registerSecurityHeaders(app: FastifyInstance): void {
  app.addHook("onSend", async (request, reply, payload) => {
    for (const [key, value] of REGS_SECURITY_HEADERS) reply.header(key, value);
    if (!reply.hasHeader("content-security-policy")) {
      reply.header("Content-Security-Policy", REGS_CSP);
    }
    if (!reply.hasHeader("x-frame-options")) {
      reply.header("X-Frame-Options", "DENY");
    }
    if (!request.url.startsWith("/api/v1/fwp/")) {
      reply.header("X-Robots-Tag", "noindex, nofollow");
    }
    return payload;
  });
}
