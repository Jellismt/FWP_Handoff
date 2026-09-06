/**
 * @file healthRoutes.ts
 * @module engage-mt/server/routes
 * @description GET /healthz — DB connectivity probe used as the Railway healthcheck.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { FastifyInstance } from "fastify";
import { query } from "../db/pool.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/healthz", async (_request, reply) => {
    try {
      await query("SELECT 1");
      return reply.send({ status: "ok", db: "up", at: new Date().toISOString() });
    } catch {
      return reply.code(503).send({ status: "degraded", db: "down", at: new Date().toISOString() });
    }
  });
}
