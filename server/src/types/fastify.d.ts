/**
 * @file fastify.d.ts
 * @module engage-mt/server/types
 * @description Fastify request augmentation — the resolved staff identity is attached
 *              by the auth preHandler so downstream handlers read `request.identity`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { StaffIdentity } from "../auth/provider.js";

declare module "fastify" {
  interface FastifyRequest {
    identity?: StaffIdentity;
  }
}
