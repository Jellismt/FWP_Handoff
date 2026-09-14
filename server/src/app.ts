/**
 * @file app.ts
 * @module engage-mt/server
 * @description Fastify app factory: plugins (cookie, CORS for public GET only,
 *              rate-limit), route groups (health, public read, staff auth + CRUD),
 *              staff SPA static serving with SPA fallback, and off-radar hardening
 *              (X-Robots-Tag noindex on non-public routes, robots.txt, optional staff
 *              IP allowlist). buildApp is pure so tests can boot it without listening.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import Fastify, { type FastifyInstance, type FastifyError } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { loadConfig } from "./config.js";
import { fail } from "@engage-mt/regs-shared";
import { healthRoutes } from "./routes/healthRoutes.js";
import { publicRoutes } from "./routes/publicRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { staffRoutes } from "./routes/staffRoutes.js";
import { staffCrudRoutes } from "./routes/staffCrudRoutes.js";
import { staffContentRoutes } from "./routes/staffContentRoutes.js";
import { publicV2Routes } from "./routes/publicV2Routes.js";
import { cmsStubRoutes } from "./routes/cmsStubRoutes.js";
import { printRoutes } from "./routes/printRoutes.js";
import { auditLogRoutes } from "./routes/auditLogRoutes.js";
import { registerSecurityHeaders } from "./security/headers.js";
import { registerStaffIpAllowlist } from "./security/ipAllowlist.js";
import { sessionPurge } from "./auth/sessionPurge.js";

const HERE = dirname(fileURLToPath(import.meta.url));

export async function buildApp(): Promise<FastifyInstance> {
  const cfg = loadConfig();
  const app = Fastify({
    logger:
      cfg.NODE_ENV === "test"
        ? false
        : { level: cfg.NODE_ENV === "production" ? "info" : "debug" },
    trustProxy: true, // Railway sits behind a proxy; needed for correct request.ip
  });

  await app.register(cookie, { secret: cfg.SESSION_SECRET });
  // Rate limits are effectively disabled under test (the suite logs in many times from
  // one IP); production keeps the real 60/min global + 5/min login limits.
  const isTest = cfg.NODE_ENV === "test";
  await app.register(rateLimit, {
    max: isTest ? 100_000 : 60,
    timeWindow: "1 minute",
  });

  // CORS: public read API only (GET/HEAD/OPTIONS). Staff is same-origin → no CORS.
  await app.register(cors, {
    origin: cfg.PUBLIC_CORS_ORIGINS,
    methods: ["GET", "HEAD", "OPTIONS"],
    allowedHeaders: ["Content-Type", "If-None-Match", "If-Modified-Since"],
    maxAge: 86400,
  });

  // Security headers on every response — see src/security/headers.ts for the
  // full contract and the two documented per-route escape hatches.
  registerSecurityHeaders(app);
  registerStaffIpAllowlist(app, cfg.STAFF_IP_ALLOWLIST);
  await app.register(sessionPurge);

  app.get("/robots.txt", async (_req, reply) => {
    reply.type("text/plain");
    return "User-agent: *\nDisallow: /\n";
  });

  // Global backstop so an uncaught throw never leaks internal detail to a client.
  // Route handlers that catch-and-return their own envelope (the norm here) are
  // unaffected; this only fires on THROWN errors (zod validation 400, rate-limit
  // 429, unexpected 500). 5xx are logged in full server-side and returned generic;
  // 4xx messages describe the client's own request, so they're safe to relay.
  app.setErrorHandler((err: FastifyError, request, reply) => {
    const status = typeof err.statusCode === "number" ? err.statusCode : 500;
    if (status >= 500) {
      request.log.error({ err }, "unhandled server error");
      return reply
        .code(500)
        .send(
          fail([
            { code: "INTERNAL", message: "An unexpected error occurred." },
          ]),
        );
    }
    request.log.info(
      { statusCode: status, message: err.message },
      "client error",
    );
    const code =
      status === 429
        ? "RATE_LIMITED"
        : status === 401
          ? "UNAUTHORIZED"
          : status === 403
            ? "FORBIDDEN"
            : status === 404
              ? "NOT_FOUND"
              : "INVALID_PARAM";
    return reply
      .code(status)
      .send(
        fail([
          { code, message: err.message || "Request could not be processed." },
        ]),
      );
  });

  // Route groups.
  await app.register(healthRoutes, { prefix: "/api/v1" });
  await app.register(publicRoutes, { prefix: "/api/v1/fwp" });
  await app.register(authRoutes, { prefix: "/api/v1/staff/auth" });
  await app.register(staffRoutes, { prefix: "/api/v1/staff" });
  await app.register(staffCrudRoutes, { prefix: "/api/v1/staff" });
  await app.register(staffContentRoutes, { prefix: "/api/v1/staff" });
  await app.register(printRoutes, { prefix: "/api/v1/staff" });
  await app.register(auditLogRoutes, { prefix: "/api/v1/staff" });
  await app.register(publicV2Routes, { prefix: "/api/v2/fwp" });
  await app.register(cmsStubRoutes, { prefix: "/api/v1" });

  // Staff SPA static + SPA fallback (only when the build exists).
  const staffDist = resolve(HERE, cfg.STAFF_DIST_DIR);
  if (existsSync(staffDist)) {
    await app.register(fastifyStatic, { root: staffDist, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply
          .code(404)
          .send(fail([{ code: "NOT_FOUND", message: "Unknown endpoint." }]));
      }
      return reply.sendFile("index.html", staffDist);
    });
  } else {
    app.setNotFoundHandler((_request, reply) =>
      reply
        .code(404)
        .send(
          fail([
            { code: "NOT_FOUND", message: "Not found (staff SPA not built)." },
          ]),
        ),
    );
  }

  return app;
}

/** Path helper for tests that need the migrations dir etc. */
export const serverRoot = join(HERE, "..");
