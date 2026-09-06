/**
 * @file OfflineAoiConfirmSheet.test.tsx
 * @module engage-mt/map
 * @description Unit tests for the on-map offline-AOI confirmation sheet. The two
 *              offline stores, the tile-quota helpers, toast, navigate, and
 *              focus-trap are mocked at the import seam so the tests drive
 *              behavior: renders null with no draft bbox; renders the sheet +
 *              extent when a bbox is captured; "Download now" on web queues +
 *              warns (no real download), on Capacitor starts the download;
 *              "Add to Offline Maps" queues + navigates;
 *              an over-cap queue result surfaces the cap warning and does not
 *              clear the draft; the cap-exceeded state disables Download and shows
 *              the notice; Cancel clears the draft.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const state = vi.hoisted(() => ({
  bbox: null as { north: number; south: number; east: number; west: number } | null,
  areas: [] as Array<{ estimatedBytes: number }>,
  estimate: 1_000_000,
  isCapacitor: false,
  queueResult: { ok: true, area: { label: "My hunt area" } } as {
    ok: boolean;
    area?: { label: string };
  },
}));
const spies = vi.hoisted(() => ({
  clearDraft: vi.fn(),
  queueArea: vi.fn(() => state.queueResult),
  startDownload: vi.fn(async () => undefined),
  show: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => spies.navigate }));
vi.mock("@/hooks/useFocusTrap", () => ({ useFocusTrap: vi.fn() }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ show: spies.show }) }));
vi.mock("@/utils/capacitor", () => ({ isCapacitor: () => state.isCapacitor }));
vi.mock("@/config/offlineBasemaps", () => ({
  BASEMAP_TEMPLATES: {
    usgsTopo: { label: "USGS Topo" },
    usgsImageryTopo: { label: "USGS Imagery Topo" },
  },
  DEFAULT_BASEMAP_KEY: "usgsTopo",
  DEFAULT_OFFLINE_MAX_ZOOM: 14,
  OFFLINE_AREA_MIN_ZOOM: 10,
  OFFLINE_MAX_ZOOM: 16,
  OFFLINE_ATTRIBUTION: "USGS",
}));
vi.mock("@/services/mobile/offlineTileQuota", () => ({
  offlineMaxBytes: () => 2_000_000_000,
  formatBytes: (b: number) => `${b} B`,
  // Both legs fold into one number so the `state.estimate` assertions stay exact.
  estimateAreaBytes: () => ({
    tileCount: 1,
    tileBytes: state.estimate,
    dataBytes: 0,
    totalBytes: state.estimate,
  }),
}));
vi.mock("@/store/field/offlineAoiDraftStore", () => ({
  useOfflineAoiDraftStore: (sel: (s: unknown) => unknown) =>
    sel({ bbox: state.bbox, clear: spies.clearDraft }),
}));
vi.mock("@/store/field/offlineAreasStore", () => ({
  MAX_AREAS: 10,
  useOfflineAreasStore: (sel: (s: unknown) => unknown) =>
    sel({ areas: state.areas, queueArea: spies.queueArea, startDownload: spies.startDownload }),
}));

import { OfflineAoiConfirmSheet } from "./OfflineAoiConfirmSheet";

const BBOX = { north: 47, south: 46, east: -110, west: -112 };

beforeEach(() => {
  vi.clearAllMocks();
  state.bbox = null;
  state.areas = [];
  state.estimate = 1_000_000;
  state.isCapacitor = false;
  state.queueResult = { ok: true, area: { label: "My hunt area" } };
});

describe("OfflineAoiConfirmSheet — visibility", () => {
  it("renders null when there is no draft bbox", () => {
    const { container } = render(<OfflineAoiConfirmSheet />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the sheet + extent bounds when a bbox is captured", () => {
    state.bbox = BBOX;
    render(<OfflineAoiConfirmSheet />);
    expect(screen.getByText("Download this area")).toBeTruthy();
    expect(screen.getByText(/46\.000, -112\.000/)).toBeTruthy();
  });
});

describe("OfflineAoiConfirmSheet — download now", () => {
  it("on web: queues, clears the draft, and warns it is a preview (no real download)", () => {
    state.bbox = BBOX;
    render(<OfflineAoiConfirmSheet />);
    fireEvent.click(screen.getByRole("button", { name: /Download now/ }));
    expect(spies.queueArea).toHaveBeenCalledTimes(1);
    expect(spies.clearDraft).toHaveBeenCalled();
    expect(spies.startDownload).not.toHaveBeenCalled();
    expect(spies.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/Web preview/) }),
    );
  });

  it("on Capacitor: starts the tile download", () => {
    state.bbox = BBOX;
    state.isCapacitor = true;
    render(<OfflineAoiConfirmSheet />);
    fireEvent.click(screen.getByRole("button", { name: /Download now/ }));
    expect(spies.startDownload).toHaveBeenCalledWith({ label: "My hunt area" });
  });

  it("surfaces the over-cap warning and does NOT clear the draft when queue is rejected", () => {
    state.bbox = BBOX;
    state.queueResult = { ok: false };
    render(<OfflineAoiConfirmSheet />);
    fireEvent.click(screen.getByRole("button", { name: /Download now/ }));
    expect(spies.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Over offline storage cap" }),
    );
    expect(spies.clearDraft).not.toHaveBeenCalled();
    expect(spies.startDownload).not.toHaveBeenCalled();
  });
});

describe("OfflineAoiConfirmSheet — stage to Offline Maps", () => {
  it("queues, toasts, and navigates to the offline-tiles page", () => {
    state.bbox = BBOX;
    render(<OfflineAoiConfirmSheet />);
    fireEvent.click(screen.getByRole("button", { name: /Add to Offline Maps/ }));
    expect(spies.queueArea).toHaveBeenCalled();
    expect(spies.navigate).toHaveBeenCalledWith("/manage/offline-tiles");
  });
});

describe("OfflineAoiConfirmSheet — cap + size guards", () => {
  it("disables Download now and shows the notice when adding would exceed the cap", () => {
    state.bbox = BBOX;
    state.areas = [{ estimatedBytes: 1_999_999_999 }]; // near the 2 GB cap
    state.estimate = 100_000_000;
    render(<OfflineAoiConfirmSheet />);
    const dl = screen.getByRole("button", { name: /Download now/ }) as HTMLButtonElement;
    expect(dl.disabled).toBe(true);
    expect(screen.getByText(/push total offline storage past/)).toBeTruthy();
  });

  it("shows the too-big notice for an estimate over ~500 MB", () => {
    state.bbox = BBOX;
    state.estimate = 600_000_000;
    render(<OfflineAoiConfirmSheet />);
    expect(screen.getByText(/That.s a lot of tiles/)).toBeTruthy();
  });
});

describe("OfflineAoiConfirmSheet — cancel", () => {
  it("clears the draft from the close button", () => {
    state.bbox = BBOX;
    render(<OfflineAoiConfirmSheet />);
    fireEvent.click(screen.getByLabelText("Cancel offline area selection"));
    expect(spies.clearDraft).toHaveBeenCalled();
  });
});
