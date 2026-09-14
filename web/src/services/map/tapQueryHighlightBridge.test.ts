/**
 * @file tapQueryHighlightBridge.test.ts
 * @module engage-mt/services/map
 * @description Coverage for the geometry → halo-kind mapping
 *              in tapQueryHighlightBridge. The mapping drives whether a
 *              tapped feature gets the "waterbody" / "point" / "polygon"
 *              halo style; a mis-mapped LayerGeometry would silently
 *              show the wrong-shaped halo, hard to spot in QA.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @version 1.0.0
 * @updated 2026-07-07
 */

import { beforeEach, describe, expect, it } from "vitest";
import { highlightTapQueryHit } from "./tapQueryHighlightBridge";
import { useHighlightedFeatureStore } from "@/store/map/highlightedFeatureStore";

/** Minimal stand-in for an ArcGIS Point geometry. */
const pt = (lat: number, lon: number) =>
  ({ latitude: lat, longitude: lon }) as { latitude: number; longitude: number };

describe("highlightTapQueryHit", () => {
  beforeEach(() => {
    useHighlightedFeatureStore.setState({ selected: null });
  });

  it("dispatches a halo at the tap point with the label", () => {
    highlightTapQueryHit({
      mapPoint: pt(46.5, -111.5) as never,
      geometry: "point",
      label: "Test feature",
    });
    const s = useHighlightedFeatureStore.getState().selected;
    expect(s).not.toBeNull();
    expect(s?.lat).toBe(46.5);
    expect(s?.lon).toBe(-111.5);
    expect(s?.label).toBe("Test feature");
    expect(s?.kind).toBe("point");
  });

  it("forwards the outline geometry + Infinity fade to the store", () => {
    const outline = {
      kind: "polygon" as const,
      rings: [
        [
          [-111, 46],
          [-111, 47],
          [-112, 47],
          [-111, 46],
        ] as ReadonlyArray<readonly [number, number]>,
      ],
    };
    highlightTapQueryHit({
      mapPoint: pt(46.5, -111.5) as never,
      geometry: "polygon",
      outline,
      label: "Parcel",
      ttlMs: Number.POSITIVE_INFINITY,
      geometryFadeMs: Number.POSITIVE_INFINITY,
    });
    const s = useHighlightedFeatureStore.getState().selected;
    expect(s?.geometry).toEqual(outline);
    expect(s?.expiresAt).toBe(Number.POSITIVE_INFINITY);
    expect(s?.geometryFadesAt).toBe(Number.POSITIVE_INFINITY);
  });

  it("maps polygon geometry to polygon kind", () => {
    highlightTapQueryHit({
      mapPoint: pt(46, -111) as never,
      geometry: "polygon",
      label: "x",
    });
    expect(useHighlightedFeatureStore.getState().selected?.kind).toBe("polygon");
  });

  it("maps line geometry to polygon kind (longer arc halo)", () => {
    highlightTapQueryHit({
      mapPoint: pt(46, -111) as never,
      geometry: "line",
      label: "x",
    });
    expect(useHighlightedFeatureStore.getState().selected?.kind).toBe("polygon");
  });

  it("maps raster geometry to polygon kind", () => {
    highlightTapQueryHit({
      mapPoint: pt(46, -111) as never,
      geometry: "raster",
      label: "x",
    });
    expect(useHighlightedFeatureStore.getState().selected?.kind).toBe("polygon");
  });

  it("maps mixed + vector-tile to point kind", () => {
    highlightTapQueryHit({
      mapPoint: pt(46, -111) as never,
      geometry: "mixed",
      label: "x",
    });
    expect(useHighlightedFeatureStore.getState().selected?.kind).toBe("point");
    highlightTapQueryHit({
      mapPoint: pt(46, -111) as never,
      geometry: "vector-tile",
      label: "y",
    });
    expect(useHighlightedFeatureStore.getState().selected?.kind).toBe("point");
  });

  it("falls back to point when geometry is omitted", () => {
    highlightTapQueryHit({ mapPoint: pt(46, -111) as never, label: "x" });
    expect(useHighlightedFeatureStore.getState().selected?.kind).toBe("point");
  });

  it("default label when not provided", () => {
    highlightTapQueryHit({ mapPoint: pt(46, -111) as never });
    expect(useHighlightedFeatureStore.getState().selected?.label).toBe("Selected feature");
  });

  it("sets expiresAt 8s into the future (tap halos fade faster than search)", () => {
    const before = Date.now();
    highlightTapQueryHit({ mapPoint: pt(46, -111) as never });
    const s = useHighlightedFeatureStore.getState().selected!;
    expect(s.expiresAt).toBeGreaterThan(before + 7_000);
    expect(s.expiresAt).toBeLessThan(before + 9_000);
  });

  it("no-ops when the mapPoint carries non-numeric coords", () => {
    highlightTapQueryHit({
      mapPoint: {
        latitude: NaN as unknown as number,
        longitude: NaN as unknown as number,
      } as never,
      label: "bad coord",
    });
    expect(useHighlightedFeatureStore.getState().selected).toBeNull();
  });
});
