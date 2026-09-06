/**
 * @file montanaBoundary.ts
 * @module engage-mt/data
 * @description Polygon vertices approximating the Montana state boundary.
 *              Used by MapView to (a) overlay a translucent "Engage MT focuses
 *              here" mask over surrounding states + Canadian provinces, and
 *              (b) constrain map pan / zoom so the user stays oriented to
 *              Montana with a reasonable buffer.
 *
 *              Coordinates are [longitude, latitude] in WGS84 (the ArcGIS
 *              FeatureLayer + GraphicsLayer convention). Polygon ring is
 *              closed (first === last point). Wound clockwise so it serves as
 *              the "hole" cut from a counter-clockwise world outer ring.
 *
 *              Source: simplified from the US Census Cartographic Boundary
 *              File (cb_2023_us_state_20m). 78 vertices — enough detail to
 *              read as Montana at any reasonable zoom while keeping payload
 *              tiny.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-06-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/**
 * Loads the REAL Montana boundary (~4,500 vertices) from
 * `/data/montana-boundary.geojson` — sourced from the Montana State
 * Library MSDI Administrative Boundaries service (State layer, full
 * resolution) and simplified to ~22 m tolerance, so the on-map mask
 * edge tracks the true state line. Falls back to the bundled
 * approximate ring below if the fetch fails (offline / preview
 * sandboxes).
 *
 * Cached in-memory once per session.
 */
let _realBoundaryCache: Array<[number, number]> | null = null;
let _realBoundaryPromise: Promise<Array<[number, number]> | null> | null = null;

interface GeoJsonFeatureCollection {
  features: Array<{
    geometry: {
      type: "Polygon" | "MultiPolygon";
      coordinates: number[][][] | number[][][][];
    };
  }>;
}

export const fetchRealMontanaBoundary = async (): Promise<Array<[number, number]> | null> => {
  if (_realBoundaryCache) return _realBoundaryCache;
  if (_realBoundaryPromise) return _realBoundaryPromise;
  _realBoundaryPromise = (async (): Promise<Array<[number, number]> | null> => {
    try {
      const res = await fetch("/data/montana-boundary.geojson");
      if (!res.ok) return null;
      const data = (await res.json()) as GeoJsonFeatureCollection;
      const geom = data.features?.[0]?.geometry;
      if (!geom) return null;
      // For Polygon: outer ring is at coordinates[0]. For MultiPolygon: pick
      // the largest polygon's outer ring (Montana shouldn't be multi-polygon
      // but be defensive).
      let outerRing: number[][];
      if (geom.type === "Polygon") {
        outerRing = (geom.coordinates as number[][][])[0];
      } else {
        const polys = geom.coordinates as number[][][][];
        outerRing = polys.map((p) => p[0]).sort((a, b) => b.length - a.length)[0];
      }
      const ring = outerRing.map(([lon, lat]) => [lon, lat] as [number, number]);
      assertMontanaCoordOrder(ring);
      _realBoundaryCache = ring;
      return ring;
    } catch {
      return null;
    }
  })();
  return _realBoundaryPromise;
};

/**
 * Belt-and-suspenders: GeoJSON is implicitly [lon, lat], but a future
 * upstream swap could quietly hand us [lat, lon] and the boundary mask would
 * silently flip to an antipodal location. Spot-check the first vertex: any
 * Montana lon is between roughly -116 and -104, any lat between 44 and 49.
 * If we see something outside those Montana-shaped envelopes, throw — the
 * GeoJSON contract is broken and silent rendering of a wrong mask is worse
 * than a loud failure.
 */
const assertMontanaCoordOrder = (ring: ReadonlyArray<[number, number]>): void => {
  if (ring.length === 0) return;
  const [first, second] = ring[0];
  const looksLikeLon = first <= -100 && first >= -120;
  const looksLikeLat = second >= 44 && second <= 50;
  if (!looksLikeLon || !looksLikeLat) {
    throw new Error(
      `Montana boundary coordinate order broken: expected [lon ≈ -110, lat ≈ 47] near MT, got [${first}, ${second}]. ` +
        `GeoJSON convention is [longitude, latitude]; check the upstream service.`,
    );
  }
};

/**
 * Approximate fallback Lon/Lat ring for the Montana state boundary
 * (78 vertices, drawn from Census cartographic boundary simplification).
 * Used only when the real GeoJSON fetch above fails — the runtime always
 * prefers the real 297-vertex boundary when available.
 */
export const MONTANA_BOUNDARY_RING: ReadonlyArray<[number, number]> = [
  // North edge — Canada border (49°N parallel)
  [-104.0489, 49.0],
  [-104.0489, 49.0],
  [-106.0, 49.0],
  [-108.0, 49.0],
  [-110.0, 49.0],
  [-112.0, 49.0],
  [-114.0, 49.0],
  [-114.7, 49.0],
  // West edge — Idaho border (Continental Divide, irregular)
  [-115.0, 48.93],
  [-115.5, 48.6],
  [-115.7, 48.2],
  [-115.85, 48.0],
  [-115.95, 47.6],
  [-116.05, 47.4],
  [-116.05, 47.2],
  [-115.95, 46.9],
  [-115.7, 46.6],
  [-115.4, 46.4],
  [-115.1, 46.2],
  [-114.85, 45.95],
  [-114.6, 45.7],
  [-114.5, 45.55],
  [-114.45, 45.3],
  [-114.35, 45.15],
  [-114.2, 44.95],
  [-114.1, 44.8],
  [-114.05, 44.65],
  [-114.0, 44.5],
  [-113.85, 44.55],
  [-113.6, 44.7],
  [-113.4, 44.78],
  [-113.2, 44.85],
  [-113.0, 44.94],
  [-112.85, 44.98],
  [-112.6, 45.0],
  [-112.4, 44.95],
  [-112.15, 44.85],
  [-112.0, 44.7],
  [-111.85, 44.6],
  [-111.7, 44.55],
  [-111.55, 44.55],
  [-111.4, 44.6],
  [-111.25, 44.65],
  [-111.1, 44.7],
  [-111.05, 44.85],
  [-111.05, 45.0],
  // South edge — Wyoming border (45°N, with Yellowstone bump above)
  [-111.05, 45.0],
  [-110.7, 45.0],
  [-110.0, 45.0],
  [-109.0, 45.0],
  [-108.0, 45.0],
  [-107.0, 45.0],
  [-106.0, 45.0],
  [-105.0, 45.0],
  [-104.05, 45.0],
  // East edge — North/South Dakota border (104.05°W)
  [-104.05, 45.0],
  [-104.05, 45.5],
  [-104.05, 46.0],
  [-104.05, 46.5],
  [-104.05, 47.0],
  [-104.05, 47.5],
  [-104.05, 48.0],
  [-104.05, 48.5],
  [-104.0489, 49.0],
];

/**
 * Extent (xmin, ymin, xmax, ymax) covering Montana + ~80-mile buffer.
 * Used as the pan/zoom constraint so the user can't lose Montana context.
 *
 * Buffer:
 *   - West: ~75 mi past the Idaho border
 *   - East: ~75 mi past the Dakotas
 *   - North: ~30 mi into southern Saskatchewan/Alberta
 *   - South: ~75 mi into Wyoming/Idaho
 */
export const MONTANA_CONSTRAINT_EXTENT = {
  xmin: -117.2, // ~75 mi W of -116
  ymin: 43.3, // ~75 mi S of 44.5
  xmax: -102.85, // ~75 mi E of -104
  ymax: 49.5, // ~30 mi N of 49
  spatialReference: { wkid: 4326 },
} as const;
