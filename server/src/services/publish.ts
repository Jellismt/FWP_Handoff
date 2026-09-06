/**
 * @file publish.ts
 * @module engage-mt/server/services
 * @description Publish a season year: validate → flip DRAFT rows to PUBLISHED → mark
 *              the season PUBLISHED → materialize the immutable published_regulations
 *              snapshot from v_regs_unified → record the publication event. All in one
 *              transaction stamped with the approver (audit). Mid-year corrections
 *              re-run this and bump the version — a v2+ publish is flagged is_correction
 *              with optional summary + affected D/E/A scope (0026) for the corrections feed.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-14
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { withTransaction } from "../db/pool.js";
import { validateSeasonYear, isPublishable } from "./validation.js";

export interface PublishResult {
  ok: boolean;
  version?: number;
  blockingCount?: number;
  isCorrection?: boolean;
}

/**
 * Optional mid-year-correction metadata. Only meaningful when the resulting version is
 * >= 2 (re-publishing an already-live year); ignored on a first publish. Surfaced by the
 * staff Corrections screen + the public /hunting/corrections feed.
 */
export interface CorrectionInput {
  correctionSummary?: string | null;
  affectedSpecies?: string | null;
  affectedDistricts?: string | null;
}

const SNAPSHOT_COLUMNS = `
  season_year, version, rule_id, species, species_group, geography_type, geography_id,
  region, district_name, legal_animal, required_license, is_draw, weapon_windows, quota,
  apply_by_date, opportunity_specific, effective_date, expires_date, source_reg_id,
  portion_code, portion_name`;

