/**
 * @file gpxImport.ts
 * @module engage-mt/services/field
 * @description GPX 1.0 / 1.1 parser. Extracts `<wpt>` waypoints,
 *              `<trk>` tracks (concatenating segments), and `<rte>` routes
 *              (treated as tracks). Validates lat/lon as finite numbers
 *              within Montana ± a 0.5° buffer; out-of-bounds items are
 *              collected as warnings, not silently dropped.
 *
 *              Uses the browser's native `DOMParser`. Falls back gracefully
 *              on parser-error documents (badly malformed XML). Returns
 *              both the parsed payload and a structured warnings list so
 *              the import dialog can show counts + conflicts before commit.
 *
 *              Privacy: every byte stays in the browser. No upload.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-09
 * @updated 2026-07-03
 * @version 1.0.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { CapturedRoute, Waypoint, WaypointKind } from "@/store/field/fieldToolsStore";
import { haversineMeters } from "@/utils/geometry"; // SP-7: was a local dup

/** Montana bounds plus a 0.5° buffer (so border-hugging imports survive). */
const MT_BOUNDS = {
  minLat: 44.5,
  maxLat: 49.5,
  minLon: -116.6,
  maxLon: -103.5,
};

const MILES_PER_METER = 0.000621371;

/** Single import payload — the import dialog batches into store actions. */
export interface GpxImportResult {
  waypoints: Array<Omit<Waypoint, "id" | "createdAt" | "updatedAt"> & { suggestedId?: string }>;
  routes: Array<Omit<CapturedRoute, "id">>;
  warnings: string[];
}

const inMontana = (lat: number, lon: number): boolean =>
  lat >= MT_BOUNDS.minLat &&
  lat <= MT_BOUNDS.maxLat &&
  lon >= MT_BOUNDS.minLon &&
  lon <= MT_BOUNDS.maxLon;

const text = (parent: Element, tag: string): string | null => {
  const el = parent.getElementsByTagName(tag).item(0);
  return el?.textContent?.trim() || null;
};

