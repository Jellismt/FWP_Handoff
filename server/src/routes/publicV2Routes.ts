/**
 * @file publicV2Routes.ts
 * @module engage-mt/server/routes
 * @description Public v2 read API (/api/v2/fwp) — license fees, reference content
 *              (laws & rules, etc.), region maps,
 *              important dates, contacts, district notes, youth opportunities, and
 *              restricted areas. Everything with a draft workflow reads the immutable
 *              published_* snapshots (or filters record_status='PUBLISHED'); map assets
 *              resolve through the CmsProvider (Bloomreach stub today). Same ETag/CORS
 *              posture as the v1 public routes. Also serves the mid-year corrections feed
 *              (/hunting/corrections) from the publication event metadata.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-14
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok, fail } from "@engage-mt/regs-shared";
import { query } from "../db/pool.js";
import { pickCmsProvider } from "../services/cms/provider.js";

const nowIso = () => new Date().toISOString();
const selfBase = () => process.env.PUBLIC_API_BASE ?? "";

async function latestVersion(seasonYear: number): Promise<number | null> {
  const r = await query<{ v: number | null }>(`SELECT max(version) AS v FROM regs.publication WHERE season_year=$1`, [seasonYear]);
  return r.rows[0]?.v == null ? null : Number(r.rows[0]!.v);
}

export async function publicV2Routes(app: FastifyInstance): Promise<void> {
  // ── License fees ──────────────────────────────────────────────────────────
  app.get("/hunting/license-fees", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "year required" }]));
    const version = await latestVersion(q.data.year);
    if (version == null) return reply.send(ok([], { generatedAt: nowIso() }));
    const rows = await query<{ product_code: string; display_name: string; product_kind: string; species_code: string | null; apply_by: string | null; chart_note: string | null; sort_order: number; audience_code: string; price_cents: number; price_note: string | null }>(
      `SELECT product_code, display_name, product_kind, species_code, apply_by, chart_note, sort_order, audience_code, price_cents, price_note
       FROM regs.published_fees WHERE season_year=$1 AND version=$2 ORDER BY sort_order, product_code, audience_code`,
      [q.data.year, version],
    );
    const byProduct = new Map<string, { code: string; name: string; kind: string; species: string | null; applyBy: string | null; note: string | null; prices: Record<string, { cents: number; note: string | null }> }>();
    for (const r of rows.rows) {
      let p = byProduct.get(r.product_code);
      if (!p) { p = { code: r.product_code, name: r.display_name, kind: r.product_kind, species: r.species_code, applyBy: r.apply_by, note: r.chart_note, prices: {} }; byProduct.set(r.product_code, p); }
      p.prices[r.audience_code] = { cents: r.price_cents, note: r.price_note };
    }
    return reply.send(ok([...byProduct.values()], { generatedAt: nowIso(), filters: { year: q.data.year, version } }));
  });

  // ── Reference content ─────────────────────────────────────────────────────
  app.get("/hunting/content", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int(), category: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "year required" }]));
    const version = await latestVersion(q.data.year);
    if (version == null) return reply.send(ok([], { generatedAt: nowIso() }));
    const params: unknown[] = [q.data.year, version];
    let catFilter = "";
    if (q.data.category) { params.push(q.data.category); catFilter = ` AND category = $${params.length}`; }
    const rows = await query(
      `SELECT slug, category, title, statute_refs, sort_order FROM regs.published_content
       WHERE season_year=$1 AND version=$2${catFilter} ORDER BY category, sort_order`,
      params,
    );
    return reply.send(ok(rows.rows, { generatedAt: nowIso() }));
  });

  app.get("/hunting/content/:slug", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "year required" }]));
    const version = await latestVersion(q.data.year);
    if (version == null) return reply.code(404).send(fail([{ code: "NOT_FOUND", message: "no published content" }]));
    const rows = await query(
      `SELECT slug, category, title, body_md, statute_refs FROM regs.published_content
       WHERE season_year=$1 AND version=$2 AND slug=$3`,
      [q.data.year, version, (request.params as { slug: string }).slug],
    );
    if (rows.rows.length === 0) return reply.code(404).send(fail([{ code: "NOT_FOUND", message: "section not found" }]));
    return reply.send(ok(rows.rows, { generatedAt: nowIso() }));
  });

  // ── Region maps ───────────────────────────────────────────────────────────
  app.get("/hunting/regions", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int().optional(), geography: z.string().default("HD") }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "invalid" }]));
    const cms = pickCmsProvider(selfBase());
    const rows = await query<{ region_id: number; region_name: string; cms_doc_id: string | null; title: string | null; alt_text: string | null; caption: string | null }>(
      `SELECT r.region_id, r.region_name, a.cms_doc_id, a.title, a.alt_text, a.caption
       FROM regs.region r
       LEFT JOIN regs.region_asset ra ON ra.region_id=r.region_id AND ra.geography_code=$1
       LEFT JOIN regs.cms_asset a ON a.asset_id=ra.asset_id
       ORDER BY r.region_id`, [q.data.geography]);
    const data = await Promise.all(rows.rows.map(async (r) => ({
      region_id: r.region_id, region_name: r.region_name,
      map: r.cms_doc_id ? { url: await cms.resolveUrl(r.cms_doc_id), title: r.title, altText: r.alt_text, caption: r.caption } : null,
    })));
    return reply.send(ok(data, { generatedAt: nowIso() }));
  });

  // ── Important dates ───────────────────────────────────────────────────────
  app.get("/hunting/important-dates", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "year required" }]));
    const version = await latestVersion(q.data.year);
    if (version == null) return reply.send(ok([], { generatedAt: nowIso() }));
    const rows = await query(
      `SELECT date_code, date_kind, species_scope, label,
              to_char(starts_on,'YYYY-MM-DD') AS starts_on, to_char(ends_on,'YYYY-MM-DD') AS ends_on,
              note, sort_order
       FROM regs.published_important_dates WHERE season_year=$1 AND version=$2 ORDER BY sort_order, date_code`,
      [q.data.year, version]);
    return reply.send(ok(rows.rows, { generatedAt: nowIso(), filters: { year: q.data.year, version } }));
  });

  // ── Contacts ──────────────────────────────────────────────────────────────
  app.get("/hunting/contacts", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "year required" }]));
    const version = await latestVersion(q.data.year);
    if (version == null) return reply.send(ok([], { generatedAt: nowIso() }));
    const rows = await query(
      `SELECT contact_code, contact_kind, name, org, address, city, phone, phone2, email, url, region_id, note, sort_order
       FROM regs.published_contacts WHERE season_year=$1 AND version=$2 ORDER BY sort_order, contact_code`,
      [q.data.year, version]);
    return reply.send(ok(rows.rows, { generatedAt: nowIso(), filters: { year: q.data.year, version } }));
  });

  // ── Youth / PTHFV opportunities (derived from opportunity restrictions) ──────
  // Reads the working opportunity table (a derived cross-cut has no snapshot), but
  // filters record_status='PUBLISHED' so DRAFT edits can never leak pre-publish.
  app.get("/hunting/youth-opportunities", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "year required" }]));
    const rows = await query(
      `SELECT DISTINCT d.geography_code, d.district_code, li.species_code, li.display_name AS license,
              lac.display_label AS opportunity, o.validity_note,
              string_agg(DISTINCT r.restr_code, ',') AS restriction_codes
       FROM regs.opportunity o
       JOIN regs.opp_restriction r ON r.opportunity_id=o.opportunity_id AND r.restr_code IN ('YOUTH_ONLY','PTHFV')
       JOIN regs.license_instrument li ON li.instrument_id=o.instrument_id
       JOIN regs.legal_animal_class lac ON lac.animal_class_id=o.animal_class_id
       JOIN regs.hunt_area ha ON ha.hunt_area_id=o.hunt_area_id
       JOIN regs.hunt_area_member ham ON ham.hunt_area_id=ha.hunt_area_id
       JOIN regs.district d ON d.district_id=ham.district_id
       WHERE o.season_year=$1 AND o.record_status='PUBLISHED'
       GROUP BY d.geography_code, d.district_code, li.species_code, li.display_name, lac.display_label, o.validity_note
       ORDER BY d.district_code, li.species_code`,
      [q.data.year]);
    return reply.send(ok(rows.rows, { generatedAt: nowIso() }));
  });

  // ── District notes ────────────────────────────────────────────────────────
  // Per-district NOTEs (CWD sampling mandates, closures, agency phones) from the
  // published_district_notes snapshot (0025). Grouped one row per district so the
  // app can index by district_code directly.
  app.get("/hunting/district-notes", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "year required" }]));
    const version = await latestVersion(q.data.year);
    if (version == null) return reply.send(ok([], { generatedAt: nowIso() }));
    const rows = await query<{ district_code: string; geography_code: string; notes: string[] }>(
      `SELECT district_code, geography_code,
              json_agg(note_text ORDER BY note_seq, note_id) AS notes
       FROM regs.published_district_notes
       WHERE season_year=$1 AND version=$2
       GROUP BY district_code, geography_code
       ORDER BY district_code`,
      [q.data.year, version]);
    return reply.send(ok(rows.rows, { generatedAt: nowIso(), filters: { year: q.data.year, version } }));
  });

  // ── Restricted areas ──────────────────────────────────────────────────────
  // restricted_area has NO draft workflow (no record_status column — it is a
  // pure-ETL, season-scoped table; see 0006). Reading it directly cannot leak
  // draft edits, so no snapshot is needed.
  app.get("/hunting/restricted-areas", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "year required" }]));
    const rows = await query(
      `SELECT ra.area_type, ra.area_name, ra.legal_desc,
              COALESCE((SELECT json_agg(d.district_code ORDER BY d.district_code)
                        FROM regs.district_rarea dr JOIN regs.district d ON d.district_id=dr.district_id
                        WHERE dr.rarea_id=ra.rarea_id),'[]') AS districts
       FROM regs.restricted_area ra WHERE ra.season_year=$1 ORDER BY ra.area_name`, [q.data.year]);
    return reply.send(ok(rows.rows, { generatedAt: nowIso() }));
  });

  // ── Corrections & updates ─────────────────────────────────────────────────
  // The public "what changed since the book was published" feed: every mid-year
  // correction (publication v2+, is_correction=true) for the year, newest first.
  // Reads the publication event only — a metadata record, never draft content —
  // so it cannot leak unpublished regulations.
  app.get("/hunting/corrections", async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(fail([{ code: "INVALID_PARAM", message: "year required" }]));
    const rows = await query<{
      version: number;
      published_at: string;
      summary: string | null;
      affected_species: string | null;
      affected_districts: string | null;
      note: string | null;
    }>(
      `SELECT version,
              to_char(published_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published_at,
              correction_summary AS summary, affected_species, affected_districts, note
       FROM regs.publication
       WHERE season_year=$1 AND is_correction = true
       ORDER BY version DESC`,
      [q.data.year],
    );
    return reply.send(
      ok(
        rows.rows.map((r) => ({ ...r, version: Number(r.version) })),
        { generatedAt: nowIso(), filters: { year: q.data.year } },
      ),
    );
  });
}
