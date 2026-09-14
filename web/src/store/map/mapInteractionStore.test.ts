/**
 * @file mapInteractionStore.test.ts
 * @module engage-mt/store
 * @description R.2a — Characterization test for the active-tool dispatcher.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { useMapInteractionStore } from "@/store/map/mapInteractionStore";

describe("mapInteractionStore", () => {
  beforeEach(() => useMapInteractionStore.getState().clearActiveTool());

  it("starts with activeTool === 'none'", () => {
    expect(useMapInteractionStore.getState().activeTool).toBe("none");
  });

  it("setActiveTool dispatches the new tool", () => {
    useMapInteractionStore.getState().setActiveTool("draw-polygon");
    expect(useMapInteractionStore.getState().activeTool).toBe("draw-polygon");
  });

  it("clearActiveTool returns to 'none'", () => {
    useMapInteractionStore.getState().setActiveTool("measure-distance");
    useMapInteractionStore.getState().clearActiveTool();
    expect(useMapInteractionStore.getState().activeTool).toBe("none");
  });

  it("supports every known tool", () => {
    for (const t of [
      "draw-polygon",
      "draw-polyline",
      "measure-distance",
      "measure-area",
      "drop-waypoint",
    ] as const) {
      useMapInteractionStore.getState().setActiveTool(t);
      expect(useMapInteractionStore.getState().activeTool).toBe(t);
    }
  });
});