const parsePoint = (
  el: Element,
): { lat: number; lon: number; ele?: number; time?: string; name?: string } | null => {
  const lat = parseFloat(el.getAttribute("lat") ?? "");
  const lon = parseFloat(el.getAttribute("lon") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const eleRaw = text(el, "ele");
  const ele = eleRaw != null ? parseFloat(eleRaw) : Number.NaN;
  return {
    lat,
    lon,
    ele: Number.isFinite(ele) ? ele : undefined,
    time: text(el, "time") ?? undefined,
    name: text(el, "name") ?? undefined,
  };
};

/**
 * Map free-form GPX "type" or "sym" hints onto our WaypointKind vocabulary.
 * Most imports won't carry our taxonomy; default to "general" and let the
 * user re-tag in the editor.
 */
const inferKind = (sym?: string | null, type?: string | null): WaypointKind => {
  const hint = (sym ?? type ?? "").toLowerCase();
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

export const parseGpx = (xml: string): GpxImportResult => {
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
      `GPX is malformed: ${parserError.textContent?.slice(0, 200) ?? "unknown"}`,
    );
    return result;
  }

  const root = doc.documentElement;
  if (root.tagName !== "gpx") {
    result.warnings.push(`Expected <gpx>; found <${root.tagName}>.`);
    return result;
  }

  // Waypoints
  const wptList = Array.from(root.getElementsByTagName("wpt"));
  for (const el of wptList) {
    const pt = parsePoint(el);
    if (!pt) {
      result.warnings.push("Skipped a <wpt> with missing or invalid lat/lon.");
      continue;
    }
    if (!inMontana(pt.lat, pt.lon)) {
      result.warnings.push(
        `Waypoint "${pt.name ?? "(unnamed)"}" sits outside Montana — kept but flag for review.`,
      );
    }
    const sym = text(el, "sym");
    const type = text(el, "type");
    const notes = text(el, "desc") ?? text(el, "cmt") ?? undefined;
    result.waypoints.push({
      kind: inferKind(sym, type),
      name: pt.name ?? `Imported ${result.waypoints.length + 1}`,
      lat: pt.lat,
      lon: pt.lon,
      notes,
      photos: [],
      tags: ["imported"],
    });
  }

  // Tracks — one polyline per <trk>, keeping each <trkseg> as its own segment
  const trkList = Array.from(root.getElementsByTagName("trk"));
  for (const el of trkList) {
    const name = text(el, "name") ?? `Imported track ${result.routes.length + 1}`;
    const path: Array<[number, number]> = [];
    const elev: number[] = [];
    const segments: number[] = [];
    let earliest: string | null = null;
    let latest: string | null = null;
    const segs = Array.from(el.getElementsByTagName("trkseg"));
    for (const seg of segs) {
      const pts = Array.from(seg.getElementsByTagName("trkpt"));
      if (pts.length > 0) segments.push(path.length);
      for (const ptEl of pts) {
        const pt = parsePoint(ptEl);
        if (!pt) continue;
        path.push([pt.lon, pt.lat]);
        elev.push(pt.ele ?? Number.NaN);
        if (pt.time) {
          if (!earliest || pt.time < earliest) earliest = pt.time;
          if (!latest || pt.time > latest) latest = pt.time;
        }
      }
    }
    if (path.length < 2) {
      result.warnings.push(`Track "${name}" had fewer than 2 points; dropped.`);
      continue;
    }
    // Compute distance + elevation gain on import. Seed `lastAlt` from the
    // first point's elevation so the opening leg's climb is counted — the
    // loop starts at i=1, so leaving lastAlt null would silently drop the
    // first ascent (and zero out gain entirely on a 2-point track).
    let totalM = 0;
    let gainFt = 0;
    let lastAlt: number | null = Number.isFinite(elev[0]) ? elev[0] : null;
    for (let i = 1; i < path.length; i++) {
      // The link into a new segment is a gap, not distance walked.
      if (!segments.includes(i)) {
        totalM += haversineMeters(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
      }
      const alt = elev[i];
      if (Number.isFinite(alt)) {
        if (lastAlt != null && Number.isFinite(lastAlt) && alt > lastAlt) {
          gainFt += (alt - lastAlt) * 3.28084;
        }
        lastAlt = alt;
      }
    }
    result.routes.push({
      name,
      path,
      elevationFt: elev.some((e) => Number.isFinite(e)) ? elev : undefined,
      segments: segments.length > 1 ? segments : undefined,
      distanceMi: totalM * MILES_PER_METER,
      gainFt,
      startedAt: earliest ?? new Date().toISOString(),
      endedAt: latest ?? new Date().toISOString(),
      tags: ["imported"],
    });
  }

  // Routes — treat as tracks
  const rteList = Array.from(root.getElementsByTagName("rte"));
  for (const el of rteList) {
    const name = text(el, "name") ?? `Imported route ${result.routes.length + 1}`;
    const path: Array<[number, number]> = [];
    const pts = Array.from(el.getElementsByTagName("rtept"));
    for (const ptEl of pts) {
      const pt = parsePoint(ptEl);
      if (!pt) continue;
      path.push([pt.lon, pt.lat]);
    }
    if (path.length < 2) {
      result.warnings.push(`Route "${name}" had fewer than 2 points; dropped.`);
      continue;
    }
    let totalM = 0;
    for (let i = 1; i < path.length; i++) {
      totalM += haversineMeters(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
    }
    result.routes.push({
      name,
      path,
      distanceMi: totalM * MILES_PER_METER,
      gainFt: 0,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      tags: ["imported"],
    });
  }

  return result;
};

/**
 * Commit a parsed GPX result into the field-tools store. Returns the count
 * of items added (waypoints + routes).
 */
export const commitGpxImport = (
  parsed: GpxImportResult,
  opts?: { tripId?: string },
): { addedWaypoints: number; addedRoutes: number } => {
  // Lazy import to avoid a circular type dep at module-load time.
  // (gpxImport doesn't need the store directly for parsing.) Block-form
  // disable so the directive survives prettier line-wrapping of the require().
  /* eslint-disable @typescript-eslint/no-require-imports */
  const mod =
    require("@/store/field/fieldToolsStore") as typeof import("@/store/field/fieldToolsStore");
  /* eslint-enable @typescript-eslint/no-require-imports */
  const store = mod.useFieldToolsStore.getState();
  let addedWaypoints = 0;
  let addedRoutes = 0;
  for (const w of parsed.waypoints) {
    store.addWaypoint({ ...w, tripId: opts?.tripId ?? w.tripId });
    addedWaypoints++;
  }
  for (const r of parsed.routes) {
    store.addRoute({ ...r, tripId: opts?.tripId ?? r.tripId });
    addedRoutes++;
  }
  return { addedWaypoints, addedRoutes };
};
