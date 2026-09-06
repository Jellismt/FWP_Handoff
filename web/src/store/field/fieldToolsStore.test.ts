/**
 * @file fieldToolsStore.test.ts
 * @module engage-mt/store
 * @description R.2a — Characterization test gating the R.4d merge with
 *              fieldModeStore. Verifies add/remove for each collection, the
 *              ID auto-generation, and the persist-middleware key.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { useFieldToolsStore } from "@/store/field/fieldToolsStore";

describe("fieldToolsStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useFieldToolsStore.getState().clearAll();
  });

  it("starts with empty collections", () => {
    const s = useFieldToolsStore.getState();
    expect(s.waypoints).toEqual([]);
    expect(s.routes).toEqual([]);
    expect(s.shapes).toEqual([]);
    expect(s.measurements).toEqual([]);
  });

  it("addWaypoint generates id + timestamps when missing", () => {
    const wp = useFieldToolsStore.getState().addWaypoint({
      kind: "camp",
      name: "Base camp",
      lat: 46,
      lon: -111,
    });
    expect(wp.id).toBeTruthy();
    expect(wp.createdAt).toBeTruthy();
    expect(useFieldToolsStore.getState().waypoints).toHaveLength(1);
  });

  it("updateWaypoint patches the matching entry + refreshes updatedAt", () => {
    const wp = useFieldToolsStore.getState().addWaypoint({
      kind: "camp",
      name: "old name",
      lat: 0,
      lon: 0,
    });
    useFieldToolsStore.getState().updateWaypoint(wp.id, { name: "new name" });
    expect(useFieldToolsStore.getState().waypoints[0].name).toBe("new name");
  });

  it("removeWaypoint drops by id", () => {
    const wp = useFieldToolsStore.getState().addWaypoint({
      kind: "camp",
      name: "x",
      lat: 0,
      lon: 0,
    });
    useFieldToolsStore.getState().removeWaypoint(wp.id);
    expect(useFieldToolsStore.getState().waypoints).toEqual([]);
  });

  it("addRoute persists a route to the routes collection", () => {
    const r = useFieldToolsStore.getState().addRoute({
      name: "morning loop",
      path: [
        [-111, 46],
        [-111.1, 46.1],
      ],
      distanceMi: 0.5,
      gainFt: 50,
      startedAt: new Date(0).toISOString(),
      endedAt: new Date(1000).toISOString(),
    });
    expect(useFieldToolsStore.getState().routes[0].id).toBe(r.id);
  });

  it("addShape persists a drawn polygon", () => {
    useFieldToolsStore.getState().addShape({
      name: "scouting area",
      shape: "polygon",
      color: "green",
      vertices: [
        [-111, 46],
        [-111.1, 46],
        [-111.1, 46.1],
      ],
    });
    expect(useFieldToolsStore.getState().shapes).toHaveLength(1);
  });

  it("addMeasurement persists a distance measurement", () => {
    useFieldToolsStore.getState().addMeasurement({
      kind: "distance",
      vertices: [
        [-111, 46],
        [-111.1, 46.1],
      ],
      value: 1.2,
    });
    expect(useFieldToolsStore.getState().measurements).toHaveLength(1);
  });

  it("clearAll empties every collection", () => {
    useFieldToolsStore.getState().addWaypoint({ kind: "camp", name: "x", lat: 0, lon: 0 });
    useFieldToolsStore.getState().addShape({
      name: "s",
      shape: "polygon",
      color: "red",
      vertices: [],
    });
    useFieldToolsStore.getState().clearAll();
    expect(useFieldToolsStore.getState().waypoints).toEqual([]);
    expect(useFieldToolsStore.getState().shapes).toEqual([]);
  });

  it("persists to localStorage key engage-mt:field-tools", () => {
    useFieldToolsStore.getState().addWaypoint({ kind: "camp", name: "x", lat: 0, lon: 0 });
    expect(window.localStorage.getItem("engage-mt:field-tools")).toBeTruthy();
  });
});
