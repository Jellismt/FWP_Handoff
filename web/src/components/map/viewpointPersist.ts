/**
 * @file viewpointPersist.ts
 * @module engage-mt/map
 * @description R.3b — `view.stationary` watcher extracted from MapView.tsx.
 *              When the view comes to rest, writes the active center + zoom
 *              into `mapModeStore` so a navigation away + return resumes at
 *              the same place.
 *
 * The nudge applies an intentional pan immediately after
 *              mount to kick the SDK's hover/tap pipeline out of its post-load
 *              freeze; the nudge's intermediate viewpoint must NOT be persisted.
 *              `kickingRef.current === true` suppresses persistence until the
 *              nudge releases the flag.
 *
 *              Returns an imperative detach function — matches the existing
 *              `attachFieldGraphics` / `attachSelectedHighlightGraphics` pattern.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import type MapView from "@arcgis/core/views/MapView";
import { useMapModeStore } from "@/store/map/mapModeStore";

interface AttachViewpointPersistOptions {
  view: MapView;
  /** Mutable suppression flag — set true during the post-mount nudge. */
  kickingRef: { current: boolean };
}

/**
 * Subscribe to `view.stationary` and persist the resting viewpoint to
 * `mapModeStore`. Returns a detach function that removes the watcher.
 */
export const attachViewpointPersist = ({
  view,
  kickingRef,
}: AttachViewpointPersistOptions): (() => void) => {
  const handle = reactiveUtils.watch(
    () => view.stationary,
    (isStationary) => {
      if (!isStationary) return;
      if (kickingRef.current) return;
      const c = view.center;
      const z = view.zoom;
      if (!c || typeof c.longitude !== "number" || typeof c.latitude !== "number") return;
      if (typeof z !== "number" || !Number.isFinite(z)) return;
      useMapModeStore.getState().setViewpoint({
        center: [c.longitude, c.latitude],
        zoom: z,
      });
    },
  );
  return () => handle.remove();
};
