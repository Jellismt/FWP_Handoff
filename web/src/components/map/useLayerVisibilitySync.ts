/**
 * @file useLayerVisibilitySync.ts
 * @module engage-mt/map
 * @description Layer visibility-sync effect extracted from
 *              MapView.tsx. Subscribes to the layer
 *              visibility store and animates each layer's opacity 0 → registered
 *              target (show) or → 0 (hide) over 220ms via rAF so toggles feel
 *              like uncovering. Respects `prefers-reduced-motion`, cancels any
 *              in-flight fade for a layer before starting a new one (so the
 *              latest target always wins), and manually retries a failed layer
 *              when the user toggles it on. The subscription lives in this hook
 *              so the re-render trigger leaves the MapView orchestrator.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect } from "react";
import type { MutableRefObject } from "react";
import type Layer from "@arcgis/core/layers/Layer";
import { LAYER_REGISTRY } from "@/config/layers";
import { useLayerVisibilityStore } from "@/store/map/layerVisibilityStore";

/** Fade duration for a visibility toggle. */
const DURATION_MS = 220;

/**
 * Drive layer opacity from the visibility store.
 *
 * @param layerObjectsRef Shared id → Layer index (null until the view mounts).
 * @param fadeHandlesRef  Per-layer in-flight rAF handles (cancellation registry).
 */
export function useLayerVisibilitySync(
  layerObjectsRef: MutableRefObject<Map<string, Layer> | null>,
  fadeHandlesRef: MutableRefObject<Map<string, number>>,
): void {
  const visibility = useLayerVisibilityStore((s) => s.visible);

  useEffect(() => {
    const layerIndex = layerObjectsRef.current;
    if (!layerIndex) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const def of LAYER_REGISTRY) {
      const layer = layerIndex.get(def.id);
      if (!layer) continue;
      const target = Boolean(visibility[def.id]);
      const targetOpacity = typeof def.opacity === "number" ? def.opacity : 1;
      // Manual retry on toggle-on for failed layers; the watch
      // handler clears the failure pill when the retry succeeds.
      if (target && (layer as Layer & { loadStatus?: string }).loadStatus === "failed") {
        const loadable = layer as Layer & { load?: () => Promise<unknown> };
        if (typeof loadable.load === "function") {
          loadable.load().catch(() => {
            // Watch surfaces the failure pill again if the retry also fails.
          });
        }
      }
      // Skip animation when already in the right state — avoids flicker when the
      // store fires on unrelated changes. For target=false only check `visible`
      // (opacity is a don't-care while hidden); for target=true require both
      // visible AND opacity at the registered target (resume partial fade-ins).
      const currentOpacity = layer.opacity ?? 1;
      if (target) {
        if (layer.visible && currentOpacity === targetOpacity) continue;
      } else {
        if (!layer.visible) continue;
      }
      if (reduced) {
        // Cancel any in-flight animation so it can't undo this assignment.
        const inflight = fadeHandlesRef.current.get(def.id);
        if (inflight !== undefined) cancelAnimationFrame(inflight);
        fadeHandlesRef.current.delete(def.id);
        layer.visible = target;
        layer.opacity = target ? targetOpacity : 0;
        if (!target) layer.opacity = targetOpacity; // reset for next show
        continue;
      }
      // Cancel any in-flight rAF chain for this layer before starting
      // a new one so a late-completing show can't overwrite a fresh hide.
      const inflight = fadeHandlesRef.current.get(def.id);
      if (inflight !== undefined) cancelAnimationFrame(inflight);
      // Keep `visible: true` while animating; flip to false at the end of a
      // fade-out so hit-test stops counting it.
      const startOpacity = layer.opacity ?? (target ? 0 : targetOpacity);
      const endOpacity = target ? targetOpacity : 0;
      layer.visible = true;
      const start = performance.now();
      const layerId = def.id;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION_MS);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        layer.opacity = startOpacity + (endOpacity - startOpacity) * eased;
        if (t < 1) {
          fadeHandlesRef.current.set(layerId, requestAnimationFrame(tick));
        } else {
          fadeHandlesRef.current.delete(layerId);
          if (!target) {
            // Fade-out done → take the layer out of hitTest; reset opacity so
            // the next show animates from 0 → targetOpacity.
            layer.visible = false;
            layer.opacity = targetOpacity;
          }
        }
      };
      fadeHandlesRef.current.set(layerId, requestAnimationFrame(tick));
    }
  }, [visibility, layerObjectsRef, fadeHandlesRef]);
}
