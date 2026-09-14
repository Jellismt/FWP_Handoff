/**
 * @file usgsWaterServices.latestCache.test.ts
 * @module engage-mt/services/public
 * @description Tests the last-good snapshot behavior of fetchLatestObservationsCached:
 *              persist on success, serve on failure, rethrow when neither the
 *              network nor a snapshot is available.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// In-memory Cache-Storage stub so the shared snapshot store persists across calls.
class FakeCache {
  private store = new Map<string, Response>();
  async match(key: string): Promise<Response | undefined> {
    return this.store.get(key);
  }
  async put(key: string, res: Response): Promise<void> {
    this.store.set(key, res);
  }
}
const buckets = new Map<string, FakeCache>();

const fetchJson = vi.fn();
vi.mock("@/utils/http", async () => {
  const actual = await vi.importActual<typeof import("@/utils/http")>("@/utils/http");
  return {
    ...actual,
    fetchJson: (url: string, opts?: unknown) => fetchJson(url, opts),
    // Pass-through backoff so the mocked fetchJson drives the outcome directly.
    withBackoff: (producer: () => unknown) => producer(),
  };
});

import { fetchLatestObservationsCached } from "./usgsWaterServices";

const nwisPayload = (cfs: number, when: string) => ({
  value: {
    timeSeries: [
      {
        sourceInfo: { siteName: "Test River", siteCode: [{ value: "06054500" }] },
        variable: {
          variableCode: [{ value: "00060" }],
          variableName: "Streamflow, ft³/s",
          unit: { unitCode: "ft3/s" },
        },
        values: [{ value: [{ value: String(cfs), dateTime: when }] }],
      },
    ],
  },
});

beforeEach(() => {
  buckets.clear();
  fetchJson.mockReset();
  vi.stubGlobal("caches", {
    open: async (name: string) => {
      if (!buckets.has(name)) buckets.set(name, new FakeCache());
      return buckets.get(name)!;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchLatestObservationsCached", () => {
  it("returns fresh readings and persists a snapshot on success", async () => {
    fetchJson.mockResolvedValueOnce(nwisPayload(120, "2026-07-14T10:00:00.000Z"));
    const result = await fetchLatestObservationsCached(["06054500"], ["discharge_cfs"]);
    expect(result.fromCache).toBe(false);
    expect(result.observations[0]?.value).toBe(120);
    expect(result.observedAt).toBe("2026-07-14T10:00:00.000Z");
  });

  it("serves the last-good snapshot when the network fails", async () => {
    fetchJson.mockResolvedValueOnce(nwisPayload(120, "2026-07-14T10:00:00.000Z"));
    await fetchLatestObservationsCached(["06054500"], ["discharge_cfs"]); // warms the snapshot

    fetchJson.mockRejectedValueOnce(new Error("offline"));
    const result = await fetchLatestObservationsCached(["06054500"], ["discharge_cfs"]);
    expect(result.fromCache).toBe(true);
    expect(result.observations[0]?.value).toBe(120);
  });

  it("rethrows when the network fails and there is no snapshot", async () => {
    fetchJson.mockRejectedValueOnce(new Error("offline"));
    await expect(fetchLatestObservationsCached(["06054500"], ["discharge_cfs"])).rejects.toThrow();
  });

  it("short-circuits empty inputs without a fetch", async () => {
    const result = await fetchLatestObservationsCached([], ["discharge_cfs"]);
    expect(result.observations).toEqual([]);
    expect(fetchJson).not.toHaveBeenCalled();
  });
});
