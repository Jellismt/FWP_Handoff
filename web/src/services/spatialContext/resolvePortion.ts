/**
 * @file resolvePortion.ts
 * @module engage-mt/services/spatialContext
 * @description Resolve the FWP district PORTION(s) covering a tapped point. FWP
 *              publishes per-species portion polygons (sub-district areas like
 *              "Portion of HD 314 South of Rock Creek") as public MapServer
 *              sublayers — Antelope /4, Mule Deer /12, White-tailed /13, Elk /14 —
 *              each keyed DISTRICT + SHAPECODE + PORTIONNAME. A single point can
 *              fall inside several species' portions, so this queries all four and
 *              returns every hit; the SHAPECODE matches a regulation row's
 *              portion_code so the district panel can emphasize the tapped portion.
 *
 *              Privacy: the tapped point goes only to FWP's public REST endpoint
 *              (same class of service the map already uses); nothing user-identifying
 *              leaves the device. Mirrors weaponRestriction.ts. Per privacy.md.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { queryAttributesAtPoint } from "@/services/spatialContext/queryAtPoint";
import { asString } from "@/utils/arcgisAttrs";

const PORTION_SERVICE_BASE =
  "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer";

/** The public per-species portion sublayers (verified live 2026-07-14). */
const PORTION_LAYERS: readonly { species: string; url: string }[] = [
  { species: "antelope", url: `${PORTION_SERVICE_BASE}/4` },
  { species: "mule deer", url: `${PORTION_SERVICE_BASE}/12` },
  { species: "white-tailed deer", url: `${PORTION_SERVICE_BASE}/13` },
  { species: "elk", url: `${PORTION_SERVICE_BASE}/14` },
];

const PORTION_FIELDS = ["DISTRICT", "SHAPECODE", "PORTIONNAME"] as const;

/** A district portion whose polygon contains the tapped point. */
export interface PortionHit {
  /** Parent hunting-district code, e.g. "314". */
  district: string;
  /** SHAPECODE — matches a regulation row's portion_code. */
  shapecode: string;
  /** Published name, e.g. "Portion of HD 314 South of Rock Creek". */
  portionName: string;
}

const portionFromAttrs = (attrs: Record<string, unknown>): PortionHit | null => {
  const district = asString(attrs.DISTRICT);
  const shapecode = asString(attrs.SHAPECODE);
  const portionName = asString(attrs.PORTIONNAME);
  if (!district || !shapecode || !portionName) return null;
  return { district, shapecode, portionName };
};

/**
 * Resolve every portion polygon (across the four species layers) covering a WGS84
 * point. Returns [] on any failure path (tap outside all portions, service miss,
 * timeout) so callers fall back to whole-district behavior. Never rejects.
 */
export const resolvePortionsAtPoint = async (point: {
  latitude: number;
  longitude: number;
}): Promise<PortionHit[]> => {
  const hits = await Promise.all(
    PORTION_LAYERS.map((l) =>
      queryAttributesAtPoint({
        url: l.url,
        longitude: point.longitude,
        latitude: point.latitude,
        outFields: PORTION_FIELDS,
      })
        .then((attrs) => (attrs ? portionFromAttrs(attrs) : null))
        .catch(() => null),
    ),
  );
  return hits.filter((h): h is PortionHit => h !== null);
};
