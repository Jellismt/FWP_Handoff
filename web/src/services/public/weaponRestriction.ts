/**
 * @file weaponRestriction.ts
 * @module engage-mt/services/public
 * @description Resolve the FWP weapon-restriction / big-game restricted area
 *              covering a tapped point. FWP publishes its "Big Game Restricted
 *              Areas" as a public (no-auth) MapServer sublayer
 *              (admbnd/huntingDistricts/MapServer/2) carrying, per polygon, the
 *              area's `PORTIONNAME` (e.g. "Gallatin Valley Weapons Restriction
 *              Area") and a free-text `COMMENTS` string (e.g. "Weapon
 *              Restrictions see regulations.", "Closed to big game hunting.").
 *
 *              The bundled hunting-district-facts carry only a district-level
 *              `weapon_restriction` boolean — the authoritative per-area comment
 *              was collapsed to that flag in the 3.0 rebuild. This lookup
 *              restores the verbatim text: when the user taps INSIDE a
 *              restricted-area polygon, the district card surfaces the real
 *              area name + comment instead of a generic boilerplate note.
 *
 *              Privacy: the tapped point goes only to FWP's public REST endpoint
 *              (the same class of service the map view already uses); the
 *              returned text is public FWP regulation metadata. No coordinate or
 *              user identifier leaves the device to any analytics or behavioral
 *              service. Per `docs/rules/privacy.md`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-08
 * @updated 2026-07-08
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { queryAttributesAtPoint } from "@/services/spatialContext/queryAtPoint";
import { asString } from "@/utils/arcgisAttrs";

/**
 * FWP "Big Game Restricted Areas" sublayer (public, no auth). Layer 2 of the
 * admbnd/huntingDistricts MapServer — the statewide weapon-restriction /
 * closed-area polygons. Verified live
 */
const RESTRICTED_AREA_SERVICE_URL =
  "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/2";

const RESTRICTED_AREA_FIELDS = ["PORTIONNAME", "COMMENTS", "REG"] as const;

/** A big-game restricted area whose polygon contains the tapped point. */
export interface RestrictedArea {
  /** The area's published name — e.g. "Gallatin Valley Weapons Restriction Area". */
  portionName: string;
  /** FWP's verbatim comment — e.g. "Weapon Restrictions see regulations." */
  comments: string | null;
  /** FWP region 1–7, when published. */
  region: string | null;
}

/**
 * Build a `RestrictedArea` from the service's attribute bag. Returns null when
 * the polygon publishes no usable name so the caller drops the row rather than
 * rendering a blank heading.
 */
export const restrictedAreaFromAttrs = (attrs: Record<string, unknown>): RestrictedArea | null => {
  const portionName = asString(attrs.PORTIONNAME);
  if (!portionName) return null;
  return {
    portionName,
    comments: asString(attrs.COMMENTS),
    region: asString(attrs.REG),
  };
};

/**
 * Resolve the big-game restricted area covering a WGS84 point. Returns null on
 * any failure path (tap outside every restricted polygon, service miss,
 * timeout) so callers fall back to the district-level boilerplate note.
 */
export const resolveWeaponRestrictionAtPoint = async (point: {
  latitude: number;
  longitude: number;
}): Promise<RestrictedArea | null> => {
  const attrs = await queryAttributesAtPoint({
    url: RESTRICTED_AREA_SERVICE_URL,
    longitude: point.longitude,
    latitude: point.latitude,
    outFields: RESTRICTED_AREA_FIELDS,
  });
  return attrs ? restrictedAreaFromAttrs(attrs) : null;
};
