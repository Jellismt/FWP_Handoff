/**
 * @file sessions.test.ts
 * @module engage-mt/server/test
 * @description Session purge against the database: expired and idle rows are
 *              removed, live rows survive, and sign-in still works afterwards.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, loginRaw } from "../helpers.js";
import { closePool, query } from "../../src/db/pool.js";
import { purgeExpiredSessions } from "../../src/auth/sessions.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
  await closePool();
});

describe("purgeExpiredSessions", () => {
  it("removes expired and idle sessions and keeps live ones", async () => {
    const user = await query<{ user_id: string }>(`SELECT user_id FROM regs.staff_user WHERE email = 'viewer@fwp.mt.gov'`);
    const uid = user.rows[0]!.user_id;
    await query(
      `INSERT INTO regs.staff_session (session_hash, user_id, expires_at, last_seen_at)
       VALUES ('purge-expired', $1, CURRENT_TIMESTAMP - interval '1 day', CURRENT_TIMESTAMP),
              ('purge-idle',    $1, CURRENT_TIMESTAMP + interval '6 days', CURRENT_TIMESTAMP - interval '9 hours'),
              ('purge-live',    $1, CURRENT_TIMESTAMP + interval '6 days', CURRENT_TIMESTAMP)`,
      [uid],
    );
    const purged = await purgeExpiredSessions();
    expect(purged).toBeGreaterThanOrEqual(2);
    const left = await query<{ session_hash: string }>(
      `SELECT session_hash FROM regs.staff_session WHERE session_hash LIKE 'purge-%' ORDER BY session_hash`,
    );
    expect(left.rows.map((r) => r.session_hash)).toEqual(["purge-live"]);
    await query(`DELETE FROM regs.staff_session WHERE session_hash LIKE 'purge-%'`);
  });

  it("does not disturb sign-in", async () => {
    const r = await loginRaw(app, "viewer@fwp.mt.gov", "test-password-123456");
    expect(r.statusCode).toBe(200);
  });
});
