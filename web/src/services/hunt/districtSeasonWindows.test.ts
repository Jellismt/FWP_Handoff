/**
 * @file districtSeasonWindows.test.ts
 * @module engage-mt/services/hunt
 * @description Unit coverage for the season-window derivation helpers: range
 *              humanization, distinct per-weapon window collection (order +
 *              dedup + comma-split), and the single-species headline window
 *              (general → antelope seasonDates fallback → null).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import type {
  DistrictRegulationRow,
  DistrictRegulationsBundle,
} from "@/hooks/useDistrictRegulations";
import {
  collectSeasonWindows,
  headlineGeneralWindow,
  humanizeSeasonRange,
} from "./districtSeasonWindows";

const row = (over: Partial<DistrictRegulationRow>): DistrictRegulationRow =>
  ({
    hd: "380",
    districtName: "Elkhorns",
    region: 3,
    districtNotes: [],
    species: "ELK",
    license: "Elk General",
    opportunity: "Either sex",
    applyByDate: null,
    quota: null,
    quotaRange: null,
    earlySeasonDates: null,
    archeryDates: null,
    generalDates: null,
    heritageMuzzleloaderDates: null,
    lateSeasonDates: null,
    seasonDates: null,
    opportunitySpecific: null,
    rawRow: "",
    _source: { pdf: "", pdfFile: "", commissionAdoptedAt: "", validUntil: "" },
    ...over,
  }) as DistrictRegulationRow;

const bundle = (
  byCategory: DistrictRegulationsBundle["byCategory"],
): DistrictRegulationsBundle => ({
  hd: "380",
  name: "Elkhorns",
  region: 3,
  notes: [],
  rows: [...byCategory.deer, ...byCategory.elk, ...byCategory.antelope],
  freshness: {
    fetchedAt: "2026-07-07T00:00:00Z",
    sourceLabel: "test",
    validUntil: null,
    effectiveDate: "2026-03-01",
    version: 4,
    stale: false,
    fromCache: false,
    bundled: false,
    tier: "live" as const,
  },
  byCategory,
});

describe("humanizeSeasonRange", () => {
  it("swaps a hyphen for a spaced en-dash", () => {
    expect(humanizeSeasonRange("Oct 24-Nov 29")).toBe("Oct 24 – Nov 29");
  });

  it("normalizes an already-spaced range and trims", () => {
    expect(humanizeSeasonRange("  Sep 6 - Oct 19 ")).toBe("Sep 6 – Oct 19");
  });
});

describe("collectSeasonWindows", () => {
  it("emits one entry per populated weapon column, in print order", () => {
    const out = collectSeasonWindows([
      row({ archeryDates: "Sep 6-Oct 19", generalDates: "Oct 24-Nov 29" }),
    ]);
    expect(out.map((w) => w.label)).toEqual(["Archery", "General"]);
    expect(out.map((w) => w.value)).toEqual(["Sep 6 – Oct 19", "Oct 24 – Nov 29"]);
  });

  it("dedupes identical windows across rows and comma-splits multi-window strings", () => {
    const out = collectSeasonWindows([
      row({ generalDates: "Oct 24-Nov 29" }),
      row({ generalDates: "Oct 24-Nov 29, Dec 1-Dec 8" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ label: "General", value: "Oct 24 – Nov 29, Dec 1 – Dec 8" });
  });

  it("returns an empty list when no weapon columns are populated", () => {
    expect(collectSeasonWindows([row({})])).toEqual([]);
  });
});

describe("headlineGeneralWindow", () => {
  it("returns the humanized general window for the species", () => {
    const b = bundle({ deer: [], elk: [row({ generalDates: "Oct 24-Nov 29" })], antelope: [] });
    expect(headlineGeneralWindow(b, "elk")).toBe("Oct 24 – Nov 29");
  });

  it("falls back to antelope seasonDates when generalDates is absent", () => {
    const b = bundle({
      deer: [],
      elk: [],
      antelope: [row({ species: "ANTELOPE", seasonDates: "Oct 10-Oct 31" })],
    });
    expect(headlineGeneralWindow(b, "antelope")).toBe("Oct 10 – Oct 31");
  });

  it("returns null for a missing bundle or empty species", () => {
    expect(headlineGeneralWindow(null, "elk")).toBeNull();
    const b = bundle({ deer: [], elk: [row({})], antelope: [] });
    expect(headlineGeneralWindow(b, "elk")).toBeNull();
  });
});
