/**
 * @file DistrictRegulationsPanel.test.tsx
 * @module engage-mt/hunt
 * @description Render-state coverage for the per-HD DEA regulations panel.
 *              Drives the `useDistrictRegulations` hook seam through loading
 *              (skeleton), error (warning tip + PDF link), miss/not-in-extract
 *              (info tip + PDF link), and loaded (district heading, notes,
 *              deer/elk/antelope sections). The regs-PDF path helper is
 *              stubbed to a stable value.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-16
 * @version 1.2.0
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

vi.mock("@/services/regsApi/corrections", async (importActual) => ({
  ...(await importActual<typeof import("@/services/regsApi/corrections")>()),
  fetchCorrections: async () => ({ data: [] }),
}));
vi.mock("@/hooks/useDistrictRegulations", () => ({
  useDistrictRegulations: () => h.result,
}));

// Enrichment sections fetch their own data; pin them so the panel test stays
// isolated to the panel. (Their own behavior is covered in their suites.)
const he = vi.hoisted(() => ({
  restrictedAreas: [] as unknown[],
  youth: [] as unknown[],
}));
vi.mock("@/hooks/useDistrictEnrichment", () => ({
  useRestrictedAreas: () => he.restrictedAreas,
  useYouthOpportunities: () => he.youth,
}));

// Keep the module's real exports and only pin the PDF-path helper to a stable
// value (a few fallback notices still link the DEA PDF on error / no-data).
vi.mock("@/services/regs/useRegsIndex", async (importActual) => {
  const actual = await importActual<typeof import("@/services/regs/useRegsIndex")>();
  return { ...actual, regsPdfPath: (p: string) => p };
});

import { DistrictRegulationsPanel } from "./DistrictRegulationsPanel";

const regRow = (over: Partial<DistrictRegulationRow>): DistrictRegulationRow =>
  ({
    hd: "380",
    name: "Elkhorns",
    region: 3,
    license: "Elk General",
    opportunity: "Either sex",
    applyByDate: null,
    quota: null,
    quotaRange: null,
    earlySeasonDates: null,
    archeryDates: "Sep 6 - Oct 19",
    generalDates: "Oct 25 - Nov 30",
    heritageMuzzleloaderDates: null,
    lateSeasonDates: null,
    seasonDates: null,
    opportunitySpecific: null,
    _source: {
      commissionAdoptedAt: "2025-12-04",
      validUntil: "2027-02-28",
    },
    ...over,
  }) as DistrictRegulationRow;

const deerRow = regRow({ license: "Deer B", opportunity: "Antlerless" });
const elkRow = regRow({ license: "Elk General", opportunity: "Either sex" });

const BUNDLE = {
  hd: "380",
  name: "Elkhorns",
  region: 3,
  notes: ["Mandatory CWD sampling", "WMA winter closure Dec 1 - May 15"],
  rows: [deerRow, elkRow],
  freshness: {
    tier: "live" as const,
    fetchedAt: "2026-07-07T00:00:00Z",
    sourceLabel: "FWP hunting regulations",
    validUntil: null,
    effectiveDate: "2026-03-01",
    version: 4,
    stale: false,
    fromCache: false,
    bundled: false,
  },
  byCategory: {
    deer: [deerRow],
    elk: [elkRow],
    antelope: [] as DistrictRegulationRow[],
  },
};

const renderPanel = () => render(<DistrictRegulationsPanel district="380" />);

beforeEach(() => {
  vi.clearAllMocks();
  h.result = { loading: true, error: null, data: null };
  he.restrictedAreas = [];
  he.youth = [];
});

describe("DistrictRegulationsPanel", () => {
  it("renders a skeleton while the regs load", () => {
    const { container } = renderPanel();
    expect(container.querySelector("[class*='skeleton']")).not.toBeNull();
  });

  it("surfaces a load error as a warning tip with a PDF fallback link", () => {
    h.result = { loading: false, error: new Error("extract fetch failed"), data: null };
    renderPanel();
    expect(screen.getByText(/couldn't load hd regulations/i)).toBeTruthy();
    expect(screen.getByText(/extract fetch failed/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /view on fwp\.mt\.gov/i })).toHaveProperty(
      "href",
      expect.stringContaining("fwp.mt.gov/hunt/regulations"),
    );
  });

  it("shows a not-in-extract info tip when the district misses", () => {
    h.result = { loading: false, error: null, data: null };
    renderPanel();
    expect(screen.getByText(/district not in current extract/i)).toBeTruthy();
    expect(screen.getByText(/hd 380/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /view on fwp\.mt\.gov/i })).toBeTruthy();
  });

  it("renders the notes and species sections when loaded (no duplicate heading)", () => {
    h.result = { loading: false, error: null, data: BUNDLE };
    renderPanel();
    // The old "HD 380 — … · Region 3" heading duplicated the page header +
    // hero above the tabs — the section is aria-labelled instead.
    expect(screen.queryByRole("heading", { name: /hd 380/i })).toBeNull();
    // District notes bullets.
    expect(screen.getByText(/mandatory cwd sampling/i)).toBeTruthy();
    // Species section headings.
    expect(screen.getByRole("heading", { name: /^deer$/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^elk$/i })).toBeTruthy();
    // No provenance "Authoritative source" citation card.
    expect(screen.queryByRole("heading", { name: /authoritative source/i })).toBeNull();
    // No internal rows-extracted count chips.
    expect(screen.queryByText(/rows extracted/i)).toBeNull();
  });

  it("omits the antelope section when there are no antelope rows", () => {
    h.result = { loading: false, error: null, data: BUNDLE };
    renderPanel();
    expect(screen.queryByRole("heading", { name: /^antelope$/i })).toBeNull();
    expect(screen.queryByText(/antelope/i)).toBeNull();
  });

  it("renders an antelope section when antelope rows are present", () => {
    const antelope = regRow({ license: "Antelope 900", opportunity: "Either sex" });
    h.result = {
      loading: false,
      error: null,
      data: {
        ...BUNDLE,
        rows: [deerRow, elkRow, antelope],
        byCategory: { deer: [deerRow], elk: [elkRow], antelope: [antelope] },
      },
    };
    renderPanel();
    expect(screen.getByRole("heading", { name: /^antelope$/i })).toBeTruthy();
  });

  it("names a built-in copy and warns when the copy is stale", () => {
    h.result = {
      loading: false,
      error: null,
      data: {
        ...BUNDLE,
        freshness: {
          ...BUNDLE.freshness,
          tier: "bundled" as const,
          bundled: true,
          stale: true,
          fetchedAt: "2026-03-15T00:00:00Z",
          validUntil: "2026-08-31",
        },
      },
    };
    renderPanel();
    expect(screen.getByText(/· Built-in copy/)).toBeInTheDocument();
    expect(screen.getByText("This copy may be out of date")).toBeInTheDocument();
    expect(screen.getByText(/last refreshed 2026-03-15/)).toBeInTheDocument();
  });
});
