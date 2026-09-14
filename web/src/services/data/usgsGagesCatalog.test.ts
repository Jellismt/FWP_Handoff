/**
 * @file usgsGagesCatalog.test.ts
 * @module engage-mt/services/data
 * @description Coverage for the bundled USGS gage catalog loader.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-03
 * @updated 2026-09-05
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchUsgsGagesCatalog } from "@/services/data/usgsGagesCatalog";
import { __resetAllCaches } from "@/services/cache/ttlCache";

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("fetchUsgsGagesCatalog", () => {
  beforeEach(() => {
    __resetAllCaches();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns the parsed catalog", async () => {
    const sample = [
      { site_no: "06054500", name: "Madison River near West Yellowstone", lat: 44.7, lon: -111.2 },
    ];
    vi.mocked(fetch).mockResolvedValueOnce(ok(sample));
    const rows = await fetchUsgsGagesCatalog();
    expect(rows[0]?.site_no).toBe("06054500");
  });

  it("surfaces an HTTP error as a typed NetworkError", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("nope", { status: 500 }));
    await expect(fetchUsgsGagesCatalog()).rejects.toThrow(/returned 500/);
  });
});
