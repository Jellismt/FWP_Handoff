/**
 * @file DistrictDetailTabs.test.tsx
 * @module engage-mt/hunt
 * @description Render-state coverage for the tabbed district detail page. Drives
 *              the curated-facts seam (`useFetchJson`) — loading (SkeletonGrid),
 *              unknown-district (EmptyStateCard early return when the curated
 *              row is absent and no live fallback resolves), and loaded (hero +
 *              tablist + default Regulations tab). A tab click confirms the
 *              URL-mirrored tab switch. `useFetchJson` is mocked so no data /
 *              REST call runs; the Seasons / Regulations panels are stubbed.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-16
 * @version 3.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { UseFetchJsonResult } from "@/hooks/useFetchJson";
import type { DistrictFactsRow } from "@/services/data/districtFacts";

const h = vi.hoisted(() => ({
  facts: {
    data: null as DistrictFactsRow[] | null,
    error: null as Error | null,
    loading: true,
    retry: () => {},
  },
}));

vi.mock("@/hooks/useFetchJson", () => ({
  useFetchJson: (): UseFetchJsonResult<DistrictFactsRow[]> => h.facts,
}));

// The single-species live fallback would otherwise hit FWP-GIS REST. Resolve
// null so an unknown district drops cleanly to the empty state.
vi.mock("@/services/hunt/huntingDistrictsLive", () => ({
  fetchDistrictFactsLive: vi.fn(async () => null),
}));

// The Regulations / Seasons tabs mount live sub-panels (both fed by the FWP
// Regs Manager) — stub them so the test never reaches their data seams.
vi.mock("./DistrictSeasonWindows", () => ({
  DistrictSeasonWindows: () => <div data-testid="season-windows-stub" />,
}));
vi.mock("./DistrictRegulationsPanel", () => ({
  DistrictRegulationsPanel: () => <div data-testid="district-regs-stub" />,
}));

import { DistrictDetailTabs } from "./DistrictDetailTabs";

const FACTS: DistrictFactsRow = {
  district: "380",
  region: 3,
  name: "Madison",
  acres: 250_000,
  counties: "Madison",
  weapon_restriction: false,
};

const renderTabs = (district = "380") =>
  render(
    <MemoryRouter initialEntries={[`/hunt/districts/${district}`]}>
      <Routes>
        <Route path="/hunt/districts/:district" element={<DistrictDetailTabs />} />
      </Routes>
    </MemoryRouter>,
  );

describe("DistrictDetailTabs", () => {
  beforeEach(() => {
    h.facts = { data: null, error: null, loading: true, retry: () => {} };
  });

  it("renders a skeleton grid while the curated facts load", () => {
    const { container } = renderTabs();
    // Loading branch returns ONLY the skeleton — no district heading yet.
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(container.querySelector("[class*='skeleton']")).not.toBeNull();
  });

  it("shows the empty state for an unknown district (no curated row, no live hit)", async () => {
    // Resolved with zero matching rows → bundledMissing → live fallback resolves null.
    h.facts = { data: [FACTS], error: null, loading: false, retry: () => {} };
    renderTabs("999");

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /no facts on file for hd 999/i })).toBeTruthy(),
    );
  });

  it("renders the district hero, action row, tablist, and Regulations tab when loaded", () => {
    h.facts = { data: [FACTS], error: null, loading: false, retry: () => {} };
    renderTabs();

    expect(screen.getByRole("heading", { level: 1, name: /HD 380 — Madison/i })).toBeTruthy();
    // Action row.
    expect(screen.getByRole("button", { name: /show on map/i })).toBeTruthy();
    // Region + acreage render as plain subheading rows under the H1 —
    // region first, then the district area spelled out in acres.
    const regionFact = screen.getByText(/^FWP Region 3$/);
    const areaFact = screen.getByText(/^250k acres$/i);
    expect(
      regionFact.compareDocumentPosition(areaFact) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Two-tab tablist (Regulations / Seasons) — Overview + Contact removed.
    const tablist = screen.getByRole("tablist", { name: /district sections/i });
    expect(tablist).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(screen.queryByRole("tab", { name: /overview/i })).toBeNull();
    expect(screen.queryByRole("tab", { name: /contact/i })).toBeNull();
    // Regulations is the selected default.
    expect(screen.getByRole("tab", { name: /regulations/i }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByTestId("district-regs-stub")).toBeTruthy();
    // No synthesized outlook or freshness chip on the reimagined page.
    expect(screen.queryByText(/district outlook/i)).toBeNull();
    expect(screen.queryByText(/2026-05-15/)).toBeNull();
  });

  it("switches to the Seasons tab on click (mirrored to the tabpanel)", async () => {
    h.facts = { data: [FACTS], error: null, loading: false, retry: () => {} };
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole("tab", { name: /seasons/i }));
    expect(screen.getByRole("tab", { name: /seasons/i }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByTestId("season-windows-stub")).toBeTruthy();
  });
});
