/**
 * @file montanaClip.test.ts
 * @module engage-mt/services/map
 * @description Unit tests for the Montana feature-clip geometry helper. The
 *              @arcgis/core Polygon / FeatureEffect / FeatureFilter classes and
 *              the boundary fetch are mocked as recording shells. Covers: the
 *              real-boundary-preferred vs bundled-fallback selection, the
 *              once-per-session memoization, ring closing, and the clockwise
 *              outer-ring winding normalization (a CCW source must be reversed
 *              or Esri reads it as an empty hole).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface PolygonProps {
  rings: number[][][];
  spatialReference: { wkid: number };
}

vi.mock("@arcgis/core/geometry/Polygon", () => ({
  default: class {
    rings: number[][][];
    spatialReference: { wkid: number };
    constructor(props: PolygonProps) {
      this.rings = props.rings;
      this.spatialReference = props.spatialReference;
    }
  },
}));

vi.mock("@arcgis/core/layers/support/FeatureEffect", () => ({
  default: class {
    constructor(public props: unknown) {}
  },
}));
vi.mock("@arcgis/core/layers/support/FeatureFilter", () => ({
  default: class {
    constructor(public props: unknown) {}
  },
}));
vi.mock("@arcgis/core/geometry/support/webMercatorUtils", () => ({
  geographicToWebMercator: (g: unknown) => g,
}));

const boundary = vi.hoisted(() => ({
  fetch: vi.fn(),
  // A tiny CCW square in screen space (lon=X, lat=Y) — positive signed area.
  fallbackRing: [
    [-112, 45],
    [-111, 45],
    [-111, 46],
    [-112, 46],
    [-112, 45],
  ] as Array<[number, number]>,
}));

vi.mock("@/data/montanaBoundary", () => ({
  MONTANA_BOUNDARY_RING: boundary.fallbackRing,
  fetchRealMontanaBoundary: (...args: unknown[]) => boundary.fetch(...args),
}));

vi.mock("@/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { getMontanaClipGeometry, __resetMontanaClipGeometryForTest } from "./montanaClip";

/** Shoelace signed area; negative = clockwise in screen space. */
const signedArea = (ring: number[][]): number => {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a / 2;
};

describe("getMontanaClipGeometry", () => {
  beforeEach(() => {
    __resetMontanaClipGeometryForTest();
    boundary.fetch.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("builds the clip polygon from the authoritative 297-vertex boundary when available", async () => {
    // A ≥50-vertex CCW ring stands in for the real Census boundary.
    const realRing: Array<[number, number]> = Array.from({ length: 60 }, (_, i) => [
      -112 + i * 0.01,
      45,
    ]);
    realRing.push([-112, 46], [-112, 45]);
    boundary.fetch.mockResolvedValue(realRing);

    const poly = (await getMontanaClipGeometry()) as unknown as PolygonProps;
    expect(poly.spatialReference.wkid).toBe(4326);
    // Used the real ring (its length), not the 5-vertex fallback.
    expect(poly.rings[0].length).toBeGreaterThan(50);
  });

  it("falls back to the bundled ring when the real boundary fetch returns null", async () => {
    boundary.fetch.mockResolvedValue(null);
    const poly = (await getMontanaClipGeometry()) as unknown as PolygonProps;
    // Fallback ring has 5 points and is already closed.
    expect(poly.rings[0].length).toBe(5);
  });

  it("falls back to the bundled ring when the real boundary is too short (<50)", async () => {
    boundary.fetch.mockResolvedValue([
      [-112, 45],
      [-111, 45],
    ]);
    const poly = (await getMontanaClipGeometry()) as unknown as PolygonProps;
    expect(poly.rings[0].length).toBe(5);
  });

  it("normalizes the outer ring to clockwise (negative signed area)", async () => {
    // The fallback ring is CCW (positive area); the helper must reverse it.
    boundary.fetch.mockResolvedValue(null);
    const poly = (await getMontanaClipGeometry()) as unknown as PolygonProps;
    expect(signedArea(poly.rings[0])).toBeLessThan(0);
  });

  it("memoizes: the boundary is fetched once across repeated calls", async () => {
    boundary.fetch.mockResolvedValue(null);
    await getMontanaClipGeometry();
    await getMontanaClipGeometry();
    await getMontanaClipGeometry();
    expect(boundary.fetch).toHaveBeenCalledTimes(1);
  });

  it("closes the ring when the source is not closed", async () => {
    // A ≥50-vertex OPEN ring (first !== last) so it isn't swapped for the
    // bundled fallback; the helper must append the first point to close it.
    const openRing: Array<[number, number]> = Array.from({ length: 55 }, (_, i) => [
      -112 + i * 0.01,
      45,
    ]);
    openRing.push([-112, 46]); // still open — first (−112,45) !== last (−112,46)
    boundary.fetch.mockResolvedValue(openRing);
    const poly = (await getMontanaClipGeometry()) as unknown as PolygonProps;
    const ring = poly.rings[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});
