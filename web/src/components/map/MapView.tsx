/**
 * @file MapView.tsx
 * @module engage-mt/map
 * @description 2D MapView orchestrator built with the `@arcgis/core` ESM
 *              modules. Owns the view's once-only lifecycle (creation, persisted
 * Viewpoint hydration + the render-pipeline nudge, the
 *              `alive`/`scheduleTimeout` teardown scaffold, ordered cleanup) and
 *              composes the extracted concerns:
 *                · layer construction / theme sync — layerLifecycle/* attachers
 *                · tap-query pipeline — tapQuery/runTapQuery
 *                · waypoint drop — attachWaypointDrop
 *                · visibility / nav / basemap — the use*Sync hooks
 * Stage 2 the heavy business logic now lives in those
 *              modules; this file stays an orchestrator.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-07
 * @version 2.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useRef, useState } from "react";
import EsriMap from "@arcgis/core/Map";
import EsriBasemap from "@arcgis/core/Basemap";
import EsriMapView from "@arcgis/core/views/MapView";
import Extent from "@arcgis/core/geometry/Extent";
import type Layer from "@arcgis/core/layers/Layer";
import { MONTANA_CONSTRAINT_EXTENT } from "@/data/montanaBoundary";
import { useMapModeStore } from "@/store/map/mapModeStore";
import { useLayerLoadStatusStore } from "@/store/map/layerLoadStatusStore";
import { useMapViewRefStore } from "@/store/map/mapViewRefStore";
import type { TapPoint } from "@/types/featureCard";
import { attachMontanaBoundaryMask } from "./montanaBoundaryMask";
import { attachViewpointPersist } from "./viewpointPersist";
import { attachFieldGraphics } from "@/services/field/fieldMapGraphics";
import { attachSelectedHighlightGraphics } from "@/services/map/selectedHighlightGraphics";
import { useMapInteraction } from "./useMapInteraction";
import { useMapHover } from "./useMapHover";
import { attachRegistryLayers } from "./layerLifecycle/attachRegistryLayers";
import { attachLayerThemeSync } from "./layerLifecycle/attachLayerThemeSync";
import { attachWaypointDrop } from "./attachWaypointDrop";
import { runTapQuery, type TapQueryContext } from "./tapQuery/runTapQuery";
import { useLayerVisibilitySync } from "./useLayerVisibilitySync";
import { useMapNavigationTarget } from "./useMapNavigationTarget";
import { useMapBasemapSync } from "./useMapBasemapSync";
import { DEFAULT_CENTER, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from "./mapViewConstants";
import type { TapQueryResult, TapQueryMore } from "./TapQueryPanel";

interface MapViewProps {
  /**
   * Emits both the tap-query results AND the click point so the
   * panel can thread the point into renderers' enrichment blocks. A null
   * `tapPoint` means programmatic clear (e.g., panel-close); otherwise the
   * click's `event.mapPoint` is forwarded verbatim. The point stays on
   * device — used by enrichments, never sent to any external service.
   *
   * The optional third arg carries the lazily-queryable
   * "N more features here" payload (null on empty taps / the waypoint-drop path).
   */
  onQueryResults: (
    results: TapQueryResult[],
    tapPoint: TapPoint | null,
    more?: TapQueryMore | null,
  ) => void;
}

