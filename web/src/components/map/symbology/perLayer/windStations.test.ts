/**
 * @file windStations.test.ts
 * @module engage-mt/map/symbology/perLayer
 * @description Coverage for the wind-speed bucket
 *              table. The class-break renderer relies on each bucket's
 *              [min, max] being contiguous + the colors matching the
 *              Beaufort-derived palette used. A swap of colors or a bucket
 *              edge slip would silently send users to the wrong-colored
 *              arrow, which is a hard-to-spot data-integrity bug.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @version 1.0.0
 * @updated 2026-06-06
 */

import { describe, expect, it } from "vitest";
import { WIND_SPEED_BREAKS, windStationsRenderer } from "./windStations";

/** Tiny helper that returns the bucket index for a given mph reading. */
function bucketFor(mph: number): number {
  for (let i = 0; i < WIND_SPEED_BREAKS.length; i++) {
    if (mph <= WIND_SPEED_BREAKS[i].max) return i;
  }
  return WIND_SPEED_BREAKS.length - 1;
}

describe("WIND_SPEED_BREAKS", () => {
  it("has five buckets ordered by ascending max", () => {
    expect(WIND_SPEED_BREAKS).toHaveLength(5);
    for (let i = 1; i < WIND_SPEED_BREAKS.length; i++) {
      expect(WIND_SPEED_BREAKS[i].max).toBeGreaterThan(WIND_SPEED_BREAKS[i - 1].max);
    }
  });

  it("matches the Beaufort-derived palette", () => {
    expect(WIND_SPEED_BREAKS[0].color).toBe("#6B7280"); // calm grey
    expect(WIND_SPEED_BREAKS[1].color).toBe("#2D8A5F"); // light green
    expect(WIND_SPEED_BREAKS[2].color).toBe("#FFC72C"); // moderate yellow
    expect(WIND_SPEED_BREAKS[3].color).toBe("#E57200"); // strong orange
    expect(WIND_SPEED_BREAKS[4].color).toBe("#C5283D"); // severe red
  });

  it("buckets representative speeds correctly", () => {
    expect(bucketFor(0)).toBe(0); // calm
    expect(bucketFor(5)).toBe(0); // edge stays calm
    expect(bucketFor(5.1)).toBe(1); // light
    expect(bucketFor(12)).toBe(1); // mid-light
    expect(bucketFor(15)).toBe(1); // edge stays light
    expect(bucketFor(20)).toBe(2); // moderate
    expect(bucketFor(25)).toBe(2);
    expect(bucketFor(30)).toBe(3); // strong
    expect(bucketFor(50)).toBe(4); // severe
    expect(bucketFor(120)).toBe(4); // clamped to last bucket
  });
});

describe("windStationsRenderer", () => {
  it("emits a class-breaks renderer keyed on WIND_SPEED with rotation by WIND_DIRECT", () => {
    const r = windStationsRenderer() as unknown as {
      type: string;
      field: string;
      classBreakInfos: { minValue: number; maxValue: number }[];
      visualVariables: { type: string; field: string; rotationType: string }[];
    };
    expect(r.type).toBe("class-breaks");
    expect(r.field).toBe("WIND_SPEED");
    expect(r.classBreakInfos).toHaveLength(5);
    expect(r.visualVariables[0].field).toBe("WIND_DIRECT");
    expect(r.visualVariables[0].rotationType).toBe("geographic");
  });

  it("contiguous break ranges with no gaps + first break starts below zero", () => {
    const r = windStationsRenderer() as unknown as {
      classBreakInfos: { minValue: number; maxValue: number }[];
    };
    // First break must include 0 mph
    expect(r.classBreakInfos[0].minValue).toBeLessThan(0);
    // No gaps: each break's maxValue = next break's minValue
    for (let i = 1; i < r.classBreakInfos.length; i++) {
      expect(r.classBreakInfos[i].minValue).toBe(r.classBreakInfos[i - 1].maxValue);
    }
  });
});
