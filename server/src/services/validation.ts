/**
 * @file validation.ts
 * @module engage-mt/server/services
 * @description Server-computed season-year validation. Blocking findings gate publish;
 *              warnings are advisory. Each finding carries a deep-link hint the SPA
 *              turns into a jump into the district/instrument editor.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-14
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { query } from "../db/pool.js";

export type FindingSeverity = "error" | "warning";

export interface ValidationFinding {
  severity: FindingSeverity;
  code: string;
  message: string;
  /** Deep-link hint, e.g. "district:210" or "instrument:210-03". */
  anchor: string | null;
}

/** Run all checks for a season year. */
export async function validateSeasonYear(seasonYear: number): Promise<ValidationFinding[]> {
  const findings: ValidationFinding[] = [];

  // 1. Every instrument has ≥1 opportunity.
  const orphanInstr = await query<{ instr_code: string }>(
    `SELECT li.instr_code
     FROM regs.license_instrument li
     WHERE li.season_year = $1 AND li.record_status <> 'ARCHIVED'
       AND NOT EXISTS (SELECT 1 FROM regs.opportunity o WHERE o.instrument_id = li.instrument_id
                        AND o.record_status <> 'ARCHIVED')`,
    [seasonYear],
  );
  for (const r of orphanInstr.rows) {
    findings.push({
      severity: "error",
      code: "INSTRUMENT_NO_OPPORTUNITY",
      message: `Instrument ${r.instr_code} has no opportunities.`,
      anchor: `instrument:${r.instr_code}`,
    });
  }

  // 2. Season windows must fall inside the season year.
  const outOfRange = await query<{ instr_code: string; district_code: string | null }>(
    `SELECT DISTINCT li.instr_code, d.district_code
     FROM regs.season_window sw
     JOIN regs.opportunity o ON o.opportunity_id = sw.opportunity_id
     JOIN regs.license_instrument li ON li.instrument_id = o.instrument_id
     LEFT JOIN regs.district d ON d.district_id = o.home_district_id
     JOIN regs.season_year sy ON sy.season_year = o.season_year
     WHERE o.season_year = $1 AND o.record_status <> 'ARCHIVED'
       AND (sw.starts_on < sy.starts_on OR sw.ends_on > sy.ends_on)`,
    [seasonYear],
  );
  for (const r of outOfRange.rows) {
    findings.push({
      severity: "error",
      code: "WINDOW_OUT_OF_SEASON",
      message: `Instrument ${r.instr_code} has a season window outside the season year.`,
      anchor: r.district_code ? `district:${r.district_code}` : `instrument:${r.instr_code}`,
    });
  }

  // 3. quota_current within commission range (belt-and-suspenders; DB CHECK also enforces).
  const quotaOut = await query<{ instr_code: string }>(
    `SELECT instr_code FROM regs.license_instrument
     WHERE season_year = $1 AND record_status <> 'ARCHIVED'
       AND quota_current IS NOT NULL AND quota_min IS NOT NULL AND quota_max IS NOT NULL
       AND (quota_current < quota_min OR quota_current > quota_max)`,
    [seasonYear],
  );
  for (const r of quotaOut.rows) {
    findings.push({
      severity: "error",
      code: "QUOTA_OUT_OF_RANGE",
      message: `Instrument ${r.instr_code} quota is outside the commission range.`,
      anchor: `instrument:${r.instr_code}`,
    });
  }

  // 4. Districts with opportunities but no general-season row (warning).
  const noGeneral = await query<{ district_code: string }>(
    `SELECT DISTINCT d.district_code
     FROM regs.opportunity o
     JOIN regs.license_instrument li ON li.instrument_id = o.instrument_id
     JOIN regs.district d ON d.district_id = o.home_district_id
     WHERE o.season_year = $1 AND o.record_status <> 'ARCHIVED'
       AND NOT EXISTS (
         SELECT 1 FROM regs.opportunity o2
         JOIN regs.license_instrument li2 ON li2.instrument_id = o2.instrument_id
         WHERE o2.home_district_id = o.home_district_id
           AND li2.instr_type_code = 'GENERAL' AND o2.record_status <> 'ARCHIVED')`,
    [seasonYear],
  );
  for (const r of noGeneral.rows) {
    findings.push({
      severity: "warning",
      code: "DISTRICT_NO_GENERAL",
      message: `District ${r.district_code} has no General license opportunity.`,
      anchor: `district:${r.district_code}`,
    });
  }

  // ── Spatial-parity checks ───────────────────────────────────────────────────
  // A regulation is served per-district by fanning each opportunity across its
  // hunt_area's members. These checks catch the failure the staff editor can hide:
  // a hunt area with no members (its opportunities serve to no district), a MULTI
  // area that never got its extra members, or a restricted area linked to nothing.

  // 5. A hunt area with active opportunities but ZERO members — those opportunities
  //    fan out to no district and disappear from the published per-district view.
  const orphanArea = await query<{ area_code: string; opp_count: string }>(
    `SELECT ha.area_code,
            count(o.opportunity_id) AS opp_count
     FROM regs.hunt_area ha
     JOIN regs.opportunity o ON o.hunt_area_id = ha.hunt_area_id AND o.record_status <> 'ARCHIVED'
     WHERE ha.season_year = $1
       AND NOT EXISTS (SELECT 1 FROM regs.hunt_area_member m WHERE m.hunt_area_id = ha.hunt_area_id)
     GROUP BY ha.area_code
     ORDER BY ha.area_code`,
    [seasonYear],
  );
  for (const r of orphanArea.rows) {
    findings.push({
      severity: "error",
      code: "HUNT_AREA_NO_MEMBERS",
      message: `Hunt area ${r.area_code} has ${r.opp_count} opportunit${r.opp_count === "1" ? "y" : "ies"} but no member districts — they serve to no district.`,
      anchor: `huntarea:${r.area_code}`,
    });
  }

  // 6. A MULTI-district hunt area with fewer than 2 members — usually an ETL
  //    validity-phrase parse miss ("valid in HDs 380 & 391" that only linked one).
  const thinMulti = await query<{ area_code: string; member_count: string }>(
    `SELECT ha.area_code,
            count(m.member_seq) AS member_count
     FROM regs.hunt_area ha
     LEFT JOIN regs.hunt_area_member m ON m.hunt_area_id = ha.hunt_area_id
     WHERE ha.season_year = $1 AND ha.area_kind = 'MULTI'
     GROUP BY ha.area_code
     HAVING count(m.member_seq) < 2
     ORDER BY ha.area_code`,
    [seasonYear],
  );
  for (const r of thinMulti.rows) {
    findings.push({
      severity: "warning",
      code: "MULTI_AREA_SINGLE_MEMBER",
      message: `Multi-district hunt area ${r.area_code} has only ${r.member_count} member — expected 2 or more.`,
      anchor: `huntarea:${r.area_code}`,
    });
  }

  // 7. A restricted area with no district links — its legal text is not tied to
  //    any district, so it never surfaces on a district's regulations.
  const unlinkedRarea = await query<{ area_name: string }>(
    `SELECT ra.area_name
     FROM regs.restricted_area ra
     WHERE ra.season_year = $1
       AND NOT EXISTS (SELECT 1 FROM regs.district_rarea dr WHERE dr.rarea_id = ra.rarea_id)
     ORDER BY ra.area_name`,
    [seasonYear],
  );
  for (const r of unlinkedRarea.rows) {
    findings.push({
      severity: "warning",
      code: "RESTRICTED_AREA_NO_DISTRICTS",
      message: `Restricted area "${r.area_name}" is linked to no district.`,
      anchor: `rarea:${r.area_name}`,
    });
  }

  // 8. Portion curation backlog: an opportunity whose note describes a sub-district area,
  //    in a district that HAS portion polygons, but which isn't linked to any portion
  //    (still serves to the whole district). These are the candidates the syncPortions +
  //    rekeyPortions ETL couldn't auto-link — staff wire them on the Portions surface.
  //    Warning (advisory), scoped to districts with portions so it stays actionable.
  const unlinkedPortion = await query<{ district_code: string; species_code: string; n: string }>(
    `SELECT d.district_code, li.species_code, count(*)::text AS n
     FROM regs.opportunity o
     JOIN regs.license_instrument li ON li.instrument_id = o.instrument_id
     JOIN regs.district d ON d.district_id = o.home_district_id
     WHERE o.season_year = $1 AND o.record_status <> 'ARCHIVED'
       AND o.validity_note ~* '(portion|that part|east of|west of|north of|south of|wilderness|management zone)'
       AND EXISTS (SELECT 1 FROM regs.district_portion dp WHERE dp.district_id = o.home_district_id)
       AND NOT EXISTS (SELECT 1 FROM regs.hunt_area_member m WHERE m.hunt_area_id = o.hunt_area_id AND m.portion_id IS NOT NULL)
     GROUP BY d.district_code, li.species_code
     ORDER BY d.district_code, li.species_code`,
    [seasonYear],
  );
  for (const r of unlinkedPortion.rows) {
    findings.push({
      severity: "warning",
      code: "PORTION_TEXT_UNLINKED",
      message: `District ${r.district_code} (${r.species_code}) has ${r.n} sub-area opportunit${r.n === "1" ? "y" : "ies"} not linked to a portion — wire on the Portions screen or leave as whole-district.`,
      anchor: `district:${r.district_code}`,
    });
  }

  return findings;
}

/** True when there are no blocking (error) findings. */
export function isPublishable(findings: ValidationFinding[]): boolean {
  return !findings.some((f) => f.severity === "error");
}
