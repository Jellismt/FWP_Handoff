/**
 * @file geometry.test.ts
 * @module engage-mt/utils
 * @description Coverage push for `geometry.ts`.
 *              Validates the haversine + polyline + Shoelace area
 *              formulas against known-good ground truths at Montana
 *              latitudes.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-10
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import {
  haversineMeters,
  polylineLengthMeters,
  polygonAreaSqMeters,
  metersToMiles,
  sqMetersToAcres,
  MILES_PER_METER,
  ACRES_PER_SQ_METER,
} from "./geometry";

describe("geometry — haversineMeters", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMeters(-110, 46, -110, 46)).toBe(0);
  });

  it("matches the great-circle distance for a known Montana baseline", () => {
    // Helena (~46.5891°N, 112.0391°W) to Bozeman (~45.6770°N, 111.0429°W).
    // Truth ~125 km (NOAA distance calc).
    const m = haversineMeters(-112.0391, 46.5891, -111.0429, 45.677);
    expect(m).toBeGreaterThan(120_000);
    expect(m).toBeLessThan(135_000);
  });

  it("is symmetric — swapping endpoints returns the same distance", () => {
    const a = haversineMeters(-110, 46, -109, 45);
    const b = haversineMeters(-109, 45, -110, 46);
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
  });
});

describe("geometry — polylineLengthMeters", () => {
  it("returns 0 for an empty / single-vertex path", () => {
    expect(polylineLengthMeters([])).toBe(0);
    expect(polylineLengthMeters([[-110, 46]])).toBe(0);
  });

  it("sums haversine segments along a 3-point path", () => {
    const path: ReadonlyArray<readonly [number, number]> = [
      [-110, 46],
      [-110, 46.01],
      [-110, 46.02],
    ];
    const expectedSegment = haversineMeters(-110, 46, -110, 46.01);
    const total = polylineLengthMeters(path);
    expect(total).toBeCloseTo(2 * expectedSegment, 3);
  });
});

describe("geometry — polygonAreaSqMeters", () => {
  it("returns 0 when fewer than 3 vertices", () => {
    expect(polygonAreaSqMeters([])).toBe(0);
    expect(polygonAreaSqMeters([[-110, 46]])).toBe(0);
    expect(
      polygonAreaSqMeters([
        [-110, 46],
        [-110, 46.01],
      ]),
    ).toBe(0);
  });

  it("computes a ~1 sq km area for a 1 km x 1 km box at Montana latitudes", () => {
    // 1 km in latitude ≈ 0.00898°, 1 km in longitude at 46°N ≈ 0.01293°.
    const dLat = 1000 / 111_132;
    const dLon = 1000 / (111_132 * Math.cos((46 * Math.PI) / 180));
    const box: ReadonlyArray<readonly [number, number]> = [
      [-110, 46],
      [-110 + dLon, 46],
      [-110 + dLon, 46 + dLat],
      [-110, 46 + dLat],
    ];
    const area = polygonAreaSqMeters(box);
    // Within 1% of 1,000,000 sq m.
    expect(area).toBeGreaterThan(990_000);
    expect(area).toBeLessThan(1_010_000);
  });

  it("returns the same area regardless of vertex winding order (handles reversed lists)", () => {
    const dLat = 1000 / 111_132;
    const dLon = 1000 / (111_132 * Math.cos((46 * Math.PI) / 180));
    const cw: ReadonlyArray<readonly [number, number]> = [
      [-110, 46],
      [-110 + dLon, 46],
      [-110 + dLon, 46 + dLat],
      [-110, 46 + dLat],
    ];
    const ccw = [...cw].reverse() as ReadonlyArray<readonly [number, number]>;
    expect(polygonAreaSqMeters(cw)).toBeCloseTo(polygonAreaSqMeters(ccw), 3);
  });
});

describe("geometry — unit conversions", () => {
  it("metersToMiles uses the exported constant", () => {
    expect(metersToMiles(1609.344)).toBeCloseTo(1, 5);
    expect(metersToMiles(0)).toBe(0);
    expect(MILES_PER_METER).toBeGreaterThan(0);
  });

  it("sqMetersToAcres uses the exported constant", () => {
    expect(sqMetersToAcres(4046.86)).toBeCloseTo(1, 3);
    expect(sqMetersToAcres(0)).toBe(0);
    expect(ACRES_PER_SQ_METER).toBeGreaterThan(0);
  });
});
