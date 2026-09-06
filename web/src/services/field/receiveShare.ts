/**
 * @file receiveShare.ts
 * @module engage-mt/services/field
 * @description Commit a decoded pin-share bundle into the field-tools
 *              store, with conflict handling so a re-opened link never silently
 *              no-ops or clobbers the recipient's edits:
 *
 *                • "copy" (default) — every item is added with a FRESH id, so a
 *                  shared pin always lands as a new copy. Re-opening the link
 *                  makes another copy (predictable, never destructive).
 *                • "skip"          — incoming ids are preserved and items whose
 *                  id already exists are skipped, so re-receiving the same link
 *                  is a no-op.
 *
 *              Returns a map-nav target for the first imported item so the
 *              caller can fly the map to the pin (the "open → look at it"
 *              behavior users expect from consumer map apps). Photos are never
 *              present (stripped at encode time).
 *
 *              Privacy: pure local store mutation; no network. Per
 *              docs/rules/privacy.md.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-14
 * @version 1.0.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useFieldToolsStore } from "@/store/field/fieldToolsStore";
import type { MapNavTarget } from "@/store/map/mapNavStore";
import type { EngageMtShareBundle } from "@/services/field/pinShareCodec";

export type ConflictMode = "copy" | "skip";

export interface CommitShareResult {
  addedWaypoints: number;
  addedRoutes: number;
  addedShapes: number;
  /** Items skipped because their id already existed (skip mode only). */
  skipped: number;
  /** Fly-to target for the first imported item, or null when nothing landed. */
  firstTarget: MapNavTarget | null;
}

/**
 * How many incoming items already exist in the store by id. Drives whether the
 * receive sheet offers the copy/skip choice at all (zero → no choice needed).
 */
export const countShareConflicts = (bundle: EngageMtShareBundle): number => {
  const s = useFieldToolsStore.getState();
  const wp = new Set(s.waypoints.map((w) => w.id));
  const r = new Set(s.routes.map((x) => x.id));
  const sh = new Set(s.shapes.map((x) => x.id));
  return (
    (bundle.waypoints ?? []).filter((w) => wp.has(w.id)).length +
    (bundle.routes ?? []).filter((x) => r.has(x.id)).length +
    (bundle.shapes ?? []).filter((x) => sh.has(x.id)).length
  );
};

/**
 * Commit a share bundle. `activeTripId` (the recipient's active trip) is used
 * when the bundle carries no trip of its own. When the bundle DOES carry a
 * trip, the imported items are grouped under it.
 */
export const commitShareBundle = (
  bundle: EngageMtShareBundle,
  opts: { mode: ConflictMode; activeTripId?: string | null },
): CommitShareResult => {
  const store = useFieldToolsStore.getState();
  const { mode } = opts;
  const preserveId = mode === "skip";

  const existingWp = new Set(store.waypoints.map((w) => w.id));
  const existingR = new Set(store.routes.map((r) => r.id));
  const existingSh = new Set(store.shapes.map((s) => s.id));

  // Resolve the destination trip. A bundled trip wins over the active trip.
  let tripId = opts.activeTripId ?? undefined;
  if (bundle.trip) {
    const existingTrip = store.trips.find((t) => t.id === bundle.trip!.id);
    if (existingTrip && preserveId) {
      tripId = existingTrip.id;
    } else {
      const created = store.addTrip({
        name: bundle.trip.name,
        color: bundle.trip.color,
        icon: bundle.trip.icon,
        notes: bundle.trip.notes,
        ...(preserveId ? { id: bundle.trip.id } : {}),
      });
      tripId = created.id;
    }
  }

  const result: CommitShareResult = {
    addedWaypoints: 0,
    addedRoutes: 0,
    addedShapes: 0,
    skipped: 0,
    firstTarget: null,
  };

  const setTarget = (lat: number, lon: number, label: string): void => {
    if (!result.firstTarget) result.firstTarget = { lat, lon, label };
  };

  for (const w of bundle.waypoints ?? []) {
    if (preserveId && existingWp.has(w.id)) {
      result.skipped++;
      continue;
    }
    store.addWaypoint({
      kind: w.kind,
      name: w.name,
      notes: w.notes,
      lat: w.lat,
      lon: w.lon,
      color: w.color,
      tags: w.tags,
      tripId,
      ...(preserveId ? { id: w.id } : {}),
    });
    result.addedWaypoints++;
    setTarget(w.lat, w.lon, w.name);
  }

  for (const r of bundle.routes ?? []) {
    if (preserveId && existingR.has(r.id)) {
      result.skipped++;
      continue;
    }
    const { id: _omitId, ...rest } = r;
    store.addRoute({ ...rest, tripId, ...(preserveId ? { id: r.id } : {}) });
    result.addedRoutes++;
    if (r.path[0]) setTarget(r.path[0][1], r.path[0][0], r.name);
  }

  for (const s of bundle.shapes ?? []) {
    if (preserveId && existingSh.has(s.id)) {
      result.skipped++;
      continue;
    }
    const { id: _omitId, createdAt: _omitCreated, ...rest } = s;
    store.addShape({ ...rest, tripId, ...(preserveId ? { id: s.id } : {}) });
    result.addedShapes++;
    if (s.vertices[0]) setTarget(s.vertices[0][1], s.vertices[0][0], s.name);
  }

  return result;
};
