/**
 * @file useDistrictRegulations.test.ts
 * @module engage-mt/hooks
 * @description Unit tests for the per-district hunting-regs hook. The hook reads
 *              the FWP Regs Manager API via `fetchHuntingRegs`
 *              and adapts NormalizedRegulation rows into the per-season-column shape.
 *              Covers: null-district idle, a district hit (name + byCategory grouping +
 *              season-column mapping), district-not-found → data:null, fetch error, and
 *              repeat lookups — with fetchHuntingRegs mocked at the seam.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-04
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedRegulation } from "@/services/hunt/regsTypes";

const h = vi.hoisted(() => ({ fetchHuntingRegs: vi.fn() }));
vi.mock("@/services/hunt/fetchHuntingRegs", () => ({ fetchHuntingRegs: h.fetchHuntingRegs }));
vi.mock("@/services/regsApi/districtNotes", () => ({
  fetchDistrictNotes: async () => ({ data: [] }),
  notesByDistrict: () => new Map<string, string[]>(),
}));

const reg = (hd: string, species: "deer" | "elk" | "antelope"): NormalizedRegulation => ({
  rule_id: `${species}:hd:${hd}:x:y:1`,
  species,
  species_group: "dea",
  geography_type: species === "antelope" ? "antelope-hd" : "hd",
  geography_id: hd,
  region: 3,
  district_name: hd === "380" ? "Elk Unit" : "Highland Unit",
  legal_animal: "Either-sex",
  required_license: "General License",
  is_draw: false,
  weapon_windows: [{ weapon: "General", range: "Oct 24-Nov 30" }],
  quota: null,
  apply_by_date: null,
  opportunity_specific: null,
  effective_date: "2025-12-04",
  expires_date: "2027-02-28",
  source_reg_id: "dea-2026",
});

const RESULT = {
  rows: [reg("380", "deer"), reg("380", "elk"), reg("380", "antelope"), reg("410", "elk")],
  freshness: {
    fetchedAt: "2026-07-04T00:00:00Z",
    sourceLabel: "FWP 2026",
    validUntil: "2027-02-28",
    fromCache: false,
  },
};

const loadHook = async (): Promise<
  typeof import("./useDistrictRegulations").useDistrictRegulations
> => {
  const mod = await import("./useDistrictRegulations");
  return mod.useDistrictRegulations;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
afterEach(() => vi.restoreAllMocks());

describe("useDistrictRegulations", () => {
  it("is idle when district is null", async () => {
    const useDistrictRegulations = await loadHook();
    const { result } = renderHook(() => useDistrictRegulations(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(h.fetchHuntingRegs).not.toHaveBeenCalled();
  });

  it("resolves a district with grouped byCategory rows from the API", async () => {
    h.fetchHuntingRegs.mockResolvedValue(RESULT);
    const useDistrictRegulations = await loadHook();
    const { result } = renderHook(() => useDistrictRegulations("380"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const data = result.current.data;
    expect(data).not.toBeNull();
    expect(data!.name).toBe("Elk Unit");
    expect(data!.rows).toHaveLength(3);
    expect(data!.byCategory.deer).toHaveLength(1);
    expect(data!.byCategory.elk).toHaveLength(1);
    expect(data!.byCategory.antelope).toHaveLength(1);
    // Season-column mapping from weapon_windows.
    expect(data!.byCategory.elk[0]!.generalDates).toBe("Oct 24-Nov 30");
    expect(result.current.error).toBeNull();
  });

  it("returns data:null when the district isn't present", async () => {
    h.fetchHuntingRegs.mockResolvedValue(RESULT);
    const useDistrictRegulations = await loadHook();
    const { result } = renderHook(() => useDistrictRegulations("999"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("surfaces a fetch error", async () => {
    h.fetchHuntingRegs.mockRejectedValue(new Error("regs offline"));
    const useDistrictRegulations = await loadHook();
    const { result } = renderHook(() => useDistrictRegulations("380"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("regs offline");
    expect(result.current.data).toBeNull();
  });

  it("asks the fetcher again for a second district (the fetcher owns caching)", async () => {
    h.fetchHuntingRegs.mockResolvedValue(RESULT);
    const useDistrictRegulations = await loadHook();
    const first = renderHook(() => useDistrictRegulations("380"));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    const second = renderHook(() => useDistrictRegulations("410"));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(h.fetchHuntingRegs).toHaveBeenCalledTimes(2);
    expect(second.result.current.data?.byCategory.elk).toHaveLength(1);
  });
});
