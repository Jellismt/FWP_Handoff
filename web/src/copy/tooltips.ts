/**
 * @file tooltips.ts
 * @module engage-mt/copy
 * @description Single source of truth for every hover-explanation in
 *              Engage MT. Plain-English explanations for the
 *              first-generation hunter / angler / hiker who does NOT
 *              know what "BMA" or "AIS" means.
 *
 *              Style rules:
 *                - Start with a verb when describing an action
 *                  ("Find your current location"), not a noun phrase
 *                  ("Locate-me tool").
 *                - Explain WHY a user would tap it, not what it's
 *                  technically called.
 *                - Two registers: a bare control (chip, icon button)
 *                  gets 4–14 words, read at a glance. A tool-cluster
 *                  trigger or a menu row that has to teach the tool
 *                  gets one full sentence — still plain English.
 *                - Plain English. Spell out acronyms on first use.
 *                - No exclamation points, no jargon, no FWP-internal
 *                  shorthand.
 *
 *              Every key MUST be referenced by the component that owns
 *              it; consumers import { TOOLTIPS } and wrap with
 *              `<Tooltip content={TOOLTIPS.mapToolLocate}>...`. This is
 *              enforced, not merely asked for — `tooltips.coverage.test.ts`
 *              fails on any key nothing references. Delete an orphan
 *              rather than leaving it here; unreferenced copy reads as
 *              accessibility work that was never actually wired up.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-06-30
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export const TOOLTIPS = {
  // ── Map tool rail — cluster triggers ──────────────────────────────
  mapClusterMarkup:
    "Draw shapes and lines, drop waypoints, or type coordinates to mark up the map.",
  mapClusterMeasure: "Measure a distance along the map, or the area inside a shape.",
  mapClusterCapture: "Record a GPS track or download this area for offline use in the field.",

  // ── Map tool rail — individual tools ──────────────────────────────
  mapToolLocate: "Find your current location on the map",
  mapToolBasemap: "Choose the map background — satellite, hybrid, or topographic",
  mapToolDrawShape: "Tap the map to outline an area — hunting spot, unit boundary, camp zone.",
  mapToolDrawLine: "Tap the map to sketch a route, trail, or property line.",
  mapToolWaypoint:
    "Mark a point — campsite, kill site, spring, vehicle. Saved on this device; send it to your phone from Field Tools.",
  mapToolCoordinateEntry:
    "Type lat/lon vertices instead of drawing — keyboard- and screen-reader-friendly.",
  mapToolMeasure: "Tap points to measure a path length in miles.",
  mapToolMeasureArea: "Tap a boundary to measure the enclosed area in acres.",
  mapToolOfflineArea: "Draw a box to save the map here for offline use in the field.",

  // ── Chart-element accessibility (aria-label) ──────────────────────
  chartConditionBar: "Where the current value falls on a low-to-high scale",

  // ── Privacy + freshness chips ─────────────────────────────────────
  privacyLocalOnly:
    "Your location stays on this device. Engage MT never transmits GPS to FWP or any server.",
  freshnessLive: "Updates live as new data arrives",
  freshnessHourly: "Refreshed at most every hour",
  freshnessDaily: "Refreshed once per day",
  freshnessWeekly: "Refreshed weekly",
  freshnessStatic: "Reference data — doesn't change frequently",
  freshnessVersioned: "Versioned dataset — refreshed each season",

  // Auth + wallet tooltips removed (orphaned at audit time).
  // Wallet UI uses aria-label on its buttons directly. Re-add as a
  // keyed entry the moment a consumer needs identical copy in 2+ sites.
  //
  // Generic `action*` copy is deliberately absent: the copy in
  // particular was never wired to a button — an unreferenced entry buys no
  // accessibility, only the illusion of it. `tooltips.coverage.test.ts`
  // now fails the build on any key nothing references, so this file cannot
  // silently drift out of sync with the UI again.
} as const;

export type TooltipKey = keyof typeof TOOLTIPS;
