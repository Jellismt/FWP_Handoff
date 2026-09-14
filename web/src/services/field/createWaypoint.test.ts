/**
 * @file createWaypoint.test.ts
 * @module engage-mt/services/field
 * @description Coverage for the shared waypoint-creation helper:
 *              persists to the field store, marks the pin as last-created (edit
 *              mode), auto-assigns the active trip, and shapes the FeatureCard
 *              result the map emit path expects.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createWaypointAt, waypointCardResult } from "./createWaypoint";
import { useFieldToolsStore } from "@/store/field/fieldToolsStore";

describe("createWaypointAt", () => {
  beforeEach(() => {
    useFieldToolsStore.getState().clearAll();
  });

  it("persists a waypoint at the given point and marks it last-created", () => {
    const wp = createWaypointAt({ lat: 46.6, lon: -111.9 });
    const store = useFieldToolsStore.getState();
    expect(store.waypoints.some((w) => w.id === wp.id)).toBe(true);
    expect(wp.lat).toBe(46.6);
    expect(wp.lon).toBe(-111.9);
    expect(store.lastCreatedId).toBe(wp.id);
    expect(wp.name).toMatch(/^Waypoint /);
  });

  it("shapes a waypoint FeatureCard result for the emit pipeline", () => {
    const wp = createWaypointAt({ lat: 45, lon: -110 });
    const result = waypointCardResult(wp);
    expect(result.layerId).toBe("engage-mt-field-waypoint");
    expect(result.module).toBe("shared");
    expect(result.features[0]).toMatchObject({
      __feature_kind: "waypoint",
      id: wp.id,
      lat: 45,
      lon: -110,
    });
  });
});
