/**
 * @file staffContentRoutes.ts
 * @module engage-mt/server/routes
 * @description Staff CRUD for the Wave-2 content domains: license fees (products +
 *              per-audience prices), reference content sections (markdown), CMS assets
 *              (+ region-map links), and sunrise-sunset (read). Registered under
 *              /api/v1/staff; requireAuth + requireNotMustReset guard the group.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok, fail } from "@engage-mt/regs-shared";
import { query, withTransaction } from "../db/pool.js";
import { requireAuth, requireRole, requireNotMustReset } from "../auth/rbac.js";
import { lockedUpdate, send409IfConflict, send500, sendWriteError } from "./lockHelpers.js";

const now = () => new Date().toISOString();
const bad = (m: string) => fail([{ code: "INVALID_PARAM" as const, message: m }]);

export async function staffContentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireNotMustReset);

  // ── Content sections ──────────────────────────────────────────────────────
  app.get("/content-sections", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int(), category: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad("year required"));
    const params: unknown[] = [q.data.year];
    let cat = "";
    if (q.data.category) { params.push(q.data.category); cat = ` AND category=$${params.length}`; }
    const res = await query(
      `SELECT section_id, slug, category, title, statute_refs, sort_order, record_status,
              to_char(updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
       FROM regs.content_section WHERE season_year=$1${cat} ORDER BY category, sort_order`, params);
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  app.get("/content-sections/:id", async (request, reply) => {
    const res = await query(
      `SELECT section_id, slug, category, title, body_md, statute_refs, sort_order,
              to_char(updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
       FROM regs.content_section WHERE section_id=$1`, [(request.params as { id: string }).id]);
    if (res.rows.length === 0) return reply.code(404).send(fail([{ code: "NOT_FOUND", message: "not found" }]));
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  const contentBody = z.object({
    season_year: z.number().int(),
    slug: z.string().max(80),
    category: z.enum(["FRONT_MATTER", "DEFINITIONS", "LICENSING", "LAWS_RULES", "YOUTH", "DISABILITY", "DRAWING", "SAFETY", "ACCESS", "CWD", "OTHER"]),
    title: z.string().max(200),
    body_md: z.string(),
    statute_refs: z.string().max(400).nullable().optional(),
    sort_order: z.number().int().default(0),
  });
  app.post("/content-sections", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = contentBody.safeParse(request.body);
    if (!p.success) return reply.code(400).send(bad(p.error.issues[0]?.message ?? "invalid"));
    const b = p.data;
    try {
      const r = await withTransaction(request.identity!.email, (c) =>
        c.query<{ section_id: string }>(
          `INSERT INTO regs.content_section (season_year, slug, category, title, body_md, statute_refs, sort_order, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING section_id`,
          [b.season_year, b.slug, b.category, b.title, b.body_md, b.statute_refs ?? null, b.sort_order, request.identity!.email]));
      return reply.code(201).send(ok([{ section_id: r.rows[0]!.section_id }], { generatedAt: now() }));
    } catch (err) { return sendWriteError(reply, err); }
  });

  const contentPatch = z.object({
    title: z.string().max(200).optional(),
    body_md: z.string().optional(),
    statute_refs: z.string().max(400).nullable().optional(),
    sort_order: z.number().int().optional(),
    expected_updated_at: z.string(),
  });
  app.patch("/content-sections/:id", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = contentPatch.safeParse(request.body);
    if (!p.success) return reply.code(400).send(bad("invalid"));
    const { expected_updated_at, ...f } = p.data;
    const sets: Record<string, unknown> = {};
    for (const k of ["title", "body_md", "statute_refs", "sort_order"] as const) if (f[k] !== undefined) sets[k] = f[k];
    if (Object.keys(sets).length === 0) return reply.code(400).send(bad("no fields"));
    try {
      await withTransaction(request.identity!.email, (c) =>
        lockedUpdate(c, "regs.content_section", "section_id", (request.params as { id: string }).id, request.identity!.email, expected_updated_at, sets));
      return reply.send(ok([{ section_id: (request.params as { id: string }).id }], { generatedAt: now() }));
    } catch (err) { if (await send409IfConflict(reply, err)) return reply; return send500(reply, err); }
  });

  app.post("/content-sections/:id/archive", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = z.object({ expected_updated_at: z.string() }).safeParse(request.body);
    if (!p.success) return reply.code(400).send(bad("expected_updated_at required"));
    const id = (request.params as { id: string }).id;
    try {
      await withTransaction(request.identity!.email, (c) =>
        lockedUpdate(c, "regs.content_section", "section_id", id, request.identity!.email, p.data.expected_updated_at, { record_status: "ARCHIVED" }));
      return reply.send(ok([{ section_id: id }], { generatedAt: now() }));
    } catch (err) { if (await send409IfConflict(reply, err)) return reply; return send500(reply, err); }
  });

  app.post("/content-sections/:id/restore", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    await withTransaction(request.identity!.email, (c) =>
      c.query(`UPDATE regs.content_section SET record_status='DRAFT', revision=revision+1, updated_by=$2, updated_at=CURRENT_TIMESTAMP WHERE section_id=$1`,
        [id, request.identity!.email]));
    return reply.send(ok([{ section_id: id }], { generatedAt: now() }));
  });

  // ── Fees: products + prices ───────────────────────────────────────────────
  app.get("/products", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad("year required"));
    const res = await query(
      `SELECT p.product_id, p.product_code, p.display_name, p.product_kind, p.species_code, p.record_status,
              to_char(p.apply_by,'YYYY-MM-DD') AS apply_by, p.chart_note, p.sort_order,
              to_char(p.updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
              COALESCE((SELECT json_object_agg(pr.audience_code, pr.price_cents) FROM regs.product_price pr WHERE pr.product_id=p.product_id),'{}') AS prices
       FROM regs.license_product p WHERE p.season_year=$1 ORDER BY p.sort_order, p.product_code`, [q.data.year]);
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  const productBody = z.object({
    season_year: z.number().int(), product_code: z.string().max(40), display_name: z.string().max(160),
    product_kind: z.enum(["PREREQUISITE", "LICENSE", "PERMIT", "COMBO", "B_LICENSE", "SURCHARGE"]),
    species_code: z.string().nullable().optional(), chart_note: z.string().max(1000).nullable().optional(), sort_order: z.number().int().default(0),
  });
  app.post("/products", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = productBody.safeParse(request.body);
    if (!p.success) return reply.code(400).send(bad(p.error.issues[0]?.message ?? "invalid"));
    const b = p.data;
    try {
      const r = await withTransaction(request.identity!.email, (c) =>
        c.query<{ product_id: string }>(
          `INSERT INTO regs.license_product (season_year, product_code, display_name, product_kind, species_code, chart_note, sort_order, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING product_id`,
          [b.season_year, b.product_code, b.display_name, b.product_kind, b.species_code ?? null, b.chart_note ?? null, b.sort_order, request.identity!.email]));
      return reply.code(201).send(ok([{ product_id: r.rows[0]!.product_id }], { generatedAt: now() }));
    } catch (err) { return sendWriteError(reply, err); }
  });

  app.put("/products/:id/prices", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = z.object({ expected_updated_at: z.string(), prices: z.array(z.object({ audience_code: z.string(), price_cents: z.number().int().gte(0), price_note: z.string().max(400).nullable().optional() })) }).safeParse(request.body);
    if (!p.success) return reply.code(400).send(bad("invalid"));
    const id = (request.params as { id: string }).id;
    try {
      await withTransaction(request.identity!.email, async (c) => {
        await lockedUpdate(c, "regs.license_product", "product_id", id, request.identity!.email, p.data.expected_updated_at, {});
        await c.query(`DELETE FROM regs.product_price WHERE product_id=$1`, [id]);
        for (const pr of p.data.prices)
          await c.query(`INSERT INTO regs.product_price (product_id, audience_code, price_cents, price_note) VALUES ($1,$2,$3,$4)`,
            [id, pr.audience_code, pr.price_cents, pr.price_note ?? null]);
      });
      return reply.send(ok([{ product_id: id }], { generatedAt: now() }));
    } catch (err) { if (await send409IfConflict(reply, err)) return reply; return send500(reply, err); }
  });

  // ── CMS assets + region-map links ─────────────────────────────────────────
  app.get("/assets", async (request, reply) => {
    const q = z.object({ kind: z.string().optional() }).safeParse(request.query);
    const params: unknown[] = [];
    let where = "";
    if (q.success && q.data.kind) { params.push(q.data.kind); where = `WHERE asset_kind=$1`; }
    const res = await query(
      `SELECT asset_id, cms_provider, cms_doc_id, asset_kind, title, caption, alt_text, season_year, cached_url
       FROM regs.cms_asset ${where} ORDER BY asset_kind, title`, params);
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  const assetBody = z.object({
    cms_doc_id: z.string().max(160), asset_kind: z.enum(["REGION_MAP", "DISTRICT_MAP", "ZONE_MAP", "AREA_MAP", "FIGURE", "COVER"]),
    title: z.string().max(200), caption: z.string().max(1000).nullable().optional(), alt_text: z.string().max(400).nullable().optional(),
    season_year: z.number().int().nullable().optional(),
  });
  app.post("/assets", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = assetBody.safeParse(request.body);
    if (!p.success) return reply.code(400).send(bad(p.error.issues[0]?.message ?? "invalid"));
    const b = p.data;
    try {
      const r = await withTransaction(request.identity!.email, (c) =>
        c.query<{ asset_id: string }>(
          `INSERT INTO regs.cms_asset (cms_doc_id, asset_kind, title, caption, alt_text, season_year, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING asset_id`,
          [b.cms_doc_id, b.asset_kind, b.title, b.caption ?? null, b.alt_text ?? null, b.season_year ?? null, request.identity!.email]));
      return reply.code(201).send(ok([{ asset_id: r.rows[0]!.asset_id }], { generatedAt: now() }));
    } catch (err) { return sendWriteError(reply, err); }
  });

  app.put("/regions/:regionId/map-asset", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = z.object({ geography_code: z.enum(["HD", "ANTELOPE_HD"]), asset_id: z.string() }).safeParse(request.body);
    if (!p.success) return reply.code(400).send(bad("invalid"));
    const regionId = Number((request.params as { regionId: string }).regionId);
    // Portable upsert (no ON CONFLICT — Oracle-portability convention): delete + insert.
    await withTransaction(request.identity!.email, async (c) => {
      await c.query(`DELETE FROM regs.region_asset WHERE region_id=$1 AND geography_code=$2`, [regionId, p.data.geography_code]);
      await c.query(`INSERT INTO regs.region_asset (region_id, geography_code, asset_id) VALUES ($1,$2,$3)`, [regionId, p.data.geography_code, p.data.asset_id]);
    });
    return reply.send(ok([{ region_id: regionId }], { generatedAt: now() }));
  });
}
