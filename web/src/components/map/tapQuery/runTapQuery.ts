/**
 * @file runTapQuery.ts
 * @module engage-mt/map
 * @description Tap-query click pipeline extracted from MapView.tsx (
 *              Stage 2). One async orchestrator, `runTapQuery(event, ctx)`,
 *              driving every stage in priority order:
 *                1. field-tools graphics hit-test (user pins win every pixel)
 *                2. USGS gages GraphicsLayer hit-test
 *                3. topmost-graphic resolution + cluster auto-zoom
 *                4. FeatureLayer query stage
 *                5. Living-Atlas portal-item fallback
 *                6. bare-land ownership fallback (cadastral)
 *                7. pulse + highlight halo + emit
 *              The view-local state the closure used to capture is passed via a
 *              single `TapQueryContext`. Gage layers are read from
 *              `ctx.layerIndex` (a stable Map populated as async layers settle)
 *              rather than late-assigned closure bindings.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-14
 * @version 1.3.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import type Layer from "@arcgis/core/layers/Layer";
import * as webMercatorUtils from "@arcgis/core/geometry/support/webMercatorUtils";
import type { HighlightGeometry } from "@/store/map/featureFocusStore";
import { LAYER_REGISTRY } from "@/config/layers";
import type { LayerDef } from "@/types/layers";
import { isReferenceContextModule } from "@/types/layers";
import type { TapPoint } from "@/types/featureCard";
import { resolveLandOwnershipAtPoint } from "@/services/spatialContext/landOwnership";
import { resolveOfflineFeaturesAtPoint } from "@/services/mobile/offlineDataResolver";
import { OFFLINE_DATA_LAYERS } from "@/config/offlineDataLayers";
import { isOnline } from "@/store/app/connectivityStore";
import { useLayerVisibilityStore } from "@/store/map/layerVisibilityStore";
import { useTapQueryFailureStore } from "@/store/map/tapQueryFailureStore";
import { useMapInteractionStore } from "@/store/map/mapInteractionStore";
import { highlightTapQueryHit } from "@/services/map/tapQueryHighlightBridge";
import { FIELD_GRAPHICS_LAYER_ID } from "@/services/field/fieldMapGraphics";
import { createLogger } from "@/utils/logger";
import type { TapQueryResult, TapQueryMore } from "../TapQueryPanel";
import { queryFeatureLayers } from "./tapQueryHelpers";
import { pulseAtPoint } from "../selectionPulse";
import { clusterDisableScale } from "../symbology/cluster";
import { DEFAULT_ZOOM, MAX_ZOOM, MAX_QUERY_RESULTS_PER_LAYER } from "../mapViewConstants";
import { resolveTopmost, decideClusterZoom, collectRegisteredHitLayerIds } from "./resolveTopmost";
import { toTapPoint } from "./toTapPoint";

const log = createLogger("runTapQuery");

/** Per-layer query timeout — one slow service can't block the rest of the tap. */
const QUERY_TIMEOUT_MS = 5000;
// 18 screen-pixels ≈ the visual radius of a rendered glyph at most
// zooms, so small picture markers (FAS, gages) are easy to
// hit on touch. Polygons keep an exact (0) hit; points/lines use this buffer.
const HIT_TOLERANCE_PX = 18;

/**
 * Map units per screen pixel. A `MapView` exposes `.resolution` directly;
 * fall back to `extent.width / view.width` if it's ever unavailable so the
 * ±18 px tolerance never silently collapses to zero.
 */
const resolutionOf = (view: __esri.MapView): number => {
  if ("resolution" in view && typeof view.resolution === "number" && view.resolution > 0) {
    return view.resolution;
  }
  const extentWidth = view.extent?.width;
  const px = view.width;
  return extentWidth && px ? extentWidth / px : 0;
};

/**
 * Convert the clicked graphic's geometry (usually Web Mercator, from a
 * FeatureLayer hitTest; already WGS84 for GeoJSON layers) into the WGS84
 * rings/paths the highlight store paints. Only polygons + polylines carry an
 * outline; points fall back to the pulsing halo (returns null). The hitTest
 * geometry is LOD-generalized, which is exactly the resolution a highlight wants.
 */
