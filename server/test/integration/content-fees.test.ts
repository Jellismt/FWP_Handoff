/**
 * @file content-fees.test.ts
 * @module engage-mt/server/test
 * @description Wave-2 authoring coverage: content-section create → archive → restore, and
 *              product create → price PUT (replace-all) with a stale-lock 409. Creates and
 *              hard-deletes its own rows so the 2026 fixtures stay pristine for the publish
 *              + diff suite.
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
let sectionId: string | null = null;
let productId: string | null = null;

beforeAll(async () => { app = await makeApp(); });
afterAll(async () => {
  if (sectionId) await query(`DELETE FROM regs.content_section WHERE section_id=$1`, [sectionId]);
  if (productId) {
    await query(`DELETE FROM regs.product_price WHERE product_id=$1`, [productId]);
    await query(`DELETE FROM regs.license_product WHERE product_id=$1`, [productId]);
  }
  await app.close();
  await closePool();
});

describe("content archive/restore", () => {
  it("creates, archives, and restores a section", async () => {
    const ck = await loginAs(app, "editor");
    const created = await app.inject({
      method: "POST", url: "/api/v1/staff/content-sections", cookies: ck,
      payload: { season_year: 2026, slug: "test-only-section", category: "OTHER", title: "Test section", body_md: "hello" },
    });
    expect(created.statusCode).toBe(201);
    sectionId = body(created).data[0].section_id;

    const lockRow = await query<{ updated_at: string }>(
      `SELECT to_char(updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at FROM regs.content_section WHERE section_id=$1`, [sectionId!]);
    const arch = await app.inject({
      method: "POST", url: `/api/v1/staff/content-sections/${sectionId}/archive`, cookies: ck,
      payload: { expected_updated_at: lockRow.rows[0]!.updated_at },
    });
    expect(arch.statusCode).toBe(200);
    const afterArchive = await query<{ record_status: string }>(`SELECT record_status FROM regs.content_section WHERE section_id=$1`, [sectionId!]);
    expect(afterArchive.rows[0]!.record_status).toBe("ARCHIVED");

    const restored = await app.inject({ method: "POST", url: `/api/v1/staff/content-sections/${sectionId}/restore`, cookies: ck });
    expect(restored.statusCode).toBe(200);
    const afterRestore = await query<{ record_status: string }>(`SELECT record_status FROM regs.content_section WHERE section_id=$1`, [sectionId!]);
    expect(afterRestore.rows[0]!.record_status).toBe("DRAFT");
  });
});

describe("product prices", () => {
  it("creates a product, sets prices (replace-all), and 409s a stale lock", async () => {
    const ck = await loginAs(app, "editor");
    const created = await app.inject({
      method: "POST", url: "/api/v1/staff/products", cookies: ck,
      payload: { season_year: 2026, product_code: "TEST-ONLY", display_name: "Test product", product_kind: "LICENSE" },
    });
    expect(created.statusCode).toBe(201);
    productId = body(created).data[0].product_id;

    const lockRow = await query<{ updated_at: string }>(
      `SELECT to_char(updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at FROM regs.license_product WHERE product_id=$1`, [productId!]);
    const put = await app.inject({
      method: "PUT", url: `/api/v1/staff/products/${productId}/prices`, cookies: ck,
      payload: { expected_updated_at: lockRow.rows[0]!.updated_at, prices: [{ audience_code: "RES", price_cents: 2000 }, { audience_code: "NR", price_cents: 12000 }] },
    });
    expect(put.statusCode).toBe(200);

    const prices = body(await app.inject({ method: "GET", url: "/api/v1/staff/products?year=2026", cookies: ck }));
    const row = prices.data.find((p: { product_id: string }) => p.product_id === productId);
    expect(row.prices.RES).toBe(2000);
    expect(row.prices.NR).toBe(12000);

    const stale = await app.inject({
      method: "PUT", url: `/api/v1/staff/products/${productId}/prices`, cookies: ck,
      payload: { expected_updated_at: "2000-01-01T00:00:00Z", prices: [] },
    });
    expect(stale.statusCode).toBe(409);
  });
});
