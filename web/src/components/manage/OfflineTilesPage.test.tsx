/**
 * @file OfflineTilesPage.test.tsx
 * @module engage-mt/manage
 * @description Behavior coverage for the offline-tile staging page (a
 *              mobile-app surface). Mocks the `useOfflineAreasStore`
 *              (selector-aware) and `useToast` while keeping the real quota
 *              math. Drives: the web-preview notice (hidden on Capacitor), the
 *              storage-cap meter, the custom-bbox queue
 *              action with its cap-exceeded toast branch, the map picker
 *              Suspense toggle, and the staged-areas list with start/remove
 *              actions.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-16
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import type { OfflineArea } from "@/store/field/offlineAreasStore";

interface StoreShape {
  areas: OfflineArea[];
  queueArea: ReturnType<typeof vi.fn>;
  removeArea: ReturnType<typeof vi.fn>;
  startDownload: ReturnType<typeof vi.fn>;
}

const h = vi.hoisted(() => ({
  show: vi.fn(),
  capacitor: false,
  store: {} as StoreShape,
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ show: h.show, dismiss: () => undefined }),
}));

vi.mock("@/utils/capacitor", () => ({ isCapacitor: () => h.capacitor }));

// Selector-aware Zustand mock: the page calls useStore((s) => s.field).
vi.mock("@/store/field/offlineAreasStore", () => ({
  MAX_AREAS: 10,
  useOfflineAreasStore: (selector: (s: StoreShape) => unknown) => selector(h.store),
}));

// The lazy AoiPickerMap pulls in ArcGIS — replace with a light stub.
vi.mock("./AoiPickerMap", () => ({
  AoiPickerMap: () => <div data-testid="aoi-picker-map" />,
}));

vi.mock("@esri/calcite-components-react", () => ({
  CalciteNotice: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import { OfflineTilesPage } from "./OfflineTilesPage";

const area = (over: Partial<OfflineArea> = {}): OfflineArea => ({
  id: "area-1",
  label: "My hunt area",
  bbox: { north: 46, south: 45.5, east: -110.5, west: -111.5 },
  maxZoom: 14,
  estimatedBytes: 50_000_000,
  status: "queued",
  createdAt: "2026-06-01T00:00:00Z",
  ...over,
});

const baseStore = (over: Partial<StoreShape> = {}): StoreShape => ({
  areas: [],
  queueArea: vi.fn(() => ({ ok: true, area: area() })),
  removeArea: vi.fn(),
  startDownload: vi.fn(() => Promise.resolve()),
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <OfflineTilesPage />
    </MemoryRouter>,
  );

describe("OfflineTilesPage", () => {
  beforeEach(() => {
    h.show = vi.fn();
    h.capacitor = false;
    h.store = baseStore();
  });

  it("renders the hero, the web-preview notice, and the storage-cap meter", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: /offline maps/i })).toBeTruthy();
    expect(screen.getByText(/on the web, engage mt can.t persist tiles/i)).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: /offline storage usage/i })).toBeTruthy();
  });

  it("hides the web-preview notice when running under Capacitor", () => {
    h.capacitor = true;
    renderPage();
    expect(screen.queryByText(/on the web, engage mt can.t persist tiles/i)).toBeNull();
  });

  it("relays the store's cap-exceeded refusal as a warning toast", async () => {
    h.store = baseStore({ queueArea: vi.fn(() => ({ ok: false, reason: "over-cap" })) });
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /queue this area/i }));
    expect(h.show).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "warning",
        title: expect.stringMatching(/over offline storage cap/i),
      }),
    );
  });

  it("queues a custom bbox area and toasts", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /queue this area/i }));
    expect(h.store.queueArea).toHaveBeenCalledWith(
      expect.objectContaining({ label: "My hunt area", maxZoom: 14, basemap: "usgsTopo" }),
    );
    expect(h.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/web preview/i) }),
    );
  });

  it("toggles the map picker open under Suspense", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByTestId("aoi-picker-map")).toBeNull();
    await user.click(screen.getByRole("button", { name: /draw area on map/i }));
    expect(await screen.findByTestId("aoi-picker-map")).toBeTruthy();
  });

  it("renders staged areas with start + remove actions", async () => {
    h.store = baseStore({ areas: [area({ label: "Gallatin range" })] });
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole("heading", { name: /staged areas/i })).toBeTruthy();
    const row = screen.getByText("Gallatin range").closest("li") as HTMLElement;

    await user.click(within(row).getByRole("button", { name: /^start$/i }));
    expect(h.store.startDownload).toHaveBeenCalledTimes(1);

    await user.click(within(row).getByRole("button", { name: /remove gallatin range/i }));
    expect(h.store.removeArea).toHaveBeenCalledWith("area-1");
  });

  it("labels the start action Retry for a previously-failed area", () => {
    h.store = baseStore({ areas: [area({ status: "failed", label: "Failed area" })] });
    renderPage();
    const row = screen.getByText("Failed area").closest("li") as HTMLElement;
    expect(within(row).getByRole("button", { name: /retry/i })).toBeTruthy();
  });
});
