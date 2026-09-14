/**
 * @file publishedRepo.ts
 * @module engage-mt/server/db
 * @description Read helpers over the immutable published_regulations snapshot — the
 *              ONLY table the public API touches. Draft rows can never leak here.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { NormalizedRegulation } from "@engage-mt/regs-shared";
import { query } from "./pool.js";

export interface PublishedYear {
  season_year: number;
  version: number;
  published_at: string;
  effective_from: string | null;
  valid_until: string | null;
}

/** The latest published (season_year, version) — the "current" year the public app reads. */
export async function latestPublishedYear(): Promise<PublishedYear | null> {
  const res = await query<PublishedYear>(
    `SELECT p.season_year, p.version, to_char(p.published_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published_at,
            to_char(sy.starts_on,'YYYY-MM-DD') AS effective_from,
            to_char(sy.ends_on,'YYYY-MM-DD')   AS valid_until
     FROM regs.publication p
     JOIN regs.season_year sy ON sy.season_year = p.season_year
     WHERE sy.status_code = 'PUBLISHED'
     ORDER BY p.season_year DESC, p.version DESC
     LIMIT 1`,
  );
  return res.rows[0] ?? null;
}

/** Resolve the latest published version for a specific season year, or null. */
export async function latestVersionFor(seasonYear: number): Promise<number | null> {
  const res = await query<{ version: number }>(
    `SELECT max(version) AS version FROM regs.publication WHERE season_year = $1`,
    [seasonYear],
  );
  const v = res.rows[0]?.version;
  return v == null ? null : Number(v);
}

interface SnapshotRow {
  rule_id: string;
  species: string;
  species_group: string;
  geography_type: string;
  geography_id: string;
  region: number | null;
  district_name: string | null;
  legal_animal: string;
  required_license: string;
  is_draw: number;
  weapon_windows: string;
  quota: number | null;
  apply_by_date: string | null;
  opportunity_specific: string | null;
  effective_date: string;
  expires_date: string | null;
  source_reg_id: string;
  portion_code: string | null;
  portion_name: string | null;
}

function toNormalized(r: SnapshotRow): NormalizedRegulation {
  let windows: NormalizedRegulation["weapon_windows"] = [];
  try {
    windows = JSON.parse(r.weapon_windows ?? "[]") ?? [];
  } catch {
    windows = [];
  }
  return {
    rule_id: r.rule_id,
    species: r.species as NormalizedRegulation["species"],
    species_group: r.species_group,
    geography_type: r.geography_type as NormalizedRegulation["geography_type"],
    geography_id: r.geography_id,
    region: r.region == null ? null : Number(r.region),
    district_name: r.district_name,
    legal_animal: r.legal_animal,
    required_license: r.required_license,
    is_draw: r.is_draw === 1,
    weapon_windows: windows,
    quota: r.quota == null ? null : Number(r.quota),
    apply_by_date: r.apply_by_date,
    opportunity_specific: r.opportunity_specific,
    effective_date: r.effective_date,
    expires_date: r.expires_date,
    source_reg_id: r.source_reg_id,
    portion_code: r.portion_code,
    portion_name: r.portion_name,
  };
}

export interface RegFilters {
  seasonYear: number;
  version: number;
  species?: string;
  district?: string;
  region?: number;
  /** Filter to a specific district portion by its SHAPECODE-derived portion_code. */
  portion?: string;
}

/** Query snapshot rows (all DEA species) with optional filters. */
export async function queryPublishedRegs(f: RegFilters): Promise<NormalizedRegulation[]> {
  const conds = ["season_year = $1", "version = $2"];
  const params: unknown[] = [f.seasonYear, f.version];
  if (f.species) {
    params.push(f.species);
    conds.push(`species = $${params.length}`);
  }
  if (f.district) {
    params.push(f.district);
    conds.push(`geography_id = $${params.length}`);
  }
  if (f.region != null) {
    params.push(f.region);
    conds.push(`region = $${params.length}`);
  }
  if (f.portion) {
    params.push(f.portion);
    conds.push(`portion_code = $${params.length}`);
  }
  const res = await query<SnapshotRow>(
    `SELECT rule_id, species, species_group, geography_type, geography_id, region,
            district_name, legal_animal, required_license, is_draw, weapon_windows,
            quota, apply_by_date, opportunity_specific, effective_date, expires_date, source_reg_id,
            portion_code, portion_name
     FROM regs.published_regulations
     WHERE ${conds.join(" AND ")}
     ORDER BY geography_id, required_license, rule_id`,
    params,
  );
  return res.rows.map(toNormalized);
}
