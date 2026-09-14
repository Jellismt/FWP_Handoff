/**
 * @file kmlImport.test.ts
 * @module engage-mt/services/field
 * @description KML parser coverage: Point → waypoint, LineString →
 *              track, lon-first coordinate ordering, Montana-bounds warnings,
 *              and malformed / non-KML rejection.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-06-30
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { parseKml } from "./kmlImport";

const kml = (body: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${body}</Document></kml>`;

describe("parseKml", () => {
  it("parses a Point placemark into a waypoint (lon,lat ordering)", () => {
    const xml = kml(
      `<Placemark><name>Camp spot</name><description>north bench</description><Point><coordinates>-111.54321,46.12345,0</coordinates></Point></Placemark>`,
    );
    const r = parseKml(xml);
    expect(r.waypoints).toHaveLength(1);
    expect(r.waypoints[0].name).toBe("Camp spot");
    expect(r.waypoints[0].lat).toBeCloseTo(46.12345);
    expect(r.waypoints[0].lon).toBeCloseTo(-111.54321);
    expect(r.waypoints[0].kind).toBe("camp"); // inferred from "Camp spot"
    expect(r.waypoints[0].notes).toBe("north bench");
    expect(r.waypoints[0].tags).toEqual(["imported"]);
  });

  it("parses a LineString placemark into a track with computed distance", () => {
    const xml = kml(
      `<Placemark><name>Ridge walk</name><LineString><coordinates>-111.5,46.1,0 -111.51,46.11,0 -111.52,46.12,0</coordinates></LineString></Placemark>`,
    );
    const r = parseKml(xml);
    expect(r.routes).toHaveLength(1);
    expect(r.routes[0].path).toHaveLength(3);
    expect(r.routes[0].distanceMi).toBeGreaterThan(0);
  });

  it("flags an out-of-Montana waypoint but keeps it", () => {
    const xml = kml(
      `<Placemark><name>Seattle</name><Point><coordinates>-122.33,47.6,0</coordinates></Point></Placemark>`,
    );
    const r = parseKml(xml);
    expect(r.waypoints).toHaveLength(1);
    expect(r.warnings.some((w) => /outside Montana/i.test(w))).toBe(true);
  });

  it("warns on a non-KML root", () => {
    const r = parseKml(`<?xml version="1.0"?><gpx></gpx>`);
    expect(r.warnings.some((w) => /expected <kml>/i.test(w))).toBe(true);
  });

  it("drops a LineString with fewer than 2 points", () => {
    const xml = kml(
      `<Placemark><name>Stub</name><LineString><coordinates>-111.5,46.1,0</coordinates></LineString></Placemark>`,
    );
    const r = parseKml(xml);
    expect(r.routes).toHaveLength(0);
    expect(r.warnings.some((w) => /fewer than 2 points/i.test(w))).toBe(true);
  });
});
