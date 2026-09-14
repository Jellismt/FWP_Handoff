/**
 * @file rbac.ts
 * @module engage-mt/server/auth
 * @description Auth + role preHandlers. `requireAuth` resolves the session cookie to
 *              an identity (401 if absent/expired); `requireRole(min)` enforces the
 *              ordered role rank (403 if below). Staff routes chain both.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import { ROLE_RANK, type StaffRole, fail } from "@engage-mt/regs-shared";
import { SESSION_COOKIE, resolveSession } from "./sessions.js";

/** Resolve the session cookie → request.identity, or 401. */
export const requireAuth: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const raw = request.cookies?.[SESSION_COOKIE];
  if (!raw) {
    await reply.code(401).send(fail([{ code: "UNAUTHORIZED", message: "Sign-in required." }]));
    return reply;
  }
  const identity = await resolveSession(raw);
  if (!identity) {
    await reply.code(401).send(fail([{ code: "UNAUTHORIZED", message: "Session expired." }]));
    return reply;
  }
  request.identity = identity;
  return undefined;
};

/**
 * Block a user who must reset their password from doing anything except
 * change-password/me/logout. Chain AFTER requireAuth on staff DATA routes (not on
 * the auth sub-routes). Returns 403 MUST_RESET so the SPA forces the reset screen.
 */
export const requireNotMustReset: preHandlerHookHandler = async (request, reply) => {
  if (request.identity?.mustReset) {
    await reply
      .code(403)
      .send(fail([{ code: "FORBIDDEN", message: "Password reset required before continuing." }]));
    return reply;
  }
  return undefined;
};

/** Ensure request.identity has at least `min` role. Chain AFTER requireAuth. */
export function requireRole(min: StaffRole): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const role = request.identity?.role;
    if (!role || ROLE_RANK[role] < ROLE_RANK[min]) {
      await reply
        .code(403)
        .send(fail([{ code: "FORBIDDEN", message: `Requires ${min} role or higher.` }]));
      return reply;
    }
    return undefined;
  };
}
