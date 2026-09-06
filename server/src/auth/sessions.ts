/**
 * @file sessions.ts
 * @module engage-mt/server/auth
 * @description Server-side sessions in Postgres. The raw session id lives only in the
 *              httpOnly cookie; the DB stores its sha-256 (so a DB dump can't be
 *              replayed). 8h idle / 7d absolute expiry.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { randomBytes, createHash } from "node:crypto";
import type { StaffRole } from "@engage-mt/regs-shared";
import { query } from "../db/pool.js";
import type { StaffIdentity } from "./provider.js";

// __Host- prefix requires Secure+Path=/+no Domain — only usable over HTTPS, so we
// drop it for local http dev to avoid the browser silently refusing the cookie.
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-regs_session" : "regs_session";
export const IDLE_MS = 8 * 60 * 60 * 1000; // 8h
export const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000; // 7d

function hashSessionId(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Create a session row and return the RAW id to set in the cookie. */
export async function createSession(
  userId: string,
  ip: string | undefined,
  userAgent: string | undefined,
): Promise<string> {
  const rawId = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ABSOLUTE_MS).toISOString();
  await query(
    `INSERT INTO regs.staff_session (session_hash, user_id, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [hashSessionId(rawId), userId, expiresAt, ip ?? null, (userAgent ?? "").slice(0, 400)],
  );
  return rawId;
}

interface ResolvedSessionRow {
  user_id: string;
  email: string;
  display_name: string;
  role: StaffRole;
  must_reset: number;
  last_seen_at: string;
  expires_at: string;
}

/** Resolve a raw cookie value to an identity, sliding the idle window. */
export async function resolveSession(rawId: string): Promise<StaffIdentity | null> {
  const res = await query<ResolvedSessionRow>(
    `SELECT u.user_id, u.email, u.display_name, u.role, u.must_reset,
            s.last_seen_at, s.expires_at
     FROM regs.staff_session s
     JOIN regs.staff_user u ON u.user_id = s.user_id
     WHERE s.session_hash = $1 AND u.is_active_flag = 1`,
    [hashSessionId(rawId)],
  );
  const row = res.rows[0];
  if (!row) return null;
  const now = Date.now();
  if (now > new Date(row.expires_at).getTime()) {
    await endSession(rawId);
    return null;
  }
  if (now - new Date(row.last_seen_at).getTime() > IDLE_MS) {
    await endSession(rawId);
    return null;
  }
  // Slide idle window.
  await query(`UPDATE regs.staff_session SET last_seen_at = CURRENT_TIMESTAMP WHERE session_hash = $1`, [
    hashSessionId(rawId),
  ]);
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    mustReset: row.must_reset === 1,
  };
}

/** Delete a session (logout / expiry). */
export async function endSession(rawId: string): Promise<void> {
  await query(`DELETE FROM regs.staff_session WHERE session_hash = $1`, [hashSessionId(rawId)]);
}

/** Sweep expired rows (called opportunistically; also safe as a cron). */
/**
 * Delete sessions past their absolute expiry or their idle window. `resolveSession`
 * removes a session only when its cookie comes back, so this sweep is what clears
 * the rest. Returns the number of rows removed.
 */
export async function purgeExpiredSessions(): Promise<number> {
  const res = await query(
    `DELETE FROM regs.staff_session
     WHERE expires_at < CURRENT_TIMESTAMP
        OR last_seen_at < CURRENT_TIMESTAMP - ($1::bigint * interval '1 millisecond')`,
    [IDLE_MS],
  );
  return res.rowCount ?? 0;
}
