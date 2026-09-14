/**
 * @file montanaClip.ts
 * @module engage-mt/services/map
 * @description Real Montana geographic clipping for national / multi-state
 *              VECTOR feature layers that carry no state-coded attribute (so a
 *              server-side `definitionExpression` can't scope them). Replaces
 *              the never-implemented "auto-clipped by MONTANA_CONSTRAINT_EXTENT"
 *              contract the Phase-50 rule assumed — the map's view constraint
 *              only limits pan/zoom, and the focus mask only dims.
 *
 *                · `attachFeatureClip` — GPU-side `featureEffect` against the
 *                  Montana polygon, so out-of-state features leave the render
 *                  AND tap-query / clustering. Mirrors the precedent in
 *                  the map substrate's district layers. Use for vector
 *                  FeatureLayers / GeoJSONLayers (Living Atlas wind stations,
 *                  NIFC fire perimeters, other no-state-field vector services).
 *                  GroupLayer-aware: a portal item that resolves to a group is
 *                  `loadAll()`ed and every child feature layer is clipped.
 *
 *              Raster / vector-tile / MapImageLayer content can't be
 *              feature-filtered; those stay dimmed by the focus mask (see the
 *              note near the end of this file). The clip geometry comes from the
 *              same authoritative 297-vertex boundary the focus mask fetches
 *              (`fetchRealMontanaBoundary`), memoized once per session.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import Polygon from "@arcgis/core/geometry/Polygon";
import FeatureEffect from "@arcgis/core/layers/support/FeatureEffect";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter";
import { geographicToWebMercator } from "@arcgis/core/geometry/support/webMercatorUtils";
import type EsriMapView from "@arcgis/core/views/MapView";
import type Layer from "@arcgis/core/layers/Layer";
import type Geometry from "@arcgis/core/geometry/Geometry";
import { MONTANA_BOUNDARY_RING, fetchRealMontanaBoundary } from "@/data/montanaBoundary";
import { createLogger } from "@/utils/logger";

const log = createLogger("montanaClip");

/** A view that can resolve layerViews. */
type AnyView = EsriMapView;

/** Detach handle returned by every attach* helper. */
export interface ClipHandle {
  remove(): void;
}

/**
 * Signed area (shoelace) in screen space (lon=X east, lat=Y north).
 * Positive = counter-clockwise, negative = clockwise. Mirrors the helper in
 * `montanaBoundaryMask.ts` — kept local so the two files stay independent.
 */
const signedArea = (ring: ReadonlyArray<[number, number]>): number => {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
};

/**
 * Build a solid Montana `Polygon` (wkid 4326) from a `[lon,lat]` ring. The
 * ring is closed and wound CLOCKWISE — Esri treats a clockwise single ring as
 * the filled outer boundary (a counter-clockwise ring reads as a hole with no
 * outer, i.e. empty). Both the real Census boundary (GeoJSON = CCW by spec)
 * and the bundled fallback ring flow through here, so we normalize winding
 * rather than trust the source.
 */
const ringToClipPolygon = (ring: ReadonlyArray<[number, number]>): Polygon => {
  const pts = ring.map(([lon, lat]) => [lon, lat] as [number, number]);
  // Close the ring if the source didn't.
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    pts.push([first[0], first[1]]);
  }
  // Esri outer ring must be clockwise → negative signed area.
  if (signedArea(pts) > 0) pts.reverse();
  return new Polygon({ rings: [pts], spatialReference: { wkid: 4326 } });
};

let _clipGeomPromise: Promise<Polygon> | null = null;

/**
 * The Montana clip polygon (wkid 4326), memoized per session. Prefers the
 * authoritative 297-vertex Census boundary; falls back to the bundled
 * 78-vertex ring when the fetch fails (offline / preview sandboxes).
 */
export const getMontanaClipGeometry = (): Promise<Polygon> => {
  if (!_clipGeomPromise) {
    _clipGeomPromise = (async (): Promise<Polygon> => {
      const real = await fetchRealMontanaBoundary().catch(() => null);
      const ring = real && real.length >= 50 ? real : MONTANA_BOUNDARY_RING;
      return ringToClipPolygon(ring);
    })();
  }
  return _clipGeomPromise;
};

