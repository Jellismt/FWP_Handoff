/**
 * @file attachRegistryLayers.ts
 * @module engage-mt/map
 * @description Layer construction + async-mount lifecycle extracted from
 *              MapView.tsx. Builds every operational layer
 *              from LAYER_REGISTRY in canonical cartographic z-order, wires
 *              load-failure watches with one-shot retry, and async-mounts the
 *              GraphicsLayer families (USGS gages) into the shared
 *              `layerIndex`. Returns the index + an imperative `detach` that
 *              removes the watch handles — same pattern as
 *              `attachMontanaBoundaryMask`. The caller owns the `alive`
 *              lifecycle flag so an async mount mid-teardown can't paint into a
 *              destroyed view.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-14
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import type EsriMap from "@arcgis/core/Map";
import type EsriMapView from "@arcgis/core/views/MapView";
import type Layer from "@arcgis/core/layers/Layer";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import { LAYER_REGISTRY } from "@/config/layers";
import type { LayerDef } from "@/types/layers";
import { useLayerVisibilityStore } from "@/store/map/layerVisibilityStore";
import { useLayerLoadStatusStore } from "@/store/map/layerLoadStatusStore";
import { useThemeStore } from "@/store/app/themeStore";
import { asPortalItem } from "@/utils/esriCast";
import { createLogger } from "@/utils/logger";
import { buildLayer } from "../buildLayer";
import { attachFeatureClip, type ClipHandle } from "@/services/map/montanaClip";
import { buildUsgsGagesLayer } from "../usgsGagesLayer";

/** Minimal shape of a Mapbox/Esri vector-tile style line layer — only the
 *  properties the contours emphasis mutates. */
interface StyleLineLayer {
  type?: string;
  paint?: {
    "line-color"?: string;
    "line-width"?: number | { base?: number; stops?: [number, number][] };
    "line-opacity"?: number | { base?: number; stops?: [number, number][] };
    /** Label (`type: "symbol"`) paint — contour elevation text. */
    "text-color"?: string;
    "text-halo-color"?: string;
    "text-halo-width"?: number;
  };
  /** Label (`type: "symbol"`) layout — contour elevation text sizing. */
  layout?: {
    "text-size"?: number | { base?: number; stops?: [number, number][] };
  };
}

const log = createLogger("attachRegistryLayers");

/** Base delay before retrying a transiently-failed layer load (backoff
 *  multiplies this per attempt). */
const RETRY_DELAY_MS = 1500;
/** How many times to re-attempt a failed layer load before giving up. Some
 *  upstream ArcGIS hosts (e.g. gisservice.mt.gov) intermittently drop a
 *  metadata request under the concurrent layer-load burst on first paint. */
const MAX_LOAD_RETRIES = 3;

// Canonical cartographic z-order (bottom → top). Earlier ArcGIS adds
// draw first = beneath later adds.
//   1. habitat polygons (filled destinations — bottom of the operational stack)
//   2. boundary polygons (outline-only reference)
//   3. default polygons (between boundary and overlay)
//   4. overlay polygons (hatched permission overlays, blendMode multiply)
//   5. lines (streams, roads)
//   6. points (clustered FAS, AIS — always on top)
const ROLE_PRIORITY: Record<string, number> = {
  habitat: 1,
  boundary: 2,
  "default-polygon": 3,
  overlay: 4,
  line: 5,
  point: 6,
};

const layerPriority = (d: LayerDef): number => {
  if (d.geometry === "polygon") {
    return ROLE_PRIORITY[d.symbology?.polygonRole ?? "default-polygon"];
  }
  if (d.geometry === "line") return ROLE_PRIORITY["line"];
  return ROLE_PRIORITY["point"];
};

export interface AttachRegistryLayersParams {
  map: EsriMap;
  view: EsriMapView;
  /** Caller-owned lifecycle flag — false once the init effect tears down. */
  alive: () => boolean;
}

export interface AttachRegistryLayersResult {
  /** Live id → Layer index, populated synchronously + as async mounts settle. */
  layerIndex: Map<string, Layer>;
  /** Removes load-status watch handles + Montana clip handles. */
  detach: () => void;
}

