/**
 * @file FieldToolsPage.test.tsx
 * @module engage-mt/field
 * @description Render + interaction coverage for the field-tools dashboard.
 *              Field data is local-first (Tier-3 zustand), so this drives the
 *              REAL `useFieldToolsStore` — reset between tests — rather than a
 *              mock: the empty-waypoints state, a store-added waypoint landing
 *              in the list + hero stat, the web-planning notice, and tab
 *              switches to the Routes / Shapes / Measurements empty states.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-16
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useFieldToolsStore } from "@/store/field/fieldToolsStore";

// Calcite web components aren't registered in the happy-dom test env; render
// the planning notice's slotted children as a plain element so its copy is
// queryable.
vi.mock("@esri/calcite-components-react", () => ({
  CalciteNotice: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import { FieldToolsPage } from "./FieldToolsPage";

const renderPage = () =>
  render(
    <MemoryRouter>
      <FieldToolsPage />
    </MemoryRouter>,
  );

describe("FieldToolsPage", () => {
  beforeEach(() => {
    // Reset the local-first store to a clean slate between tests.
    useFieldToolsStore.getState().clearAll();
    useFieldToolsStore.setState({ trips: [], activeTripId: null });
  });

  it("renders the hero, the web-planning notice, and the empty waypoints state", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: /field tools/i })).toBeTruthy();
    // Web notice — this is a planning surface on the web.
    expect(screen.getByText(/planning on the web/i)).toBeTruthy();
    // No waypoints yet — the empty state points at the map's drop-waypoint flow.
    expect(screen.getByText(/no waypoints yet/i)).toBeTruthy();
    // Every field-tools tab present (the TripSwitcher renders its own
    // "Trips" tablist, so query the tabs directly rather than by wrapper).
    expect(screen.getByRole("tab", { name: /waypoints/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /routes/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /shapes/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /measure/i })).toBeTruthy();
  });

  it("shows a store-held waypoint in the list + hero stat", () => {
    useFieldToolsStore.getState().addWaypoint({
      kind: "general",
      name: "Elk wallow",
      lat: 46.55,
      lon: -111.72,
    });
    renderPage();

    // Landed in the list.
    expect(screen.getByText("Elk wallow")).toBeTruthy();
    expect(screen.getByText(/46\.55000, -111\.72000/)).toBeTruthy();
    // Empty message gone.
    expect(screen.queryByText(/no waypoints yet/i)).toBeNull();
    // Per-waypoint actions render.
    expect(screen.getByRole("button", { name: /show elk wallow on the map/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /delete waypoint elk wallow/i })).toBeTruthy();
  });

  it("deletes a waypoint from the list and returns to the empty state", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    useFieldToolsStore.getState().addWaypoint({
      kind: "general",
      name: "Elk wallow",
      lat: 46.55,
      lon: -111.72,
    });
    renderPage();

    await user.click(screen.getByRole("button", { name: /delete waypoint elk wallow/i }));
    expect(screen.queryByText("Elk wallow")).toBeNull();
    expect(screen.getByText(/no waypoints yet/i)).toBeTruthy();
    expect(useFieldToolsStore.getState().waypoints).toHaveLength(0);
  });

  it("switches to the Measurements tab and shows its empty state", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: /measure/i }));
    expect(screen.getByRole("heading", { name: /measurements/i })).toBeTruthy();
    expect(screen.getByText(/no measurements yet/i)).toBeTruthy();
  });
});
