/**
 * @file authRoutes.ts
 * @module engage-mt/server/routes
 * @description Staff auth routes: POST login (rate-limited), POST logout, GET me.
 *              Sets/clears the session cookie; never returns the password hash.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { verify, hash } from "@node-rs/argon2";
import { ok, fail, changePasswordSchema } from "@engage-mt/regs-shared";
import { loadConfig } from "../config.js";
import { PasswordAuthProvider } from "../auth/passwordProvider.js";
import { SESSION_COOKIE, createSession, endSession } from "../auth/sessions.js";
import { requireAuth } from "../auth/rbac.js";
import { query, withTransaction } from "../db/pool.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const provider = new PasswordAuthProvider();

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const cfg = loadConfig();
  const secure = cfg.NODE_ENV === "production";

  app.post(
    "/login",
    {
      config: {
        rateLimit: { max: cfg.NODE_ENV === "test" ? 100_000 : 5, timeWindow: "1 minute" },
      },
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "Email and password required." }]));
      }
      const identity = await provider.authenticate(parsed.data);
      if (!identity) {
        return reply.code(401).send(fail([{ code: "UNAUTHORIZED", message: "Invalid email or password." }]));
      }
      const rawId = await createSession(
        identity.userId,
        request.ip,
        request.headers["user-agent"],
      );
      reply.setCookie(SESSION_COOKIE, rawId, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
      return reply.send(
        ok([{ email: identity.email, displayName: identity.displayName, role: identity.role, mustReset: identity.mustReset }], {
          generatedAt: new Date().toISOString(),
        }),
      );
    },
  );

  app.post("/logout", { preHandler: [requireAuth] }, async (request, reply) => {
    const raw = request.cookies?.[SESSION_COOKIE];
    if (raw) await endSession(raw);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.send(ok([], { generatedAt: new Date().toISOString() }));
  });

  app.get("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const id = request.identity!;
    return reply.send(
      ok([{ email: id.email, displayName: id.displayName, role: id.role, mustReset: id.mustReset }], {
        generatedAt: new Date().toISOString(),
      }),
    );
  });

  // Change password — verifies current, clears must_reset, rotates the session.
  // Allowed while must_reset is set (the forced-reset escape hatch).
  app.post("/change-password", { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: parsed.error.issues[0]?.message ?? "Invalid input." }]));
    }
    const id = request.identity!;
    const row = await query<{ password_hash: string }>(
      `SELECT password_hash FROM regs.staff_user WHERE user_id = $1`,
      [id.userId],
    );
    const currentHash = row.rows[0]?.password_hash;
    if (!currentHash || !(await verify(currentHash, parsed.data.current_password).catch(() => false))) {
      return reply.code(401).send(fail([{ code: "UNAUTHORIZED", message: "Current password is incorrect." }]));
    }
    const newHash = await hash(parsed.data.new_password);
    await withTransaction(id.email, (client) =>
      client.query(
        `UPDATE regs.staff_user SET password_hash = $2, must_reset = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
        [id.userId, newHash],
      ),
    );
    // Rotate the session: end the old, issue a fresh cookie.
    const oldRaw = request.cookies?.[SESSION_COOKIE];
    if (oldRaw) await endSession(oldRaw);
    const rawId = await createSession(id.userId, request.ip, request.headers["user-agent"]);
    reply.setCookie(SESSION_COOKIE, rawId, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return reply.send(ok([{ ok: true }], { generatedAt: new Date().toISOString() }));
  });
}
