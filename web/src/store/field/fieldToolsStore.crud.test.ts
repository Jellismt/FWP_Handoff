/**
 * @file fieldToolsStore.crud.test.ts
 * @module engage-mt/store
 * @description Exercises the field-tools store mutators the
 *              add/clearAll suite left uncovered: update/remove for every
 *              collection, waypoint photos, trips (update/archive/remove with
 *              detach), assign-to-trip, active-trip, and the last-created
 *              consume handshake.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-13
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { useFieldToolsStore } from "@/store/field/fieldToolsStore";

const store = () => useFieldToolsStore.getState();

beforeEach(() => store().clearAll());

describe("waypoint update / remove / photos", () => {
  it("updateWaypoint patches fields", () => {
    const wp = store().addWaypoint({ kind: "general", name: "Old", lat: 46, lon: -111 });
    store().updateWaypoint(wp.id, { name: "New", notes: "added" });
    const u = store().waypoints.find((w) => w.id === wp.id);
    expect(u?.name).toBe("New");
    expect(u?.notes).toBe("added");
  });

  it("removeWaypoint drops the row", () => {
    const wp = store().addWaypoint({ kind: "general", name: "X", lat: 46, lon: -111 });
    store().removeWaypoint(wp.id);
    expect(store().waypoints).toHaveLength(0);
  });

  it("adds then removes a waypoint photo", () => {
    const wp = store().addWaypoint({ kind: "general", name: "P", lat: 46, lon: -111 });
    store().addWaypointPhoto(wp.id, {
      uri: "data:image/jpeg;base64,AAA",
      capturedAt: "2026-06-13T00:00:00Z",
    });
    const photoId = store().waypoints.find((w) => w.id === wp.id)!.photos[0]!.id;
    expect(photoId).toBeTruthy();
    store().removeWaypointPhoto(wp.id, photoId);
    expect(store().waypoints.find((w) => w.id === wp.id)?.photos).toHaveLength(0);
  });
});

describe("route / shape / measurement update + remove", () => {
  const addRoute = () =>
    store().addRoute({
      name: "Track",
      path: [
        [-111, 46],
        [-111.1, 46.1],
      ],
      distanceMi: 3,
      gainFt: 200,
      startedAt: "2026-06-13T00:00:00Z",
      endedAt: "2026-06-13T01:00:00Z",
    });

  it("updates and removes a route", () => {
    const r = addRoute();
    store().updateRoute(r.id, { name: "Renamed" });
    expect(store().routes[0]!.name).toBe("Renamed");
    store().removeRoute(r.id);
    expect(store().routes).toHaveLength(0);
  });

  it("updates and removes a shape", () => {
    const s = store().addShape({
      name: "Zone",
      shape: "polygon",
      vertices: [
        [-111, 46],
        [-111, 47],
        [-110, 47],
      ],
      color: "red",
    });
    store().updateShape(s.id, { name: "Z2" });
    expect(store().shapes[0]!.name).toBe("Z2");
    store().removeShape(s.id);
    expect(store().shapes).toHaveLength(0);
  });

  it("removes a measurement", () => {
    const m = store().addMeasurement({
      kind: "distance",
      vertices: [
        [-111, 46],
        [-110, 46],
      ],
      value: 47.2,
    });
    store().removeMeasurement(m.id);
    expect(store().measurements).toHaveLength(0);
  });
});

describe("trips", () => {
  it("adds, updates, and archives a trip", () => {
    const t = store().addTrip({ name: "Elk 2026", color: "green" });
    store().updateTrip(t.id, { name: "Elk Camp" });
    expect(store().trips[0]!.name).toBe("Elk Camp");
    store().archiveTrip(t.id);
    expect(store().trips[0]!.archivedAt).toBeTruthy();
  });

  it("detaches assigned items when a trip is removed", () => {
    const t = store().addTrip({ name: "Trip", color: "blue" });
    const wp = store().addWaypoint({
      kind: "general",
      name: "WP",
      lat: 46,
      lon: -111,
      tripId: t.id,
    });
    store().removeTrip(t.id);
    expect(store().trips).toHaveLength(0);
    expect(store().waypoints.find((w) => w.id === wp.id)?.tripId).toBeUndefined();
  });

  it("assigns items to a trip and tracks the active trip", () => {
    const t = store().addTrip({ name: "Trip", color: "blue" });
    const wp = store().addWaypoint({ kind: "general", name: "WP", lat: 46, lon: -111 });
    store().assignToTrip({ waypointIds: [wp.id] }, t.id);
    expect(store().waypoints.find((w) => w.id === wp.id)?.tripId).toBe(t.id);
    store().setActiveTrip(t.id);
    expect(store().activeTripId).toBe(t.id);
  });
});

describe("lastCreated handshake", () => {
  it("consumeLastCreated returns true once for a match, then false", () => {
    store().setLastCreated("abc");
    expect(store().consumeLastCreated("abc")).toBe(true);
    expect(store().consumeLastCreated("abc")).toBe(false);
  });

  it("consumeLastCreated returns false for a non-matching id", () => {
    store().setLastCreated("abc");
    expect(store().consumeLastCreated("xyz")).toBe(false);
  });
});
