/**
 * @file huntingDistrictsLive.test.ts
 * @module engage-mt/services/hunt
 * @description Characterization test for the live hunting-district facts
 *              lookup. Asserts the parallel per-species-layer fetch, the
 *              single-species synthesis, the no-hit null, and per-layer
 *              failure isolation.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-06-29
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDistrictFactsLive } from "@/services/hunt/huntingDistrictsLive";

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const empty = (): Response => ok({ features: [] });

// SPECIES_LAYERS order: deer/elk(0), antelope(1), sheep(2), moose(3),
// goat(4), upland(5). Promise.all preserves this index order regardless of
// resolution timing.
const moose = (): Response =>
  ok({
    features: [
      {
        attributes: {
          DISTRICT: "106",
          REG: "1",
          AREA_AC: 546474,
          WEBPAGE: "https://myfwp.mt.gov/guide?MO=106",
          MAPLINK: "https://fwp.mt.gov/moosehd106.pdf",
        },
      },
    ],
  });

describe("fetchDistrictFactsLive", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("synthesizes facts from the single species layer that holds the district", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(empty()) // deer/elk
      .mockResolvedValueOnce(empty()) // antelope
      .mockResolvedValueOnce(empty()) // sheep
      .mockResolvedValueOnce(moose()) // moose
      .mockResolvedValueOnce(empty()) // goat
      .mockResolvedValueOnce(empty()); // upland

    const out = await fetchDistrictFactsLive("106");
    expect(out).not.toBeNull();
    expect(out?.district).toBe("106");
    expect(out?.region).toBe(1);
    expect(out?.acres).toBe(546474);
    expect(out?.species).toHaveLength(1);
    expect(out?.species[0]?.species).toBe("Moose");
    expect(out?.species[0]?.guideUrl).toContain("myfwp.mt.gov");
    expect(out?.species[0]?.mapUrl).toContain(".pdf");
  });

  it("returns null when no species layer carries the district", async () => {
    vi.mocked(fetch).mockResolvedValue(empty());
    expect(await fetchDistrictFactsLive("999")).toBeNull();
  });

  it("returns null for a blank district without hitting the network", async () => {
    expect(await fetchDistrictFactsLive("   ")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("isolates a single failing layer — other hits still resolve", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(empty()) // deer/elk
      .mockRejectedValueOnce(new Error("service down")) // antelope errors
      .mockResolvedValueOnce(empty()) // sheep
      .mockResolvedValueOnce(moose()) // moose still hits
      .mockResolvedValueOnce(empty()) // goat
      .mockResolvedValueOnce(empty()); // upland

    const out = await fetchDistrictFactsLive("106");
    expect(out?.species).toHaveLength(1);
    expect(out?.species[0]?.species).toBe("Moose");
  });
});
