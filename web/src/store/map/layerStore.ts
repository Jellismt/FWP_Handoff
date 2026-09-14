/**
 * @file layerStore.ts
 * @module engage-mt/store
 * @description R.4b — Co-located layer-state stores. Two Zustand stores live
 *              here: `useLayerVisibilityStore` (which layers are on) and
 *              `useLayerLoadStatusStore` (which layers ArcGIS reported failed).
 *
 *              Both are keyed by layer-id and read together in LayerPanel
 *              ("show layer X with a failed-to-load chip" requires both). Co-
 *              locating the definitions in one module keeps the layer-state
 *              vocabulary in one place; subscription isolation stays preserved
 *              because they remain two separate Zustand stores.
 *
 *              `layerVisibilityStore.ts` and `layerLoadStatusStore.ts`
 *              re-export from here so existing imports keep working.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-06
 * @version 1.3.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import { LAYER_REGISTRY } from "@/config/layers";
import { isReferenceContextModule } from "@/types/layers";

/* ── Visibility — which layers are turned on ─────────────────────────── */

interface LayerVisibilityState {
  visible: Record<string, boolean>;
  toggle: (id: string) => void;
  setVisible: (id: string, visible: boolean) => void;
  /**
   * Turn ON exactly one layer and turn OFF every other — EXCEPT the cross-
   * cutting reference/shared context layers, whose current visibility is
   * preserved. Composite-aware: when `id` is a composite parent
   * (url: "", `composite: [...]`), its children are the layers that actually
   * render, so they're switched on too. Backs the `/?focus=<id>` deep-link used
   * by "open the map with only this layer + the app-open context" tools.
   */
  soloLayer: (id: string) => void;
}

const initialVisibility: Record<string, boolean> = Object.fromEntries(
  LAYER_REGISTRY.map((def) => [def.id, def.defaultVisible]),
);

export const useLayerVisibilityStore = create<LayerVisibilityState>((set) => ({
  visible: initialVisibility,
  toggle: (id) => set((state) => ({ visible: { ...state.visible, [id]: !state.visible[id] } })),
  setVisible: (id, visible) => set((state) => ({ visible: { ...state.visible, [id]: visible } })),
  soloLayer: (id) =>
    set((state) => {
      const def = LAYER_REGISTRY.find((d) => d.id === id);
      // Guard: unknown id → leave visibility untouched (don't blank the map on a typo).
      if (!def) return state;
      // Composite parent → also turn on its children (they're what renders).
      const onIds = new Set(def.composite ? [id, ...def.composite] : [id]);
      const visible = Object.fromEntries(
        LAYER_REGISTRY.map((d) => {
          if (onIds.has(d.id)) return [d.id, true];
          // Preserve the app-open context layers at their CURRENT visibility
          // (preserve, don't force-on: a heavy VTL the user turned off stays
          // off). Everything else is turned off so the tool's layer reads
          // clean. + isReferenceContextModule in types/layers.ts.
          if (isReferenceContextModule(d.module)) {
            return [d.id, state.visible[d.id] ?? d.defaultVisible];
          }
          return [d.id, false];
        }),
      );
      return { visible };
    }),
}));

/* ── Load status — which layers ArcGIS reported failed ───────────────── */

interface LayerLoadStatusState {
  /** layerId → true if ArcGIS reported `loadStatus === "failed"`. */
  failed: Record<string, boolean>;
  setFailed: (layerId: string, failed: boolean) => void;
  reset: () => void;
}

export const useLayerLoadStatusStore = create<LayerLoadStatusState>((set) => ({
  failed: {},
  setFailed: (layerId, failed) =>
    set((state) => ({ failed: { ...state.failed, [layerId]: failed } })),
  reset: () => set({ failed: {} }),
}));
