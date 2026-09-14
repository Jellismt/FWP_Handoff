/**
 * @file kmlImport.ts
 * @module engage-mt/services/field
 * @description KML 2.2 parser. Extracts `<Placemark>`→`<Point>` as
 *              waypoints and `<Placemark>`→`<LineString>` as tracks, returning
 *              the SAME `GpxImportResult` shape as `gpxImport.ts` so the import
 *              dialog + receive flow + `commitGpxImport` consume it unchanged.
 *
 *              KML is the default export of most mapping apps and agencies
 *              (NPS, BLM), so this closes the "open a pin a friend exported" path for the
 *              KML half (GPX is handled by gpxImport). Coordinates are
 *              `lon,lat[,alt]` whitespace-separated tuples — note the
 *              lon-first ordering, the classic KML foot-gun.
 *
 *              Validates lat/lon as finite numbers within Montana ± a 0.5°
 *              buffer; out-of-bounds items are kept but flagged as warnings,
 *              not silently dropped (mirrors gpxImport).
 *
 *              Privacy: parsed in-browser via DOMParser. No upload. Per
 *              docs/rules/privacy.md.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-14
 * @version 1.0.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { WaypointKind } from "@/store/field/fieldToolsStore";
import { haversineMeters } from "@/utils/geometry"; // SP-7: was a local dup
import type { GpxImportResult } from "@/services/field/gpxImport";

/** Montana bounds plus a 0.5° buffer (so border-hugging imports survive). */
const MT_BOUNDS = { minLat: 44.5, maxLat: 49.5, minLon: -116.6, maxLon: -103.5 };
const MILES_PER_METER = 0.000621371;

const inMontana = (lat: number, lon: number): boolean =>
  lat >= MT_BOUNDS.minLat &&
  lat <= MT_BOUNDS.maxLat &&
  lon >= MT_BOUNDS.minLon &&
  lon <= MT_BOUNDS.maxLon;

const childText = (parent: Element, tag: string): string | null => {
  const el = parent.getElementsByTagName(tag).item(0);
  return el?.textContent?.trim() || null;
};

/** Map free-form KML name/description hints onto our WaypointKind vocabulary. */
const inferKind = (hintRaw?: string | null): WaypointKind => {
  const hint = (hintRaw ?? "").toLowerCase();
  if (/camp|tent/.test(hint)) return "camp";
  if (/blind|stand/.test(hint)) return "blind";
  if (/spring|well/.test(hint)) return "spring";
  if (/water/.test(hint)) return "water";
  if (/glass/.test(hint)) return "glassing-point";
  if (/photo|camera/.test(hint)) return "photo";
  if (/vehicle|truck|car/.test(hint)) return "vehicle";
  if (/hazard|danger/.test(hint)) return "hazard";
  if (/ridge/.test(hint)) return "ridge";
  if (/saddle/.test(hint)) return "saddle";
  return "general";
};

/**
 * Parse a KML `<coordinates>` blob into [lon, lat] pairs. KML tuples are
 * `lon,lat[,alt]` separated by whitespace; alt (if present) is dropped.
 */
const parseCoordinates = (raw: string): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (const tuple of raw.trim().split(/\s+/)) {
    const parts = tuple.split(",");
    if (parts.length < 2) continue;
    const lon = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) out.push([lon, lat]);
  }
  return out;
};

export const parseKml = (xml: string): GpxImportResult => {
  const result: GpxImportResult = { waypoints: [], routes: [], warnings: [] };

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml");
  } catch (err) {
    result.warnings.push(`Could not parse XML: ${err instanceof Error ? err.message : err}`);
    return result;
  }

  const parserError = doc.getElementsByTagName("parsererror").item(0);
  if (parserError) {
    result.warnings.push(
      `KML is malformed: ${parserError.textContent?.slice(0, 200) ?? "unknown"}`,
    );
    return result;
  }

  const root = doc.documentElement;
  if (root.tagName.toLowerCase() !== "kml") {
    result.warnings.push(`Expected <kml>; found <${root.tagName}>.`);
    return result;
  }

  const placemarks = Array.from(root.getElementsByTagName("Placemark"));
  for (const pm of placemarks) {
    const name = childText(pm, "name");
    const desc = childText(pm, "description") ?? undefined;

    // Point → waypoint
    const point = pm.getElementsByTagName("Point").item(0);
    if (point) {
      const coordsRaw = childText(point, "coordinates");
      const coords = coordsRaw ? parseCoordinates(coordsRaw) : [];
      if (coords.length === 0) {
        result.warnings.push(`Skipped Placemark "${name ?? "(unnamed)"}" with no valid Point.`);
        continue;
      }
      const [lon, lat] = coords[0];
      if (!inMontana(lat, lon)) {
        result.warnings.push(
          `Waypoint "${name ?? "(unnamed)"}" sits outside Montana — kept but flag for review.`,
        );
      }
      result.waypoints.push({
        kind: inferKind(name ?? desc),
        name: name ?? `Imported ${result.waypoints.length + 1}`,
        lat,
        lon,
        notes: desc,
        photos: [],
        tags: ["imported"],
      });
      continue;
    }

    // LineString → track
    const line = pm.getElementsByTagName("LineString").item(0);
    if (line) {
      const coordsRaw = childText(line, "coordinates");
      const path = coordsRaw ? parseCoordinates(coordsRaw) : [];
      if (path.length < 2) {
        result.warnings.push(`Track "${name ?? "(unnamed)"}" had fewer than 2 points; dropped.`);
        continue;
      }
      let totalM = 0;
      for (let i = 1; i < path.length; i++) {
        totalM += haversineMeters(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
      }
      result.routes.push({
        name: name ?? `Imported track ${result.routes.length + 1}`,
        path,
        distanceMi: totalM * MILES_PER_METER,
        gainFt: 0,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        tags: ["imported"],
      });
    }
  }

  return result;
};
