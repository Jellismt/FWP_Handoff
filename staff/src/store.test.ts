/**
 * @file store.test.ts
 * @module engage-mt/staff
 * @description Season-year store: the active year clamps to a year the API
 *              actually returned.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-05
 * @updated 2026-09-05
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ seasonYears: vi.fn() }));
vi.mock("./api.js", () => ({ api: { seasonYears: h.seasonYears } }));

import { useApp } from "./store.js";

const year = (season_year: number) => ({
  season_year,
  status_code: "PUBLISHED",
  starts_on: `${season_year}-03-01`,
  ends_on: `${season_year + 1}-02-28`,
  adopted_on: null,
  version: 1,
  instrument_count: "0",
});

beforeEach(() => {
  h.seasonYears.mockReset();
  useApp.setState({ me: null, seasonYear: 2026, seasonYears: [] });
});

describe("useApp.refreshSeasonYears", () => {
  it("keeps the active year when the API still lists it", async () => {
    h.seasonYears.mockResolvedValue([year(2026), year(2027)]);
    await useApp.getState().refreshSeasonYears();
    expect(useApp.getState().seasonYear).toBe(2026);
    expect(useApp.getState().seasonYears).toHaveLength(2);
  });

  it("falls back to the most recent year when the active one is gone", async () => {
    useApp.setState({ seasonYear: 2024 });
    h.seasonYears.mockResolvedValue([year(2026), year(2027)]);
    await useApp.getState().refreshSeasonYears();
    expect(useApp.getState().seasonYear).toBe(2027);
  });

  it("leaves the active year alone when the API returns nothing", async () => {
    h.seasonYears.mockResolvedValue([]);
    await useApp.getState().refreshSeasonYears();
    expect(useApp.getState().seasonYear).toBe(2026);
  });
});
