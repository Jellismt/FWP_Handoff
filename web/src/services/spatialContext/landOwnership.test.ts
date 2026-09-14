/**
 * @file landOwnership.test.ts
 * @module engage-mt/services/spatialContext
 * @description Characterization test for the bare-land ownership resolver.
 *              Asserts the cadastral fetch shape and the null fallback.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-10
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveLandOwnershipAtPoint } from "@/services/spatialContext/landOwnership";

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const LON = -109.5;
const LAT = 45.8;

describe("resolveLandOwnershipAtPoint", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns a cadastral result for a BLM parcel", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      ok({ features: [{ attributes: { OwnerName: "USA BLM", PropType: "FEDERAL" } }] }),
    );
    expect(await resolveLandOwnershipAtPoint(LON, LAT)).toEqual({
      kind: "cadastral",
      attrs: { OwnerName: "USA BLM", PropType: "FEDERAL" },
    });
  });

  it("returns a cadastral result for a state parcel", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      ok({ features: [{ attributes: { OwnerName: "STATE OF MONTANA" } }] }),
    );
    expect(await resolveLandOwnershipAtPoint(LON, LAT)).toEqual({
      kind: "cadastral",
      attrs: { OwnerName: "STATE OF MONTANA" },
    });
  });

  it("reports 'none' when the service answers with no parcel", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok({ features: [] }));
    expect(await resolveLandOwnershipAtPoint(LON, LAT)).toEqual({ kind: "none" });
  });

  it("reports 'unavailable' with a reason when the service cannot be reached", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));
    expect(await resolveLandOwnershipAtPoint(LON, LAT)).toEqual({
      kind: "unavailable",
      reason: "network",
    });
    vi.mocked(fetch).mockResolvedValueOnce(ok({ error: { code: 500, message: "down" } }));
    expect(await resolveLandOwnershipAtPoint(LON, LAT)).toEqual({
      kind: "unavailable",
      reason: "service",
    });
  });
});
