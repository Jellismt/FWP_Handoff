/**
 * @file aoiGeometry.test.ts
 * @module engage-mt/services/map
 * @description Unit tests for the AOI bbox helpers — corner-order independence
 *              and degenerate-selection detection.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-06-30
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { bboxFromCorners, isDegenerateBbox, type LonLat } from "./aoiGeometry";

describe("bboxFromCorners", () => {
  // Two diagonal corners of a Montana-ish box.
  const sw: LonLat = [-111.5, 45.5];
  const ne: LonLat = [-110.5, 46.0];
  const expected = { north: 46.0, south: 45.5, east: -110.5, west: -111.5 };

  it("normalizes regardless of which corner is given first", () => {
    expect(bboxFromCorners(sw, ne)).toEqual(expected);
    expect(bboxFromCorners(ne, sw)).toEqual(expected);
  });

  it("handles the other diagonal (NW + SE) identically", () => {
    const nw: LonLat = [-111.5, 46.0];
    const se: LonLat = [-110.5, 45.5];
    expect(bboxFromCorners(nw, se)).toEqual(expected);
    expect(bboxFromCorners(se, nw)).toEqual(expected);
  });

  it("always yields north >= south and east >= west", () => {
    const box = bboxFromCorners([-110.5, 45.5], [-111.5, 46.0]);
    expect(box.north).toBeGreaterThanOrEqual(box.south);
    expect(box.east).toBeGreaterThanOrEqual(box.west);
  });
});

describe("isDegenerateBbox", () => {
  it("flags a same-point selection (zero area)", () => {
    const point: LonLat = [-111.0, 45.7];
    expect(isDegenerateBbox(bboxFromCorners(point, point))).toBe(true);
  });

  it("flags a zero-width or zero-height sliver", () => {
    expect(isDegenerateBbox({ north: 46, south: 45, east: -111, west: -111 })).toBe(true);
    expect(isDegenerateBbox({ north: 45, south: 45, east: -110, west: -111 })).toBe(true);
  });

  it("accepts a real box", () => {
    expect(isDegenerateBbox({ north: 46, south: 45.5, east: -110.5, west: -111.5 })).toBe(false);
  });
});
