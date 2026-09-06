/**
 * @file FeatureCardShell.test.tsx
 * @module engage-mt/map/featureCards
 * @description Unit tests for the shared FeatureCard chrome. Covers the
 *              header (module badge + title + metadata strip + optional
 *              subtitle), the default action row forks (detail-route,
 *              cross-module "Switch to", Expand in panel vs Close in
 *              takeover), the Expand → takeoverPopupStore wiring (only when
 *              rendererProps are supplied), the takeover-only chart slot,
 *              the tab strip gated to takeover + WAI-ARIA tab selection,
 *              the multi-feature compact action collapse, and the caller
 *              `actions` override. `useNavigate` is mocked at the
 *              react-router seam; the takeover store is the real Zustand
 *              store, reset per test.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

import { FeatureCardShell } from "@/components/map/featureCards/core/FeatureCardShell";
import { useTakeoverPopupStore } from "@/store/map/takeoverPopupStore";
import type {
  FeatureRendererProps,
  FeatureRendererTab,
} from "@/components/map/featureCards/core/types";

const baseProps = {
  module: "fish" as const,
  title: "Madison River",
  layerId: "fishing-access-sites",
  layerTitle: "Fishing Access Sites",
  attrs: { NAME: "Lone Pine" } as Record<string, unknown>,
  body: <p>body-content</p>,
};

const rendererProps: FeatureRendererProps = {
  attrs: baseProps.attrs,
  layerId: baseProps.layerId,
  layerTitle: baseProps.layerTitle,
  module: "fish",
};

const renderShell = (props: Parameters<typeof FeatureCardShell>[0]) =>
  render(
    <MemoryRouter>
      <FeatureCardShell {...props} />
    </MemoryRouter>,
  );

beforeEach(() => {
  navigate.mockReset();
  useTakeoverPopupStore.setState({ open: false, layerId: null, layerTitle: null, attrs: null });
});

describe("FeatureCardShell — header", () => {
  it("renders the title + subtitle-only meta strip (no badge, no layer, no freshness)", () => {
    const { container, getByText } = renderShell({ ...baseProps, subtitle: "boat ramp" });
    expect(getByText("Madison River")).toBeTruthy();
    // The module badge chip, the layer title, and the freshness
    // chip were all removed from the popup header; the meta strip is now just
    // the renderer's subtitle.
    expect(container.querySelector(".feature-card__badge")).toBeNull();
    expect(container.querySelector(".feature-card__meta-layer")).toBeNull();
    expect(container.querySelector(".feature-card__meta-sub")?.textContent).toBe("boat ramp");
  });

  it("omits the subtitle metadata cell when no subtitle is given", () => {
    const { container } = renderShell(baseProps);
    expect(container.querySelector(".feature-card__meta-sub")).toBeNull();
  });

  it("tags the article with the module data attribute + presentation class", () => {
    const { container } = renderShell(baseProps);
    const article = container.querySelector(".feature-card");
    expect(article?.getAttribute("data-module")).toBe("fish");
    expect(article?.className).toMatch(/feature-card--panel/);
  });
});

describe("FeatureCardShell — default actions (panel)", () => {
  it("renders Open detail + Expand, and navigates on Open detail", () => {
    const { getByText } = renderShell({ ...baseProps, detailRoute: "/explore/fas/17" });
    const detail = getByText("Open detail");
    expect(detail).toBeTruthy();
    expect(getByText("Expand")).toBeTruthy();
    fireEvent.click(detail);
    expect(navigate).toHaveBeenCalledWith("/explore/fas/17");
  });

  it("omits Open detail when there is no detailRoute", () => {
    const { queryByText } = renderShell(baseProps);
    expect(queryByText("Open detail")).toBeNull();
  });

  it("never shows a cross-tab 'Switch to' button (removed)", () => {
    const { queryByText } = renderShell(baseProps);
    expect(queryByText(/Switch to/)).toBeNull();
  });
});

describe("FeatureCardShell — Expand → takeover store", () => {
  it("opens the takeover with the renderer's attrs when Expand is clicked", () => {
    const { getByText } = renderShell({ ...baseProps, rendererProps });
    fireEvent.click(getByText("Expand"));
    const s = useTakeoverPopupStore.getState();
    expect(s.open).toBe(true);
    expect(s.layerId).toBe("fishing-access-sites");
    expect(s.attrs).toEqual(baseProps.attrs);
  });

  it("no-ops Expand when rendererProps are absent (nothing to escalate)", () => {
    const { getByText } = renderShell(baseProps);
    fireEvent.click(getByText("Expand"));
    expect(useTakeoverPopupStore.getState().open).toBe(false);
  });
});

describe("FeatureCardShell — takeover presentation", () => {
  it("renders the chart slot only in takeover and swaps Expand for Close", () => {
    const { container, getByText, queryByText } = renderShell({
      ...baseProps,
      presentation: "takeover",
      chart: <svg data-testid="chart" />,
    });
    expect(container.querySelector(".feature-card__chart svg")).not.toBeNull();
    expect(getByText("Close")).toBeTruthy();
    expect(queryByText("Expand")).toBeNull();
  });

  it("does not render the chart slot in the panel preset", () => {
    const { container } = renderShell({ ...baseProps, chart: <svg data-testid="chart" /> });
    expect(container.querySelector(".feature-card__chart")).toBeNull();
  });
});

describe("FeatureCardShell — tabs", () => {
  const tabs: readonly FeatureRendererTab[] = [
    { id: "overview", label: "Overview", Body: () => <p>tab-overview</p> },
    { id: "history", label: "History", Body: () => <p>tab-history</p> },
  ];

  it("renders the tab strip + first tab body in takeover, ignoring the base body", () => {
    const { container, getByText, queryByText } = renderShell({
      ...baseProps,
      presentation: "takeover",
      tabs,
      rendererProps,
    });
    expect(container.querySelector("[role=tablist]")).not.toBeNull();
    expect(getByText("tab-overview")).toBeTruthy();
    expect(queryByText("body-content")).toBeNull();
  });

  it("switches the routed body when another tab is selected", () => {
    const { getByRole, getByText } = renderShell({
      ...baseProps,
      presentation: "takeover",
      tabs,
      rendererProps,
    });
    fireEvent.click(getByRole("tab", { name: "History" }));
    expect(getByText("tab-history")).toBeTruthy();
  });

  it("ignores tabs entirely in the panel preset (renders the base body)", () => {
    const { container, getByText } = renderShell({ ...baseProps, tabs, rendererProps });
    expect(container.querySelector("[role=tablist]")).toBeNull();
    expect(getByText("body-content")).toBeTruthy();
  });
});

describe("FeatureCardShell — multi-feature + overrides", () => {
  it("collapses the action row to a single Expand in multi-feature mode", () => {
    const { getByText, queryByText, container } = renderShell({
      ...baseProps,
      detailRoute: "/explore/fas/17",
      multiFeature: true,
      rendererProps,
    });
    expect(getByText("Expand")).toBeTruthy();
    expect(queryByText("Open detail")).toBeNull();
    expect(container.querySelector(".feature-card")?.getAttribute("data-multi-feature")).toBe(
      "true",
    );
  });

  it("renders a caller-supplied actions node instead of the defaults", () => {
    const { getByText, queryByText } = renderShell({
      ...baseProps,
      detailRoute: "/explore/fas/17",
      actions: <button type="button">custom-action</button>,
    });
    expect(getByText("custom-action")).toBeTruthy();
    expect(queryByText("Open detail")).toBeNull();
  });

  it("renders the enrichment slot when provided", () => {
    const { container } = renderShell({
      ...baseProps,
      enrichment: <div data-testid="enrich">nearby-access</div>,
    });
    expect(container.querySelector(".feature-card__enrichment")?.textContent).toBe("nearby-access");
  });
});
