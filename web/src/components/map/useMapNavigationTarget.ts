/**
 * @file useMapNavigationTarget.ts
 * @module engage-mt/map
 * @description Fly-to-point consumer effect extracted from MapView.tsx
 *. Subscribes imperatively to the map-nav
 *              store so cross-app "View on map" requests (FAS detail,
 *              locate-me, search) fly the view without re-rendering on
 *              every store mutation, and lands each flyTo with a 3-second
 * Highlight halo. drains any target already set
 *              before this effect mounted (a detail page's `requestGoto` +
 *              `navigate("/")` synchronous path) once the view is ready.
 *
 *              Distinct from `hooks/useMapNavigation.ts` (the fly-to PRODUCER
 *              used by pages); this is the in-MapView CONSUMER.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect } from "react";
import type { RefObject } from "react";
import type EsriMapView from "@arcgis/core/views/MapView";
import { useMapNavStore } from "@/store/map/mapNavStore";
import { highlightTapQueryHit } from "@/services/map/tapQueryHighlightBridge";

/** Default zoom for a "View on map" flyTo when the request omits one. */
const FLYTO_DEFAULT_ZOOM = 13;
const FLYTO_DURATION_MS = 800;
const FLYTO_HALO_TTL_MS = 3000;

/** Subscribe a view ref to map-nav fly-to requests. */
export function useMapNavigationTarget(viewRef: RefObject<EsriMapView | null>): void {
  useEffect(() => {
    const flyToTarget = (target: {
      lat: number;
      lon: number;
      zoom?: number;
      label?: string;
    }): void => {
      const view = viewRef.current;
      if (!view) return;
      void view
        .goTo(
          {
            center: [target.lon, target.lat],
            zoom: target.zoom ?? FLYTO_DEFAULT_ZOOM,
          },
          { duration: FLYTO_DURATION_MS, easing: "ease-in-out" },
        )
        .then(() => {
          // Land with a halo + 2-pulse ring on the destination,
          // reusing the tap-query bridge so it matches search-hit feedback.
          highlightTapQueryHit({
            mapPoint: { latitude: target.lat, longitude: target.lon },
            geometry: "point",
            label: target.label ?? "Selected location",
            ttlMs: FLYTO_HALO_TTL_MS,
          });
        })
        .catch(() => {
          // view.goTo rejects on rapid successive flyTos; the next dispatch
          // supersedes this one + handles its own halo. Swallow.
        });
      useMapNavStore.getState().clear();
    };

    // Drain a pending target on view-ready (covers the synchronous
    // requestGoto-then-navigate path from detail pages).
    const drainPending = (): void => {
      const pending = useMapNavStore.getState().target;
      if (pending) flyToTarget(pending);
    };
    const v = viewRef.current;
    if (v) {
      void v.when().then(drainPending);
    } else {
      // viewRef populates in the mount effect (same tick); microtask catch.
      void Promise.resolve().then(() => {
        const ready = viewRef.current;
        if (ready) void ready.when().then(drainPending);
      });
    }

    // Subscribe for future requests.
    return useMapNavStore.subscribe((state) => {
      if (state.target) flyToTarget(state.target);
    });
  }, [viewRef]);
}
