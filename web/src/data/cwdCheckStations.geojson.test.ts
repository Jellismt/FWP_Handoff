/**
 * @file cwdCheckStations.geojson.test.ts
 * @module engage-mt/data
 * @description Guard test — sanity-checks the bundled cwd-check-stations.geojson
 *              (the offline fallback for the cwd-check-stations layer, whose
 *              primary source is FWP's live hosted PublicView service). Asserts
 *              the FeatureCollection shape, coordinate validity within Montana,
 *              and the property contract the CwdCheckStationCard reads.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-15
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface CheckStationFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    name: string;
    season: string;
    zoneId: string;
    zoneName: string;
    status: string;
    districts: string;
    region: number;
    county: string;
    lat: number;
    lon: number;
  };
}

// Vitest runs with cwd = web/, so the bundled asset lives at public/data/.
const geojsonPath = resolve(process.cwd(), "public/data/cwd-check-stations.geojson");
const geojson = JSON.parse(readFileSync(geojsonPath, "utf-8")) as {
  type: "FeatureCollection";
  features: CheckStationFeature[];
};

// Montana bounding box (generous): lon -116.2..-103.9, lat 44.3..49.1.
const MT_LON = [-116.2, -103.9] as const;
const MT_LAT = [44.3, 49.1] as const;

describe("cwd-check-stations.geojson (offline fallback)", () => {
  it("is a non-empty FeatureCollection of Point features", () => {
    expect(geojson.type).toBe("FeatureCollection");
    expect(geojson.features.length).toBeGreaterThan(0);
    for (const f of geojson.features) {
      expect(f.type).toBe("Feature");
      expect(f.geometry.type).toBe("Point");
    }
  });

  it("every station has valid Montana coordinates matching its lat/lon properties", () => {
    for (const f of geojson.features) {
      const [lon, lat] = f.geometry.coordinates;
      expect(lon).toBeGreaterThanOrEqual(MT_LON[0]);
      expect(lon).toBeLessThanOrEqual(MT_LON[1]);
      expect(lat).toBeGreaterThanOrEqual(MT_LAT[0]);
      expect(lat).toBeLessThanOrEqual(MT_LAT[1]);
      // GeoJSON is [lon, lat]; the property mirror must agree.
      expect(f.properties.lon).toBeCloseTo(lon, 4);
      expect(f.properties.lat).toBeCloseTo(lat, 4);
    }
  });

  it("every station carries the property contract the feature card reads", () => {
    const names = new Set<string>();
    for (const f of geojson.features) {
      for (const key of ["name", "season", "zoneId", "zoneName", "status", "county"] as const) {
        expect(f.properties[key], `${key} on "${f.properties.name}"`).toBeTruthy();
      }
      expect(typeof f.properties.region).toBe("number");
      expect(names.has(f.properties.name), `duplicate station "${f.properties.name}"`).toBe(false);
      names.add(f.properties.name);
    }
  });
});
