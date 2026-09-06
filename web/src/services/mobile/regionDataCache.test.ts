/**
 * @file regionDataCache.test.ts
 * @module engage-mt/services/mobile
 * @description Unit tests for the bbox-scoped region layer fetch + pagination.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const findLayerById = vi.fn();
const fetchJson = vi.fn();

vi.mock("@/config/layers", () => ({ findLayerById: (id: string) => findLayerById(id) }));
vi.mock("@/utils/http", () => ({
  fetchJson: (url: string, opts?: unknown) => fetchJson(url, opts),
}));

import { fetchLayerFeaturesInBbox } from "./regionDataCache";

const BBOX = { north: 46, south: 45, east: -110, west: -111 };

const polygonDef = {
  id: "hunting-districts",
  url: "https://example.test/MapServer/1",
  geometry: "polygon",
  outFieldsHint: ["DISTRICT", "REG"],
};

const ringFeature = (n: number) => ({
  attributes: { DISTRICT: String(n) },
  geometry: {
    rings: [
      [
        [-111, 45],
        [-110, 45],
        [-110, 46],
        [-111, 46],
        [-111, 45],
      ],
    ],
  },
});

beforeEach(() => {
  findLayerById.mockReset();
  fetchJson.mockReset();
});

describe("fetchLayerFeaturesInBbox", () => {
  it("returns null for a non-polygon / unregistered layer", async () => {
    findLayerById.mockReturnValue(undefined);
    expect(await fetchLayerFeaturesInBbox("nope", BBOX)).toBeNull();

    findLayerById.mockReturnValue({ ...polygonDef, geometry: "point" });
    expect(await fetchLayerFeaturesInBbox("hunting-districts", BBOX)).toBeNull();
  });

  it("sends an envelope-intersect query and maps rings", async () => {
    findLayerById.mockReturnValue(polygonDef);
    fetchJson.mockResolvedValueOnce({ features: [ringFeature(1), ringFeature(2)] });

    const result = await fetchLayerFeaturesInBbox("hunting-districts", BBOX);
    expect(result?.features).toHaveLength(2);
    expect(result?.truncated).toBe(false);

    const calledUrl = fetchJson.mock.calls[0][0] as string;
    expect(calledUrl).toContain("geometryType=esriGeometryEnvelope");
    expect(calledUrl).toContain("spatialRel=esriSpatialRelIntersects");
    expect(calledUrl).toContain("outFields=DISTRICT%2CREG");
  });

  it("paginates while the service reports more records", async () => {
    findLayerById.mockReturnValue(polygonDef);
    const fullPage = Array.from({ length: 1000 }, (_, i) => ringFeature(i));
    fetchJson
      .mockResolvedValueOnce({ features: fullPage, exceededTransferLimit: true })
      .mockResolvedValueOnce({ features: [ringFeature(9999)], exceededTransferLimit: false });

    const result = await fetchLayerFeaturesInBbox("hunting-districts", BBOX);
    expect(fetchJson).toHaveBeenCalledTimes(2);
    expect(result?.features).toHaveLength(1001);
    // Second page requested with a non-zero offset.
    expect(fetchJson.mock.calls[1][0] as string).toContain("resultOffset=1000");
  });

  it("returns null when the first page fails", async () => {
    findLayerById.mockReturnValue(polygonDef);
    fetchJson.mockRejectedValueOnce(new Error("network"));
    expect(await fetchLayerFeaturesInBbox("hunting-districts", BBOX)).toBeNull();
  });

  it("drops features that carry no rings", async () => {
    findLayerById.mockReturnValue(polygonDef);
    fetchJson.mockResolvedValueOnce({
      features: [ringFeature(1), { attributes: { DISTRICT: "x" }, geometry: {} }],
    });
    const result = await fetchLayerFeaturesInBbox("hunting-districts", BBOX);
    expect(result?.features).toHaveLength(1);
  });
});
