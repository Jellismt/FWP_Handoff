/**
 * @file audit-log.test.ts
 * @module engage-mt/server/test
 * @description Audit-log reads against the seeded test database: filters by
 *              table, user, and window; keyset paging; validation; and the
 *              approver-only CSV export.
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
import { makeApp, loginAs } from "../helpers.js";
import { closePool } from "../../src/db/pool.js";

let app: FastifyInstance;
const body = (r: { payload: string }) => JSON.parse(r.payload);

beforeAll(async () => {
  app = await makeApp();
  // Guarantee audit rows from a known user: an editor creates an instrument.
  const editor = await loginAs(app, "editor");
  await app.inject({
    method: "POST",
    url: "/api/v1/staff/instruments",
    cookies: editor,
    payload: { season_year: 2026, instr_type_code: "PERMIT", species_code: "deer", instr_code: "998-98", display_name: "audit-log test", is_draw: true },
  });
});

afterAll(async () => {
  await app.close();
  await closePool();
});

describe("GET /api/v1/staff/audit-log", () => {
  it("returns newest-first rows with a nextCursor only when the page is full", async () => {
    const ck = await loginAs(app, "viewer");
    const r = await app.inject({ method: "GET", url: "/api/v1/staff/audit-log?limit=2", cookies: ck });
    expect(r.statusCode).toBe(200);
    const b = body(r);
    expect(b.data.length).toBeLessThanOrEqual(2);
    const ids = b.data.map((row: { audit_id: string }) => Number(row.audit_id));
    expect([...ids].sort((a, b2) => b2 - a)).toEqual(ids);
    if (b.data.length === 2) expect(b.meta.nextCursor).toBe(String(ids[1]));
    else expect(b.meta.nextCursor).toBeNull();
  });

  it("pages by keyset without overlap", async () => {
    const ck = await loginAs(app, "viewer");
    const first = body(await app.inject({ method: "GET", url: "/api/v1/staff/audit-log?limit=1", cookies: ck }));
    if (!first.meta.nextCursor) return;
    const second = body(
      await app.inject({ method: "GET", url: `/api/v1/staff/audit-log?limit=1&before=${first.meta.nextCursor}`, cookies: ck }),
    );
    if (second.data.length === 1) {
      expect(Number(second.data[0].audit_id)).toBeLessThan(Number(first.data[0].audit_id));
    }
  });

  it("filters by table, by user (case-insensitive), and by window", async () => {
    const ck = await loginAs(app, "viewer");
    const byTable = body(await app.inject({ method: "GET", url: "/api/v1/staff/audit-log?table=license_instrument", cookies: ck }));
    expect(byTable.data.length).toBeGreaterThan(0);
    for (const row of byTable.data) expect(row.table_name).toBe("license_instrument");
    const byUser = body(
      await app.inject({ method: "GET", url: "/api/v1/staff/audit-log?user=EDITOR@fwp.mt.gov", cookies: ck }),
    );
    for (const row of byUser.data) expect(row.changed_by.toLowerCase()).toBe("editor@fwp.mt.gov");
    const future = body(
      await app.inject({ method: "GET", url: "/api/v1/staff/audit-log?from=2999-01-01T00:00:00Z", cookies: ck }),
    );
    expect(future.data).toEqual([]);
  });

  it("rejects bad filters", async () => {
    const ck = await loginAs(app, "viewer");
    expect((await app.inject({ method: "GET", url: "/api/v1/staff/audit-log?table=not_a_table", cookies: ck })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/api/v1/staff/audit-log?from=yesterday", cookies: ck })).statusCode).toBe(400);
    expect(
      (await app.inject({ method: "GET", url: "/api/v1/staff/audit-log?from=2026-02-01T00:00:00Z&to=2026-01-01T00:00:00Z", cookies: ck })).statusCode,
    ).toBe(400);
  });
});

describe("GET /api/v1/staff/audit-log.csv", () => {
  it("is approver-only and returns a CSV attachment matching the JSON count", async () => {
    const viewer = await loginAs(app, "viewer");
    expect((await app.inject({ method: "GET", url: "/api/v1/staff/audit-log.csv", cookies: viewer })).statusCode).toBe(403);
    const approver = await loginAs(app, "approver");
    const csv = await app.inject({ method: "GET", url: "/api/v1/staff/audit-log.csv?table=opportunity", cookies: approver });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers["content-type"]).toMatch(/^text\/csv/);
    expect(csv.headers["content-disposition"]).toMatch(/attachment; filename="audit-log-\d{8}\.csv"/);
    const lines = csv.payload.split("\r\n").filter((l) => l.length > 0);
    expect(lines[0]).toBe("audit_id,changed_at,changed_by,table_name,row_pk,action_code,publication_id,old_row_json,new_row_json");
    const json = body(await app.inject({ method: "GET", url: "/api/v1/staff/audit-log?table=opportunity&limit=500", cookies: approver }));
    expect(lines.length - 1).toBe(json.data.length);
  });
});
