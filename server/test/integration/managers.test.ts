/**
 * @file managers.test.ts
 * @module engage-mt/server/test
 * @description Restricted-area + portion manager coverage: the newly-wired PATCH routes
 *              honor the optimistic lock, the restricted-area DELETE is blocked while
 *              districts are linked (then allowed once unlinked), and portion PATCH works.
 *              Creates and tears down its own rows.
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
let rareaId: string | null = null;
let portionId: string | null = null;

const lockOf = async (table: string, pk: string, id: string): Promise<string> => {
  const r = await query<{ updated_at: string }>(
    `SELECT to_char(updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at FROM ${table} WHERE ${pk}=$1`, [id]);
  return r.rows[0]!.updated_at;
};

beforeAll(async () => { app = await makeApp(); });
afterAll(async () => {
  if (rareaId) {
    await query(`DELETE FROM regs.district_rarea WHERE rarea_id=$1`, [rareaId]);
    await query(`DELETE FROM regs.restricted_area WHERE rarea_id=$1`, [rareaId]);
  }
  if (portionId) await query(`DELETE FROM regs.district_portion WHERE portion_id=$1`, [portionId]);
  await app.close();
  await closePool();
});

describe("restricted-area PATCH + delete guard", () => {
  it("patches under lock, blocks delete while linked, then deletes once unlinked", async () => {
    const ck = await loginAs(app, "editor");
    const created = await app.inject({
      method: "POST", url: "/api/v1/staff/restricted-areas", cookies: ck,
      payload: { season_year: 2026, area_type: "RESTRICTED", area_name: "Test RA", legal_desc: "x" },
    });
    expect(created.statusCode).toBe(201);
    rareaId = body(created).data[0].rarea_id;

    // PATCH honors the lock: fresh → 200, stale → 409.
    const good = await app.inject({
      method: "PATCH", url: `/api/v1/staff/restricted-areas/${rareaId}`, cookies: ck,
      payload: { area_name: "Test RA (edited)", expected_updated_at: await lockOf("regs.restricted_area", "rarea_id", rareaId!) },
    });
    expect(good.statusCode).toBe(200);
    const stale = await app.inject({
      method: "PATCH", url: `/api/v1/staff/restricted-areas/${rareaId}`, cookies: ck,
      payload: { area_name: "nope", expected_updated_at: "2000-01-01T00:00:00Z" },
    });
    expect(stale.statusCode).toBe(409);

    // Link district 900, then DELETE is guarded.
    const d = await query<{ district_id: string }>(`SELECT district_id FROM regs.district WHERE district_code='900' AND geography_code='HD'`);
    const link = await app.inject({
      method: "PUT", url: `/api/v1/staff/restricted-areas/${rareaId}/districts`, cookies: ck,
      payload: { expected_updated_at: await lockOf("regs.restricted_area", "rarea_id", rareaId!), links: [{ district_id: d.rows[0]!.district_id }] },
    });
    expect(link.statusCode).toBe(200);

    const links = body(await app.inject({ method: "GET", url: `/api/v1/staff/restricted-areas/${rareaId}/districts`, cookies: ck }));
    expect(links.data.length).toBe(1);

    const blocked = await app.inject({ method: "DELETE", url: `/api/v1/staff/restricted-areas/${rareaId}`, cookies: ck });
    expect(blocked.statusCode).toBe(409);

    // Unlink → delete succeeds.
    const unlink = await app.inject({
      method: "PUT", url: `/api/v1/staff/restricted-areas/${rareaId}/districts`, cookies: ck,
      payload: { expected_updated_at: await lockOf("regs.restricted_area", "rarea_id", rareaId!), links: [] },
    });
    expect(unlink.statusCode).toBe(200);
    const del = await app.inject({ method: "DELETE", url: `/api/v1/staff/restricted-areas/${rareaId}`, cookies: ck });
    expect(del.statusCode).toBe(200);
    rareaId = null; // deleted
  });
});

describe("portion PATCH", () => {
  it("creates and patches a district portion under lock", async () => {
    const ck = await loginAs(app, "editor");
    const d = await query<{ district_id: string }>(`SELECT district_id FROM regs.district WHERE district_code='900' AND geography_code='HD'`);
    const created = await app.inject({
      method: "POST", url: "/api/v1/staff/portions", cookies: ck,
      payload: { district_id: d.rows[0]!.district_id, portion_code: "TEST-P", portion_name: "Test portion" },
    });
    expect(created.statusCode).toBe(201);
    portionId = body(created).data[0].portion_id;

    const patched = await app.inject({
      method: "PATCH", url: `/api/v1/staff/portions/${portionId}`, cookies: ck,
      payload: { portion_name: "Renamed portion", expected_updated_at: await lockOf("regs.district_portion", "portion_id", portionId!) },
    });
    expect(patched.statusCode).toBe(200);
    const row = await query<{ portion_name: string }>(`SELECT portion_name FROM regs.district_portion WHERE portion_id=$1`, [portionId!]);
    expect(row.rows[0]!.portion_name).toBe("Renamed portion");
  });
});