const toHighlightGeometry = (
  geom: __esri.Geometry | undefined | null,
): HighlightGeometry | null => {
  if (!geom || (geom.type !== "polygon" && geom.type !== "polyline")) return null;
  const sr = geom.spatialReference;
  const isWebMerc = Boolean(sr?.isWebMercator || sr?.wkid === 3857 || sr?.wkid === 102100);
  // geom is narrowed to Polygon|Polyline by the guard above; the projector's
  // typing wants the concrete geometry union, so cast at the call boundary.
  const geo = isWebMerc
    ? webMercatorUtils.webMercatorToGeographic(geom as __esri.Polygon | __esri.Polyline)
    : geom;
  if (geom.type === "polygon") {
    const rings = (geo as __esri.Polygon).rings;
    if (!rings?.length) return null;
    return { kind: "polygon", rings: rings.map((r) => r.map(([x, y]) => [x, y] as const)) };
  }
  const paths = (geo as __esri.Polyline).paths;
  if (!paths?.length) return null;
  return { kind: "polyline", paths: paths.map((p) => p.map(([x, y]) => [x, y] as const)) };
};

/** View-local state the tap-query pipeline needs, passed in lieu of closures. */
export interface TapQueryContext {
  /**
   * The active `MapView`. Every stage reads only stable view surface
   * (`hitTest`, `scale`, `zoom`, `goTo`, `extent`) plus `resolutionOf(view)`.
   */
  view: __esri.MapView;
  map: __esri.Map;
  /** Live id → Layer index (gages settle into it asynchronously). */
  layerIndex: Map<string, Layer>;
  /**
   * Forwards results to the panel. MapView wires this through
   * `onQueryResultsRef.current` so the map's once-only lifecycle never depends
   * on the callback's identity (the popup-close "map reloads" fix).
   */
  emit: (results: TapQueryResult[], tapPoint: TapPoint | null, more?: TapQueryMore | null) => void;
}

/**
 * Run the full tap-query pipeline for one map click. Resolves once the panel
 * has been emitted to (or an early-return stage handled the click).
 */
