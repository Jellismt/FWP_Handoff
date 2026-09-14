/**
 * @file printRoutes.framing.test.ts
 * @module engage-mt/server/routes
 * @description Tripwire for the print-proof framing regression:
 *              the staff console previews the proof inline in a same-origin
 *              <iframe>, but the app-wide `frame-ancestors 'none'` +
 *              `X-Frame-Options: DENY` blocked it, so the preview rendered blank
 *              while the PDF download (never framed) worked.
 *
 *              The runtime half exercises the real hook from src/security/headers.ts
 *              on a bare Fastify instance. It deliberately does NOT import app.ts:
 *              vitest here runs single-fork with `isolate: false`, so pulling in the
 *              app's db/pool.js would defeat the `vi.mock` other suites rely on.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-24
 * @updated 2026-07-24
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { registerSecurityHeaders, PROOF_CSP } from "../security/headers.js";

const here = dirname(fileURLToPath(import.meta.url));
const printSrc = readFileSync(join(here, "printRoutes.ts"), "utf8");
const headersSrc = readFileSync(
  join(here, "..", "security", "headers.ts"),
  "utf8",
);

describe("print proof framing", () => {
  it("the proof route opts into same-origin framing", () => {
    expect(printSrc).toContain('"X-Frame-Options", "SAMEORIGIN"');
    expect(printSrc).toContain("PROOF_CSP");
  });

  it("the proof policy allows framing by our own origin only", () => {
    expect(PROOF_CSP).toContain("frame-ancestors 'self'");
    expect(PROOF_CSP).not.toContain("frame-ancestors 'none'");
  });

  it("the proof CSP stays tighter than the global one (self-contained document)", () => {
    // No scripts, no external refs — only the inline <style> the renderer emits.
    expect(PROOF_CSP).toContain("default-src 'none'");
    expect(PROOF_CSP).not.toContain("script-src");
  });

  it("the app-wide X-Frame-Options does not clobber a route's own value", () => {
    // The bug: the onSend hook set X-Frame-Options unconditionally, overwriting
    // whatever the route had set. It must be guarded like the CSP above it.
    expect(headersSrc).toContain('if (!reply.hasHeader("x-frame-options"))');
    expect(headersSrc).not.toMatch(
      /REGS_SECURITY_HEADERS[\s\S]*?\["X-Frame-Options", "DENY"\]/,
    );
  });
});

describe("print proof framing (runtime)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    registerSecurityHeaders(app);
    // Stands in for the proof route: sets the same two headers, minus the DB.
    app.get("/proof-like", async (_req, reply) => {
      reply
        .header("X-Frame-Options", "SAMEORIGIN")
        .header("Content-Security-Policy", PROOF_CSP);
      return reply.send("<!doctype html><p>proof</p>");
    });
    app.get("/ordinary", async (_req, reply) => reply.send("ok"));
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("a route's own X-Frame-Options and CSP survive the onSend hook", async () => {
    const res = await app.inject({ method: "GET", url: "/proof-like" });
    expect(res.statusCode).toBe(200);
    // Pre-fix this came back DENY — the hook overwrote it and blanked the iframe.
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["content-security-policy"]).toContain(
      "frame-ancestors 'self'",
    );
  });

  it("every other route still gets DENY and the global CSP", async () => {
    const res = await app.inject({ method: "GET", url: "/ordinary" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
  });

  it("the rest of the header contract is still applied", async () => {
    const res = await app.inject({ method: "GET", url: "/ordinary" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
  });
});
