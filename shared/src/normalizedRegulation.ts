/**
 * @file normalizedRegulation.ts
 * @module engage-mt/shared
 * @description The flattened `NormalizedRegulation` output contract — a byte-for-byte
 *              mirror of web/src/services/hunt/regsTypes.ts. The public read API and the
 *              published snapshot both emit this shape; a conformance test asserts the
 *              server type is assignable to the web type, so a future live-REST
 *              cutover can flip with zero client change.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { z } from "zod";

/** Coarse species id — mirrors web `HuntSpeciesId`. */
export const HUNT_SPECIES_IDS = [
  "deer",
  "elk",
  "antelope",
  "moose",
  "sheep",
  "goat",
  "bison",
  "bear",
  "wolf",
  "furbearer",
  "lion",
  "turkey",
  "upland",
  "migratory",
] as const;
export type HuntSpeciesId = (typeof HUNT_SPECIES_IDS)[number];

/** Which district geography a rule is keyed by — mirrors web `HuntGeographyType`. */
export const HUNT_GEOGRAPHY_TYPES = [
  "hd",
  "antelope-hd",
  "sheep-hd",
  "moose-hd",
  "goat-hd",
  "bison-hd",
  "upland-district",
  "turkey-district",
  "migratory-zone",
  "bmu",
  "lmu",
  "region",
  "statewide",
] as const;
export type HuntGeographyType = (typeof HUNT_GEOGRAPHY_TYPES)[number];

/** One raw weapon-season window, parsed at runtime by the web app's seasonWindow.ts. */
export const weaponWindowSchema = z.object({
  weapon: z.string(),
  /** Raw range string, e.g. "Sep 05-Oct 18". */
  range: z.string(),
});
export type WeaponWindow = z.infer<typeof weaponWindowSchema>;

/**
 * The normalized regulation row — the unified dataset's record shape and the
 * public engine's only input. Field names + nullability match web exactly.
 */
export const normalizedRegulationSchema = z.object({
  rule_id: z.string(),
  species: z.enum(HUNT_SPECIES_IDS),
  species_group: z.string(),
  geography_type: z.enum(HUNT_GEOGRAPHY_TYPES),
  geography_id: z.string(),
  region: z.number().nullable(),
  district_name: z.string().nullable(),
  legal_animal: z.string(),
  required_license: z.string(),
  is_draw: z.boolean(),
  weapon_windows: z.array(weaponWindowSchema),
  quota: z.number().nullable(),
  apply_by_date: z.string().nullable(),
  opportunity_specific: z.string().nullable(),
  effective_date: z.string(),
  expires_date: z.string().nullable(),
  source_reg_id: z.string(),
  // Sub-district portion scope (e.g. "Portion of HD 314 South of Rock Creek"). Additive:
  // geography_id stays the parent district_code; portion_code is the SHAPECODE-derived key
  // and joins to FWP's ESRI portion polygon. Optional/nullable for back-compat with
  // pre-portion published snapshots and older clients.
  portion_code: z.string().nullable().optional(),
  portion_name: z.string().nullable().optional(),
});
export type NormalizedRegulation = z.infer<typeof normalizedRegulationSchema>;
