/**
 * @file gpxImport.test.ts
 * @module engage-mt/services/field
 * @description Unit tests for the GPX 1.0/1.1 parser: waypoint / track / route
 *              extraction, Montana-bounds warnings, kind inference, distance +
 *              gain math, and malformed-input resilience. Runs against the
 *              happy-dom DOMParser the same way the import dialog does.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-10
 * @updated 2026-06-17
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { parseGpx } from "./gpxImport";

const gpx = (inner: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="test">${inner}</gpx>`;

describe("parseGpx — waypoints", () => {
  it("extracts a Montana waypoint with name, notes, and inferred kind", () => {
    const r = parseGpx(
      gpx(
        `<wpt lat="46.6" lon="-112.0"><name>Camp Spot</name><sym>Campground</sym><desc>nice flat</desc></wpt>`,
      ),
    );
    expect(r.waypoints).toHaveLength(1);
    expect(r.waypoints[0]).toMatchObject({
      name: "Camp Spot",
      kind: "camp",
      notes: "nice flat",
      lat: 46.6,
      lon: -112.0,
      tags: ["imported"],
    });
    expect(r.warnings).toHaveLength(0);
  });

  it("flags a waypoint outside Montana but keeps it", () => {
    const r = parseGpx(gpx(`<wpt lat="40.0" lon="-105.0"><name>Boulder CO</name></wpt>`));
    expect(r.waypoints).toHaveLength(1);
    expect(r.warnings.join(" ")).toMatch(/outside Montana/i);
  });

  it("skips a waypoint with missing/invalid lat-lon and warns", () => {
    const r = parseGpx(gpx(`<wpt lat="abc" lon="-112.0"><name>Bad</name></wpt>`));
    expect(r.waypoints).toHaveLength(0);
    expect(r.warnings.join(" ")).toMatch(/missing or invalid/i);
  });

  it("falls back to a generated name and general kind", () => {
    const r = parseGpx(gpx(`<wpt lat="46.6" lon="-112.0"></wpt>`));
    expect(r.waypoints[0].kind).toBe("general");
    expect(r.waypoints[0].name).toMatch(/Imported/);
  });
});

describe("parseGpx — tracks", () => {
  it("concatenates segments, computes distance, gain, and time bounds", () => {
    const r = parseGpx(
      gpx(`<trk><name>Ridge Run</name>
        <trkseg>
          <trkpt lat="46.0" lon="-112.0"><ele>1500</ele><time>2026-06-01T08:00:00Z</time></trkpt>
          <trkpt lat="46.01" lon="-112.0"><ele>1600</ele><time>2026-06-01T09:00:00Z</time></trkpt>
        </trkseg>
        <trkseg>
          <trkpt lat="46.02" lon="-112.0"><ele>1550</ele><time>2026-06-01T10:00:00Z</time></trkpt>
        </trkseg>
      </trk>`),
    );
    expect(r.routes).toHaveLength(1);
    const route = r.routes[0];
    expect(route.name).toBe("Ridge Run");
    expect(route.path).toHaveLength(3);
    expect(route.distanceMi).toBeGreaterThan(0);
    // Only the 1500→1600 leg is an ascent (100 m ≈ 328 ft); the 1600→1550 drop is ignored.
    expect(route.gainFt).toBeGreaterThan(300);
    expect(route.gainFt).toBeLessThan(360);
    expect(route.startedAt).toBe("2026-06-01T08:00:00Z");
    expect(route.endedAt).toBe("2026-06-01T10:00:00Z");
  });

  it("keeps each <trkseg> as a segment and does not count the gap as distance", () => {
    const gpx = `<?xml version="1.0"?><gpx version="1.1" creator="t"><trk><name>Gap</name>
      <trkseg><trkpt lat="46.0" lon="-111.0"/><trkpt lat="46.0009" lon="-111.0"/></trkseg>
      <trkseg><trkpt lat="46.5" lon="-111.5"/><trkpt lat="46.5009" lon="-111.5"/></trkseg>
    </trk></gpx>`;
    const result = parseGpx(gpx);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].segments).toEqual([0, 2]);
    // Two 100 m legs, not the 60 km jump between them.
    expect(result.routes[0].distanceMi).toBeLessThan(0.2);
  });

  it("drops a track with fewer than 2 points and warns", () => {
    const r = parseGpx(
      gpx(`<trk><name>Stub</name><trkseg><trkpt lat="46" lon="-112"/></trkseg></trk>`),
    );
    expect(r.routes).toHaveLength(0);
    expect(r.warnings.join(" ")).toMatch(/fewer than 2 points/i);
  });
});

describe("parseGpx — routes", () => {
  it("treats <rte> as a track with zero gain", () => {
    const r = parseGpx(
      gpx(`<rte><name>Paddle</name>
        <rtept lat="46.0" lon="-112.0"/>
        <rtept lat="46.05" lon="-112.0"/>
      </rte>`),
    );
    expect(r.routes).toHaveLength(1);
    expect(r.routes[0].name).toBe("Paddle");
    expect(r.routes[0].gainFt).toBe(0);
    expect(r.routes[0].distanceMi).toBeGreaterThan(0);
  });
});

describe("parseGpx — malformed input", () => {
  it("warns when the root element is not <gpx>", () => {
    const r = parseGpx(`<?xml version="1.0"?><kml><Placemark/></kml>`);
    expect(r.waypoints).toHaveLength(0);
    expect(r.routes).toHaveLength(0);
    expect(r.warnings.join(" ")).toMatch(/Expected <gpx>/i);
  });

  it("never throws and always returns a result shape", () => {
    const r = parseGpx("not xml at all <<<");
    expect(r).toHaveProperty("waypoints");
    expect(r).toHaveProperty("routes");
    expect(r).toHaveProperty("warnings");
    expect(Array.isArray(r.warnings)).toBe(true);
  });
});
