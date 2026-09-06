/**
 * @file LayerPanel.test.tsx
 * @module engage-mt/map
 * @description Render + interaction coverage for the layer-toggle panel. Calcite
 *              chrome, the cartographic swatch, and the hover Tooltip are stubbed
 *              to pass-through elements so the assertions target the panel's own
 *              logic: the collapsed pill (mobile default) + expand, module-group
 *              folding, single-layer toggle wiring, the composite cascade
 *              (all-on → all-off and any-off → fill), the visible-count badge,
 *              and the failed-load notice. Uses the REAL LAYER_REGISTRY + REAL
 *              Zustand stores, driving state via getState() rather than mocks.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { LAYER_REGISTRY } from "@/config/layers";
import { useLayerVisibilityStore } from "@/store/map/layerVisibilityStore";
import { useLayerLoadStatusStore } from "@/store/map/layerLoadStatusStore";

// Calcite web components don't render meaningfully in happy-dom; pass-through
// the two used here so we can assert on the slotted content directly.
vi.mock("@esri/calcite-components-react", () => ({
  CalcitePanel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CalciteNotice: ({ children }: { children?: ReactNode }) => <div role="alert">{children}</div>,
}));
// The swatch pulls the ArcGIS symbology/icon registry — stub to a marker.
vi.mock("./symbology/swatch", () => ({
  LayerSwatch: () => <span data-testid="swatch" />,
}));
// Tooltip uses a portal; keep the trigger child inline so the row button is
// still queryable and clickable.
vi.mock("@/components/shared/overlays/Tooltip", () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

import { LayerPanel } from "./LayerPanel";

// A registry entry that toggles a single (non-composite, panel-visible) layer.
const singleDef = LAYER_REGISTRY.find(
  (d) => !d.composite && !d.hiddenFromPanel && !d.deferredLoad && !d.unavailable && !d.subgroup,
);
// A composite parent + its children (the cascade path).
const compositeDef = LAYER_REGISTRY.find((d) => d.composite && !d.hiddenFromPanel);

const resetStores = (): void => {
  // Clear every layer's visibility + failure state to a known baseline.
  const vis: Record<string, boolean> = {};
  for (const d of LAYER_REGISTRY) vis[d.id] = false;
  useLayerVisibilityStore.setState({ visible: vis });
  useLayerLoadStatusStore.setState({ failed: {} });
};

// The panel picks its default collapsed state from matchMedia at mount. Force a
// desktop (expanded) viewport so tests start with the full panel unless a test
// opts into mobile.
const setViewport = (mobile: boolean): void => {
  window.matchMedia = ((query: string) => ({
    matches: mobile && query.includes("max-width"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  resetStores();
  setViewport(false);
});

afterEach(() => {
  cleanup();
});

describe("LayerPanel — collapsed pill", () => {
  it("renders the collapsed pill on a mobile viewport and expands on click", () => {
    setViewport(true);
    render(<LayerPanel />);
    const pill = screen.getByRole("button", { name: /open layer panel/i });
    expect(pill).toBeInTheDocument();
    fireEvent.click(pill);
    // Expanded panel exposes the module group headings.
    expect(screen.getByRole("button", { name: /^Hunt/ })).toBeInTheDocument();
  });

  it("shows the total-visible badge on the collapsed pill", () => {
    if (!singleDef) throw new Error("fixture: expected a single-layer registry entry");
    setViewport(true);
    useLayerVisibilityStore.setState({ visible: { [singleDef.id]: true } });
    render(<LayerPanel />);
    const pill = screen.getByRole("button", { name: /1 layers visible/i });
    expect(within(pill).getByText("1")).toBeInTheDocument();
  });
});

describe("LayerPanel — group folding + rows", () => {
  it("expands a module group to reveal its layer rows", () => {
    render(<LayerPanel />);
    // Groups start folded (aria-expanded=false); click Hunt to unfold it.
    const huntHeading = screen.getByRole("button", { name: /^Hunt/ });
    expect(huntHeading).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(huntHeading);
    expect(huntHeading).toHaveAttribute("aria-expanded", "true");
  });

  it("toggles a single layer's visibility through the store on row click", () => {
    if (!singleDef) throw new Error("fixture: expected a single-layer registry entry");
    render(<LayerPanel />);
    // Unfold the owning module group.
    fireEvent.click(screen.getByRole("button", { name: new RegExp(singleModuleLabel()) }));
    const row = screen.getByRole("button", {
      name: new RegExp(`Show ${escapeRe(singleDef.title)}`),
    });
    act(() => fireEvent.click(row));
    expect(useLayerVisibilityStore.getState().visible[singleDef.id]).toBe(true);
  });
});

describe("LayerPanel — composite cascade", () => {
  it("turns all composite children ON when the parent is toggled from off", () => {
    if (!compositeDef?.composite) throw new Error("fixture: expected a composite registry entry");
    render(<LayerPanel />);
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(moduleLabelFor(compositeDef.module)) }),
    );
    const row = screen.getByRole("button", {
      name: new RegExp(`Show ${escapeRe(compositeDef.title)}`),
    });
    act(() => fireEvent.click(row));
    const vis = useLayerVisibilityStore.getState().visible;
    for (const child of compositeDef.composite) expect(vis[child]).toBe(true);
  });

  it("turns all composite children OFF when every child was already on", () => {
    if (!compositeDef?.composite) throw new Error("fixture: expected a composite registry entry");
    const allOn: Record<string, boolean> = {};
    for (const c of compositeDef.composite) allOn[c] = true;
    useLayerVisibilityStore.setState({ visible: allOn });
    render(<LayerPanel />);
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(moduleLabelFor(compositeDef.module)) }),
    );
    const row = screen.getByRole("button", {
      name: new RegExp(`Hide ${escapeRe(compositeDef.title)}`),
    });
    act(() => fireEvent.click(row));
    const vis = useLayerVisibilityStore.getState().visible;
    for (const child of compositeDef.composite) expect(vis[child]).toBe(false);
  });
});

describe("LayerPanel — failed-load notice", () => {
  it("surfaces the failed-layer notice when a layer reports failure", () => {
    if (!singleDef) throw new Error("fixture: expected a single-layer registry entry");
    useLayerLoadStatusStore.setState({ failed: { [singleDef.id]: true } });
    render(<LayerPanel />);
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn.t load/i);
  });

  it("renders no failed notice when nothing has failed", () => {
    render(<LayerPanel />);
    // The polite live region exists but carries no notice text.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ── helpers ──────────────────────────────────────────────────────────────
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function moduleLabelFor(module: string): string {
  const labels: Record<string, string> = {
    reference: "Reference",
    hunt: "Hunt",
    fish: "Fish",
    explore: "Explore",
    access: "Access",
    manage: "My FWP",
    shared: "Conditions",
  };
  return labels[module] ?? module;
}
function singleModuleLabel(): string {
  return moduleLabelFor(singleDef?.module ?? "hunt");
}
