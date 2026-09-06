/**
 * @file lifecycle.test.ts
 * @module engage-mt/server/test
 * @description Year-lifecycle integration coverage: creating a new (empty) season year is
 *              approver-gated + rejects duplicates, and clone-forward deep-copies a prior
 *              year then refuses a second clone into a now-populated year. Uses a
 *              far-future year (2031) and tears its rows down in FK order for idempotency.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, loginAs } from "../helpers.js";
import { closePool, query } from "../../src/db/pool.js";

let app: FastifyInstance;
const body = (r: { payload: string }) => JSON.parse(r.payload);
const YEAR = 2031; // far-future; won't collide with seeded 2025/2026 fixtures

beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
  await closePool();
});

async function tearDownYear(year: number): Promise<void> {
  // FK-safe order: leaf children first, parents last.
  await query(`DELETE FROM regs.opp_restriction WHERE opportunity_id IN (SELECT opportunity_id FROM regs.opportunity WHERE season_year=$1)`, [year]);
  await query(`DELETE FROM regs.season_window WHERE opportunity_id IN (SELECT opportunity_id FROM regs.opportunity WHERE season_year=$1)`, [year]);
  await query(`DELETE FROM regs.opportunity WHERE season_year=$1`, [year]);
  await query(`DELETE FROM regs.hunt_area_member WHERE hunt_area_id IN (SELECT hunt_area_id FROM regs.hunt_area WHERE season_year=$1)`, [year]);
  await query(`DELETE FROM regs.hunt_area WHERE season_year=$1`, [year]);
  await query(`DELETE FROM regs.license_instrument WHERE season_year=$1`, [year]);
  await query(`DELETE FROM regs.district_note WHERE season_year=$1`, [year]);
  await query(`DELETE FROM regs.season_year WHERE season_year=$1`, [year]);
}

describe("season-year create + clone-forward", () => {
  beforeAll(async () => { await tearDownYear(YEAR); });
  afterAll(async () => { await tearDownYear(YEAR); });

  it("editor cannot create a season year", async () => {
    const ck = await loginAs(app, "editor");
    const r = await app.inject({
      method: "POST", url: "/api/v1/staff/season-years", cookies: ck,
      payload: { season_year: YEAR, starts_on: `${YEAR}-03-01`, ends_on: `${YEAR + 1}-02-28` },
    });
    expect(r.statusCode).toBe(403);
  });

  it("approver creates the year, and duplicates 409", async () => {
    const ck = await loginAs(app, "approver");
    const r = await app.inject({
      method: "POST", url: "/api/v1/staff/season-years", cookies: ck,
      payload: { season_year: YEAR, starts_on: `${YEAR}-03-01`, ends_on: `${YEAR + 1}-02-28` },
    });
    expect(r.statusCode).toBe(201);
    expect(body(r).data[0].season_year).toBe(YEAR);

    const dup = await app.inject({
      method: "POST", url: "/api/v1/staff/season-years", cookies: ck,
      payload: { season_year: YEAR, starts_on: `${YEAR}-03-01`, ends_on: `${YEAR + 1}-02-28` },
    });
    expect(dup.statusCode).toBe(409);
  });

  it("clones the previous year forward, then refuses a second clone", async () => {
    const ck = await loginAs(app, "editor");
    const first = await app.inject({ method: "POST", url: `/api/v1/staff/season-years/${YEAR}/clone-from/2026`, cookies: ck });
    expect(first.statusCode).toBe(200);
    const counts = body(first).data[0];
    expect(counts.license_instrument).toBeGreaterThan(0);
    expect(counts.opportunity).toBeGreaterThan(0);

    const second = await app.inject({ method: "POST", url: `/api/v1/staff/season-years/${YEAR}/clone-from/2026`, cookies: ck });
    expect(second.statusCode).toBe(409);
  });
});
