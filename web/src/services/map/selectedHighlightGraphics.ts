/**
 * @file selectedHighlightGraphics.ts
 * @module engage-mt/services/map
 * @description Manages a dedicated GraphicsLayer that paints a
 *              pulsing fish-accent halo at the active highlight target.
 *              Subscribes to `useHighlightedFeatureStore` so any caller —
 *              search, deep link, explorer-row click — produces the same
 *              "this is the spot" affordance on the map.
 *
 *              Mirrors the lifecycle pattern of `fieldMapGraphics.ts`:
 *              attach once at MapView init, returns a `detach()` that the
 *              cleanup effect calls. Honors prefers-reduced-motion (skips
 *              the pulse animation, renders a static ring).
 *
 *              Geometry flash. When the target carries
 *              vector geometry (polygon rings for lakes, polyline paths
 *              for rivers), a separate Graphic renders the outline in a
 *              high-contrast brand-accent stroke for ~6 s before fading.
 *              The point halo remains for the full TTL so the user can
 *              still find the feature after the flash clears.
 *
 *              Auto-clears the store entry when `expiresAt` passes.
 *
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-07
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import EsriMap from "@arcgis/core/Map";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import Polygon from "@arcgis/core/geometry/Polygon";
import Polyline from "@arcgis/core/geometry/Polyline";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import {
  useHighlightedFeatureStore,
  type HighlightGeometry,
  type HighlightTarget,
} from "@/store/map/highlightedFeatureStore";
import { cssVarToHex } from "@/utils/cssVarToHex";

const LAYER_ID = "engage-mt-highlight";
const LAYER_TITLE = "Selected feature";

const PULSE_INTERVAL_MS = 1_500;
const PULSE_MIN_RADIUS = 18;
const PULSE_MAX_RADIUS = 32;
const STATIC_RADIUS = 22;

const GEOM_STROKE_WIDTH = 3;
const GEOM_FILL_RGBA: [number, number, number, number] = [74, 144, 217, 0.18];

function buildSymbol(radius: number, accent: string): SimpleMarkerSymbol {
  return new SimpleMarkerSymbol({
    style: "circle",
    size: radius,
    color: [74, 144, 217, 0.18], // fish-accent rgba fill, low alpha
    outline: {
      color: accent,
      width: 3,
    },
  });
}

function buildPointGraphic(target: HighlightTarget, accent: string, radius: number): Graphic {
  return new Graphic({
    geometry: new Point({ longitude: target.lon, latitude: target.lat }),
    symbol: buildSymbol(radius, accent),
    attributes: {
      label: target.label,
      kind: target.kind,
    },
  });
}

function buildGeometryGraphic(
  geom: HighlightGeometry,
  accent: string,
  alpha: number,
): Graphic | null {
  if (geom.kind === "polygon") {
    const polygon = new Polygon({
      rings: geom.rings.map((ring) => ring.map((pt) => [pt[0], pt[1]] as [number, number])),
      spatialReference: { wkid: 4326 },
    });
    const fillAlpha = Math.max(0.05, Math.min(0.32, GEOM_FILL_RGBA[3] * alpha));
    return new Graphic({
      geometry: polygon,
      symbol: new SimpleFillSymbol({
        color: [GEOM_FILL_RGBA[0], GEOM_FILL_RGBA[1], GEOM_FILL_RGBA[2], fillAlpha],
        outline: { color: accent, width: GEOM_STROKE_WIDTH },
      }),
    });
  }
  if (geom.kind === "polyline") {
    const line = new Polyline({
      paths: geom.paths.map((path) => path.map((pt) => [pt[0], pt[1]] as [number, number])),
      spatialReference: { wkid: 4326 },
    });
    return new Graphic({
      geometry: line,
      symbol: new SimpleLineSymbol({
        color: accent,
        width: GEOM_STROKE_WIDTH + 1,
      }),
    });
  }
  return null;
}

export interface AttachHighlightArgs {
  map: EsriMap;
}

export function attachSelectedHighlightGraphics({ map }: AttachHighlightArgs): () => void {
  const layer = new GraphicsLayer({
    id: LAYER_ID,
    title: LAYER_TITLE,
    listMode: "hide", // never appear in the layer panel
  });
  map.add(layer);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const accent = cssVarToHex("var(--fwp-accent-fish)") || "#4A90D9";

  let pulseTimer: number | null = null;
  let expireTimer: number | null = null;
  let geomFadeRaf: number | null = null;
  let currentGraphic: Graphic | null = null;
  let currentGeomGraphic: Graphic | null = null;

  const clearPointTimers = (): void => {
    if (pulseTimer !== null) {
      window.clearInterval(pulseTimer);
      pulseTimer = null;
    }
    if (expireTimer !== null) {
      window.clearTimeout(expireTimer);
      expireTimer = null;
    }
  };

  const clearGeomGraphic = (): void => {
    if (currentGeomGraphic) {
      layer.remove(currentGeomGraphic);
      currentGeomGraphic = null;
    }
    if (geomFadeRaf !== null) {
      window.cancelAnimationFrame(geomFadeRaf);
      geomFadeRaf = null;
    }
  };

  const clearAll = (): void => {
    if (currentGraphic) {
      layer.remove(currentGraphic);
      currentGraphic = null;
    }
    clearGeomGraphic();
    clearPointTimers();
  };

  const renderGeometry = (geom: HighlightGeometry | null, fadesAt: number | undefined): void => {
    clearGeomGraphic();
    if (!geom) return;
    const fadeMs = fadesAt ? Math.max(0, fadesAt - Date.now()) : 0;
    if (fadeMs <= 0) return;

    const initial = buildGeometryGraphic(geom, accent, 1);
    if (!initial) return;
    currentGeomGraphic = initial;
    layer.add(initial);

    // A persistent highlight (Infinity fade) stays at full opacity
    // until cleared: no fade animation, no removal timeout. `setTimeout(fn,
    // Infinity)` fires immediately, so the finiteness check is load-bearing.
    if (!Number.isFinite(fadeMs)) return;

    if (reduced) {
      // Skip the fade — render at full opacity for `fadeMs`, then remove.
      window.setTimeout(() => {
        clearGeomGraphic();
      }, fadeMs);
      return;
    }

    const start = Date.now();
    const step = (): void => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / fadeMs);
      if (progress >= 1) {
        clearGeomGraphic();
        return;
      }
      // Rebuild with a faded alpha. We re-add because the SDK doesn't
      // give us a per-graphic opacity that animates without re-issuing.
      const alpha = 1 - progress;
      const next = buildGeometryGraphic(geom, accent, alpha);
      if (next) {
        if (currentGeomGraphic) layer.remove(currentGeomGraphic);
        currentGeomGraphic = next;
        layer.add(next);
      }
      geomFadeRaf = window.requestAnimationFrame(step);
    };
    geomFadeRaf = window.requestAnimationFrame(step);
  };

  const render = (target: HighlightTarget | null): void => {
    clearAll();
    if (!target) return;

    if (reduced) {
      currentGraphic = buildPointGraphic(target, accent, STATIC_RADIUS);
      layer.add(currentGraphic);
    } else {
      let phase = 0;
      const tick = (): void => {
        phase = phase === 0 ? 1 : 0;
        const radius = phase === 0 ? PULSE_MIN_RADIUS : PULSE_MAX_RADIUS;
        if (currentGraphic) layer.remove(currentGraphic);
        currentGraphic = buildPointGraphic(target, accent, radius);
        layer.add(currentGraphic);
      };
      tick();
      pulseTimer = window.setInterval(tick, PULSE_INTERVAL_MS);
    }

    // geometry flash (when present).
    renderGeometry(target.geometry ?? null, target.geometryFadesAt);

    // Auto-clear when the target's TTL expires — but only for a finite TTL.
    // A persistent highlight (Infinity, e.g. an open tap-query panel) is
    // cleared explicitly by its owner; scheduling `setTimeout(fn, Infinity)`
    // would fire immediately and wipe the highlight the instant it appeared.
    const remaining = target.expiresAt - Date.now();
    if (Number.isFinite(remaining) && remaining > 0) {
      expireTimer = window.setTimeout(() => {
        useHighlightedFeatureStore.getState().clear();
      }, remaining);
    }
  };

  // Initial paint from current store state (deep-link case).
  render(useHighlightedFeatureStore.getState().selected);

  // Track the previous target so we can distinguish "new selection" from
  // "geometry resolved on the existing one." Latter just updates the
  // geometry layer without re-pulsing the point halo. We key the point
  // re-pulse on the monotonic `seq` (not the label): two successive taps on
  // different parcels share the label "Cadastral parcels" AND can share a
  // ring-count geomKey, so label/geom fingerprints alone leave a stale
  // outline. `seq` changes on every set(), so a new selection always re-renders.
  let prevSeq: number | null = useHighlightedFeatureStore.getState().selected?.seq ?? null;
  let prevGeomKey: string | null = null;

  const geomKey = (g: HighlightGeometry | null | undefined): string | null => {
    if (!g) return null;
    if (g.kind === "polygon") return `poly:${g.rings.length}:${g.rings[0]?.length ?? 0}`;
    return `line:${g.paths.length}:${g.paths[0]?.length ?? 0}`;
  };

  const unsubscribe = useHighlightedFeatureStore.subscribe((state) => {
    const t = state.selected;
    const nextSeq = t?.seq ?? null;
    const nextGeomKey = geomKey(t?.geometry);

    if (nextSeq !== prevSeq) {
      // New selection (or cleared) — full re-render including the point halo.
      render(t);
    } else if (nextGeomKey !== prevGeomKey) {
      // Same selection, geometry resolved late — flash without re-pulsing.
      renderGeometry(t?.geometry ?? null, t?.geometryFadesAt);
    }
    prevSeq = nextSeq;
    prevGeomKey = nextGeomKey;
  });

  return () => {
    unsubscribe();
    clearAll();
    map.remove(layer);
  };
}