/** Test seam — reset the memoized geometry between unit tests. */
export const __resetMontanaClipGeometryForTest = (): void => {
  _clipGeomPromise = null;
};

/**
 * Project the 4326 clip polygon into the view's spatial reference. Our
 * basemaps are Web Mercator, so we convert synchronously; for any other SR we
 * hand back the 4326 geometry and let the SDK project it internally.
 */
const clipGeometryForView = (poly: Polygon, view: AnyView): Geometry => {
  const sr = view.spatialReference;
  if (sr && sr.isWebMercator) {
    return geographicToWebMercator(poly);
  }
  return poly;
};

/** Layers that accept a `featureEffect` (FeatureLayer, GeoJSONLayer, …). */
type EffectLayer = Layer & { type?: string; featureEffect?: FeatureEffect | null };
/** GroupLayer surface we use (load all children, flat descendant collection). */
type Groupish = Layer & {
  type?: string;
  loadAll?: () => Promise<unknown>;
  allLayers?: { toArray?: () => Layer[]; forEach?: (cb: (l: Layer) => void) => void };
};

/**
 * Clip a vector layer to Montana via the LAYER-level `featureEffect` (supported
 * by FeatureLayer / GeoJSONLayer). Features outside the Montana polygon render
 * at `opacity(0)`. Setting the effect on the layer itself — rather than the
 * layerView — sidesteps the `whenLayerView` timing / StrictMode-teardown
 * rejection and applies as soon as the geometry resolves.
 *
 * A Living Atlas portal item can resolve to a **GroupLayer** whose child
 * FeatureLayers aren't typed until loaded, so for groups we `loadAll()` then
 * clip every descendant feature layer.
 *
 * `alive` mirrors the caller-owned lifecycle flag used across the map attach
 * helpers — a teardown mid-await must not paint into a destroyed layer.
 */
export const attachFeatureClip = (
  view: AnyView,
  layer: Layer,
  alive: () => boolean = () => true,
): ClipHandle => {
  let removed = false;
  const clipped: EffectLayer[] = [];

  const applyTo = (l: Layer, geom: Polygon): boolean => {
    const el = l as EffectLayer;
    if (el.type !== "feature" && el.type !== "geojson") return false;
    el.featureEffect = new FeatureEffect({
      filter: new FeatureFilter({
        geometry: clipGeometryForView(geom, view),
        spatialRelationship: "intersects",
      }),
      // Out-of-state features fully disappear (not merely dimmed).
      excludedEffect: "opacity(0)",
    });
    clipped.push(el);
    return true;
  };

  void getMontanaClipGeometry()
    .then(async (geom) => {
      if (removed || !alive()) return;
      const grp = layer as Groupish;
      if (grp.type === "group") {
        // Ensure the group's child FeatureLayers are loaded + typed.
        if (typeof grp.loadAll === "function") await grp.loadAll().catch(() => undefined);
        if (removed || !alive()) return;
        const kids = grp.allLayers?.toArray?.() ?? [];
        let n = 0;
        for (const kid of kids) if (applyTo(kid, geom)) n += 1;
        log.info(`Montana feature-clip applied to ${n} child layer(s) of "${layer.id}"`);
        return;
      }
      if (applyTo(layer, geom)) {
        log.info(`Montana feature-clip applied to "${layer.id}"`);
      } else {
        log.info(`Layer "${layer.id}" (type ${(layer as EffectLayer).type}) has no featureEffect`);
      }
    })
    .catch((err: unknown) => {
      log.warn(
        `Montana feature-clip failed for "${layer.id}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });

  return {
    remove(): void {
      removed = true;
      for (const el of clipped) {
        try {
          el.featureEffect = null;
        } catch {
          // Layer already torn down — nothing to restore.
        }
      }
    },
  };
};

// NOTE: raster / vector-tile layers (radar, public-land VTL, contours)
// can't be feature-filtered. The Esri "clip/mask" pattern
// (GroupLayer + a `blendMode:"destination-in"` Montana-fill mask) is the
// documented way to hard-clip them, but reparenting those layers into a bottom
// GroupLayer destabilized the 2D MapView render (blanked the basemap) in this
// codebase's layer stack. Until that render-isolation issue is solved, those
// layers stay scoped by the translucent focus mask (dim outside Montana) +
// `minScale` and carry a `montanaScopeNote`. Tracked as a follow-up.
