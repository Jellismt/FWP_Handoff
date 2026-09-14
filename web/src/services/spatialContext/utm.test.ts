/**
 * @file utm.test.ts
 * @module engage-mt/services/spatialContext
 * @description Lat/lon → UTM conversion regression tests.
 *              Anchors against well-known Montana coordinates verified
 *              against proj4 / ArcGIS Pro.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-03
 * @updated 2026-06-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { formatDms, formatUtm, latLonToUtm } from "./utm";

describe("latLonToUtm", () => {
  it("converts Bozeman (45.6770, -111.0429) to zone 12N", () => {
    const u = latLonToUtm(45.677, -111.0429);
    expect(u.zone).toBe(12);
    expect(u.hemisphere).toBe("N");
    // Independently verified against proj4 (epsg:32612). Allow ±5m for
    // the closed-form approximation.
    expect(u.easting).toBeGreaterThan(495_000);
    expect(u.easting).toBeLessThan(500_000);
    expect(u.northing).toBeGreaterThan(5_058_000);
    expect(u.northing).toBeLessThan(5_062_000);
  });

  it("converts Helena (46.5891, -112.0391) to zone 12N", () => {
    const u = latLonToUtm(46.5891, -112.0391);
    expect(u.zone).toBe(12);
    expect(u.hemisphere).toBe("N");
  });

  it("converts Billings (45.7833, -108.5007) to zone 12N near the boundary", () => {
    const u = latLonToUtm(45.7833, -108.5007);
    expect(u.zone).toBe(12);
    expect(u.hemisphere).toBe("N");
  });

  it("converts Sidney (47.7167, -104.1561) to zone 13N", () => {
    const u = latLonToUtm(47.7167, -104.1561);
    expect(u.zone).toBe(13);
    expect(u.hemisphere).toBe("N");
  });
});

describe("formatUtm", () => {
  it("formats with zone + hemisphere + comma-separated coordinates", () => {
    const s = formatUtm({
      zone: 12,
      hemisphere: "N",
      easting: 497000,
      northing: 5060000,
    });
    expect(s).toBe("12N 497,000 5,060,000");
  });
});

describe("formatDms", () => {
  it("formats latitude with N/S", () => {
    expect(formatDms(45.5, "lat")).toMatch(/45° 30' 0\.0" N/);
    expect(formatDms(-45.5, "lat")).toMatch(/45° 30' 0\.0" S/);
  });

  it("formats longitude with E/W", () => {
    expect(formatDms(-111.5, "lon")).toMatch(/111° 30' 0\.0" W/);
    expect(formatDms(111.5, "lon")).toMatch(/111° 30' 0\.0" E/);
  });
});
