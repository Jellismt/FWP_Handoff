/**
 * @file regsTypes.ts
 * @module engage-mt/services/hunt
 * @description The normalized hunting-regulation contract — the single row shape
 *              every species (DEA / MSGB / Bear / Wolf-Furbearer / Lion / Turkey /
 *              Birds) maps into, and the geography vocabulary that keys it. The
 *              Consumers read ONLY this shape, so adding a species
 *              is a build-time adapter + (if its geography differs) a resolver
 *              entry — never an engine change.
 *
 *              Stored snake_case to match the SQL-backed row convention
 *              (cf. DistrictFactsRow) and loaded from the unified JSON
 *              dataset. Season date ranges stay RAW here and are
 *              parsed at runtime by `seasonWindow.ts` (reuses the tested Nov→Feb
 *              wrap + open/next logic).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/** Coarse species id — one per huntable animal the regulations dataset covers. */
export type HuntSpeciesId =
  | "deer"
  | "elk"
  | "antelope"
  | "moose"
  | "sheep"
  | "goat"
  | "bison"
  | "bear"
  | "wolf"
  | "furbearer"
  | "lion"
  | "turkey"
  | "upland"
  | "migratory";

/**
 * Which district geography a rule is keyed by. Each maps to one ArcGIS layer the
 * point-resolver queries (see `resolveHuntGeographies.ts`). `statewide` matches
 * every Montana point (wolf); `region` is the FWP R1–R7 admin region (furbearer).
 */
export type HuntGeographyType =
  | "hd" // Deer / Elk / Lion — admbnd/huntingDistricts/MapServer/11
  | "antelope-hd" // /3
  | "sheep-hd" // /5
  | "moose-hd" // /16
  | "goat-hd" // /19
  | "bison-hd"
  | "upland-district" // /31
  | "turkey-district"
  | "migratory-zone"
  | "bmu" // Bear Management Unit
  | "lmu" // Lion Management Unit
  | "region" // FWP admin region R1–R7
  | "statewide";

/** A resolved (type, id) pair — the output of point→geography resolution. */
export interface HuntGeography {
  type: HuntGeographyType;
  /** Code within that geography; "STATE" for statewide. */
  id: string;
}

/** One raw weapon-season window, parsed at runtime by seasonWindow.ts. */
export interface WeaponWindow {
  weapon: string;
  /** Raw range string, e.g. "Sep 05-Oct 18" / "Apr. 15-Jun. 15". */
  range: string;
}

/**
 * The normalized regulation row — the unified dataset's record shape and the
 * engine's only input. One row per (geography × species × opportunity), carrying
 * every weapon window for that opportunity.
 */
export interface NormalizedRegulation {
  rule_id: string;
  species: HuntSpeciesId;
  /** Source regulation group: 'dea' | 'msgb' | 'bear' | 'wolf-furbearer' | 'lion' | 'turkey' | 'birds'. */
  species_group: string;
  geography_type: HuntGeographyType;
  geography_id: string;
  region: number | null;
  district_name: string | null;
  /** Pill label, e.g. "Brow-tined Bull Elk", "Antlered Bull Moose", "Black Bear". */
  legal_animal: string;
  /** Human label of the credential this opportunity needs. */
  required_license: string;
  /** True when this is a drawn (limited-quota) opportunity. */
  is_draw: boolean;
  /** Parsed by the provider from the JSON-string column in the source table. */
  weapon_windows: WeaponWindow[];
  quota: number | null;
  apply_by_date: string | null;
  opportunity_specific: string | null;
  /** Commission-adopted date (ISO). */
  effective_date: string;
  /** Last day the citation is current (ISO), or null. */
  expires_date: string | null;
  /** regs-index.json id of the source PDF (citation + deep-link). */
  source_reg_id: string;
  /** Sub-district portion scope (e.g. "Portion of HD 314 South of Rock Creek"); optional. */
  portion_code?: string | null;
  portion_name?: string | null;
}