export async function runTapQuery(
  event: __esri.ViewClickEvent,
  ctx: TapQueryContext,
): Promise<void> {
  const { view, map, layerIndex, emit } = ctx;

  // Don't run tap-query while a draw/measure tool is active — those clicks
  // belong to the sketch hook.
  if (useMapInteractionStore.getState().activeTool !== "none") return;

  // Read visibility straight from the store when the click fires.
  const currentVisibility = useLayerVisibilityStore.getState().visible;
  const results: TapQueryResult[] = [];
  // Each tap clears prior failures — chip counts reflect only this attempt.
  useTapQueryFailureStore.getState().clear();
  const recordFailure = useTapQueryFailureStore.getState().recordFailure;

  // User field-tools graphics take priority over every operational
  // layer. A user who taps their own waypoint expects to open IT, not whatever
  // FWP point happens to share the pixel. Synthesizes the result as if it came
  // from the synthetic `engage-mt-field-{waypoint,track,shape}` layer ids.
  const fieldLayer = map.findLayerById(FIELD_GRAPHICS_LAYER_ID);
  if (fieldLayer) {
    try {
      const hit = await view.hitTest(event, { include: fieldLayer });
      const firstGraphic = hit.results.find((r): r is __esri.GraphicHit => r.type === "graphic");
      const fattrs = firstGraphic?.graphic?.attributes as
        | (Record<string, unknown> & { __feature_kind?: string })
        | undefined;
      if (fattrs && typeof fattrs.__feature_kind === "string") {
        const k = fattrs.__feature_kind;
        // Active-track in-progress is render-only; fall through so the user can
        // still tap-query operational layers beneath it.
        if (k === "waypoint" || k === "route" || k === "shape") {
          pulseAtPoint(view, event.mapPoint);
          const synthLayerId =
            k === "waypoint"
              ? "engage-mt-field-waypoint"
              : k === "route"
                ? "engage-mt-field-track"
                : "engage-mt-field-shape";
          const synthTitle = k === "waypoint" ? "Waypoint" : k === "route" ? "Track" : "Shape";
          results.push({
            layerId: synthLayerId,
            layerTitle: synthTitle,
            module: "shared",
            features: [fattrs as Record<string, unknown>],
          });
          emit(results, toTapPoint(event.mapPoint));
          return;
        }
      }
    } catch (err) {
      log.debug("field graphics hitTest failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Same explicit hit-test for the USGS gages GraphicsLayer; without
  // it, `view.hitTest(event)` returns the cluster aggregate (no `layer.id`) and
  // the topmost branch can't map it back to a LayerDef.
  const usgsGagesLayer = layerIndex.get("usgs-gages");
  if (usgsGagesLayer && currentVisibility["usgs-gages"] !== false) {
    try {
      const hit = await view.hitTest(event, { include: usgsGagesLayer });
      const firstGraphic = hit.results.find((r): r is __esri.GraphicHit => r.type === "graphic");
      if (firstGraphic?.graphic?.attributes) {
        pulseAtPoint(view, event.mapPoint);
        const usgsDef = LAYER_REGISTRY.find((d) => d.id === "usgs-gages");
        results.push({
          layerId: "usgs-gages",
          layerTitle: usgsDef?.title ?? "USGS gage",
          module: usgsDef?.module ?? "fish",
          features: [firstGraphic.graphic.attributes as Record<string, unknown>],
        });
        emit(results, toTapPoint(event.mapPoint));
        return;
      }
    } catch (err) {
      log.debug("usgs gages hitTest failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Convert the screen-pixel tolerance into map units so
  // point + line layers (which rarely fall exactly under the click) still hit.
  const tolMeters = HIT_TOLERANCE_PX * resolutionOf(view);

  // "the popup is for the thing I clicked." Ask ArcGIS
  // which graphic is frontmost, then restrict the multi-layer query below to
  // that one layer so the panel shows ONE card instead of a stack.
  let topLayerId: string | null = null;
  let topGraphicAttrs: Record<string, unknown> | null = null;
  let topGraphic: { graphic?: __esri.Graphic } | undefined;
  // The distinct registered layer ids the click landed on,
  // captured from the SAME hitTest as the topmost so the "N more features here"
  // affordance costs zero extra network.
  let hitLayerIds: string[] = [];
  try {
    const hit = await view.hitTest(event);
    const registeredIds = new Set<string>(LAYER_REGISTRY.map((d) => d.id));
    const resolved = resolveTopmost(hit.results, registeredIds);
    topLayerId = resolved.topLayerId;
    topGraphicAttrs = resolved.topGraphicAttrs;
    topGraphic = resolved.topGraphic;
    hitLayerIds = collectRegisteredHitLayerIds(hit.results, registeredIds);

    // Cluster auto-zoom decision (pure); we own the goTo.
    const topDefForCluster = topLayerId
      ? LAYER_REGISTRY.find((d) => d.id === topLayerId)
      : undefined;
    const clusterDisableAt = topDefForCluster?.symbology?.cluster?.enabled
      ? clusterDisableScale(topDefForCluster)
      : null;
    const decision = decideClusterZoom({
      topGraphicAttrs,
      hasGeometry: Boolean(topGraphic?.graphic?.geometry),
      clusterDisableScale: clusterDisableAt,
      currentScale: view.scale ?? Infinity,
      currentZoom: view.zoom ?? DEFAULT_ZOOM,
      maxZoom: MAX_ZOOM,
    });
    if (decision.shouldZoom && topGraphic?.graphic?.geometry) {
      void view.goTo(
        { target: topGraphic.graphic.geometry, zoom: decision.targetZoom },
        { duration: 350, easing: "ease-in-out" },
      );
      pulseAtPoint(view, event.mapPoint);
      // DO NOT emit here. The map zoom is the feedback; emitting
      // `[]` would fill the panel with the "no hit" notice. The next click
      // resolves to an individual feature.
      return;
    }
    // Falling through on an aggregate (past disable / at max zoom):
    // its synthetic attributes aren't real feature data — clear them so the
    // Living-Atlas fallback doesn't surface them as a Tier-1 card.
    if (decision.clearAttrs && topLayerId) {
      topGraphicAttrs = null;
    }
  } catch (err) {
    // hitTest occasionally throws if a layer hasn't finished loading; fall
    // through to no-topmost (the query loop below returns empty).
    log.debug("topmost hitTest failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // FeatureLayer query stage (extracted to tapQueryHelpers).
  const queryablePairs = LAYER_REGISTRY.filter(
    (def) => currentVisibility[def.id] && (!topLayerId || def.id === topLayerId),
  )
    .map((def) => {
      const layer = layerIndex.get(def.id);
      return layer instanceof FeatureLayer ? ([def, layer] as const) : null;
    })
    .filter((p): p is readonly [LayerDef, FeatureLayer] => p !== null);

  const flResults = await queryFeatureLayers({
    pairs: queryablePairs,
    mapPoint: event.mapPoint,
    tolMeters,
    maxResults: MAX_QUERY_RESULTS_PER_LAYER,
    timeoutMs: QUERY_TIMEOUT_MS,
    recordFailure,
  });
  results.push(...flResults);

  // Living Atlas portal-item fallback. If the query loop came back
  // empty but hitTest DID find a graphic on a known layer, surface its
  // attributes directly (how the wind arrow reaches WindStationCard).
  if (results.length === 0 && topLayerId && topGraphicAttrs) {
    const topDef = LAYER_REGISTRY.find((d) => d.id === topLayerId);
    if (topDef) {
      results.push({
        layerId: topDef.id,
        layerTitle: topDef.title,
        module: topDef.module,
        features: [topGraphicAttrs],
      });
    }
  }

  // Offline tap-to-identify — when there's no live hit and the device is
  // offline, answer from the region data captured for the downloaded area:
  // ownership, hunting/fishing districts, and access boundaries under the point.
  // The live FeatureLayer stages above return nothing offline (their layers
  // never load), so this is what makes "whose land / what district" work with no
  // signal. It reads only the AOI the user chose to download (region-scoped).
  if (
    results.length === 0 &&
    !isOnline() &&
    event.mapPoint.longitude != null &&
    event.mapPoint.latitude != null
  ) {
    const offlineHits = await resolveOfflineFeaturesAtPoint(
      event.mapPoint.longitude,
      event.mapPoint.latitude,
      OFFLINE_DATA_LAYERS.map((l) => l.layerId),
    );
    for (const hit of offlineHits) {
      const def = LAYER_REGISTRY.find((d) => d.id === hit.layerId);
      if (def) {
        results.push({
          layerId: def.id,
          layerTitle: def.title,
          module: def.module,
          features: [hit.attributes],
        });
      }
    }
  }

  // An empty tap on bare land resolves "whose land is this" from the cadastral
  // service so the owner-aware card renders.
  // Online only — the offline stage above already answered from cached data.
  if (
    results.length === 0 &&
    isOnline() &&
    event.mapPoint.longitude != null &&
    event.mapPoint.latitude != null
  ) {
    const ownership = await resolveLandOwnershipAtPoint(
      event.mapPoint.longitude,
      event.mapPoint.latitude,
    );
    const def = LAYER_REGISTRY.find((d) => d.id === "mt-cadastral");
    if (ownership.kind === "cadastral" && def) {
      results.push({
        layerId: def.id,
        layerTitle: def.title,
        module: def.module,
        features: [ownership.attrs],
      });
    } else if (ownership.kind === "unavailable" && def) {
      // Distinguish "no parcel record here" from "the service did not answer".
      recordFailure({
        layerId: def.id,
        layerTitle: def.title,
        reason: ownership.reason === "service" ? "unknown" : ownership.reason,
        at: new Date().toISOString(),
      });
    }
  }

  // Pulse + durable halo on any hit so a map click feels like
  // a search hit. No pulse on empty taps.
  if (results.length > 0) {
    pulseAtPoint(view, event.mapPoint);
    const top = results[0];
    const topDef = LAYER_REGISTRY.find((d) => d.id === top.layerId);
    // Outline the clicked feature's boundary and
    // persist it (Infinity) for as long as the panel is open; MapPage clears
    // it on close / empty tap. Only outline when results[0] IS the topmost
    // hitTest graphic (synthesized gage/ownership results have no
    // matching client geometry → halo-only, matching prior behavior).
    const outline =
      top.layerId === topLayerId ? toHighlightGeometry(topGraphic?.graphic?.geometry) : null;
    highlightTapQueryHit({
      mapPoint: event.mapPoint,
      geometry: topDef?.geometry,
      outline,
      label: top.layerTitle,
      ttlMs: Number.POSITIVE_INFINITY,
      geometryFadeMs: Number.POSITIVE_INFINITY,
    });
  }

  // "N more features here". Other visible activity layers
  // the click also landed on (per the topmost hitTest), minus what's already
  // shown and minus the passive reference/shared context layers. Only the
  // metadata is computed now; `run()` queries those layers lazily when the user
  // asks — preserving the Phase-19 no-extra-latency default.
  const shownIds = new Set(results.map((r) => r.layerId));
  const moreDefs = hitLayerIds
    .filter((id) => id !== topLayerId && !shownIds.has(id))
    .map((id) => LAYER_REGISTRY.find((d) => d.id === id))
    .filter((d): d is LayerDef => Boolean(d))
    .filter((d) => currentVisibility[d.id] && !isReferenceContextModule(d.module));

  let more: TapQueryMore | null = null;
  if (moreDefs.length > 0) {
    more = {
      candidates: moreDefs.map((d) => ({ layerId: d.id, layerTitle: d.title, module: d.module })),
      run: async (): Promise<TapQueryResult[]> => {
        const flPairs = moreDefs
          .map((def) => {
            const layer = layerIndex.get(def.id);
            return layer instanceof FeatureLayer ? ([def, layer] as const) : null;
          })
          .filter((p): p is readonly [LayerDef, FeatureLayer] => p !== null);
        return queryFeatureLayers({
          pairs: flPairs,
          mapPoint: event.mapPoint,
          tolMeters,
          maxResults: MAX_QUERY_RESULTS_PER_LAYER,
          timeoutMs: QUERY_TIMEOUT_MS,
          recordFailure,
        });
      },
    };
  }

  emit(results, toTapPoint(event.mapPoint), more);
}
