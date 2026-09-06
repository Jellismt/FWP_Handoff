/**
 * @file useMapBasemapSync.ts
 * @module engage-mt/map
 * @description Keeps the map's basemap in step with the basemap picker and,
 *              on the device, swaps to the downloaded tile layer while
 *              offline. While offline it also tracks whether the map centre
 *              lies inside a downloaded area so the banner can say when the
 *              user has panned off their packs.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-08
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import EsriBasemap from "@arcgis/core/Basemap";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import type EsriMapView from "@arcgis/core/views/MapView";
import { useMapModeStore } from "@/store/map/mapModeStore";
import { useConnectivityStore } from "@/store/app/connectivityStore";
import { useOfflineCoverageStore } from "@/store/map/offlineCoverageStore";
import { hasAnyDownloadedCoverage } from "@/services/mobile/offlineTileResolver";
import { isCapacitor } from "@/utils/capacitor";

export function useMapBasemapSync(viewRef: RefObject<EsriMapView | null>): void {
  const basemap = useMapModeStore((s) => s.basemap);
  const online = useConnectivityStore((s) => s.online);

  // Skip the first run; the init effect already created the map with the
  // right basemap. Firing here on first render would race its load.
  const basemapInitRef = useRef(true);
  useEffect(() => {
    if (basemapInitRef.current) {
      basemapInitRef.current = false;
      return;
    }
    if (viewRef.current?.map) {
      viewRef.current.map.basemap = EsriBasemap.fromId(basemap) as never;
    }
  }, [basemap, viewRef]);

  // Offline tile swap. Device only.
  const offlineSwapRef = useRef(false);
  useEffect(() => {
    if (!isCapacitor()) return;
    const map = viewRef.current?.map;
    if (!map) return;
    if (!online && hasAnyDownloadedCoverage() && !offlineSwapRef.current) {
      offlineSwapRef.current = true;
      void (async () => {
        try {
          const { createOfflineXyzLayer } = await import("./OfflineXyzLayer");
          const offlineLayer = await createOfflineXyzLayer();
          if (!offlineLayer || !viewRef.current?.map) return;
          viewRef.current.map.basemap = new EsriBasemap({
            baseLayers: [offlineLayer as never],
            title: "Offline",
            id: "offline-xyz",
          }) as never;
        } catch {
          offlineSwapRef.current = false;
        }
      })();
    } else if (online && offlineSwapRef.current) {
      offlineSwapRef.current = false;
      map.basemap = EsriBasemap.fromId(basemap) as never;
    }
  }, [online, basemap, viewRef]);

  // Coverage tracking while offline: re-evaluate whenever the view settles.
  useEffect(() => {
    const view = viewRef.current;
    const coverage = useOfflineCoverageStore.getState();
    if (!isCapacitor() || online || !view) {
      coverage.update(null);
      return;
    }
    const evaluate = (): void => {
      const c = view.center;
      if (c && typeof c.longitude === "number" && typeof c.latitude === "number") {
        coverage.update({ lon: c.longitude, lat: c.latitude });
      }
    };
    evaluate();
    const handle = reactiveUtils.watch(
      () => view.stationary,
      (stationary) => {
        if (stationary) evaluate();
      },
    );
    return () => handle.remove();
  }, [online, viewRef]);
}
