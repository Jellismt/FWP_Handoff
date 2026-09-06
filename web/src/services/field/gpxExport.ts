/**
 * @file gpxExport.ts
 * @module engage-mt/services/field
 * @description GPX 1.1 serializer for a single waypoint or
 *              track. Used by the share-sheet flow (pastes the GPX
 *              into the share body).
 *
 *              Single-item helpers (`waypointToGpx`, `routeToGpx`)
 *              produce a valid stand-alone document so the share body
 *              can be saved as `.gpx` directly. `buildGpxBundle`
 *              builds a single document with every selected waypoint +
 *              route for multi-item shares.
 *
 *              Conformance: GPX 1.1 schema, UTF-8, XML special chars
 *              escaped in `<name>` / `<desc>` / `<type>`. Lat/lon at
 *              7-decimal precision (~1 cm), elevation in meters per
 *              the GPX `ele` convention.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-16
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { CapturedRoute, Waypoint } from "@/store/field/fieldToolsStore";
import { splitPath } from "./pathSegments";

const FEET_PER_METER = 3.28084;

const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>`;
const gpxOpen = `<gpx version="1.1" creator="Engage MT — Montana FWP" xmlns="http://www.topografix.com/GPX/1/1">`;
const gpxClose = `</gpx>`;

const waypointXml = (w: Waypoint): string => {
  const lines = [
    `  <wpt lat="${w.lat.toFixed(7)}" lon="${w.lon.toFixed(7)}">`,
    `    <name>${xmlEscape(w.name)}</name>`,
    `    <type>${xmlEscape(w.kind)}</type>`,
  ];
  if (w.notes) lines.push(`    <desc>${xmlEscape(w.notes)}</desc>`);
  lines.push(`    <time>${w.createdAt}</time>`);
  lines.push(`  </wpt>`);
  return lines.join("\n");
};

const routeXml = (r: CapturedRoute): string => {
  const lines = [`  <trk>`, `    <name>${xmlEscape(r.name)}</name>`];
  if (r.notes) lines.push(`    <desc>${xmlEscape(r.notes)}</desc>`);
  // One <trkseg> per recorded segment: readers keep the gaps.
  const indexed = r.path.map((pt, i) => ({ pt, i }));
  for (const segment of splitPath(indexed, r.segments)) {
    lines.push(`    <trkseg>`);
    for (const { pt, i } of segment) {
      const [lon, lat] = pt;
      const eleFt = r.elevationFt?.[i];
      const ele =
        eleFt != null && Number.isFinite(eleFt)
          ? `<ele>${(eleFt / FEET_PER_METER).toFixed(2)}</ele>`
          : "";
      lines.push(`      <trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}">${ele}</trkpt>`);
    }
    lines.push(`    </trkseg>`);
  }
  lines.push(`  </trk>`);
  return lines.join("\n");
};

export const waypointToGpx = (w: Waypoint): string =>
  [xmlHeader, gpxOpen, waypointXml(w), gpxClose].join("\n");

/** Single-route GPX document. */
export const routeToGpx = (r: CapturedRoute): string =>
  [xmlHeader, gpxOpen, routeXml(r), gpxClose].join("\n");

/** All-waypoints + all-routes GPX bundle. */
export const buildGpxBundle = (
  waypoints: readonly Waypoint[],
  routes: readonly CapturedRoute[],
): string => {
  const body = [...waypoints.map(waypointXml), ...routes.map(routeXml)].join("\n");
  return [xmlHeader, gpxOpen, body, gpxClose].join("\n");
};
