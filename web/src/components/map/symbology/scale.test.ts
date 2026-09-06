/**
 * @file scale.test.ts
 * @module engage-mt/map/symbology
 * @description Coverage for `markerSizeAtScale` — the plain-JS mirror of the
 *              renderer's scale→size ramp used by the hover-halo overlay in
 *              `useMapHover`. The halo ring must track the on-screen marker
 *              size at every zoom; if this drifts from
 *              `sizeByScaleVisualVariable`, the ring stops surrounding the
 *              marker (the exact bug that made dense icons look halo-less).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-10
 * @updated 2026-06-10
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { markerSizeAtScale, sizeByScaleVisualVariable } from "./scale";

const BASE = 24;

describe("markerSizeAtScale", () => {
  it("clamps to the most-zoomed-in factor (1.3x) at or below the tightest stop", () => {
    expect(markerSizeAtScale(BASE, 250000)).toBeCloseTo(BASE * 1.3);
    expect(markerSizeAtScale(BASE, 50000)).toBeCloseTo(BASE * 1.3);
  });

  it("clamps to the most-zoomed-out factor (0.7x) at or above the widest stop", () => {
    expect(markerSizeAtScale(BASE, 9000000)).toBeCloseTo(BASE * 0.7);
    expect(markerSizeAtScale(BASE, 20000000)).toBeCloseTo(BASE * 0.7);
  });

  it("matches the renderer visual-variable size exactly at each defining stop", () => {
    // The pure helper must agree with the renderer's stops so the hover
    // ring and the marker are sized from the same source of truth.
    const stops = sizeByScaleVisualVariable(BASE).stops;
    for (const stop of stops) {
      expect(markerSizeAtScale(BASE, stop.value)).toBeCloseTo(stop.size);
    }
  });

  it("interpolates linearly between two adjacent stops", () => {
    // Midpoint (in scale) between 1.5M (1.0x) and 4M (0.85x) → 0.925x.
    const mid = (1500000 + 4000000) / 2;
    expect(markerSizeAtScale(BASE, mid)).toBeCloseTo(BASE * 0.925);
  });

  it("scales proportionally with the base size", () => {
    expect(markerSizeAtScale(8, 144448)).toBeCloseTo((8 / BASE) * markerSizeAtScale(BASE, 144448));
  });
});
