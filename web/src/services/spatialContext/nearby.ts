/**
 * @file nearby.ts
 * @module engage-mt/services/spatialContext
 * @description Nearby-feature lookup for the
 *              NearbyPublicAccessBlock + AdjacentTenureBlock enrichments.
 *              Issues a distance-bounded ArcGIS REST query, returns up to
 *              N features sorted by distance from the click point.
 *
 *              Public services only; no auth; coordinates stay on device.
 *              Matches the privacy contract of the rest of the spatial-
 *              context layer.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-03
 * @updated 2026-07-01
 * @version 1.3.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { fetchArcgisQuery } from "@/utils/http";

interface NearbyInput {
  url: string;
  longitude: number;
  latitude: number;
  /** Radius in miles. */
  distanceMiles: number;
  outFields: readonly string[];
  /** Max features to return. */
  limit?: number;
  timeoutMs?: number;
  /**
   * Optional SQL `where` predicate applied at the service. Useful when a
   * layer carries large numbers of micro-features (unnamed tributaries,
   * micro-ponds) that consume the result budget before the user-meaningful
   * named features are returned. Defaults to `1=1`.
   */
  where?: string;
  /**
   * Optional caller AbortSignal. Merged with the internal timeout so
   * cancelling the caller's context (e.g. component unmount) immediately
   * aborts the in-flight request rather than waiting for the timeout.
   */
  signal?: AbortSignal;
}

export interface NearbyHit {
  attributes: Record<string, unknown>;
  /** Distance in miles from the query point to the nearest feature vertex. */
  distanceMiles: number;
  /** WGS84 longitude of the nearest point on the feature (fly-to target). */
  longitude?: number;
  /** WGS84 latitude of the nearest point on the feature (fly-to target). */
  latitude?: number;
}

const METERS_PER_MILE = 1609.344;

/**
 * Query a public ArcGIS layer for features within the given distance of
 * the point. Resolves to up to `limit` features in order of distance.
 * Returns [] on any failure path.
 */
export async function queryNearbyFeatures(input: NearbyInput): Promise<NearbyHit[]> {
  const {
    url,
    longitude,
    latitude,
    distanceMiles,
    outFields,
    limit = 3,
    timeoutMs = 6000,
    where = "1=1",
    signal: callerSignal,
  } = input;

  const params = new URLSearchParams({
    f: "json",
    geometry: JSON.stringify({
      x: longitude,
      y: latitude,
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    distance: String(distanceMiles * METERS_PER_MILE),
    units: "esriSRUnit_Meter",
    returnGeometry: "true",
    returnCentroid: "true",
    // Force WGS84 lon/lat back so the computed distance + the surfaced
    // feature coordinates are deterministic (some services default outSR to
    // Web Mercator, which would break both the distance and the fly-to).
    outSR: "4326",
    outFields: outFields.join(","),
    where,
    resultRecordCount: String(limit * 4),
  });

  type RawFeature = {
    attributes?: Record<string, unknown>;
    geometry?: {
      x?: number;
      y?: number;
      centroid?: { x?: number; y?: number };
      rings?: number[][][];
      paths?: number[][][];
    };
  };
  // Shared timeout + caller-signal merge + `{ error }`-envelope handling live
  // in fetchArcgisQuery; it returns null on any failure (incl. caller-abort).
  const json = await fetchArcgisQuery<{ features?: RawFeature[] }>(
    `${url}/query?${params.toString()}`,
    { timeoutMs, signal: callerSignal },
  );
  if (!json?.features) return [];
  try {
    // Distance fallback: ArcGIS's spatial filter already restricts the
    // result set, so the sort order is mostly cosmetic. We compute a
    // simple equirectangular distance (good enough at MT latitudes,
    // ~6 m error over 1 km) for ordering only.
    const KM_PER_DEG_LAT = 110.574;
    const cosLat = Math.cos((latitude * Math.PI) / 180);
    const KM_PER_DEG_LON = 111.32 * cosLat;
    const computeDistanceKm = (lonF: number, latF: number): number => {
      const dx = (lonF - longitude) * KM_PER_DEG_LON;
      const dy = (latF - latitude) * KM_PER_DEG_LAT;
      return Math.sqrt(dx * dx + dy * dy);
    };

    // Pick the geometry vertex nearest the query point. Covers points
    // (x/y), polygons (rings), and — critically for rivers — polylines
    // (paths), which a first-vertex-only reader missed (every stream came
    // back distance 0 with no fly-to coordinate).
    const nearestVertex = (
      geom: RawFeature["geometry"],
    ): { lon: number; lat: number; km: number } | null => {
      const candidates: Array<[number, number]> = [];
      if (typeof geom?.x === "number" && typeof geom?.y === "number") {
        candidates.push([geom.x, geom.y]);
      }
      if (typeof geom?.centroid?.x === "number" && typeof geom?.centroid?.y === "number") {
        candidates.push([geom.centroid.x, geom.centroid.y]);
      }
      for (const part of [...(geom?.rings ?? []), ...(geom?.paths ?? [])]) {
        for (const v of part) {
          if (typeof v[0] === "number" && typeof v[1] === "number") candidates.push([v[0], v[1]]);
        }
      }
      let best: { lon: number; lat: number; km: number } | null = null;
      for (const [lon, lat] of candidates) {
        const km = computeDistanceKm(lon, lat);
        if (!best || km < best.km) best = { lon, lat, km };
      }
      return best;
    };

    const hits: NearbyHit[] = [];
    for (const f of json.features) {
      const a = f.attributes ?? {};
      const near = nearestVertex(f.geometry);
      hits.push({
        attributes: a,
        distanceMiles: near ? near.km * 0.621371 : 0,
        longitude: near?.lon,
        latitude: near?.lat,
      });
    }
    hits.sort((a, b) => a.distanceMiles - b.distanceMiles);
    return hits.slice(0, limit);
  } catch {
    return [];
  }
}
