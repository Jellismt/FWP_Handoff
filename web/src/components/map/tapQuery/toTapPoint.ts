/**
 * @file toTapPoint.ts
 * @module engage-mt/map
 * @description Pure reducer converting an ArcGIS Point to the privacy-safe
 *              `TapPoint` shape every FeatureCard renderer receives. Extracted
 *              from MapView.tsx. The point already lives in
 *              browser memory (the user just tapped it); we strip the Esri
 *              prototype so React + the takeover store don't keep a live
 *              reference to a map graphic. The coordinate never leaves the
 *              device — per `docs/rules/privacy.md`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-06-29
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { TapPoint } from "@/types/featureCard";

/**
 * Strip an ArcGIS `Point` down to the plain `TapPoint` record. Returns `null`
 * for a missing point or one without resolvable lat/lon so callers can skip
 * enrichment rather than thread an unusable coordinate.
 */
export const toTapPoint = (mp: __esri.Point | null | undefined): TapPoint | null => {
  if (!mp) return null;
  const lat = mp.latitude;
  const lon = mp.longitude;
  if (lat == null || lon == null) return null;
  return {
    x: mp.x,
    y: mp.y,
    latitude: lat,
    longitude: lon,
    spatialReferenceWkid: mp.spatialReference?.wkid ?? undefined,
  };
};