/**
 * Construct + mount every registry layer onto `map`, returning the shared
 * `layerIndex` and an ordered `detach`.
 */
export function attachRegistryLayers({
  map,
  view,
  alive,
}: AttachRegistryLayersParams): AttachRegistryLayersResult {
  const layerIndex = new Map<string, Layer>();
  // Retry timers, so a failed layer can't keep a callback (and its layer
  // closure) alive past teardown. Mirrors MapView's pendingTimeouts.
  const retryTimers = new Set<ReturnType<typeof setTimeout>>();

  /**
   * True when the caller tore down while this layer was still being
   * constructed. The view that owns the map is already destroyed, so the
   * layer would never be destroyed with it — destroy the orphan here instead
   * of mounting it onto a dead map.
   */
  const orphaned = (layer: __esri.Layer): boolean => {
    if (alive()) return false;
    (layer as unknown as { destroy?: () => void }).destroy?.();
    return true;
  };
  // Read the store synchronously so each layer mounts with the correct
  // visibility from the first paint (BUG-C — no race with the sync effect).
  const initialVisibility = useLayerVisibilityStore.getState().visible;
  const setLayerFailed = useLayerLoadStatusStore.getState().setFailed;
  const watchHandles: Array<{ remove(): void }> = [];
  // Montana geometry-clip handles (feature-effect) — removed on detach.
  const clipHandles: ClipHandle[] = [];

  const orderedDefs = [...LAYER_REGISTRY].sort((a, b) => layerPriority(a) - layerPriority(b));

  for (const def of orderedDefs) {
    // Skip token-gated / not-yet-wired layers — adding them trips ArcGIS
    // IdentityManager sign-in prompts we can't honor in stub mode.
    if (def.deferredLoad) {
      log.info(`Skipping deferred-load layer "${def.id}" (token-gated)`);
      continue;
    }
    // Temporarily-offline upstream (e.g. FWP Block Management out of season).
    if (def.unavailable) {
      log.info(`Skipping unavailable layer "${def.id}" (${def.unavailable.note})`);
      continue;
    }
    // Composite layers are UI-only; their children load via their own
    // LayerDef entries.
    if (def.composite) {
      log.info(`Skipping composite layer "${def.id}" (UI-only)`);
      continue;
    }
    // Portal-item-backed layers (Living Atlas wind). Async-loads
    // Via Layer.fromPortalItem; reads CURRENT visibility on settle.
    if (def.portalItemId) {
      const portalItemId = def.portalItemId;
      void import("@arcgis/core/layers/Layer").then(({ default: EsriLayer }) =>
        EsriLayer.fromPortalItem({
          portalItem: asPortalItem(portalItemId),
        })
          .then((layer) => {
            layer.id = def.id;
            layer.title = def.title;
            const currentVisible = Boolean(useLayerVisibilityStore.getState().visible[def.id]);
            layer.visible = currentVisible;
            if (typeof def.opacity === "number") layer.opacity = def.opacity;

            // Elevation contours — the Living Atlas World Contours VTL styles
            // its lines too faintly to read over satellite imagery. Post-load,
            // clone the style and recolor (black) + thicken every line class, then
            // re-apply via loadStyle(). Best-practice per Esri: mutate the
            // style JSON rather than layering CSS filters over the canvas.
            if (def.id === "contours-elevation") {
              const vtl = layer as unknown as {
                load?: () => Promise<unknown>;
                currentStyleInfo?: { style?: { layers?: StyleLineLayer[] } };
                loadStyle?: (style: unknown) => Promise<unknown>;
              };
              void vtl
                .load?.()
                .then(() => {
                  const style = vtl.currentStyleInfo?.style;
                  if (!style?.layers || typeof vtl.loadStyle !== "function") return;
                  const emphasized = JSON.parse(JSON.stringify(style)) as {
                    layers?: StyleLineLayer[];
                  };
                  for (const sl of emphasized.layers ?? []) {
                    // Elevation labels (Contour_NN_main_text) ship olive #61674A
                    // at 9–9.5px, which disappears over imagery — make them plain
                    // black at double size. The pale halo stays so they remain
                    // legible on dark terrain.
                    if (sl.type === "symbol") {
                      if (sl.paint) sl.paint["text-color"] = "#000000";
                      const ts = sl.layout?.["text-size"];
                      if (sl.layout) {
                        if (typeof ts === "number") {
                          sl.layout["text-size"] = ts * 2;
                        } else if (ts && Array.isArray(ts.stops)) {
                          ts.stops = ts.stops.map(([z, v]) => [z, v * 2]);
                        }
                      }
                      continue;
                    }
                    if (sl.type !== "line" || !sl.paint) continue;
                    sl.paint["line-color"] = "#000000"; // black contours
                    // Fully opaque — the stock style fades contour classes with
                    // line-opacity, which washes them out over imagery.
                    sl.paint["line-opacity"] = 1;
                    const w = sl.paint["line-width"];
                    if (typeof w === "number") {
                      sl.paint["line-width"] = w * 1.8;
                    } else if (w && Array.isArray(w.stops)) {
                      w.stops = w.stops.map(([z, v]) => [z, v * 1.8]);
                    } else if (w === undefined) {
                      sl.paint["line-width"] = 1.4;
                    }
                  }
                  return vtl.loadStyle(emphasized);
                })
                .catch(() => {
                  // Style emphasis is progressive enhancement — the stock
                  // Living Atlas style still renders if the mutation fails.
                });
            }

            // Silence the SDK auto-popup on every FeatureLayer the
            // portal item resolves to; tap-query is owned by TapQueryPanel.
            // Propagate our LayerDef id/title onto each FeatureLayer
            // child so hitTest maps the click back to a registered LayerDef.
            const silenceLayerPopup = (l: __esri.Layer): void => {
              const anyL = l as unknown as {
                popupEnabled?: boolean;
                popupTemplate?: unknown;
              };
              if ("popupEnabled" in anyL) anyL.popupEnabled = false;
              if ("popupTemplate" in anyL) anyL.popupTemplate = null;
            };
            silenceLayerPopup(layer);
            let registered: __esri.Layer = layer;
            const maybeGroup = layer as unknown as {
              layers?: {
                flatten?: (cb: (l: __esri.Layer) => unknown) => __esri.Collection<__esri.Layer>;
                forEach?: (cb: (l: __esri.Layer) => void) => void;
              };
            };
            if (maybeGroup.layers && typeof maybeGroup.layers.forEach === "function") {
              maybeGroup.layers.forEach((child) => {
                silenceLayerPopup(child);
                if (child instanceof FeatureLayer) {
                  (child as unknown as { id?: string; title?: string }).id = def.id;
                  (child as unknown as { id?: string; title?: string }).title = def.title;
                  if (registered === layer) registered = child;
                }
              });
            }

            // Montana geometry-clip. The portal-item path bypasses buildLayer,
            // so definitionExpression/minScale never applied here — and the
            // Living Atlas wind service has no state field to filter on anyway.
            // A featureEffect clip against the Montana polygon is the honest
            // fix (attachFeatureClip is GroupLayer-aware: it loadAll()s and
            // clips each child FeatureLayer). Out-of-state arrows disappear.
            if (def.montanaClip === "feature") {
              clipHandles.push(attachFeatureClip(view, layer as Layer, alive));
            }

            // Draw-order fix. Portal-item layers load
            // async, so a plain `map.add` always appends them ON TOP of every
            // synchronously-mounted layer, regardless of role. That's why the
            // Living Atlas public-land-ownership VTL covered hunting-district
            // boundaries. Vector-tile reference layers belong at the BOTTOM of
            // the operational stack, so insert them at index 0 (still above the
            // Montana boundary mask, which was added first and stays on top to
            // dim out-of-state). Non-VTL portal items (e.g. the wind layer)
            // keep appending on top as before.
            if (orphaned(layer)) return;
            if (def.geometry === "vector-tile") {
              map.add(layer, 0);
            } else {
              map.add(layer);
            }
            layerIndex.set(def.id, registered);
          })
          .catch((err: unknown) => {
            log.warn(`Portal-item layer "${def.id}" failed to load`, {
              layerId: def.id,
              portalItemId: def.portalItemId,
              error: err instanceof Error ? err.message : String(err),
            });
            setLayerFailed(def.id, true);
          }),
      );
      continue;
    }
    // Raster layers (NEXRAD radar) load as ImageryLayer; visual
    // Overlay only. same async-toggle-race fix.
    if (def.geometry === "raster") {
      void import("@arcgis/core/layers/ImageryLayer")
        .then(({ default: EsriImageryLayer }) => {
          const currentVisible = Boolean(useLayerVisibilityStore.getState().visible[def.id]);
          const layer = new EsriImageryLayer({
            id: def.id,
            url: def.url,
            title: def.title,
            visible: currentVisible,
            opacity: def.opacity ?? 0.7,
          });
          if (orphaned(layer)) return;
          map.add(layer);
          layerIndex.set(def.id, layer);
        })
        .catch((err: unknown) => {
          log.warn(`Raster layer "${def.id}" failed to load`, {
            layerId: def.id,
            url: def.url,
            error: err instanceof Error ? err.message : String(err),
          });
          setLayerFailed(def.id, true);
        });
      continue;
    }
    // Skip layers whose URL is neither an ArcGIS REST endpoint nor a bundled
    // `/data/*.geojson` dataset (other static-JSON fixtures are consumed by
    // explorer pages, not mounted on the map). buildLayer dispatches the
    // .geojson paths to a GeoJSONLayer.
    if (!/^https?:\/\//.test(def.url) && !def.url.endsWith(".geojson")) {
      log.info(`Skipping non-ArcGIS layer "${def.id}" (fixture-only)`);
      continue;
    }
    const layer = buildLayer(def, Boolean(initialVisibility[def.id]));
    map.add(layer);
    layerIndex.set(def.id, layer);
    // Montana feature-clip for no-state-field vector layers (a
    // definitionExpression can't scope them). Out-of-state features leave the
    // render + tap-query. Raster/VTL layers use the raster-clip group instead.
    if (def.montanaClip === "feature") {
      clipHandles.push(attachFeatureClip(view, layer, alive));
    }
    // Watch loadStatus via reactiveUtils; surface failures to the
    // LayerPanel and auto-retry one transient failure.
    let retryCount = 0;
    const handle = reactiveUtils.watch(
      () => (layer as Layer & { loadStatus?: string }).loadStatus,
      (status) => {
        if (status === "failed") {
          setLayerFailed(def.id, true);
          const loadError = (layer as Layer & { loadError?: Error }).loadError;
          log.warn(`Layer "${def.id}" failed to load`, {
            layerId: def.id,
            url: def.url,
            attempt: retryCount + 1,
            error: loadError ? loadError.message : "unknown",
          });
          if (retryCount < MAX_LOAD_RETRIES) {
            retryCount += 1;
            // Linear backoff so a flaky host isn't hammered on the same tick.
            const timer = setTimeout(() => {
              retryTimers.delete(timer);
              if (!alive()) return;
              const loadable = layer as Layer & { load?: () => Promise<unknown> };
              if (typeof loadable.load === "function") {
                loadable.load().catch(() => {
                  // Watch fires again with "failed" if this attempt also fails;
                  // the counter guards recursion. After MAX_LOAD_RETRIES the
                  // user can still manually toggle to try again.
                });
              }
            }, RETRY_DELAY_MS * retryCount);
            retryTimers.add(timer);
          }
        } else if (status === "loaded") {
          setLayerFailed(def.id, false);
        }
      },
    );
    watchHandles.push(handle);
  }

  // Mount the curated USGS gage catalog. Pass the current theme so
  // each graphic builds with the gauge-glyph marker matching DNRC stage gages.
  void buildUsgsGagesLayer(
    Boolean(initialVisibility["usgs-gages"] ?? false),
    useThemeStore.getState().resolved,
  ).then(({ layer }) => {
    if (orphaned(layer)) return;
    map.add(layer);
    layerIndex.set("usgs-gages", layer);
  });

  const detach = (): void => {
    for (const h of watchHandles) h.remove();
    for (const h of clipHandles) h.remove();
    for (const t of retryTimers) clearTimeout(t);
    retryTimers.clear();
  };

  return { layerIndex, detach };
}
