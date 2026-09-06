/**
 * @file DistrictBrowserScreen.test.tsx
 * @module engage-mt/staff
 * @description Loads districts for the season and geography, groups them by
 *              region, filters by code or name, switches geography, and shows
 *              the empty states.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({ districts: vi.fn() }));
vi.mock("../api.js", () => ({ api: { districts: h.districts } }));
vi.mock("../store.js", () => ({ useApp: (sel: (s: { seasonYear: number }) => unknown) => sel({ seasonYear: 2026 }) }));

import { DistrictBrowserScreen } from "./DistrictBrowserScreen.js";

const row = (code: string, name: string | null, region: number) => ({
  district_id: code,
  district_code: code,
  geography_code: "HD",
  region_id: region,
  district_name: name,
  instrument_count: "3",
});

const renderScreen = () =>
  render(
    <MemoryRouter>
      <DistrictBrowserScreen />
    </MemoryRouter>,
  );

beforeEach(() => {
  h.districts.mockReset();
  h.districts.mockResolvedValue([row("380", "Elkhorns", 3), row("410", "Missouri Breaks", 4), row("381", null, 3)]);
});

describe("DistrictBrowserScreen", () => {
  it("loads districts for the season and geography and groups them by region", async () => {
    renderScreen();
    expect(await screen.findByText("Region 3")).toBeInTheDocument();
    expect(screen.getByText("Region 4")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "380 — Elkhorns" })).toHaveAttribute("href", "/districts/380?geo=HD");
    expect(screen.getByRole("link", { name: "381 — Unnamed" })).toBeInTheDocument();
    expect(h.districts).toHaveBeenCalledWith(2026, "HD");
  });

  it("filters by code or name and explains an empty match", async () => {
    renderScreen();
    await screen.findByText("Region 3");
    fireEvent.change(screen.getByPlaceholderText(/district number or name/i), { target: { value: "breaks" } });
    expect(screen.getByRole("link", { name: "410 — Missouri Breaks" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "380 — Elkhorns" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/district number or name/i), { target: { value: "999" } });
    expect(screen.getByText(/No districts match/)).toBeInTheDocument();
  });

  it("reloads for the antelope geography and shows the empty-season state", async () => {
    renderScreen();
    await screen.findByText("Region 3");
    h.districts.mockResolvedValueOnce([]);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ANTELOPE_HD" } });
    await waitFor(() => expect(h.districts).toHaveBeenLastCalledWith(2026, "ANTELOPE_HD"));
    expect(await screen.findByText(/No districts in this geography/)).toBeInTheDocument();
  });
});
