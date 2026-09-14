/**
 * @file clone.ts
 * @module engage-mt/server/services
 * @description Clone-forward: deep-copy a source season year into a target year as
 *              DRAFT (updated_by='clone'), shifting dates by the year offset for staff
 *              review. FKs are re-resolved by NATURAL keys in the target year
 *              (area_code / instr_code / animal class / district) — no surrogate-id
 *              maps, so the SQL stays simple and Oracle-portable. Carries hunt areas +
 *              members (district AND portion), instruments, opportunities, windows,
 *              restrictions, district notes, and restricted areas + their district links.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-14
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { withTransaction } from "../db/pool.js";
import { query } from "../db/pool.js";

export interface CloneResult {
  ok: boolean;
  reason?: string;
  counts?: Record<string, number>;
}

/** Deep-copy `fromYear` → `toYear`. `toYear` must exist and be empty of instruments. */
export async function cloneSeasonForward(
  fromYear: number,
  toYear: number,
  actor: string,
): Promise<CloneResult> {
  const offset = toYear - fromYear;
  if (offset === 0) return { ok: false, reason: "Source and target year are the same." };

  const tgtExists = await query<{ n: string }>(`SELECT count(*) AS n FROM regs.season_year WHERE season_year = $1`, [
    toYear,
  ]);
  if (Number(tgtExists.rows[0]?.n ?? "0") === 0) {
    return { ok: false, reason: `Target season year ${toYear} does not exist — create it first.` };
  }
  const tgtInstr = await query<{ n: string }>(
    `SELECT count(*) AS n FROM regs.license_instrument WHERE season_year = $1`,
    [toYear],
  );
  if (Number(tgtInstr.rows[0]?.n ?? "0") > 0) {
    return { ok: false, reason: `Target year ${toYear} already has instruments — refusing to overwrite.` };
  }

  // make_interval(years => n) — oracle-note: ADD_MONTHS(col, 12*offset)
  const yShift = `make_interval(years => ${offset})`;

  return withTransaction(actor, async (client) => {
    const counts: Record<string, number> = {};

    const ha = await client.query(
      `INSERT INTO regs.hunt_area (season_year, area_code, area_kind, definition_text)
       SELECT $2, area_code, area_kind, definition_text FROM regs.hunt_area WHERE season_year = $1`,
      [fromYear, toYear],
    );
    counts.hunt_area = ha.rowCount ?? 0;

    const ham = await client.query(
      `INSERT INTO regs.hunt_area_member (hunt_area_id, member_seq, district_id, portion_id)
       SELECT nha.hunt_area_id, m.member_seq, m.district_id, m.portion_id
       FROM regs.hunt_area_member m
       JOIN regs.hunt_area oha ON oha.hunt_area_id = m.hunt_area_id AND oha.season_year = $1
       JOIN regs.hunt_area nha ON nha.area_code = oha.area_code AND nha.season_year = $2`,
      [fromYear, toYear],
    );
    counts.hunt_area_member = ham.rowCount ?? 0;

    const li = await client.query(
      `INSERT INTO regs.license_instrument
         (season_year, instr_type_code, species_code, instr_code, display_name, is_draw,
          apply_by, otc_from, quota_current, quota_unlimited, quota_min, quota_max,
          per_hunter_max, record_status, revision, updated_by, source_doc_id, source_page, raw_text)
       SELECT $2, instr_type_code, species_code, instr_code, display_name, is_draw,
              CASE WHEN apply_by IS NULL THEN NULL ELSE (apply_by + ${yShift})::date END,
              CASE WHEN otc_from IS NULL THEN NULL ELSE (otc_from + ${yShift})::date END,
              quota_current, quota_unlimited, quota_min, quota_max,
              per_hunter_max, 'DRAFT', 1, 'clone', source_doc_id, source_page, raw_text
       FROM regs.license_instrument WHERE season_year = $1 AND record_status <> 'ARCHIVED'`,
      [fromYear, toYear],
    );
    counts.license_instrument = li.rowCount ?? 0;

    const opp = await client.query(
      `INSERT INTO regs.opportunity
         (season_year, instrument_id, animal_class_id, hunt_area_id, split_seq,
          home_district_id, print_order, validity_note, record_status, revision, updated_by,
          source_doc_id, source_page, raw_text)
       SELECT $2, nli.instrument_id, o.animal_class_id, nha.hunt_area_id, o.split_seq,
              o.home_district_id, o.print_order, o.validity_note, 'DRAFT', 1, 'clone',
              o.source_doc_id, o.source_page, o.raw_text
       FROM regs.opportunity o
       JOIN regs.license_instrument oli ON oli.instrument_id = o.instrument_id AND oli.season_year = $1
       JOIN regs.license_instrument nli ON nli.instr_code = oli.instr_code AND nli.season_year = $2
       JOIN regs.hunt_area oha ON oha.hunt_area_id = o.hunt_area_id AND oha.season_year = $1
       JOIN regs.hunt_area nha ON nha.area_code = oha.area_code AND nha.season_year = $2
       WHERE o.season_year = $1 AND o.record_status <> 'ARCHIVED'`,
      [fromYear, toYear],
    );
    counts.opportunity = opp.rowCount ?? 0;

    // Windows + restrictions: resolve target opportunity by its natural key.
    const win = await client.query(
      `INSERT INTO regs.season_window (opportunity_id, season_type_code, window_seq, starts_on, ends_on, raw_range)
       SELECT no2.opportunity_id, sw.season_type_code, sw.window_seq,
              (sw.starts_on + ${yShift})::date, (sw.ends_on + ${yShift})::date, sw.raw_range
       FROM regs.season_window sw
       JOIN regs.opportunity o  ON o.opportunity_id = sw.opportunity_id AND o.season_year = $1
       JOIN regs.license_instrument oli ON oli.instrument_id = o.instrument_id
       JOIN regs.license_instrument nli ON nli.instr_code = oli.instr_code AND nli.season_year = $2
       JOIN regs.hunt_area oha ON oha.hunt_area_id = o.hunt_area_id
       JOIN regs.hunt_area nha ON nha.area_code = oha.area_code AND nha.season_year = $2
       JOIN regs.opportunity no2 ON no2.instrument_id = nli.instrument_id
             AND no2.animal_class_id = o.animal_class_id
             AND no2.hunt_area_id = nha.hunt_area_id
             AND no2.split_seq = o.split_seq`,
      [fromYear, toYear],
    );
    counts.season_window = win.rowCount ?? 0;

    const restr = await client.query(
      `INSERT INTO regs.opp_restriction (opportunity_id, restr_seq, restr_code, value_text, raw_text)
       SELECT no2.opportunity_id, r.restr_seq, r.restr_code, r.value_text, r.raw_text
       FROM regs.opp_restriction r
       JOIN regs.opportunity o  ON o.opportunity_id = r.opportunity_id AND o.season_year = $1
       JOIN regs.license_instrument oli ON oli.instrument_id = o.instrument_id
       JOIN regs.license_instrument nli ON nli.instr_code = oli.instr_code AND nli.season_year = $2
       JOIN regs.hunt_area oha ON oha.hunt_area_id = o.hunt_area_id
       JOIN regs.hunt_area nha ON nha.area_code = oha.area_code AND nha.season_year = $2
       JOIN regs.opportunity no2 ON no2.instrument_id = nli.instrument_id
             AND no2.animal_class_id = o.animal_class_id
             AND no2.hunt_area_id = nha.hunt_area_id
             AND no2.split_seq = o.split_seq`,
      [fromYear, toYear],
    );
    counts.opp_restriction = restr.rowCount ?? 0;

    const notes = await client.query(
      `INSERT INTO regs.district_note (season_year, district_id, species_code, note_text, note_seq, record_status, updated_by, source_doc_id, source_page)
       SELECT $2, district_id, species_code, note_text, note_seq, 'DRAFT', 'clone', source_doc_id, source_page
       FROM regs.district_note WHERE season_year = $1 AND record_status <> 'ARCHIVED'`,
      [fromYear, toYear],
    );
    counts.district_note = notes.rowCount ?? 0;

    // Restricted areas (WRAs / closures / archery-only) + their district links. Season-scoped;
    // remapped by the (season_year, area_name) natural key (uq_restricted_area), so district_rarea
    // resolves the new rarea_id the same way hunt-area members resolve area_code. district_id is
    // year-agnostic.
    const rarea = await client.query(
      `INSERT INTO regs.restricted_area (season_year, area_type, area_name, legal_desc, source_doc_id, source_page, updated_by)
       SELECT $2, area_type, area_name, legal_desc, source_doc_id, source_page, 'clone'
       FROM regs.restricted_area WHERE season_year = $1`,
      [fromYear, toYear],
    );
    counts.restricted_area = rarea.rowCount ?? 0;

    const drarea = await client.query(
      `INSERT INTO regs.district_rarea (district_id, rarea_id, note)
       SELECT dr.district_id, nra.rarea_id, dr.note
       FROM regs.district_rarea dr
       JOIN regs.restricted_area ora ON ora.rarea_id = dr.rarea_id AND ora.season_year = $1
       JOIN regs.restricted_area nra ON nra.area_name = ora.area_name AND nra.season_year = $2`,
      [fromYear, toYear],
    );
    counts.district_rarea = drarea.rowCount ?? 0;

    // NOTE: fees (license_product/product_price) + content_section are also season-scoped but are
    // NOT cloned yet (deferred). If those get populated per-year, add clone blocks + update the
    // DashboardScreen confirmation copy.

    await client.query(`UPDATE regs.season_year SET status_code = 'DRAFT' WHERE season_year = $1`, [toYear]);

    return { ok: true, counts };
  });
}
