/**
 * @file plss.ts
 * @module engage-mt/services/spatialContext
 * @description Public Land Survey System (Township / Range / Section)
 *              lookup at a tapped point. Warden and SAR location work uses the
 *              PLSS survey grid, which covers all land — unlike an assessor
 *              parcel's TRS, which is blank on public + state-trust ground.
 *              Backs the "Survey location (PLSS)" pill in the cadastral card's
 *              identity stack (via its `usePlssTrs` hook).
 *
 *              Source: the BLM National PLSS CadNSDI "PLSS Intersected" layer
 *              (public, no auth) — one query returns township label + section in
 *              a single feature. Fields verified 2026-07-06 against
 *              `.../BLM_Natl_PLSS_CadNSDI/MapServer/3?f=json`:
 *                TWNSHPLAB "10N 3W", FRSTDIVLAB "30", PRINMER "Montana Meridian",
 *                STATEABBR "MT".
 *              Scoped to Montana via `STATEABBR='MT'` so an out-of-state edge tap
 *              resolves to null instead of a neighboring state's grid.
 *
 *              Privacy: the tap point goes only to the same class of public REST
 *              endpoint the map already uses; no coordinate reaches analytics.
 *              Per `docs/rules/privacy.md`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-06
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { queryAttributesAtPoint } from "./queryAtPoint";
import { asString } from "@/utils/arcgisAttrs";

const PLSS_INTERSECTED_URL =
  "https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/3";

export interface PlssLocation {
  /** Formatted survey descriptor, e.g. "T10N R3W Sec 30". */
  trs: string;
  /** Township label as published, e.g. "10N 3W". */
  townshipLabel: string;
  /** Section number, e.g. "30". */
  section: string | null;
  /** Principal meridian, e.g. "Montana Meridian". */
  meridian: string | null;
}

/**
 * Format the raw TWNSHPLAB ("10N 3W") + section ("30") into the canonical
 * "T10N R3W Sec 30". Returns the township label unchanged if it doesn't parse
 * into the expected two tokens.
 */
export const formatTrs = (townshipLabel: string, section: string | null): string => {
  const parts = townshipLabel.trim().split(/\s+/);
  const twp = parts.length >= 1 && parts[0] ? `T${parts[0]}` : townshipLabel;
  const rng = parts.length >= 2 && parts[1] ? ` R${parts[1]}` : "";
  const sec = section ? ` Sec ${section}` : "";
  return `${twp}${rng}${sec}`.trim();
};

/**
 * Resolve the PLSS Township / Range / Section at a WGS84 point. Returns null on
 * any failure path (no hit, timeout, out-of-state) so the caller drops the row
 * gracefully rather than throwing — the tap must never be slowed or broken by
 * this lookup.
 */
export async function lookupPlssAtPoint(
  longitude: number,
  latitude: number,
): Promise<PlssLocation | null> {
  const attrs = await queryAttributesAtPoint({
    url: PLSS_INTERSECTED_URL,
    longitude,
    latitude,
    outFields: ["TWNSHPLAB", "FRSTDIVLAB", "PRINMER"],
    where: "STATEABBR='MT'",
  });
  if (!attrs) return null;
  const townshipLabel = asString(attrs.TWNSHPLAB);
  if (!townshipLabel) return null;
  const section = asString(attrs.FRSTDIVLAB);
  const meridian = asString(attrs.PRINMER);
  return {
    trs: formatTrs(townshipLabel, section),
    townshipLabel,
    section,
    meridian,
  };
}
