/**
 * @file nearby.test.ts
 * @module engage-mt/services/spatialContext
 * @description R.2b — Characterization test for the nearby-features helper.
 *              Verifies sort-by-distance, the limit cap, the empty-on-error
 *              contract, and geometry-extraction fallbacks.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-17
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryNearbyFeatures } from "@/services/spatialContext/nearby";

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const ORIGIN = { url: "https://example.com/FeatureServer/0", longitude: -111, latitude: 46 };

describe("queryNearbyFeatures", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns sorted-by-distance hits with limit applied", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      ok({
        features: [
          { attributes: { id: "far" }, geometry: { x: -110, y: 46 } },
          { attributes: { id: "near" }, geometry: { x: -111.01, y: 46 } },
          { attributes: { id: "mid" }, geometry: { x: -111.2, y: 46 } },
        ],
      }),
    );
    const hits = await queryNearbyFeatures({
      ...ORIGIN,
      distanceMiles: 100,
      outFields: ["id"],
      limit: 2,
    });
    expect(hits.map((h) => h.attributes.id)).toEqual(["near", "mid"]);
  });

  it("uses centroid when point geometry absent", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      ok({
        features: [{ attributes: { id: "x" }, geometry: { centroid: { x: -111.05, y: 46.05 } } }],
      }),
    );
    const hits = await queryNearbyFeatures({
      ...ORIGIN,
      distanceMiles: 100,
      outFields: ["id"],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].distanceMiles).toBeGreaterThan(0);
  });

  it("returns [] on service error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok({ error: { code: 400 } }));
    expect(
      await queryNearbyFeatures({
        ...ORIGIN,
        distanceMiles: 10,
        outFields: ["id"],
      }),
    ).toEqual([]);
  });

  it("returns [] on fetch throwing", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("nope"));
    expect(
      await queryNearbyFeatures({
        ...ORIGIN,
        distanceMiles: 10,
        outFields: ["id"],
      }),
    ).toEqual([]);
  });
});
