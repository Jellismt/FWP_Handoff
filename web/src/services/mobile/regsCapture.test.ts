/**
 * @file regsCapture.test.ts
 * @module engage-mt/services/mobile
 * @description District extraction from the cached layer, the forced dataset
 *              refresh with fail-soft facts, the per-area file, and the
 *              captured-facts lookup.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isCapacitor: vi.fn(() => true),
  files: new Map<string, string>(),
  regs: vi.fn(async () => ({ rows: [], freshness: { version: 9 } })),
  notes: vi.fn(async () => ({ data: [], freshness: { version: 9 } })),
  restricted: vi.fn(async () => ({ data: [], freshness: { version: 9 } })),
  youth: vi.fn(async () => ({ data: [], freshness: { version: 9 } })),
  corrections: vi.fn(async () => ({ data: [], freshness: { version: 9 } })),
  facts: vi.fn(async (hd: string) =>
    hd === "380" ? { district: "380", region: 3, acres: 1, species: [], source: "FWP" } : null,
  ),
}));
vi.mock("@/utils/capacitor", () => ({ isCapacitor: h.isCapacitor }));
vi.mock("@/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@/services/hunt/fetchHuntingRegs", () => ({ fetchHuntingRegs: h.regs }));
vi.mock("@/services/regsApi/districtNotes", () => ({ fetchDistrictNotes: h.notes }));
vi.mock("@/services/regsApi/restrictedAreas", () => ({ fetchRestrictedAreas: h.restricted }));
vi.mock("@/services/regsApi/youthOpportunities", () => ({ fetchYouthOpportunities: h.youth }));
vi.mock("@/services/regsApi/corrections", () => ({ fetchCorrections: h.corrections }));
vi.mock("@/services/hunt/huntingDistrictsLive", () => ({ fetchDistrictFactsLive: h.facts }));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: {
    readFile: async ({ path }: { path: string }) => {
      const data = h.files.get(path);
      if (data === undefined) throw new Error("ENOENT");
      return { data };
    },
    writeFile: async ({ path, data }: { path: string; data: string }) => {
      h.files.set(path, data);
    },
  },
  Directory: { Data: "DATA" },
}));

import { capturedDistrictFacts, captureAreaRegs, districtsInArea } from "./regsCapture";

const seedDistricts = (areaId: string, codes: Array<string | number>): void => {
  h.files.set(
    `data/${areaId}/hunting-districts.json`,
    JSON.stringify({ features: codes.map((c) => ({ attributes: { DISTRICT: c }, rings: [] })) }),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  h.files.clear();
  h.isCapacitor.mockReturnValue(true);
  window.localStorage.clear();
});

describe("districtsInArea", () => {
  it("returns unique three-digit codes, sorted, from the cached layer", async () => {
    seedDistricts("a1", ["410", 380, "380", "bad", 12]);
    await expect(districtsInArea("a1")).resolves.toEqual(["380", "410"]);
    await expect(districtsInArea("missing")).resolves.toEqual([]);
  });
});

describe("captureAreaRegs", () => {
  it("forces every dataset, records facts for the area's districts, and writes the area file", async () => {
    seedDistricts("a1", ["380", "410"]);
    const onProgress = vi.fn();
    const result = await captureAreaRegs({ areaId: "a1", onProgress });
    expect(result.ok).toBe(true);
    expect(result.version).toBe(9);
    expect(result.districts).toEqual(["380", "410"]);
    expect(result.bytes).toBeGreaterThan(0);
    expect(h.regs).toHaveBeenCalledWith(true);
    expect(h.notes).toHaveBeenCalledWith(expect.any(Number), true);
    const file = JSON.parse(h.files.get("regs/areas/a1.json") ?? "{}");
    expect(Object.keys(file.facts)).toEqual(["380"]);
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ percent: 100 }));
  });

  it("reports failure when a dataset cannot be refreshed but still writes what it has", async () => {
    seedDistricts("a1", []);
    h.notes.mockRejectedValueOnce(new Error("offline"));
    const result = await captureAreaRegs({ areaId: "a1" });
    expect(result.ok).toBe(false);
    expect(h.files.has("regs/areas/a1.json")).toBe(true);
  });

  it("is a no-op on the web", async () => {
    h.isCapacitor.mockReturnValue(false);
    const result = await captureAreaRegs({ areaId: "a1" });
    expect(result).toEqual({ ok: true, version: null, districts: [], bytes: 0 });
    expect(h.regs).not.toHaveBeenCalled();
  });
});

describe("capturedDistrictFacts", () => {
  it("finds facts saved with a downloaded area", async () => {
    window.localStorage.setItem(
      "engage-mt:offline-areas",
      JSON.stringify([
        {
          id: "a1",
          bbox: { north: 1, south: 0, east: 1, west: 0 },
          maxZoom: 12,
          status: "downloaded",
        },
      ]),
    );
    h.files.set(
      "regs/areas/a1.json",
      JSON.stringify({
        areaId: "a1",
        capturedAt: "",
        version: 9,
        districts: ["380"],
        facts: { "380": { district: "380" } },
      }),
    );
    await expect(capturedDistrictFacts("380")).resolves.toEqual({ district: "380" });
    await expect(capturedDistrictFacts("999")).resolves.toBeNull();
  });
});
