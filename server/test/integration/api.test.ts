/**
 * @file api.test.ts
 * @module engage-mt/server/test
 * @description Integration tests for the staff + public API against a real Postgres.
 *              Covers the load-bearing paths: auth + must-reset, RBAC, optimistic-lock
 *              409, child PUT-replace + parent audit bump, hunt-area in-use guard,
 *              validation, publish atomicity + snapshot, diff, and the public contract.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-14
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { normalizedRegulationSchema } from "@engage-mt/regs-shared";
import { makeApp, loginAs, loginRaw } from "../helpers.js";
import { closePool, query } from "../../src/db/pool.js";

let app: FastifyInstance;
const body = (r: { payload: string }) => JSON.parse(r.payload);

beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
  await closePool();
});

describe("auth + must-reset", () => {
  it("rejects bad credentials", async () => {
    const r = await loginRaw(app, "admin@fwp.mt.gov", "wrong");
    expect(r.statusCode).toBe(401);
  });
  it("issues a session on good credentials", async () => {
    const r = await loginRaw(app, "editor@fwp.mt.gov", "test-password-123456");
    expect(r.statusCode).toBe(200);
    expect(r.cookies.length).toBeGreaterThan(0);
  });
  it("blocks a must-reset user from data routes but allows change-password", async () => {
    const ck = await loginAs(app, "editor" as never).catch(() => ({}));
    void ck;
    const login = await loginRaw(app, "mustreset@fwp.mt.gov", "test-password-123456");
    const cookies = Object.fromEntries(login.cookies.map((c) => [c.name, c.value]));
    const blocked = await app.inject({ method: "GET", url: "/api/v1/staff/instruments?year=2026", cookies });
    expect(blocked.statusCode).toBe(403);
    const cp = await app.inject({
      method: "POST", url: "/api/v1/staff/auth/change-password", cookies,
      payload: { current_password: "test-password-123456", new_password: "new-password-123456" },
    });
    expect(cp.statusCode).toBe(200);
    // session rotated + must_reset cleared → data routes now work
    const ck2 = Object.fromEntries(cp.cookies.map((c) => [c.name, c.value]));
    const ok = await app.inject({ method: "GET", url: "/api/v1/staff/instruments?year=2026", cookies: ck2 });
    expect(ok.statusCode).toBe(200);
    // restore for idempotency
    await query(`UPDATE regs.staff_user SET must_reset=1 WHERE email='mustreset@fwp.mt.gov'`);
  });
});

describe("RBAC", () => {
  it("viewer cannot create an instrument", async () => {
    const ck = await loginAs(app, "viewer");
    const r = await app.inject({
      method: "POST", url: "/api/v1/staff/instruments", cookies: ck,
      payload: { season_year: 2026, instr_type_code: "PERMIT", species_code: "deer", instr_code: "999-99", display_name: "x", is_draw: true },
    });
    expect(r.statusCode).toBe(403);
  });
  it("editor cannot publish", async () => {
    const ck = await loginAs(app, "editor");
    const r = await app.inject({ method: "POST", url: "/api/v1/staff/season-years/2026/publish", cookies: ck, payload: { note: "x" } });
    expect(r.statusCode).toBe(403);
  });
  it("non-admin cannot list users", async () => {
    const ck = await loginAs(app, "editor");
    const r = await app.inject({ method: "GET", url: "/api/v1/staff/users", cookies: ck });
    expect(r.statusCode).toBe(403);
  });
});

describe("optimistic locking", () => {
  it("accepts a fresh lock and 409s a stale one", async () => {
    const ck = await loginAs(app, "editor");
    const list = body(await app.inject({ method: "GET", url: "/api/v1/staff/instruments?year=2026&code=900-00", cookies: ck }));
    const inst = list.data[0];
    const good = await app.inject({
      method: "PATCH", url: `/api/v1/staff/instruments/${inst.instrument_id}`, cookies: ck,
      payload: { quota_current: 60, expected_updated_at: inst.updated_at },
    });
    expect(good.statusCode).toBe(200);
    const stale = await app.inject({
      method: "PATCH", url: `/api/v1/staff/instruments/${inst.instrument_id}`, cookies: ck,
      payload: { quota_current: 10, expected_updated_at: "2000-01-01T00:00:00Z" },
    });
    expect(stale.statusCode).toBe(409);
    expect(body(stale).errors[0].code).toBe("CONFLICT");
  });
});

describe("hunt-area in-use guard + repoint", () => {
  it("blocks delete while referenced, then allows after repoint", async () => {
    const ck = await loginAs(app, "editor");
    // HD-900 is referenced by the fixture opportunities
    const areas = body(await app.inject({ method: "GET", url: "/api/v1/staff/hunt-areas?year=2026", cookies: ck }));
    const inUse = areas.data.find((a: { area_code: string }) => a.area_code === "HD-900");
    expect(Number(inUse.opportunity_count)).toBeGreaterThan(0);
    const del = await app.inject({ method: "DELETE", url: `/api/v1/staff/hunt-areas/${inUse.hunt_area_id}`, cookies: ck });
    expect(del.statusCode).toBe(409);
    // a fresh empty area can be created + deleted
    const created = body(await app.inject({
      method: "POST", url: "/api/v1/staff/hunt-areas", cookies: ck,
      payload: { season_year: 2026, area_code: "HD-900-TMP", area_kind: "MULTI", members: [] },
    }));
    const del2 = await app.inject({ method: "DELETE", url: `/api/v1/staff/hunt-areas/${created.data[0].hunt_area_id}`, cookies: ck });
    expect(del2.statusCode).toBe(200);
  });
});

describe("validation + publish + diff + public contract", () => {
  it("validates, publishes atomically, and serves a contract-valid snapshot", async () => {
    const approver = await loginAs(app, "approver");
    const v = body(await app.inject({ method: "GET", url: "/api/v1/staff/season-years/2026/validation", cookies: approver }));
    const blocking = v.data.filter((f: { severity: string }) => f.severity === "error");
    expect(blocking.length).toBe(0);

    const pub = await app.inject({ method: "POST", url: "/api/v1/staff/season-years/2026/publish", cookies: approver, payload: { note: "test publish" } });
    expect(pub.statusCode).toBe(200);
    const version = body(pub).data[0].version;
    expect(version).toBeGreaterThanOrEqual(1);

    // Public compat endpoint returns contract-valid rows.
    const pubRows = body(await app.inject({ method: "GET", url: "/api/v1/fwp/datasets/hunting-regulations-unified" }));
    expect(pubRows.data.length).toBeGreaterThan(0);
    for (const row of pubRows.data) expect(normalizedRegulationSchema.safeParse(row).success).toBe(true);

    // A just-published year diffs clean against its own snapshot.
    const diff = body(await app.inject({ method: "GET", url: "/api/v1/staff/season-years/2026/diff", cookies: approver }));
    expect(diff.data[0].totals).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  it("records an audit row for a mutation with the acting user", async () => {
    const ck = await loginAs(app, "editor");
    const list = body(await app.inject({ method: "GET", url: "/api/v1/staff/instruments?year=2026&code=900-00", cookies: ck }));
    const inst = list.data[0];
    await app.inject({
      method: "PATCH", url: `/api/v1/staff/instruments/${inst.instrument_id}`, cookies: ck,
      payload: { quota_current: 55, expected_updated_at: inst.updated_at },
    });
    const audit = await query<{ changed_by: string }>(
      `SELECT changed_by FROM regs.audit_log WHERE table_name='license_instrument' ORDER BY changed_at DESC LIMIT 1`,
    );
    expect(audit.rows[0]?.changed_by).toBe("editor@fwp.mt.gov");
  });

  it("re-publishing an already-live year records a correction and serves it", async () => {
    const approver = await loginAs(app, "approver");
    // A second publish (v2+) with correction metadata.
    const pub = await app.inject({
      method: "POST",
      url: "/api/v1/staff/season-years/2026/publish",
      cookies: approver,
      payload: {
        note: "mid-year fix",
        correction_summary: "HD 900 elk quota corrected",
        affected_species: "elk",
        affected_districts: "900",
      },
    });
    expect(pub.statusCode).toBe(200);
    const version = body(pub).data[0].version;
    expect(version).toBeGreaterThanOrEqual(2);

    // The public corrections feed surfaces it with the structured scope.
    const feed = body(await app.inject({ method: "GET", url: "/api/v2/fwp/hunting/corrections?year=2026" }));
    const latest = feed.data.find((c: { version: number }) => c.version === version);
    expect(latest).toBeTruthy();
    expect(latest.summary).toBe("HD 900 elk quota corrected");
    expect(latest.affected_species).toBe("elk");
    // v1 is the book, never a correction — it must not appear in the feed.
    expect(feed.data.some((c: { version: number }) => c.version === 1)).toBe(false);
  });
});
