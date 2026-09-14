/**
 * @file bundledRegsSnapshot.test.ts
 * @module engage-mt/services/regs
 * @description Unit tests for the build-time regs snapshot loader.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchJson = vi.fn();
vi.mock("@/utils/http", () => ({ fetchJson: (url: string) => fetchJson(url) }));

import {
  getBundledRegsEntry,
  loadBundledRegsSnapshot,
  resetBundledRegsSnapshot,
} from "./bundledRegsSnapshot";

const SNAP = {
  "hunting-regulations-unified": {
    data: [{ rule_id: "r1" }],
    meta: {
      generatedAt: "2026-07-14T00:00:00.000Z",
      effectiveDate: "2026-03-01",
      validUntil: "2027-02-28",
      sourceLabel: "FWP 2026 hunting regulations (published v7)",
      version: 7,
    },
  },
};

beforeEach(() => {
  fetchJson.mockReset();
  resetBundledRegsSnapshot();
});

describe("bundledRegsSnapshot loader", () => {
  it("loads and caches the snapshot (one fetch per session)", async () => {
    fetchJson.mockResolvedValue(SNAP);
    await loadBundledRegsSnapshot();
    await loadBundledRegsSnapshot();
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson).toHaveBeenCalledWith("/data/regs-snapshot.json");
  });

  it("degrades to empty when the file is missing (never rejects)", async () => {
    fetchJson.mockRejectedValue(new Error("404"));
    const snap = await loadBundledRegsSnapshot();
    expect(snap).toEqual({});
  });

  it("getBundledRegsEntry returns a hit by cacheKey", async () => {
    fetchJson.mockResolvedValue(SNAP);
    const entry = await getBundledRegsEntry<Array<{ rule_id: string }>>(
      "hunting-regulations-unified",
    );
    expect(entry?.data[0].rule_id).toBe("r1");
    expect(entry?.meta.effectiveDate).toBe("2026-03-01");
  });

  it("getBundledRegsEntry returns null on a miss", async () => {
    fetchJson.mockResolvedValue(SNAP);
    expect(await getBundledRegsEntry("no-such-key-2026")).toBeNull();
  });
});
