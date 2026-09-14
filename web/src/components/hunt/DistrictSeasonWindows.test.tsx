/**
 * @file DistrictSeasonWindows.test.tsx
 * @module engage-mt/hunt
 * @description Render-state coverage for the authoritative Seasons panel. Drives
 *              the `useDistrictRegulations` seam through loading (skeleton),
 *              error (warning tip + PDF link), miss (info tip + PDF link),
 *              loaded (per-species headings + humanized weapon-window pills),
 *              and the no-windows case (info tip). The regs-PDF path helper is
 *              stubbed to a stable value.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type {
  DistrictRegulationRow,
  UseDistrictRegulationsResult,
} from "@/hooks/useDistrictRegulations";

const h = vi.hoisted(() => ({
  result: { loading: true, error: null, data: null } as UseDistrictRegulationsResult,
}));

vi.mock("@/hooks/useDistrictRegulations", () => ({
  useDistrictRegulations: () => h.result,
}));

vi.mock("@/services/regs/useRegsIndex", async (importActual) => {
  const actual = await importActual<typeof import("@/services/regs/useRegsIndex")>();
  return { ...actual, regsPdfPath: (p: string) => p };
});

import { DistrictSeasonWindows } from "./DistrictSeasonWindows";

const regRow = (over: Partial<DistrictRegulationRow>): DistrictRegulationRow =>
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

const elkRow = regRow({ archeryDates: "Sep 6-Oct 19", generalDates: "Oct 24-Nov 29" });

const BUNDLE = {
  hd: "380",
  name: "Elkhorns",
  region: 3,
  notes: [],
  rows: [elkRow],
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
  byCategory: {
    deer: [] as DistrictRegulationRow[],
    elk: [elkRow],
    antelope: [] as DistrictRegulationRow[],
  },
};

const renderPanel = () => render(<DistrictSeasonWindows district="380" />);

beforeEach(() => {
  vi.clearAllMocks();
  h.result = { loading: true, error: null, data: null };
});

describe("DistrictSeasonWindows", () => {
  it("renders a skeleton while the regs load", () => {
    const { container } = renderPanel();
    expect(container.querySelector("[class*='skeleton']")).not.toBeNull();
  });

  it("surfaces a load error as a warning tip with a PDF fallback link", () => {
    h.result = { loading: false, error: new Error("regs fetch failed"), data: null };
    renderPanel();
    expect(screen.getByText(/couldn't load hd seasons/i)).toBeTruthy();
    expect(screen.getByText(/regs fetch failed/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /view on fwp\.mt\.gov/i })).toBeTruthy();
  });

  it("shows a not-in-extract info tip when the district misses", () => {
    h.result = { loading: false, error: null, data: null };
    renderPanel();
    expect(screen.getByText(/district not in current extract/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /view on fwp\.mt\.gov/i })).toBeTruthy();
  });

  it("renders per-species headings + humanized weapon windows when loaded", () => {
    h.result = { loading: false, error: null, data: BUNDLE };
    renderPanel();
    expect(
      screen.getByRole("heading", { name: /hd 380 — elkhorns · region 3 · season windows/i }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^elk$/i })).toBeTruthy();
    expect(screen.getByText("Archery")).toBeTruthy();
    expect(screen.getByText("Sep 6 – Oct 19")).toBeTruthy();
    expect(screen.getByText("Oct 24 – Nov 29")).toBeTruthy();
    // No deer/antelope rows → those species sections are omitted.
    expect(screen.queryByRole("heading", { name: /^deer$/i })).toBeNull();
  });

  it("shows the no-windows info tip when the bundle carries no weapon windows", () => {
    h.result = {
      loading: false,
      error: null,
      data: {
        ...BUNDLE,
        rows: [regRow({})],
        byCategory: { deer: [], elk: [regRow({})], antelope: [] },
      },
    };
    renderPanel();
    expect(screen.getByText(/no structured season windows/i)).toBeTruthy();
  });
});
