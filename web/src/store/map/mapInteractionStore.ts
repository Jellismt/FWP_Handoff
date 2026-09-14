/**
 * @file mapInteractionStore.ts
 * @module engage-mt/store
 * @description Tier-3 store: which on-map interaction tool is currently active.
 *              `useMapInteraction` subscribes and runs a lightweight custom
 *              click-to-collect-vertices draw/measure session (deliberately not
 *              the ArcGIS Sketch / Measurement widgets, to keep the bundle
 *              small); captured shapes / measurements persist to fieldToolsStore.
 *              The `select-offline-aoi` tool delegates to `attachAoiRectangle`
 *              and hands its bbox to `offlineAoiDraftStore`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";

export type MapTool =
  | "none"
  | "draw-polygon"
  | "draw-polyline"
  | "measure-distance"
  | "measure-area"
  // Single-tap waypoint drop. The next user tap on the
  // map opens an inline name+kind dialog and persists via the existing
  // fieldToolsStore.addWaypoint API.
  | "drop-waypoint"
  // Offline-map AOI selection — two taps draw a rectangle box. The captured
  // bbox lands in offlineAoiDraftStore and opens the OfflineAoiConfirmSheet
  // (label / basemap / zoom / size estimate → queue or download). Handled by
  // attachAoiRectangle via useMapInteraction.
  | "select-offline-aoi";

interface MapInteractionState {
  activeTool: MapTool;
  setActiveTool: (tool: MapTool) => void;
  clearActiveTool: () => void;
}

export const useMapInteractionStore = create<MapInteractionState>((set) => ({
  activeTool: "none",
  setActiveTool: (tool) => set({ activeTool: tool }),
  clearActiveTool: () => set({ activeTool: "none" }),
}));