export const MapView = ({ onQueryResults }: MapViewProps): JSX.Element => {
  // Latest-callback ref. The view-init effect below builds the entire map and is
  // intentionally run once. MapPage passes `onQueryResults` as a fresh inline
  // arrow on every render, so listing it in the effect deps used to tear down +
  // rebuild the whole map every time the popup opened or closed — the map
  // appeared to "reload" on close. Reading the callback through this ref keeps
  // the handlers calling the current closure without coupling the map's
  // lifecycle to the callback's identity.
  const onQueryResultsRef = useRef(onQueryResults);
  onQueryResultsRef.current = onQueryResults;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EsriMapView | null>(null);
  const [activeView, setActiveView] = useState<EsriMapView | null>(null);
  // True while the post-mount goTo nudge is running. The stationary
  // watch consults this ref and skips persisting if the nudge is in flight, so a
  // partial-nudge position can't drift into localStorage if React StrictMode
  // unmounts the view mid-restore.
  const kickingRef = useRef(false);
  const layerObjectsRef = useRef<Map<string, Layer> | null>(null);
  // Per-layer in-flight rAF handles for the visibility-sync fade
  // animations. Owned here (shared between this effect's teardown and the
  // visibility hook) so overlapping animations can cancel deterministically.
  const fadeHandlesRef = useRef<Map<string, number>>(new Map());

  // Activate on-map draw + measure when MapInteractionStore.activeTool ≠ none.
  useMapInteraction(activeView);
  // Hover halo + pointer cursor on desktop (no-op on touch).
  useMapHover(activeView);
  // Layer visibility fades, fly-to requests, and basemap/offline swaps each own
  // Their own effect via these hooks.
  useLayerVisibilitySync(layerObjectsRef, fadeHandlesRef);
  useMapNavigationTarget(viewRef);
  useMapBasemapSync(viewRef);

  // Initialize the view once.
  useEffect(() => {
    if (!containerRef.current) return;

    // Instantiate the basemap via Basemap.fromId() rather than the
    // string id; the string-coercion path in 4.34 produced an unloaded Basemap
    // that left the canvas blank until the user toggled it. Falls back to the
    // string id if a future SDK drops a well-known definition.
    const initialBasemapId = useMapModeStore.getState().basemap;
    const initialBasemap = EsriBasemap.fromId(initialBasemapId) ?? (initialBasemapId as never);
    // Silence the unhandled-rejection that fires when a first-mount
    // view gets torn down by StrictMode before this basemap finishes loading.
    if (
      initialBasemap &&
      typeof (initialBasemap as { load?: () => Promise<unknown> }).load === "function"
    ) {
      void (initialBasemap as { load: () => Promise<unknown> }).load().catch(() => undefined);
    }
    // — lifecycle guard for async work spawned inside this effect.
    // `alive` flips false in cleanup; any pending then-block that captured the
    // view must early-out. `pendingTimeouts` collects window.setTimeout ids so
    // cleanup can drain them.
    let alive = true;
    const pendingTimeouts = new Set<number>();
    const scheduleTimeout = (fn: () => void, ms: number): number => {
      const id = window.setTimeout(() => {
        pendingTimeouts.delete(id);
        if (!alive) return;
        fn();
      }, ms);
      pendingTimeouts.add(id);
      return id;
    };

    const map = new EsriMap({ basemap: initialBasemap });
    // Hydrate the initial viewport from the persisted viewpoint so
    // returning to /map lands where the user left off; statewide default on
    // first launch.
    const persistedViewpoint = useMapModeStore.getState().viewpoint;
    const view = new EsriMapView({
      container: containerRef.current,
      map,
      center: persistedViewpoint ? persistedViewpoint.center : DEFAULT_CENTER,
      zoom: persistedViewpoint ? persistedViewpoint.zoom : DEFAULT_ZOOM,
      // Constrain pan + zoom to Montana + ~80 mi buffer.
      constraints: {
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        geometry: new Extent(MONTANA_CONSTRAINT_EXTENT),
        rotationEnabled: false,
      },
    });
    // Kick the render pipeline. On initial mount in 4.34 the tile
    // layerView + several FeatureLayerViews stay `updating=true` and never
    // paint; a `view.goTo` with a longitude delta wakes the tile fetcher the
    // same way a real pan would. The `kickingRef` guard tells the stationary
    // watch to ignore every fire until the nudge releases the flag, so the
    // nudge's intermediate viewpoint can never be persisted.
    void view.when().then(() => {
      if (view.destroyed) return;
      const c = view.center;
      const z = view.zoom;
      if (
        !c ||
        typeof c.longitude !== "number" ||
        typeof c.latitude !== "number" ||
        typeof z !== "number" ||
        !Number.isFinite(z)
      ) {
        return;
      }
      const original = { center: [c.longitude, c.latitude] as [number, number], zoom: z };
      kickingRef.current = true;
      view
        .goTo(
          { center: [c.longitude + 0.05, c.latitude], zoom: z },
          { animate: true, duration: 60 },
        )
        .then(() => {
          if (view.destroyed) return;
          return view.goTo(original, { animate: true, duration: 60 });
        })
        .catch(() => undefined)
        .finally(() => {
          // Release persist suppression on a delayed macrotask so any stationary
          // event the SDK schedules after the restore goTo has already fired and
          // been ignored. Tracked so effect cleanup cancels stragglers.
          scheduleTimeout(() => {
            kickingRef.current = false;
          }, 200);
        });
    });
    // Every tap is owned by TapQueryPanel + the FeatureCard
    // registry. Disable the SDK popup widget so Living Atlas portal items don't
    // race our popups by firing their authored popupTemplate on click.
    (view as unknown as { popupEnabled: boolean }).popupEnabled = false;
    (view.popup as unknown as { autoOpenEnabled: boolean }).autoOpenEnabled = false;

    // R.3b — viewpoint persistence + Montana focus mask own their watch/
    // subscription lifecycles and return detach functions called in cleanup.
    const detachViewpointPersist = attachViewpointPersist({ view, kickingRef });
    const detachMontanaMask = attachMontanaBoundaryMask({ map, view, alive: () => alive });
    // Field-tools graphics overlay (waypoints + tracks + active line).
    const detachFieldGraphics = attachFieldGraphics({ map });
    // Pulsing halo at search / deep-link / explorer selections.
    const detachHighlightGraphics = attachSelectedHighlightGraphics({ map });

    // Layer construction + async GraphicsLayer mounts.
    const { layerIndex, detach: detachRegistryLayers } = attachRegistryLayers({
      map,
      view,
      alive: () => alive,
    });
    layerObjectsRef.current = layerIndex;
    // Recolor every renderer + the USGS gages layer on theme flip.
    const detachThemeSync = attachLayerThemeSync({ layerIndex });

    // Tap-query + waypoint drop share an `emit` that threads through the
    // latest-callback ref so the map's once-only lifecycle stays decoupled from
    // the prop identity.
    const emit = (
      results: TapQueryResult[],
      tapPoint: TapPoint | null,
      more?: TapQueryMore | null,
    ): void => {
      onQueryResultsRef.current(results, tapPoint, more ?? null);
    };
    const tapContext: TapQueryContext = { view, map, layerIndex, emit };
    const clickHandle = view.on("click", (event) => {
      void runTapQuery(event, tapContext);
    });
    // Long-press / right-click drops a draft waypoint + opens its card.
    // Waypoint dropping is now available on BOTH platforms (web users
    // plan a pin and hand it to their phone via send-to-phone); only GPS track
    // recording + offline downloads stay mobile-only.
    const detachWaypointDrop = attachWaypointDrop({ view, emit });

    viewRef.current = view;
    setActiveView(view);
    // Publish to mapViewRefStore so cross-cutting overlays
    // (highlight-on-search) reach the view without prop-drilling.
    useMapViewRefStore.getState().setView(view);

    return () => {
      // — flip the lifecycle flag first so in-flight then-blocks see a
      // dead view; then drain tracked window.setTimeout ids.
      alive = false;
      for (const id of pendingTimeouts) window.clearTimeout(id);
      pendingTimeouts.clear();
      clickHandle.remove();
      detachWaypointDrop();
      detachViewpointPersist();
      detachMontanaMask();
      detachThemeSync();
      setActiveView(null);
      useMapViewRefStore.getState().setView(null);
      detachRegistryLayers();
      detachFieldGraphics();
      detachHighlightGraphics();
      useLayerLoadStatusStore.getState().reset();
      view.destroy();
      viewRef.current = null;
      layerObjectsRef.current = null;
    };
    // Build the view exactly once — `onQueryResults` is read via the ref inside
    // the handlers, and visibility / basemap / nav are handled by the hooks
    // above.
  }, []);

  return (
    <div
      ref={containerRef}
      className="esri-map-host"
      role="application"
      aria-label="Interactive map of Montana"
      style={{ width: "100%", height: "100%" }}
    />
  );
};
