/**
 * @file staffCrudRoutes.ts
 * @module engage-mt/server/routes
 * @description Wave-2 staff CRUD: opportunities (+windows/restrictions), hunt areas
 *              (+members/repoint/in-use guard), portions, restricted areas (+district
 *              links), note edits, user admin, publications + pre-publish diff. Registers
 *              under /api/v1/staff alongside the Wave-1 staffRoutes. requireAuth +
 *              requireNotMustReset guard the whole group; mutations add requireRole.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-14
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import {
  ok, fail,
  createOpportunitySchema, patchOpportunitySchema, putWindowsSchema, putRestrictionsSchema,
  createHuntAreaSchema, patchHuntAreaSchema, putMembersSchema, repointSchema,
  createPortionSchema, patchPortionSchema,
  createRareaSchema, patchRareaSchema, putRareaDistrictsSchema,
  patchNoteSchema, createUserSchema, patchUserSchema,
} from "@engage-mt/regs-shared";
import { query, withTransaction } from "../db/pool.js";
import { requireAuth, requireRole, requireNotMustReset } from "../auth/rbac.js";
import { lockedUpdate, bumpParent, send409IfConflict, send500, sendWriteError } from "./lockHelpers.js";
import { computeDiff } from "../services/diff.js";

const now = () => new Date().toISOString();
const badReq = (msg: string) => ({ code: "INVALID_PARAM" as const, message: msg });

async function insertWindows(client: import("pg").PoolClient, oppId: string, windows: { season_type_code: string; window_seq: number; starts_on: string; ends_on: string; raw_range?: string | null }[]): Promise<void> {
  for (const w of windows) {
    const raw = w.raw_range ?? null;
    await client.query(
      `INSERT INTO regs.season_window (opportunity_id, season_type_code, window_seq, starts_on, ends_on, raw_range)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [oppId, w.season_type_code, w.window_seq, w.starts_on, w.ends_on, raw],
    );
  }
}
async function insertRestrictions(client: import("pg").PoolClient, oppId: string, restrictions: { restr_code: string; value_text?: string | null; raw_text?: string | null }[]): Promise<void> {
  let seq = 1;
  for (const r of restrictions) {
    await client.query(
      `INSERT INTO regs.opp_restriction (opportunity_id, restr_seq, restr_code, value_text, raw_text)
       VALUES ($1,$2,$3,$4,$5)`,
      [oppId, seq++, r.restr_code, r.value_text ?? null, r.raw_text ?? r.restr_code],
    );
  }
}

export async function staffCrudRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireNotMustReset);

  // ── Instruments (read for the editor + anchor resolution) ────────────────
  app.get("/instruments", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int(), species: z.string().optional(), code: z.string().optional(), q: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([badReq("year is required")]));
    const params: unknown[] = [q.data.year];
    const conds = ["li.season_year = $1", "li.record_status <> 'ARCHIVED'"];
    if (q.data.species) { params.push(q.data.species); conds.push(`li.species_code = $${params.length}`); }
    if (q.data.code) { params.push(q.data.code); conds.push(`li.instr_code = $${params.length}`); }
    if (q.data.q) { params.push(`%${q.data.q}%`); conds.push(`(li.instr_code ILIKE $${params.length} OR li.display_name ILIKE $${params.length})`); }
    const res = await query(
      `SELECT li.instrument_id, li.instr_code, li.display_name, li.instr_type_code, li.species_code,
              li.is_draw, li.quota_current, li.quota_min, li.quota_max, li.quota_unlimited,
              to_char(li.updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
              (SELECT count(*) FROM regs.opportunity o WHERE o.instrument_id = li.instrument_id AND o.record_status <> 'ARCHIVED') AS opportunity_count
       FROM regs.license_instrument li WHERE ${conds.join(" AND ")} ORDER BY li.instr_code LIMIT 500`,
      params,
    );
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  // NOTE: POST/PATCH/DELETE /instruments + POST /notes live in the Wave-1 staffRoutes.ts.
  // Here we add the new read + the child/hunt-area/etc. surfaces only.

  // ── Lookups (read-only; back the editing forms) ──────────────────────────────
  app.get("/animal-classes", async (request, reply) => {
    const q = z.object({ species: z.string().optional() }).safeParse(request.query);
    const params: unknown[] = [];
    let where = "";
    if (q.success && q.data.species) { params.push(q.data.species); where = `WHERE species_code = $1`; }
    const res = await query(
      `SELECT animal_class_id, species_code, class_code, display_label
       FROM regs.legal_animal_class ${where} ORDER BY species_code, class_code`, params);
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  app.get("/restriction-types", async (_request, reply) => {
    const res = await query(
      `SELECT restr_code, category, display_name, needs_value FROM regs.restriction_type ORDER BY category, restr_code`);
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  app.get("/portions", async (request, reply) => {
    const q = z.object({ district_id: z.string().optional() }).safeParse(request.query);
    const params: unknown[] = [];
    let where = "";
    if (q.success && q.data.district_id) { params.push(q.data.district_id); where = `WHERE district_id = $1`; }
    const res = await query(
      `SELECT portion_id, district_id, portion_code, portion_name, boundary_desc
       FROM regs.district_portion ${where} ORDER BY portion_code`, params);
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  app.get("/regions", async (_request, reply) => {
    const res = await query(`SELECT region_id, region_name FROM regs.region ORDER BY region_id`);
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  // ── Opportunities ─────────────────────────────────────────────────────────
  app.get("/opportunities", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int(), restr_code: z.string().optional(), district: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([badReq("year is required")]));
    const params: unknown[] = [q.data.year];
    const conds = ["o.season_year = $1", "o.record_status <> 'ARCHIVED'"];
    if (q.data.restr_code) { params.push(q.data.restr_code); conds.push(`EXISTS (SELECT 1 FROM regs.opp_restriction r WHERE r.opportunity_id = o.opportunity_id AND r.restr_code = $${params.length})`); }
    if (q.data.district) { params.push(q.data.district); conds.push(`EXISTS (SELECT 1 FROM regs.district d WHERE d.district_id = o.home_district_id AND d.district_code = $${params.length})`); }
    const res = await query(
      `SELECT o.opportunity_id, o.split_seq, o.validity_note, li.instr_code, li.display_name AS instrument_name,
              li.species_code, lac.display_label AS legal_animal,
              (SELECT d.district_code FROM regs.district d WHERE d.district_id = o.home_district_id) AS district_code
       FROM regs.opportunity o
       JOIN regs.license_instrument li ON li.instrument_id = o.instrument_id
       JOIN regs.legal_animal_class lac ON lac.animal_class_id = o.animal_class_id
       WHERE ${conds.join(" AND ")} ORDER BY district_code, li.instr_code LIMIT 2000`,
      params,
    );
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  app.post("/opportunities", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = createOpportunitySchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq(p.error.issues[0]?.message ?? "invalid")]));
    const b = p.data;
    try {
      const id = await withTransaction(request.identity!.email, async (c) => {
        const r = await c.query<{ opportunity_id: string }>(
          `INSERT INTO regs.opportunity (season_year, instrument_id, animal_class_id, hunt_area_id, split_seq, home_district_id, validity_note, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING opportunity_id`,
          [b.season_year, b.instrument_id, b.animal_class_id, b.hunt_area_id, b.split_seq, b.home_district_id ?? null, b.validity_note ?? null, request.identity!.email],
        );
        const oppId = r.rows[0]!.opportunity_id;
        await insertWindows(c, oppId, b.windows);
        await insertRestrictions(c, oppId, b.restrictions);
        return oppId;
      });
      return reply.code(201).send(ok([{ opportunity_id: id }], { generatedAt: now() }));
    } catch (err) { return sendWriteError(reply, err); }
  });

  app.patch("/opportunities/:id", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = patchOpportunitySchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq(p.error.issues[0]?.message ?? "invalid")]));
    const { expected_updated_at, ...f } = p.data;
    const sets: Record<string, unknown> = {};
    for (const k of ["animal_class_id", "hunt_area_id", "split_seq", "home_district_id", "validity_note"] as const)
      if (f[k] !== undefined) sets[k] = f[k];
    if (Object.keys(sets).length === 0) return reply.code(400).send(fail([badReq("no fields")]));
    try {
      await withTransaction(request.identity!.email, (c) =>
        lockedUpdate(c, "regs.opportunity", "opportunity_id", (request.params as { id: string }).id, request.identity!.email, expected_updated_at, sets));
      return reply.send(ok([{ opportunity_id: (request.params as { id: string }).id }], { generatedAt: now() }));
    } catch (err) { if (await send409IfConflict(reply, err)) return reply; return send500(reply, err); }
  });

  app.post("/opportunities/:id/archive", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = z.object({ expected_updated_at: z.string() }).safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq("expected_updated_at required")]));
    try {
      await withTransaction(request.identity!.email, (c) =>
        lockedUpdate(c, "regs.opportunity", "opportunity_id", (request.params as { id: string }).id, request.identity!.email, p.data.expected_updated_at, { record_status: "ARCHIVED" }));
      return reply.send(ok([{ opportunity_id: (request.params as { id: string }).id }], { generatedAt: now() }));
    } catch (err) { if (await send409IfConflict(reply, err)) return reply; return send500(reply, err); }
  });

  app.post("/opportunities/:id/restore", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    await withTransaction(request.identity!.email, (c) =>
      c.query(`UPDATE regs.opportunity SET record_status='DRAFT', revision=revision+1, updated_by=$2, updated_at=CURRENT_TIMESTAMP WHERE opportunity_id=$1`,
        [(request.params as { id: string }).id, request.identity!.email]));
    return reply.send(ok([{ opportunity_id: (request.params as { id: string }).id }], { generatedAt: now() }));
  });

  app.put("/opportunities/:id/windows", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = putWindowsSchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq(p.error.issues[0]?.message ?? "invalid")]));
    const id = (request.params as { id: string }).id;
    try {
      await withTransaction(request.identity!.email, async (c) => {
        await bumpParent(c, "regs.opportunity", "opportunity_id", id, request.identity!.email, p.data.expected_updated_at);
        await c.query(`DELETE FROM regs.season_window WHERE opportunity_id = $1`, [id]);
        await insertWindows(c, id, p.data.windows);
      });
      return reply.send(ok([{ opportunity_id: id }], { generatedAt: now() }));
    } catch (err) { if (await send409IfConflict(reply, err)) return reply; return send500(reply, err); }
  });

  app.put("/opportunities/:id/restrictions", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = putRestrictionsSchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq(p.error.issues[0]?.message ?? "invalid")]));
    const id = (request.params as { id: string }).id;
    try {
      await withTransaction(request.identity!.email, async (c) => {
        await bumpParent(c, "regs.opportunity", "opportunity_id", id, request.identity!.email, p.data.expected_updated_at);
        await c.query(`DELETE FROM regs.opp_restriction WHERE opportunity_id = $1`, [id]);
        await insertRestrictions(c, id, p.data.restrictions);
      });
      return reply.send(ok([{ opportunity_id: id }], { generatedAt: now() }));
    } catch (err) { if (await send409IfConflict(reply, err)) return reply; return send500(reply, err); }
  });

  // ── Hunt areas ────────────────────────────────────────────────────────────
  app.get("/hunt-areas", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int(), kind: z.string().optional(), q: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([badReq("year required")]));
    const params: unknown[] = [q.data.year];
    const conds = ["ha.season_year = $1"];
    if (q.data.kind) { params.push(q.data.kind); conds.push(`ha.area_kind = $${params.length}`); }
    if (q.data.q) { params.push(`%${q.data.q}%`); conds.push(`ha.area_code ILIKE $${params.length}`); }
    const res = await query(
      `SELECT ha.hunt_area_id, ha.area_code, ha.area_kind, ha.definition_text,
              to_char(ha.updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
              (SELECT count(*) FROM regs.hunt_area_member m WHERE m.hunt_area_id = ha.hunt_area_id) AS member_count,
              (SELECT count(*) FROM regs.opportunity o WHERE o.hunt_area_id = ha.hunt_area_id AND o.record_status <> 'ARCHIVED') AS opportunity_count
       FROM regs.hunt_area ha WHERE ${conds.join(" AND ")} ORDER BY ha.area_code LIMIT 1000`,
      params,
    );
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  app.post("/hunt-areas", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = createHuntAreaSchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq(p.error.issues[0]?.message ?? "invalid")]));
    const b = p.data;
    try {
      const id = await withTransaction(request.identity!.email, async (c) => {
        const r = await c.query<{ hunt_area_id: string }>(
          `INSERT INTO regs.hunt_area (season_year, area_code, area_kind, definition_text, updated_by)
           VALUES ($1,$2,$3,$4,$5) RETURNING hunt_area_id`,
          [b.season_year, b.area_code, b.area_kind, b.definition_text ?? null, request.identity!.email]);
        const haId = r.rows[0]!.hunt_area_id;
        let seq = 1;
        for (const m of b.members)
          await c.query(`INSERT INTO regs.hunt_area_member (hunt_area_id, member_seq, district_id, portion_id) VALUES ($1,$2,$3,$4)`,
            [haId, seq++, m.district_id ?? null, m.portion_id ?? null]);
        return haId;
      });
      return reply.code(201).send(ok([{ hunt_area_id: id }], { generatedAt: now() }));
    } catch (err) { return sendWriteError(reply, err); }
  });

  app.patch("/hunt-areas/:id", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = patchHuntAreaSchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq("invalid")]));
    const { expected_updated_at, ...f } = p.data;
    const sets: Record<string, unknown> = {};
    if (f.area_code !== undefined) sets.area_code = f.area_code;
    if (f.definition_text !== undefined) sets.definition_text = f.definition_text;
    if (Object.keys(sets).length === 0) return reply.code(400).send(fail([badReq("no fields")]));
    try {
      await withTransaction(request.identity!.email, (c) =>
        lockedUpdate(c, "regs.hunt_area", "hunt_area_id", (request.params as { id: string }).id, request.identity!.email, expected_updated_at, sets));
      return reply.send(ok([{ hunt_area_id: (request.params as { id: string }).id }], { generatedAt: now() }));
    } catch (err) { if (await send409IfConflict(reply, err)) return reply; return send500(reply, err); }
  });

  // The current members of a hunt area, so the editor can pre-check the served
  // districts (and see the portion members it must preserve). Mirrors
  // GET /restricted-areas/:id/districts. NOTE: district_id is returned as the raw
  // BIGINT-as-string (see pool.ts) — it must stay a string here and in
  // GET /districts so the SPA's Set<string> pre-check matches. Keep them in lockstep.
  app.get("/hunt-areas/:id/members", async (request, reply) => {
    const res = await query(
      `SELECT ham.member_seq, ham.district_id, d.district_code,
              ham.portion_id, p.portion_code, p.portion_name
       FROM regs.hunt_area_member ham
       LEFT JOIN regs.district d         ON d.district_id = ham.district_id
       LEFT JOIN regs.district_portion p ON p.portion_id  = ham.portion_id
       WHERE ham.hunt_area_id = $1
       ORDER BY ham.member_seq`, [(request.params as { id: string }).id]);
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  app.put("/hunt-areas/:id/members", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = putMembersSchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq("invalid")]));
    const id = (request.params as { id: string }).id;
    try {
      await withTransaction(request.identity!.email, async (c) => {
        await bumpParent(c, "regs.hunt_area", "hunt_area_id", id, request.identity!.email, p.data.expected_updated_at);
        await c.query(`DELETE FROM regs.hunt_area_member WHERE hunt_area_id = $1`, [id]);
        let seq = 1;
        for (const m of p.data.members)
          await c.query(`INSERT INTO regs.hunt_area_member (hunt_area_id, member_seq, district_id, portion_id) VALUES ($1,$2,$3,$4)`,
            [id, seq++, m.district_id ?? null, m.portion_id ?? null]);
      });
      return reply.send(ok([{ hunt_area_id: id }], { generatedAt: now() }));
    } catch (err) { if (await send409IfConflict(reply, err)) return reply; return send500(reply, err); }
  });

  app.post("/hunt-areas/:id/repoint", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = repointSchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq("to_hunt_area_id required")]));
    const from = (request.params as { id: string }).id;
    const moved = await withTransaction(request.identity!.email, async (c) => {
      const ids = p.data.opportunity_ids;
      const res = ids
        ? await c.query(`UPDATE regs.opportunity SET hunt_area_id=$1, revision=revision+1, updated_by=$3, updated_at=CURRENT_TIMESTAMP WHERE hunt_area_id=$2 AND opportunity_id = ANY($4::bigint[])`, [p.data.to_hunt_area_id, from, request.identity!.email, ids])
        : await c.query(`UPDATE regs.opportunity SET hunt_area_id=$1, revision=revision+1, updated_by=$3, updated_at=CURRENT_TIMESTAMP WHERE hunt_area_id=$2`, [p.data.to_hunt_area_id, from, request.identity!.email]);
      return res.rowCount ?? 0;
    });
    return reply.send(ok([{ moved }], { generatedAt: now() }));
  });

  app.delete("/hunt-areas/:id", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const used = await query<{ n: string }>(`SELECT count(*) AS n FROM regs.opportunity WHERE hunt_area_id=$1 AND record_status <> 'ARCHIVED'`, [id]);
    if (Number(used.rows[0]?.n ?? "0") > 0)
      return reply.code(409).send(fail([{ code: "CONFLICT", message: `In use by ${used.rows[0]!.n} opportunities — re-point them first.` }]));
    await withTransaction(request.identity!.email, async (c) => {
      await c.query(`DELETE FROM regs.hunt_area_member WHERE hunt_area_id=$1`, [id]);
      await c.query(`DELETE FROM regs.hunt_area WHERE hunt_area_id=$1`, [id]);
    });
    return reply.send(ok([{ hunt_area_id: id }], { generatedAt: now() }));
  });

  // ── Portions ──────────────────────────────────────────────────────────────
  app.post("/portions", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = createPortionSchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq("invalid")]));
    const b = p.data;
    try {
      const res = await withTransaction(request.identity!.email, (c) =>
        c.query<{ portion_id: string }>(`INSERT INTO regs.district_portion (district_id, portion_code, portion_name, boundary_desc, updated_by) VALUES ($1,$2,$3,$4,$5) RETURNING portion_id`,
          [b.district_id, b.portion_code, b.portion_name, b.boundary_desc ?? null, request.identity!.email]));
      return reply.code(201).send(ok([{ portion_id: res.rows[0]!.portion_id }], { generatedAt: now() }));
    } catch (err) { return sendWriteError(reply, err); }
  });

  app.patch("/portions/:id", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = patchPortionSchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq("invalid")]));
    const { expected_updated_at, ...f } = p.data;
    const sets: Record<string, unknown> = {};
    if (f.portion_name !== undefined) sets.portion_name = f.portion_name;
    if (f.boundary_desc !== undefined) sets.boundary_desc = f.boundary_desc;
    if (Object.keys(sets).length === 0) return reply.code(400).send(fail([badReq("no fields")]));
    try {
      await withTransaction(request.identity!.email, (c) =>
        lockedUpdate(c, "regs.district_portion", "portion_id", (request.params as { id: string }).id, request.identity!.email, expected_updated_at, sets));
      return reply.send(ok([{ portion_id: (request.params as { id: string }).id }], { generatedAt: now() }));
    } catch (err) { if (await send409IfConflict(reply, err)) return reply; return send500(reply, err); }
  });

  app.delete("/portions/:id", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const used = await query<{ n: string }>(`SELECT count(*) AS n FROM regs.hunt_area_member WHERE portion_id=$1`, [id]);
    if (Number(used.rows[0]?.n ?? "0") > 0) return reply.code(409).send(fail([{ code: "CONFLICT", message: "Portion is referenced by a hunt area." }]));
    await withTransaction(request.identity!.email, (c) => c.query(`DELETE FROM regs.district_portion WHERE portion_id=$1`, [id]));
    return reply.send(ok([{ portion_id: id }], { generatedAt: now() }));
  });

  // ── Restricted areas ──────────────────────────────────────────────────────
  app.get("/restricted-areas", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([badReq("year required")]));
    const res = await query(
      `SELECT ra.rarea_id, ra.area_type, ra.area_name, ra.legal_desc,
              to_char(ra.updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
              (SELECT count(*) FROM regs.district_rarea dr WHERE dr.rarea_id = ra.rarea_id) AS district_count
       FROM regs.restricted_area ra WHERE ra.season_year = $1 ORDER BY ra.area_name`,
      [q.data.year]);
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  app.post("/restricted-areas", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = createRareaSchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq("invalid")]));
    const b = p.data;
    try {
      const res = await withTransaction(request.identity!.email, (c) =>
        c.query<{ rarea_id: string }>(`INSERT INTO regs.restricted_area (season_year, area_type, area_name, legal_desc, updated_by) VALUES ($1,$2,$3,$4,$5) RETURNING rarea_id`,
          [b.season_year, b.area_type, b.area_name, b.legal_desc ?? null, request.identity!.email]));
      return reply.code(201).send(ok([{ rarea_id: res.rows[0]!.rarea_id }], { generatedAt: now() }));
    } catch (err) { return sendWriteError(reply, err); }
  });

  app.patch("/restricted-areas/:id", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = patchRareaSchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq("invalid")]));
    const { expected_updated_at, ...f } = p.data;
    const sets: Record<string, unknown> = {};
    if (f.area_type !== undefined) sets.area_type = f.area_type;
    if (f.area_name !== undefined) sets.area_name = f.area_name;
    if (f.legal_desc !== undefined) sets.legal_desc = f.legal_desc;
    if (Object.keys(sets).length === 0) return reply.code(400).send(fail([badReq("no fields")]));
    try {
      await withTransaction(request.identity!.email, (c) =>
        lockedUpdate(c, "regs.restricted_area", "rarea_id", (request.params as { id: string }).id, request.identity!.email, expected_updated_at, sets));
      return reply.send(ok([{ rarea_id: (request.params as { id: string }).id }], { generatedAt: now() }));
    } catch (err) { if (await send409IfConflict(reply, err)) return reply; return send500(reply, err); }
  });

  app.delete("/restricted-areas/:id", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const used = await query<{ n: string }>(`SELECT count(*) AS n FROM regs.district_rarea WHERE rarea_id=$1`, [id]);
    if (Number(used.rows[0]?.n ?? "0") > 0)
      return reply.code(409).send(fail([{ code: "CONFLICT", message: `Linked to ${used.rows[0]!.n} district(s) — unlink them first.` }]));
    await withTransaction(request.identity!.email, (c) => c.query(`DELETE FROM regs.restricted_area WHERE rarea_id=$1`, [id]));
    return reply.send(ok([{ rarea_id: id }], { generatedAt: now() }));
  });

  app.get("/restricted-areas/:id/districts", async (request, reply) => {
    // district_id stays a string here so the RestrictedAreasScreen Set<string> pre-check
    // matches GET /districts — keep in lockstep (see the /districts and /hunt-areas members notes).
    const res = await query(
      `SELECT dr.district_id, d.district_code, d.geography_code, dr.note
       FROM regs.district_rarea dr JOIN regs.district d ON d.district_id = dr.district_id
       WHERE dr.rarea_id = $1 ORDER BY d.district_code`, [(request.params as { id: string }).id]);
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  app.put("/restricted-areas/:id/districts", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = putRareaDistrictsSchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq("invalid")]));
    const id = (request.params as { id: string }).id;
    try {
      await withTransaction(request.identity!.email, async (c) => {
        await bumpParent(c, "regs.restricted_area", "rarea_id", id, request.identity!.email, p.data.expected_updated_at);
        await c.query(`DELETE FROM regs.district_rarea WHERE rarea_id=$1`, [id]);
        for (const l of p.data.links)
          await c.query(`INSERT INTO regs.district_rarea (district_id, rarea_id, note) VALUES ($1,$2,$3)`, [l.district_id, id, l.note ?? null]);
      });
      return reply.send(ok([{ rarea_id: id }], { generatedAt: now() }));
    } catch (err) { if (await send409IfConflict(reply, err)) return reply; return send500(reply, err); }
  });

  // ── Note edits ────────────────────────────────────────────────────────────
  app.patch("/notes/:id", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = patchNoteSchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq("invalid")]));
    const { expected_updated_at, ...f } = p.data;
    const sets: Record<string, unknown> = {};
    if (f.note_text !== undefined) sets.note_text = f.note_text;
    if (f.species_code !== undefined) sets.species_code = f.species_code;
    if (Object.keys(sets).length === 0) return reply.code(400).send(fail([badReq("no fields")]));
    try {
      await withTransaction(request.identity!.email, (c) =>
        lockedUpdate(c, "regs.district_note", "note_id", (request.params as { id: string }).id, request.identity!.email, expected_updated_at, sets));
      return reply.send(ok([{ note_id: (request.params as { id: string }).id }], { generatedAt: now() }));
    } catch (err) { if (await send409IfConflict(reply, err)) return reply; return send500(reply, err); }
  });

  // ── Users (admin) ─────────────────────────────────────────────────────────
  app.get("/users", { preHandler: [requireRole("admin")] }, async (_request, reply) => {
    const res = await query(
      `SELECT user_id, email, display_name, role, must_reset, is_active_flag,
              to_char(created_at,'YYYY-MM-DD') AS created_at FROM regs.staff_user ORDER BY email`);
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  app.post("/users", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const p = createUserSchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq(p.error.issues[0]?.message ?? "invalid")]));
    const temp = randomBytes(9).toString("base64url");
    const pwHash = await hash(temp);
    try {
      const res = await withTransaction(request.identity!.email, (c) =>
        c.query<{ user_id: string }>(`INSERT INTO regs.staff_user (email, password_hash, display_name, role, must_reset) VALUES ($1,$2,$3,$4,1) RETURNING user_id`,
          [p.data.email.toLowerCase(), pwHash, p.data.display_name, p.data.role]));
      return reply.code(201).send(ok([{ user_id: res.rows[0]!.user_id, temp_password: temp }], { generatedAt: now() }));
    } catch (err) { return sendWriteError(reply, err); }
  });

  app.patch("/users/:id", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const p = patchUserSchema.safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq("invalid")]));
    const id = (request.params as { id: string }).id;
    if (id === request.identity!.userId && (p.data.role !== undefined || p.data.is_active === false))
      return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "You cannot change your own role or deactivate yourself." }]));
    const sets: string[] = []; const params: unknown[] = [];
    if (p.data.role !== undefined) { params.push(p.data.role); sets.push(`role=$${params.length}`); }
    if (p.data.display_name !== undefined) { params.push(p.data.display_name); sets.push(`display_name=$${params.length}`); }
    if (p.data.is_active !== undefined) { params.push(p.data.is_active ? 1 : 0); sets.push(`is_active_flag=$${params.length}`); }
    if (sets.length === 0) return reply.code(400).send(fail([badReq("no fields")]));
    params.push(id);
    await withTransaction(request.identity!.email, async (c) => {
      await c.query(`UPDATE regs.staff_user SET ${sets.join(", ")}, updated_at=CURRENT_TIMESTAMP WHERE user_id=$${params.length}`, params);
      if (p.data.is_active === false) await c.query(`DELETE FROM regs.staff_session WHERE user_id=$1`, [id]);
    });
    return reply.send(ok([{ user_id: id }], { generatedAt: now() }));
  });

  app.post("/users/:id/reset-password", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const temp = randomBytes(9).toString("base64url");
    const pwHash = await hash(temp);
    await withTransaction(request.identity!.email, async (c) => {
      await c.query(`UPDATE regs.staff_user SET password_hash=$2, must_reset=1, updated_at=CURRENT_TIMESTAMP WHERE user_id=$1`, [id, pwHash]);
      await c.query(`DELETE FROM regs.staff_session WHERE user_id=$1`, [id]);
    });
    return reply.send(ok([{ user_id: id, temp_password: temp }], { generatedAt: now() }));
  });

  // ── Publications + diff ───────────────────────────────────────────────────
  app.get("/publications", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int().optional() }).safeParse(request.query);
    const params: unknown[] = [];
    let where = "";
    if (q.success && q.data.year) { params.push(q.data.year); where = `WHERE p.season_year = $1`; }
    const res = await query(
      `SELECT p.season_year, p.version, p.published_by, p.note,
              p.is_correction, p.correction_summary, p.affected_species, p.affected_districts,
              to_char(p.published_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published_at,
              (SELECT count(*) FROM regs.published_regulations pr WHERE pr.season_year=p.season_year AND pr.version=p.version) AS row_count
       FROM regs.publication p ${where} ORDER BY p.season_year DESC, p.version DESC`, params);
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });

  app.get("/season-years/:year/diff", async (request, reply) => {
    const year = Number((request.params as { year: string }).year);
    const diff = await computeDiff(year);
    return reply.send(ok([diff], { generatedAt: now() }));
  });

  // ── Important dates ─────────────────────────────────────────────────────────
  app.get("/important-dates", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([badReq("year required")]));
    const res = await query(
      `SELECT important_date_id, date_code, date_kind, species_scope, label,
              to_char(starts_on,'YYYY-MM-DD') AS starts_on, to_char(ends_on,'YYYY-MM-DD') AS ends_on,
              note, sort_order, record_status, to_char(updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
       FROM regs.important_date WHERE season_year=$1 ORDER BY date_kind, sort_order`, [q.data.year]);
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });
  const importantDateBody = z.object({
    date_code: z.string().max(60), date_kind: z.enum(["SEASON", "DEADLINE", "DRAWING_RESULT", "REFUND", "PURCHASE_WINDOW"]),
    species_scope: z.string().max(60).nullable().optional(), label: z.string().max(200),
    starts_on: z.string().nullable().optional(), ends_on: z.string().nullable().optional(),
    note: z.string().max(600).nullable().optional(), sort_order: z.number().int().default(0),
  });
  app.post("/important-dates", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = importantDateBody.extend({ season_year: z.number().int() }).safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq("invalid")]));
    const b = p.data;
    try {
      const res = await withTransaction(request.identity!.email, (c) =>
        c.query<{ important_date_id: string }>(
          `INSERT INTO regs.important_date (season_year, date_code, date_kind, species_scope, label, starts_on, ends_on, note, sort_order, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING important_date_id`,
          [b.season_year, b.date_code, b.date_kind, b.species_scope ?? null, b.label, b.starts_on ?? null, b.ends_on ?? null, b.note ?? null, b.sort_order, request.identity!.email]));
      return reply.code(201).send(ok([{ important_date_id: res.rows[0]!.important_date_id }], { generatedAt: now() }));
    } catch (err) { return sendWriteError(reply, err); }
  });
  app.patch("/important-dates/:id", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = importantDateBody.partial().extend({ expected_updated_at: z.string() }).safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq("invalid")]));
    const { expected_updated_at, ...f } = p.data;
    const sets: Record<string, unknown> = {};
    for (const k of ["date_kind", "species_scope", "label", "starts_on", "ends_on", "note", "sort_order"] as const)
      if (f[k] !== undefined) sets[k] = f[k];
    if (Object.keys(sets).length === 0) return reply.code(400).send(fail([badReq("no fields")]));
    try {
      await withTransaction(request.identity!.email, (c) =>
        lockedUpdate(c, "regs.important_date", "important_date_id", (request.params as { id: string }).id, request.identity!.email, expected_updated_at, sets));
      return reply.send(ok([{ important_date_id: (request.params as { id: string }).id }], { generatedAt: now() }));
    } catch (err) { if (await send409IfConflict(reply, err)) return reply; return send500(reply, err); }
  });
  app.delete("/important-dates/:id", { preHandler: [requireRole("approver")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    await withTransaction(request.identity!.email, (c) => c.query(`DELETE FROM regs.important_date WHERE important_date_id=$1`, [id]));
    return reply.send(ok([{ important_date_id: id }], { generatedAt: now() }));
  });

  // ── Contacts ────────────────────────────────────────────────────────────────
  app.get("/contacts", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([badReq("year required")]));
    const res = await query(
      `SELECT contact_id, contact_code, contact_kind, name, org, address, city, phone, phone2, email, url, region_id, note, sort_order,
              record_status, to_char(updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
       FROM regs.contact WHERE season_year=$1 ORDER BY contact_kind, sort_order`, [q.data.year]);
    return reply.send(ok(res.rows, { generatedAt: now() }));
  });
  const contactBody = z.object({
    contact_code: z.string().max(60),
    contact_kind: z.enum(["STATE_HQ", "HOTLINE", "REGIONAL_HQ", "FIELD_OFFICE", "STATE_AGENCY", "FEDERAL", "TRIBAL", "BEAR_SPECIALIST", "OTHER"]),
    name: z.string().max(160), org: z.string().max(160).nullable().optional(), address: z.string().max(240).nullable().optional(),
    city: z.string().max(80).nullable().optional(), phone: z.string().max(60).nullable().optional(), phone2: z.string().max(60).nullable().optional(),
    email: z.string().max(160).nullable().optional(), url: z.string().max(240).nullable().optional(),
    region_id: z.number().int().nullable().optional(), note: z.string().max(400).nullable().optional(), sort_order: z.number().int().default(0),
  });
  app.post("/contacts", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = contactBody.extend({ season_year: z.number().int() }).safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq("invalid")]));
    const b = p.data;
    try {
      const res = await withTransaction(request.identity!.email, (c) =>
        c.query<{ contact_id: string }>(
          `INSERT INTO regs.contact (season_year, contact_code, contact_kind, name, org, address, city, phone, phone2, email, url, region_id, note, sort_order, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING contact_id`,
          [b.season_year, b.contact_code, b.contact_kind, b.name, b.org ?? null, b.address ?? null, b.city ?? null, b.phone ?? null, b.phone2 ?? null, b.email ?? null, b.url ?? null, b.region_id ?? null, b.note ?? null, b.sort_order, request.identity!.email]));
      return reply.code(201).send(ok([{ contact_id: res.rows[0]!.contact_id }], { generatedAt: now() }));
    } catch (err) { return sendWriteError(reply, err); }
  });
  app.patch("/contacts/:id", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const p = contactBody.partial().extend({ expected_updated_at: z.string() }).safeParse(request.body);
    if (!p.success) return reply.code(400).send(fail([badReq("invalid")]));
    const { expected_updated_at, ...f } = p.data;
    const sets: Record<string, unknown> = {};
    for (const k of ["contact_kind", "name", "org", "address", "city", "phone", "phone2", "email", "url", "region_id", "note", "sort_order"] as const)
      if (f[k] !== undefined) sets[k] = f[k];
    if (Object.keys(sets).length === 0) return reply.code(400).send(fail([badReq("no fields")]));
    try {
      await withTransaction(request.identity!.email, (c) =>
        lockedUpdate(c, "regs.contact", "contact_id", (request.params as { id: string }).id, request.identity!.email, expected_updated_at, sets));
      return reply.send(ok([{ contact_id: (request.params as { id: string }).id }], { generatedAt: now() }));
    } catch (err) { if (await send409IfConflict(reply, err)) return reply; return send500(reply, err); }
  });
  app.delete("/contacts/:id", { preHandler: [requireRole("approver")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    await withTransaction(request.identity!.email, (c) => c.query(`DELETE FROM regs.contact WHERE contact_id=$1`, [id]));
    return reply.send(ok([{ contact_id: id }], { generatedAt: now() }));
  });
}
