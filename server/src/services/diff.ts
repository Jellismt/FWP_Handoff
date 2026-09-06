/**
 * @file diff.ts
 * @module engage-mt/server/services
 * @description Pre-publish diff: what will change when this season year is published.
 *              FULL OUTER JOINs the draft-inclusive projection (v_regs_unified_draft)
 *              against the latest published_regulations snapshot on rule_id →
 *              added / removed / changed (with per-field before/after). No baseline
 *              publication → everything is "added".
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { query } from "../db/pool.js";

// Per-rule regulation content only. effective_date/expires_date/source_reg_id are
// year-level provenance stamps (identical across every rule in a book, and COALESCEd
// at publish) — not per-rule edits, so they're excluded from the rule-by-rule diff.
const COMPARED = [
  "species", "geography_type", "geography_id", "region", "district_name", "legal_animal",
  "required_license", "is_draw", "weapon_windows", "quota", "apply_by_date",
  "opportunity_specific",
] as const;

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}
export interface DiffRow {
  rule_id: string;
  geography_id: string;
  status: "added" | "removed" | "changed";
  changes?: FieldChange[];
}
export interface DiffGroup {
  district_code: string;
  added: DiffRow[];
  removed: DiffRow[];
  changed: DiffRow[];
}
export interface DiffResult {
  season_year: number;
  baseline_version: number | null;
  groups: DiffGroup[];
  totals: { added: number; removed: number; changed: number };
}

type Row = Record<string, unknown> & { rule_id: string; geography_id: string };

export async function computeDiff(seasonYear: number): Promise<DiffResult> {
  const verRes = await query<{ v: number | null }>(
    `SELECT max(version) AS v FROM regs.publication WHERE season_year = $1`,
    [seasonYear],
  );
  const baseline = verRes.rows[0]?.v ?? null;

  const draftRes = await query<Row>(
    `SELECT * FROM regs.v_regs_unified_draft WHERE season_year = $1`,
    [seasonYear],
  );
  const draft = new Map(draftRes.rows.map((r) => [r.rule_id, r]));

  const publishedRows: Row[] =
    baseline == null
      ? []
      : (
          await query<Row>(
            `SELECT rule_id, species, geography_type, geography_id, region, district_name,
                    legal_animal, required_license, (is_draw=1) AS is_draw, weapon_windows, quota,
                    apply_by_date, opportunity_specific, effective_date, expires_date
             FROM regs.published_regulations WHERE season_year = $1 AND version = $2`,
            [seasonYear, baseline],
          )
        ).rows;
  const published = new Map(publishedRows.map((r) => [r.rule_id, r]));

  const groups = new Map<string, DiffGroup>();
  const group = (code: string): DiffGroup => {
    let g = groups.get(code);
    if (!g) {
      g = { district_code: code, added: [], removed: [], changed: [] };
      groups.set(code, g);
    }
    return g;
  };
  const totals = { added: 0, removed: 0, changed: 0 };

  for (const [ruleId, d] of draft) {
    const p = published.get(ruleId);
    if (!p) {
      group(d.geography_id).added.push({ rule_id: ruleId, geography_id: d.geography_id, status: "added" });
      totals.added += 1;
    } else {
      const changes: FieldChange[] = [];
      for (const f of COMPARED) {
        const a = normalize(d[f]);
        const b = normalize(p[f]);
        if (a !== b) changes.push({ field: f, before: p[f], after: d[f] });
      }
      if (changes.length > 0) {
        group(d.geography_id).changed.push({ rule_id: ruleId, geography_id: d.geography_id, status: "changed", changes });
        totals.changed += 1;
      }
    }
  }
  for (const [ruleId, p] of published) {
    if (!draft.has(ruleId)) {
      group(p.geography_id).removed.push({ rule_id: ruleId, geography_id: p.geography_id, status: "removed" });
      totals.removed += 1;
    }
  }

  return {
    season_year: seasonYear,
    baseline_version: baseline == null ? null : Number(baseline),
    groups: [...groups.values()].sort((a, b) => a.district_code.localeCompare(b.district_code)),
    totals,
  };
}

/** Stable compare key — collapses null/number/json-string wobble. */
function normalize(v: unknown): string {
  if (v == null) return "(empty)";
  if (typeof v === "boolean") return v ? "1" : "0";
  const s = String(v);
  if (s === "" || s === "[]") return "(empty)";
  return s;
}
