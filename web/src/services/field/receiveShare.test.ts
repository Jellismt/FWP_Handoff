/**
 * @file receiveShare.test.ts
 * @module engage-mt/services/field
 * @description Commit + conflict coverage: copy mode always adds with
 *              fresh ids (never clobbers), skip mode dedups by id, and the
 *              fly-to target points at the first imported item.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useFieldToolsStore, type Waypoint } from "@/store/field/fieldToolsStore";
import { buildShareBundle } from "./pinShareCodec";
import { commitShareBundle, countShareConflicts } from "./receiveShare";

const wp = (over: Partial<Waypoint> = {}): Waypoint => ({
  id: "shared-1",
  kind: "camp",
  name: "Shared camp",
  lat: 46.1,
  lon: -111.5,
  createdAt: "2026-06-30T13:00:00.000Z",
  updatedAt: "2026-06-30T13:00:00.000Z",
  photos: [],
  tags: ["from-friend"],
  ...over,
});

beforeEach(() => {
  useFieldToolsStore.getState().clearAll();
});

describe("commitShareBundle — copy mode", () => {
  it("adds with a fresh id and never collides with an existing item", () => {
    // Seed an item that shares the incoming id.
    useFieldToolsStore.getState().addWaypoint({ ...wp(), id: "shared-1" });
    const bundle = buildShareBundle({ waypoints: [wp()] });

    const result = commitShareBundle(bundle, { mode: "copy" });

    expect(result.addedWaypoints).toBe(1);
    const ids = useFieldToolsStore.getState().waypoints.map((w) => w.id);
    expect(ids).toHaveLength(2); // original + copy, no clobber
    expect(new Set(ids).size).toBe(2); // the copy got a new id
  });

  it("returns a fly-to target for the first waypoint", () => {
    const bundle = buildShareBundle({ waypoints: [wp({ name: "Glassing knob" })] });
    const result = commitShareBundle(bundle, { mode: "copy" });
    expect(result.firstTarget).toEqual({ lat: 46.1, lon: -111.5, label: "Glassing knob" });
  });

  it("preserves the kind, color, tags, and notes", () => {
    const bundle = buildShareBundle({
      waypoints: [wp({ kind: "blind", color: "fire", notes: "north bench" })],
    });
    commitShareBundle(bundle, { mode: "copy" });
    const saved = useFieldToolsStore.getState().waypoints[0];
    expect(saved.kind).toBe("blind");
    expect(saved.color).toBe("fire");
    expect(saved.notes).toBe("north bench");
    expect(saved.tags).toEqual(["from-friend"]);
  });
});

describe("commitShareBundle — skip mode", () => {
  it("skips an item whose id already exists and adds the rest", () => {
    useFieldToolsStore.getState().addWaypoint({ ...wp(), id: "shared-1" });
    const bundle = buildShareBundle({
      waypoints: [wp({ id: "shared-1" }), wp({ id: "shared-2", name: "New pin" })],
    });

    const result = commitShareBundle(bundle, { mode: "skip" });

    expect(result.addedWaypoints).toBe(1);
    expect(result.skipped).toBe(1);
    expect(useFieldToolsStore.getState().waypoints).toHaveLength(2);
  });

  it("is a no-op the second time the same link is received (skip mode)", () => {
    const bundle = buildShareBundle({ waypoints: [wp({ id: "shared-9" })] });
    commitShareBundle(bundle, { mode: "skip" });
    const second = commitShareBundle(bundle, { mode: "skip" });
    expect(second.addedWaypoints).toBe(0);
    expect(second.skipped).toBe(1);
    expect(useFieldToolsStore.getState().waypoints).toHaveLength(1);
  });
});

describe("countShareConflicts", () => {
  it("counts incoming ids that already exist", () => {
    useFieldToolsStore.getState().addWaypoint({ ...wp(), id: "shared-1" });
    const bundle = buildShareBundle({
      waypoints: [wp({ id: "shared-1" }), wp({ id: "shared-x" })],
    });
    expect(countShareConflicts(bundle)).toBe(1);
  });
});
