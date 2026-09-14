/**
 * @file gpxExport.test.ts
 * @module engage-mt/services/field
 * @description GPX serializer round-trip + escape tests.
 *              Verifies the output parses as valid XML, lat/lon land
 *              at 7-decimal precision, XML special chars in name +
 *              notes don't escape the tag boundaries, and the bundle
 *              form merges waypoints + routes into one document.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import type { CapturedRoute, Waypoint } from "@/store/field/fieldToolsStore";
import { waypointToGpx, routeToGpx, buildGpxBundle } from "@/services/field/gpxExport";

const SAMPLE_WAYPOINT: Waypoint = {
  id: "wp-1",
  kind: "glassing-point",
  name: "South ridge",
  notes: "Best at dawn; <wind from W>",
  lat: 46.123456789,
  lon: -111.987654321,
  createdAt: "2026-06-02T12:00:00.000Z",
  updatedAt: "2026-06-02T12:00:00.000Z",
  // Waypoint type added `photos` + `tags` as required.
  photos: [],
  tags: [],
};

const SAMPLE_ROUTE: CapturedRoute = {
  id: "rt-1",
  name: "Roundtop loop & ridge",
  notes: 'AM walk — "easy"',
  path: [
    [-111.0, 46.0],
    [-111.0005, 46.0003],
    [-111.001, 46.0006],
  ],
  elevationFt: [4500, 4505, 4510],
  distanceMi: 0.42,
  gainFt: 10,
  startedAt: "2026-06-02T08:00:00.000Z",
  endedAt: "2026-06-02T08:15:00.000Z",
};

const parseXml = (xml: string): Document => {
  const parser = new DOMParser();
  return parser.parseFromString(xml, "application/xml");
};

describe("waypointToGpx", () => {
  it("emits a well-formed GPX document", () => {
    const xml = waypointToGpx(SAMPLE_WAYPOINT);
    const doc = parseXml(xml);
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  });

  it("clamps lat/lon to 7-decimal precision", () => {
    const xml = waypointToGpx(SAMPLE_WAYPOINT);
    expect(xml).toContain('lat="46.1234568"');
    expect(xml).toContain('lon="-111.9876543"');
  });

  it("preserves name + kind", () => {
    const xml = waypointToGpx(SAMPLE_WAYPOINT);
    expect(xml).toContain("<name>South ridge</name>");
    expect(xml).toContain("<type>glassing-point</type>");
  });

  it("escapes XML special chars in notes so the doc still parses", () => {
    const xml = waypointToGpx(SAMPLE_WAYPOINT);
    expect(xml).not.toContain("<wind from W>");
    expect(xml).toContain("&lt;wind from W&gt;");
    const doc = parseXml(xml);
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  });

  it("includes the created timestamp", () => {
    const xml = waypointToGpx(SAMPLE_WAYPOINT);
    expect(xml).toContain("<time>2026-06-02T12:00:00.000Z</time>");
  });
});

describe("routeToGpx", () => {
  it("emits a well-formed GPX document", () => {
    const xml = routeToGpx(SAMPLE_ROUTE);
    const doc = parseXml(xml);
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  });

  it("emits one <trkpt> per path entry", () => {
    const xml = routeToGpx(SAMPLE_ROUTE);
    const doc = parseXml(xml);
    expect(doc.getElementsByTagName("trkpt")).toHaveLength(3);
  });

  it("converts elevation feet → meters with 2-decimal precision", () => {
    const xml = routeToGpx(SAMPLE_ROUTE);
    // 4500 ft = ~1371.6 m
    expect(xml).toContain("<ele>1371.60</ele>");
  });

  it("escapes XML special chars in name", () => {
    const xml = routeToGpx(SAMPLE_ROUTE);
    expect(xml).toContain("Roundtop loop &amp; ridge");
    const doc = parseXml(xml);
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  });

  it("escapes XML special chars in notes (quotes)", () => {
    const xml = routeToGpx(SAMPLE_ROUTE);
    expect(xml).toContain("AM walk — &quot;easy&quot;");
  });

  it("omits <ele> when elevation is missing", () => {
    const noEle: CapturedRoute = { ...SAMPLE_ROUTE, elevationFt: undefined };
    const xml = routeToGpx(noEle);
    expect(xml).not.toContain("<ele>");
  });
});

describe("routeToGpx — segments", () => {
  it("writes one <trkseg> per recorded segment", () => {
    const xml = routeToGpx({ ...SAMPLE_ROUTE, segments: [0, 1] });
    const doc = parseXml(xml);
    expect(doc.getElementsByTagName("trkseg")).toHaveLength(2);
    expect(doc.getElementsByTagName("trkpt")).toHaveLength(SAMPLE_ROUTE.path.length);
  });
});

describe("buildGpxBundle", () => {
  it("merges waypoints + routes into one document", () => {
    const xml = buildGpxBundle([SAMPLE_WAYPOINT], [SAMPLE_ROUTE]);
    const doc = parseXml(xml);
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(doc.getElementsByTagName("wpt")).toHaveLength(1);
    expect(doc.getElementsByTagName("trk")).toHaveLength(1);
  });

  it("handles empty waypoints + routes", () => {
    const xml = buildGpxBundle([], []);
    const doc = parseXml(xml);
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(doc.getElementsByTagName("wpt")).toHaveLength(0);
    expect(doc.getElementsByTagName("trk")).toHaveLength(0);
  });
});
