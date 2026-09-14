/**
 * @file staffRoutes.ts
 * @module engage-mt/server/routes
 * @description Staff CRUD + workflow API (session auth + RBAC). Reads: season years,
 *              district browser, district detail (the money read). Writes: instruments,
 *              opportunities, notes — each optimistic-lock-checked and audit-stamped via
 *              withTransaction(actor). Workflow: validation, clone-forward, publish,
 *              audit log. Every route chains requireAuth; mutations add requireRole.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-14
 * @version 1.1.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok, fail, createSeasonYearSchema } from "@engage-mt/regs-shared";
import { query, withTransaction } from "../db/pool.js";
import { requireAuth, requireRole, requireNotMustReset } from "../auth/rbac.js";
import { validateSeasonYear } from "../services/validation.js";
import { publishSeasonYear } from "../services/publish.js";
import { cloneSeasonForward } from "../services/clone.js";
import { sendWriteError } from "./lockHelpers.js";

const nowIso = () => new Date().toISOString();

export async function staffRoutes(app: FastifyInstance): Promise<void> {
  // Everything here requires a session + a completed password reset.
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireNotMustReset);

  // ── Season years ─────────────────────────────────────────────────────────
  app.get("/season-years", async (_req, reply) => {
    const res = await query(
      `SELECT sy.season_year, sy.status_code,
              to_char(sy.starts_on,'YYYY-MM-DD') AS starts_on,
              to_char(sy.ends_on,'YYYY-MM-DD')   AS ends_on,
              to_char(sy.adopted_on,'YYYY-MM-DD') AS adopted_on,
              (SELECT max(version) FROM regs.publication p WHERE p.season_year = sy.season_year) AS version,
              (SELECT count(*) FROM regs.license_instrument li WHERE li.season_year = sy.season_year AND li.record_status <> 'ARCHIVED') AS instrument_count
       FROM regs.season_year sy ORDER BY sy.season_year DESC`,
    );
    return reply.send(ok(res.rows, { generatedAt: nowIso() }));
  });

  // Create a brand-new (empty, DRAFT) season year — the prerequisite for clone-forward,
  // which refuses to write into a year that doesn't exist yet. Approver-gated: creating
  // an edition is a lifecycle act.
  app.post("/season-years", { preHandler: [requireRole("approver")] }, async (request, reply) => {
    const parsed = createSeasonYearSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: parsed.error.issues[0]?.message ?? "invalid" }]));
    const b = parsed.data;
    if (b.ends_on <= b.starts_on) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "ends_on must be after starts_on." }]));
    const exists = await query<{ n: string }>(`SELECT count(*) AS n FROM regs.season_year WHERE season_year = $1`, [b.season_year]);
    if (Number(exists.rows[0]?.n ?? "0") > 0)
      return reply.code(409).send(fail([{ code: "CONFLICT", message: `Season year ${b.season_year} already exists.` }]));
    await withTransaction(request.identity!.email, (client) =>
      client.query(
        `INSERT INTO regs.season_year (season_year, starts_on, ends_on, status_code, notes) VALUES ($1,$2,$3,'DRAFT',$4)`,
        [b.season_year, b.starts_on, b.ends_on, b.notes ?? null],
      ),
    );
    return reply.code(201).send(ok([{ season_year: b.season_year }], { generatedAt: nowIso() }));
  });

  app.get("/season-years/:year/validation", async (request, reply) => {
    const year = Number((request.params as { year: string }).year);
    const findings = await validateSeasonYear(year);
    return reply.send(ok(findings, { generatedAt: nowIso(), filters: { season_year: year } }));
  });

  app.post("/season-years/:year/clone-from/:prev", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const { year, prev } = request.params as { year: string; prev: string };
    const result = await cloneSeasonForward(Number(prev), Number(year), request.identity!.email);
    if (!result.ok) return reply.code(409).send(fail([{ code: "CONFLICT", message: result.reason ?? "Clone failed." }]));
    return reply.send(ok([result.counts], { generatedAt: nowIso() }));
  });

  app.post("/season-years/:year/publish", { preHandler: [requireRole("approver")] }, async (request, reply) => {
    const year = Number((request.params as { year: string }).year);
    const body = z
      .object({
        note: z.string().min(1).max(1000),
        // Optional mid-year-correction metadata (only stored when the resulting version is v2+).
        correction_summary: z.string().max(2000).optional(),
        affected_species: z.string().max(200).optional(),
        affected_districts: z.string().max(2000).optional(),
      })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "A changelog note is required." }]));
    const result = await publishSeasonYear(year, request.identity!.email, body.data.note, {
      correctionSummary: body.data.correction_summary ?? null,
      affectedSpecies: body.data.affected_species ?? null,
      affectedDistricts: body.data.affected_districts ?? null,
    });
    if (!result.ok) {
      return reply
        .code(409)
        .send(fail([{ code: "CONFLICT", message: `Cannot publish: ${result.blockingCount} blocking validation error(s).` }]));
    }
    return reply.send(ok([{ season_year: year, version: result.version }], { generatedAt: nowIso() }));
  });

  // ── District browser + detail ────────────────────────────────────────────
  app.get("/districts", async (request, reply) => {
    const q = z
      .object({ year: z.coerce.number().int(), geography: z.enum(["HD", "ANTELOPE_HD"]).optional() })
      .safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "year is required." }]));
    const params: unknown[] = [q.data.year];
    let geoFilter = "";
    if (q.data.geography) {
      params.push(q.data.geography);
      geoFilter = ` AND d.geography_code = $${params.length}`;
    }
    // district_id is the raw BIGINT-as-string (see pool.ts). The SPA pickers pre-check
    // members via Set<string>.has(district_id), so this endpoint and the member/link
    // reads (GET /hunt-areas/:id/members, /restricted-areas/:id/districts) must all keep
    // district_id a string — a one-sided int8 type-parser or ::text cast would break the match.
    const res = await query(
      `SELECT d.district_id, d.district_code, d.geography_code, d.region_id, d.district_name,
              (SELECT count(DISTINCT li.instrument_id)
                 FROM regs.opportunity o
                 JOIN regs.license_instrument li ON li.instrument_id = o.instrument_id
                WHERE o.home_district_id = d.district_id AND o.season_year = $1
                  AND o.record_status <> 'ARCHIVED') AS instrument_count
       FROM regs.district d
       WHERE (d.last_season IS NULL OR d.last_season >= $1)${geoFilter}
       ORDER BY d.region_id, d.district_code`,
      params,
    );
    return reply.send(ok(res.rows, { generatedAt: nowIso(), filters: q.data }));
  });

  app.get("/districts/:code/detail", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int(), geography: z.enum(["HD", "ANTELOPE_HD"]).default("HD") }).safeParse(
      request.query,
    );
    if (!q.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "year is required." }]));
    const code = (request.params as { code: string }).code;
    // Opportunities in this district (as home HD), with instrument + class + windows + restrictions.
    const opps = await query(
      `SELECT o.opportunity_id, o.split_seq, o.validity_note, o.record_status,
              o.instrument_id, o.animal_class_id, o.hunt_area_id,
              to_char(o.updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
              to_char(li.updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS instrument_updated_at,
              li.instr_code, li.display_name AS instrument_name, li.instr_type_code,
              li.species_code, li.is_draw, li.quota_current, li.quota_min, li.quota_max, li.quota_unlimited,
              to_char(li.apply_by,'YYYY-MM-DD') AS apply_by, to_char(li.otc_from,'YYYY-MM-DD') AS otc_from,
              lac.class_code, lac.display_label AS legal_animal,
              ha.area_code,
              COALESCE((
                SELECT json_agg(json_build_object('season_type', sw.season_type_code, 'window_seq', sw.window_seq,
                                                  'raw_range', sw.raw_range,
                                                  'starts_on', to_char(sw.starts_on,'YYYY-MM-DD'),
                                                  'ends_on', to_char(sw.ends_on,'YYYY-MM-DD'))
                                ORDER BY sw.window_seq)
                FROM regs.season_window sw WHERE sw.opportunity_id = o.opportunity_id), '[]') AS windows,
              COALESCE((
                SELECT json_agg(json_build_object('restr_code', r.restr_code, 'value_text', r.value_text, 'raw_text', r.raw_text)
                                ORDER BY r.restr_seq)
                FROM regs.opp_restriction r WHERE r.opportunity_id = o.opportunity_id), '[]') AS restrictions
       FROM regs.opportunity o
       JOIN regs.district d ON d.district_id = o.home_district_id AND d.district_code = $2 AND d.geography_code = $3
       JOIN regs.license_instrument li ON li.instrument_id = o.instrument_id
       JOIN regs.legal_animal_class lac ON lac.animal_class_id = o.animal_class_id
       JOIN regs.hunt_area ha ON ha.hunt_area_id = o.hunt_area_id
       WHERE o.season_year = $1 AND o.record_status <> 'ARCHIVED'
       ORDER BY li.species_code, li.instr_type_code, li.instr_code, o.split_seq`,
      [q.data.year, code, q.data.geography],
    );
    const notes = await query(
      `SELECT dn.note_id, dn.species_code, dn.note_text, dn.record_status,
              to_char(dn.updated_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
       FROM regs.district_note dn
       JOIN regs.district d ON d.district_id = dn.district_id AND d.district_code = $2 AND d.geography_code = $3
       WHERE dn.season_year = $1 AND dn.record_status <> 'ARCHIVED' ORDER BY dn.note_seq`,
      [q.data.year, code, q.data.geography],
    );
    // The district's surrogate id (used as home_district_id when adding an opportunity)
    // — resolved independently so it's present even when the district has no opps yet.
    const dRow = await query<{ district_id: string }>(
      `SELECT district_id FROM regs.district WHERE district_code = $1 AND geography_code = $2`,
      [code, q.data.geography],
    );
    return reply.send(
      ok([{ district_code: code, district_id: dRow.rows[0]?.district_id ?? null, opportunities: opps.rows, notes: notes.rows }], {
        generatedAt: nowIso(),
        filters: q.data,
      }),
    );
  });

  // ── Instruments (editor) ─────────────────────────────────────────────────
  const instrumentBody = z.object({
    season_year: z.number().int(),
    instr_type_code: z.enum(["GENERAL", "PERMIT", "B_LICENSE", "SPECIES_LICENSE", "B_SPECIES_LICENSE"]),
    species_code: z.enum(["deer", "elk", "antelope"]),
    instr_code: z.string().max(12),
    display_name: z.string().max(120),
    is_draw: z.boolean(),
    apply_by: z.string().nullable().optional(),
    otc_from: z.string().nullable().optional(),
    quota_current: z.number().int().nullable().optional(),
    quota_unlimited: z.boolean().default(false),
    quota_min: z.number().int().nullable().optional(),
    quota_max: z.number().int().nullable().optional(),
    per_hunter_max: z.number().int().nullable().optional(),
  });

  app.post("/instruments", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const parsed = instrumentBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: parsed.error.message }]));
    const b = parsed.data;
    try {
      const res = await withTransaction(request.identity!.email, (client) =>
        client.query<{ instrument_id: string }>(
          `INSERT INTO regs.license_instrument
             (season_year, instr_type_code, species_code, instr_code, display_name, is_draw,
              apply_by, otc_from, quota_current, quota_unlimited, quota_min, quota_max, per_hunter_max, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING instrument_id`,
          [
            b.season_year, b.instr_type_code, b.species_code, b.instr_code, b.display_name, b.is_draw ? 1 : 0,
            b.apply_by ?? null, b.otc_from ?? null, b.quota_current ?? null, b.quota_unlimited ? 1 : 0,
            b.quota_min ?? null, b.quota_max ?? null, b.per_hunter_max ?? 1, request.identity!.email,
          ],
        ),
      );
      return reply.code(201).send(ok([{ instrument_id: res.rows[0]!.instrument_id }], { generatedAt: nowIso() }));
    } catch (err) {
      return sendWriteError(reply, err);
    }
  });

  const instrumentPatch = z.object({
    display_name: z.string().max(120).optional(),
    quota_current: z.number().int().nullable().optional(),
    quota_min: z.number().int().nullable().optional(),
    quota_max: z.number().int().nullable().optional(),
    apply_by: z.string().nullable().optional(),
    otc_from: z.string().nullable().optional(),
    expected_updated_at: z.string(),
  });

  app.patch("/instruments/:id", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const parsed = instrumentPatch.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: parsed.error.message }]));
    const b = parsed.data;
    const sets: string[] = [];
    const params: unknown[] = [];
    const push = (col: string, val: unknown) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (b.display_name !== undefined) push("display_name", b.display_name);
    if (b.quota_current !== undefined) push("quota_current", b.quota_current);
    if (b.quota_min !== undefined) push("quota_min", b.quota_min);
    if (b.quota_max !== undefined) push("quota_max", b.quota_max);
    if (b.apply_by !== undefined) push("apply_by", b.apply_by);
    if (b.otc_from !== undefined) push("otc_from", b.otc_from);
    if (sets.length === 0) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "No fields to update." }]));
    params.push(request.identity!.email);
    sets.push(`updated_by = $${params.length}`);
    sets.push(`revision = revision + 1`);
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);
    const idIdx = params.length;
    params.push(b.expected_updated_at);
    const lockIdx = params.length;
    try {
      const res = await withTransaction(request.identity!.email, (client) =>
        client.query(
          `UPDATE regs.license_instrument SET ${sets.join(", ")}
           WHERE instrument_id = $${idIdx}
             AND date_trunc('second', updated_at) = date_trunc('second', $${lockIdx}::timestamptz)
           RETURNING instrument_id`,
          params,
        ),
      );
      if (res.rowCount === 0) {
        return reply.code(409).send(fail([{ code: "CONFLICT", message: "Row changed since you loaded it — reload." }]));
      }
      return reply.send(ok([{ instrument_id: id }], { generatedAt: nowIso() }));
    } catch (err) {
      return sendWriteError(reply, err);
    }
  });

  app.delete("/instruments/:id", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    await withTransaction(request.identity!.email, (client) =>
      client.query(
        `UPDATE regs.license_instrument SET record_status = 'ARCHIVED', updated_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE instrument_id = $1`,
        [id, request.identity!.email],
      ),
    );
    return reply.send(ok([{ instrument_id: id }], { generatedAt: nowIso() }));
  });

  // ── District notes (editor) ──────────────────────────────────────────────
  const noteBody = z.object({
    season_year: z.number().int(),
    district_code: z.string(),
    geography_code: z.enum(["HD", "ANTELOPE_HD"]).default("HD"),
    species_code: z.enum(["deer", "elk", "antelope"]).nullable().optional(),
    note_text: z.string().min(1).max(2000),
  });
  app.post("/notes", { preHandler: [requireRole("editor")] }, async (request, reply) => {
    const parsed = noteBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: parsed.error.message }]));
    const b = parsed.data;
    const d = await query<{ district_id: string }>(
      `SELECT district_id FROM regs.district WHERE district_code = $1 AND geography_code = $2`,
      [b.district_code, b.geography_code],
    );
    if (!d.rows[0]) return reply.code(404).send(fail([{ code: "NOT_FOUND", message: "District not found." }]));
    const res = await withTransaction(request.identity!.email, (client) =>
      client.query<{ note_id: string }>(
        `INSERT INTO regs.district_note (season_year, district_id, species_code, note_text, updated_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING note_id`,
        [b.season_year, d.rows[0]!.district_id, b.species_code ?? null, b.note_text, request.identity!.email],
      ),
    );
    return reply.code(201).send(ok([{ note_id: res.rows[0]!.note_id }], { generatedAt: nowIso() }));
  });

}
