/**
 * @file important-dates-contacts.test.ts
 * @module engage-mt/server/test
 * @description Full-pamphlet-parity authoring coverage: important-date + contact create →
 *              patch (with a stale-lock 409) → delete, and the derived youth-opportunities
 *              public endpoint. Creates and hard-deletes its own rows so the 2026 fixtures
 *              stay pristine for the publish suite.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
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
let dateId: string | null = null;
let contactId: string | null = null;

beforeAll(async () => { app = await makeApp(); });
afterAll(async () => {
  if (dateId) await query(`DELETE FROM regs.important_date WHERE important_date_id=$1`, [dateId]);
  if (contactId) await query(`DELETE FROM regs.contact WHERE contact_id=$1`, [contactId]);
  await app.close();
  await closePool();
});

describe("important dates CRUD", () => {
  it("creates, patches, and 409s a stale lock", async () => {
    const ck = await loginAs(app, "editor");
    const created = await app.inject({
      method: "POST", url: "/api/v1/staff/important-dates", cookies: ck,
      payload: { season_year: 2026, date_code: "test-only-date", date_kind: "DEADLINE", species_scope: "Deer & Elk", label: "Test deadline", starts_on: "2026-04-01", sort_order: 1 },
    });
    expect(created.statusCode).toBe(201);
    dateId = body(created).data[0].important_date_id;

    const listed = body(await app.inject({ method: "GET", url: "/api/v1/staff/important-dates?year=2026", cookies: ck }));
    const row = listed.data.find((d: { important_date_id: string }) => d.important_date_id === dateId);
    expect(row.label).toBe("Test deadline");
    expect(row.starts_on).toBe("2026-04-01");

    const patched = await app.inject({
      method: "PATCH", url: `/api/v1/staff/important-dates/${dateId}`, cookies: ck,
      payload: { expected_updated_at: row.updated_at, label: "Updated deadline" },
    });
    expect(patched.statusCode).toBe(200);

    const stale = await app.inject({
      method: "PATCH", url: `/api/v1/staff/important-dates/${dateId}`, cookies: ck,
      payload: { expected_updated_at: "2000-01-01T00:00:00Z", label: "Nope" },
    });
    expect(stale.statusCode).toBe(409);
  });
});

describe("contacts CRUD", () => {
  it("creates, patches, and lists a contact", async () => {
    const ck = await loginAs(app, "editor");
    const created = await app.inject({
      method: "POST", url: "/api/v1/staff/contacts", cookies: ck,
      payload: { season_year: 2026, contact_code: "test-only-contact", contact_kind: "HOTLINE", name: "Test Hotline", phone: "406-555-0100", sort_order: 1 },
    });
    expect(created.statusCode).toBe(201);
    contactId = body(created).data[0].contact_id;

    const listed = body(await app.inject({ method: "GET", url: "/api/v1/staff/contacts?year=2026", cookies: ck }));
    const row = listed.data.find((c: { contact_id: string }) => c.contact_id === contactId);
    expect(row.name).toBe("Test Hotline");
    expect(row.phone).toBe("406-555-0100");

    const patched = await app.inject({
      method: "PATCH", url: `/api/v1/staff/contacts/${contactId}`, cookies: ck,
      payload: { expected_updated_at: row.updated_at, phone: "406-555-0200" },
    });
    expect(patched.statusCode).toBe(200);
    const relisted = body(await app.inject({ method: "GET", url: "/api/v1/staff/contacts?year=2026", cookies: ck }));
    expect(relisted.data.find((c: { contact_id: string }) => c.contact_id === contactId).phone).toBe("406-555-0200");
  });
});

describe("public v2 endpoints exist", () => {
  it("serves youth-opportunities without error", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/fwp/hunting/youth-opportunities?year=2026" });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(body(res).data)).toBe(true);
  });
  it("serves important-dates + contacts (empty until published)", async () => {
    const d = await app.inject({ method: "GET", url: "/api/v2/fwp/hunting/important-dates?year=2026" });
    expect(d.statusCode).toBe(200);
    const c = await app.inject({ method: "GET", url: "/api/v2/fwp/hunting/contacts?year=2026" });
    expect(c.statusCode).toBe(200);
  });
});