export async function publishSeasonYear(
  seasonYear: number,
  approver: string,
  note: string,
  correction: CorrectionInput = {},
): Promise<PublishResult> {
  const findings = await validateSeasonYear(seasonYear);
  if (!isPublishable(findings)) {
    return { ok: false, blockingCount: findings.filter((f) => f.severity === "error").length };
  }

  return withTransaction(approver, async (client) => {
    // Flip DRAFT → PUBLISHED for the year's mutable rows.
    await client.query(
      `UPDATE regs.license_instrument SET record_status = 'PUBLISHED', updated_by = $2
       WHERE season_year = $1 AND record_status = 'DRAFT'`,
      [seasonYear, approver],
    );
    await client.query(
      `UPDATE regs.opportunity SET record_status = 'PUBLISHED', updated_by = $2
       WHERE season_year = $1 AND record_status = 'DRAFT'`,
      [seasonYear, approver],
    );
    await client.query(
      `UPDATE regs.district_note SET record_status = 'PUBLISHED', updated_by = $2
       WHERE season_year = $1 AND record_status = 'DRAFT'`,
      [seasonYear, approver],
    );
    // Fees + content publish inside the SAME transaction/version ("one book,
    // one version" — the print export depends on this invariant).
    await client.query(
      `UPDATE regs.license_product SET record_status = 'PUBLISHED', updated_by = $2
       WHERE season_year = $1 AND record_status = 'DRAFT'`,
      [seasonYear, approver],
    );
    await client.query(
      `UPDATE regs.content_section SET record_status = 'PUBLISHED', updated_by = $2
       WHERE season_year = $1 AND record_status = 'DRAFT'`,
      [seasonYear, approver],
    );
    await client.query(
      `UPDATE regs.important_date SET record_status = 'PUBLISHED', updated_by = $2
       WHERE season_year = $1 AND record_status = 'DRAFT'`,
      [seasonYear, approver],
    );
    await client.query(
      `UPDATE regs.contact SET record_status = 'PUBLISHED', updated_by = $2
       WHERE season_year = $1 AND record_status = 'DRAFT'`,
      [seasonYear, approver],
    );
    await client.query(`UPDATE regs.season_year SET status_code = 'PUBLISHED' WHERE season_year = $1`, [seasonYear]);

    // Next version.
    const vRes = await client.query<{ next: number }>(
      `SELECT COALESCE(max(version),0) + 1 AS next FROM regs.publication WHERE season_year = $1`,
      [seasonYear],
    );
    const version = Number(vRes.rows[0]!.next);
    // Any re-publish of an already-live year (v2+) is a mid-year correction; the first
    // publish is the book. Correction scope fields are stored only when it's a correction.
    const isCorrection = version >= 2;
    const summary = isCorrection ? (correction.correctionSummary ?? null) : null;
    const species = isCorrection ? (correction.affectedSpecies ?? null) : null;
    const districts = isCorrection ? (correction.affectedDistricts ?? null) : null;

    // Publication event.
    const pubRes = await client.query<{ publication_id: string }>(
      `INSERT INTO regs.publication
         (season_year, version, published_by, note, is_correction, correction_summary, affected_species, affected_districts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING publication_id`,
      [seasonYear, version, approver, note, isCorrection, summary, species, districts],
    );
    const publicationId = pubRes.rows[0]!.publication_id;

    // Materialize the snapshot from the flat view (now that rows are PUBLISHED).
    await client.query(
      `INSERT INTO regs.published_regulations (${SNAPSHOT_COLUMNS})
       SELECT season_year, $2, rule_id, species, species_group, geography_type, geography_id,
              region, district_name, legal_animal, required_license, is_draw,
              COALESCE(weapon_windows, '[]'), quota, apply_by_date, opportunity_specific,
              COALESCE(effective_date, to_char((SELECT starts_on FROM regs.season_year WHERE season_year = $1), 'YYYY-MM-DD')),
              expires_date, COALESCE(source_reg_id, 'dea-' || $1::text),
              portion_code, portion_name
       FROM regs.v_regs_unified
       WHERE season_year = $1`,
      [seasonYear, version],
    );

    // Snapshot fees (from v_fees_flat) + content into their published_* tables.
    await client.query(
      `INSERT INTO regs.published_fees
         (season_year, version, product_code, display_name, product_kind, species_code,
          audience_code, price_cents, apply_by, chart_note, price_note, sort_order)
       SELECT season_year, $2, product_code, display_name, product_kind, species_code,
              audience_code, price_cents, apply_by, chart_note, price_note, sort_order
       FROM regs.v_fees_flat WHERE season_year = $1`,
      [seasonYear, version],
    );
    await client.query(
      `INSERT INTO regs.published_content
         (season_year, version, slug, category, title, body_md, statute_refs, sort_order)
       SELECT season_year, $2, slug, category, title, body_md, statute_refs, sort_order
       FROM regs.content_section WHERE season_year = $1 AND record_status = 'PUBLISHED'`,
      [seasonYear, version],
    );
    // Important dates + contacts snapshot (same "one book, one version" invariant).
    await client.query(
      `INSERT INTO regs.published_important_dates
         (season_year, version, date_code, date_kind, species_scope, label, starts_on, ends_on, note, sort_order)
       SELECT season_year, $2, date_code, date_kind, species_scope, label, starts_on, ends_on, note, sort_order
       FROM regs.important_date WHERE season_year = $1 AND record_status = 'PUBLISHED'`,
      [seasonYear, version],
    );
    await client.query(
      `INSERT INTO regs.published_contacts
         (season_year, version, contact_code, contact_kind, name, org, address, city, phone, phone2, email, url, region_id, note, sort_order)
       SELECT season_year, $2, contact_code, contact_kind, name, org, address, city, phone, phone2, email, url, region_id, note, sort_order
       FROM regs.contact WHERE season_year = $1 AND record_status = 'PUBLISHED'`,
      [seasonYear, version],
    );
    // District notes snapshot (0025) — the per-district NOTEs (CWD sampling, closures,
    // agency phones) that the app's District Regulations panel surfaces.
    await client.query(
      `INSERT INTO regs.published_district_notes
         (season_year, version, note_id, district_code, geography_code, species_code, note_seq, note_text)
       SELECT dn.season_year, $2, dn.note_id, d.district_code, d.geography_code, dn.species_code, dn.note_seq, dn.note_text
       FROM regs.district_note dn JOIN regs.district d ON d.district_id = dn.district_id
       WHERE dn.season_year = $1 AND dn.record_status = 'PUBLISHED'`,
      [seasonYear, version],
    );

    // Explicit PUBLISH audit marker.
    await client.query(
      `INSERT INTO regs.audit_log (table_name, row_pk, action_code, changed_by, publication_id, new_row_json)
       VALUES ('publication', $1, 'PUBLISH', $2, $1, $3)`,
      [
        publicationId,
        approver,
        JSON.stringify({ season_year: seasonYear, version, note, is_correction: isCorrection, correction_summary: summary }),
      ],
    );

    return { ok: true, version, isCorrection };
  });
}
