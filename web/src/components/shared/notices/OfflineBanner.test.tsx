/**
 * @file OfflineBanner.test.tsx
 * @module engage-mt/shared/notices
 * @description Hidden online, generic copy offline, and the nearest-area
 *              prompt when the map is outside every downloaded area.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useConnectivityStore } from "@/store/app/connectivityStore";
import { useOfflineCoverageStore } from "@/store/map/offlineCoverageStore";

const flyTo = vi.fn();
vi.mock("@/hooks/useMapNavigation", () => ({ useMapNavigation: () => ({ flyTo }) }));
vi.mock("@esri/calcite-components-react", () => ({
  CalciteNotice: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { OfflineBanner } from "./OfflineBanner";

const renderBanner = (): void => {
  render(
    <MemoryRouter>
      <OfflineBanner />
    </MemoryRouter>,
  );
};

describe("OfflineBanner", () => {
  beforeEach(() => {
    flyTo.mockClear();
    useOfflineCoverageStore.setState({ inCoverage: null, nearest: null });
  });

  it("renders nothing while online", () => {
    useConnectivityStore.getState().setOnline(true);
    renderBanner();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the generic offline copy when coverage is unknown", () => {
    useConnectivityStore.getState().setOnline(false);
    renderBanner();
    expect(screen.getByText("You're offline")).toBeInTheDocument();
  });

  it("names the nearest area and flies to it when outside every download", () => {
    useConnectivityStore.getState().setOnline(false);
    useOfflineCoverageStore.setState({
      inCoverage: false,
      nearest: {
        id: "camp",
        label: "Elk camp",
        bbox: { north: 46, south: 45, east: -111, west: -112 },
        minZoom: 6,
        maxZoom: 14,
      },
    });
    renderBanner();
    expect(screen.getByText(/outside your downloaded areas/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show Elk camp" }));
    expect(flyTo).toHaveBeenCalledWith({ lat: 45.5, lon: -111.5, zoom: 11 });
  });
});
