/**
 * @file money-screen.test.ts
 * @module engage-mt/server/test
 * @description District-detail (money screen) editing coverage: the detail response now
 *              carries the ids the editors need, creating an opportunity works, and a
 *              restrictions PUT replaces the set + bumps the parent opportunity's lock.
 *              Creates then hard-deletes its own opportunity so the 2026 fixtures (which
 *              other suites publish + diff) stay pristine.
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
let createdOppId: string | null = null;

beforeAll(async () => { app = await makeApp(); });
afterAll(async () => {
  if (createdOppId) {
    await query(`DELETE FROM regs.opp_restriction WHERE opportunity_id=$1`, [createdOppId]);
    await query(`DELETE FROM regs.season_window WHERE opportunity_id=$1`, [createdOppId]);
    await query(`DELETE FROM regs.opportunity WHERE opportunity_id=$1`, [createdOppId]);
  }
  await app.close();
  await closePool();
});

describe("district detail + opportunity editing", () => {
  it("detail carries the ids the editors need", async () => {
    const ck = await loginAs(app, "editor");
    const d = body(await app.inject({ method: "GET", url: "/api/v1/staff/districts/900/detail?year=2026&geography=HD", cookies: ck }));
    const detail = d.data[0];
    expect(detail.district_id).toBeTruthy();
    const opp = detail.opportunities[0];
    expect(opp.instrument_id).toBeTruthy();
    expect(opp.animal_class_id).toBeTruthy();
    expect(opp.hunt_area_id).toBeTruthy();
    expect(opp.instrument_updated_at).toBeTruthy();
  });

  it("creates an opportunity, then a restrictions PUT replaces + bumps the parent lock", async () => {
    const ck = await loginAs(app, "editor");
    const d = body(await app.inject({ method: "GET", url: "/api/v1/staff/districts/900/detail?year=2026&geography=HD", cookies: ck }));
    const detail = d.data[0];
    const src = detail.opportunities[0];

    const created = await app.inject({
      method: "POST", url: "/api/v1/staff/opportunities", cookies: ck,
      payload: {
        season_year: 2026, instrument_id: src.instrument_id, animal_class_id: src.animal_class_id,
        hunt_area_id: src.hunt_area_id, home_district_id: detail.district_id, split_seq: 9,
        validity_note: "test-only opportunity", windows: [], restrictions: [],
      },
    });
    expect(created.statusCode).toBe(201);
    createdOppId = body(created).data[0].opportunity_id;

    // Read back the lock token + revision, then replace restrictions.
    const before = await query<{ updated_at: string; revision: number }>(
      `SELECT to_char(updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at, revision FROM regs.opportunity WHERE opportunity_id=$1`, [createdOppId!]);
    const lock = before.rows[0]!.updated_at;

    const put = await app.inject({
      method: "PUT", url: `/api/v1/staff/opportunities/${createdOppId}/restrictions`, cookies: ck,
      payload: { expected_updated_at: lock, restrictions: [{ restr_code: "YOUTH_ONLY", value_text: "10-15", raw_text: "Youth only." }] },
    });
    expect(put.statusCode).toBe(200);

    const stored = await query<{ n: string }>(`SELECT count(*) AS n FROM regs.opp_restriction WHERE opportunity_id=$1`, [createdOppId!]);
    expect(Number(stored.rows[0]!.n)).toBe(1);

    // The parent opportunity's lock was bumped (revision advanced) — deterministic,
    // unlike the second-granularity updated_at which can collide within one wall-clock second.
    const after = await query<{ revision: number }>(`SELECT revision FROM regs.opportunity WHERE opportunity_id=$1`, [createdOppId!]);
    expect(after.rows[0]!.revision).toBeGreaterThan(before.rows[0]!.revision);

    // A definitively-stale lock (far past) is still rejected.
    const stale = await app.inject({
      method: "PUT", url: `/api/v1/staff/opportunities/${createdOppId}/restrictions`, cookies: ck,
      payload: { expected_updated_at: "2000-01-01T00:00:00Z", restrictions: [] },
    });
    expect(stale.statusCode).toBe(409);
  });

  it("exposes the lookup endpoints the editors depend on", async () => {
    const ck = await loginAs(app, "editor");
    const classes = body(await app.inject({ method: "GET", url: "/api/v1/staff/animal-classes?species=deer", cookies: ck }));
    expect(classes.data.length).toBeGreaterThan(0);
    const restr = body(await app.inject({ method: "GET", url: "/api/v1/staff/restriction-types", cookies: ck }));
    expect(restr.data.length).toBeGreaterThan(0);
    const regions = body(await app.inject({ method: "GET", url: "/api/v1/staff/regions", cookies: ck }));
    expect(regions.data.length).toBe(7);
  });
});
