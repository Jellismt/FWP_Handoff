/**
 * @file TapQueryPanel.test.tsx
 * @module engage-mt/map
 * @description Unit tests for the tap-to-query result surface — the core map
 *              interaction. The FeatureCard renderer, the focus-trap
 *              hook, and the three stores/hooks it reads are mocked at the import
 *              seam so the tests drive the panel's own behavior: renders nothing
 *              when inactive or resultless, shows the empty-tap notice for a
 *              zero-hit tap, renders one FeatureCard per feature for single- and
 *              multi-layer taps, escalates a single takeover-presentation feature
 *              to the takeover portal (and closes the panel), collapses
 *              duplicate-at-tap siblings to one card, surfaces the
 *              layers-couldn't-respond failure notice, and dismisses via the
 *              close button.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-07
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Calcite web components don't register in happy-dom — render children only.
vi.mock("@esri/calcite-components-react", () => ({
  CalciteNotice: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const mocks = vi.hoisted(() => ({
  openTakeover: vi.fn(),
  navigate: vi.fn(),
  resolveFeature: vi.fn((_id: string) => null as unknown),
  failures: [] as Array<{ layerTitle: string }>,
}));

vi.mock("@/store/map/takeoverPopupStore", () => ({
  useTakeoverPopupStore: (sel: (s: { openFeature: unknown }) => unknown) =>
    sel({ openFeature: mocks.openTakeover }),
}));
vi.mock("@/store/map/tapQueryFailureStore", () => ({
  useTapQueryFailureStore: (sel: (s: unknown) => unknown) => sel({}),
  selectFailureList: () => mocks.failures,
}));
vi.mock("@/hooks/useFocusTrap", () => ({ useFocusTrap: vi.fn() }));
vi.mock("@/components/map/featureCards/core/registry", () => ({
  resolveFeature: (id: string) => mocks.resolveFeature(id),
}));
vi.mock("@/components/map/featureCards", () => ({
  FeatureCard: (props: { layerId: string; multiFeature?: boolean; siblingCount?: number }) => (
    <div
      data-testid="feature-card"
      data-layer={props.layerId}
      data-multi={String(props.multiFeature)}
      data-siblings={String(props.siblingCount)}
    />
  ),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
}));

import { TapQueryPanel, type TapQueryResult, type TapQueryMore } from "./TapQueryPanel";

const group = (layerId: string, featureCount: number): TapQueryResult => ({
  layerId,
  layerTitle: `${layerId} title`,
  module: "fish",
  features: Array.from({ length: featureCount }, (_, i) => ({ id: `${layerId}-${i}` })),
});

const moreOf = (candidateIds: string[], run: TapQueryMore["run"]): TapQueryMore => ({
  candidates: candidateIds.map((id) => ({
    layerId: id,
    layerTitle: `${id} title`,
    module: "hunt",
  })),
  run,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveFeature.mockReturnValue(null);
  mocks.failures = [];
});

describe("TapQueryPanel — visibility", () => {
  it("renders nothing when inactive", () => {
    const { container } = render(
      <TapQueryPanel results={[group("fas", 1)]} onClose={vi.fn()} active={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when results is null", () => {
    const { container } = render(<TapQueryPanel results={null} onClose={vi.fn()} active />);
    expect(container.firstChild).toBeNull();
  });
});

describe("TapQueryPanel — empty tap", () => {
  it("shows the empty-tap notice for a zero-hit result set", () => {
    render(<TapQueryPanel results={[]} onClose={vi.fn()} active />);
    expect(screen.getByText("No features here")).toBeTruthy();
    expect(screen.getByText(/No visible layer reported a hit/i)).toBeTruthy();
    expect(screen.queryByTestId("feature-card")).toBeNull();
  });
});

describe("TapQueryPanel — service failure on an empty tap", () => {
  it("says the spot could not be checked instead of claiming it is empty", () => {
    mocks.failures = [{ layerTitle: "Land ownership" }];
    render(<TapQueryPanel results={[]} onClose={vi.fn()} active />);
    expect(screen.getByText("Couldn't check this spot")).toBeTruthy();
    expect(screen.queryByText("No features here")).toBeNull();
    mocks.failures = [];
  });
});

describe("TapQueryPanel — feature rendering", () => {
  it("renders one FeatureCard for a single-feature single-layer tap (panel presentation)", () => {
    render(<TapQueryPanel results={[group("fas", 1)]} onClose={vi.fn()} active />);
    const cards = screen.getAllByTestId("feature-card");
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute("data-multi")).toBe("false");
    expect(screen.getByText("What's here")).toBeTruthy();
  });

  it("renders a card per feature and marks them multiFeature when total > 1", () => {
    render(<TapQueryPanel results={[group("fas", 2), group("bma", 1)]} onClose={vi.fn()} active />);
    const cards = screen.getAllByTestId("feature-card");
    expect(cards).toHaveLength(3);
    expect(cards.every((c) => c.getAttribute("data-multi") === "true")).toBe(true);
    expect(screen.getByText(/3 features across 2 layers/)).toBeTruthy();
  });

  it("collapses duplicate-at-tap siblings to a single card carrying the sibling count", () => {
    mocks.resolveFeature.mockImplementation((id: string) =>
      id === "surveys" ? { collapseDuplicatesAtTap: true } : null,
    );
    render(<TapQueryPanel results={[group("surveys", 4)]} onClose={vi.fn()} active />);
    const cards = screen.getAllByTestId("feature-card");
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute("data-siblings")).toBe("4");
  });
});

describe("TapQueryPanel — no auto-escalation", () => {
  // Every tap stays in this panel (right rail on desktop,
  // full-screen sheet on phones). Renderers never auto-jump to the
  // centred takeover dialog; Expand is the only route to it.
  it("keeps a single feature in the panel instead of opening the takeover portal", () => {
    mocks.resolveFeature.mockReturnValue({ presentation: "takeover" });
    const onClose = vi.fn();
    render(
      <TapQueryPanel
        results={[group("reservoir", 1)]}
        onClose={onClose}
        active
        tapPoint={{ x: 1, y: 2, latitude: 46, longitude: -111 }}
      />,
    );
    expect(mocks.openTakeover).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getAllByTestId("feature-card")).toHaveLength(1);
  });

  it("does NOT escalate a multi-feature tap either", () => {
    mocks.resolveFeature.mockReturnValue({ presentation: "takeover" });
    render(<TapQueryPanel results={[group("reservoir", 2)]} onClose={vi.fn()} active />);
    expect(mocks.openTakeover).not.toHaveBeenCalled();
  });
});

describe("TapQueryPanel — tapRoute navigation", () => {
  it("navigates to the district report and closes when a tapRoute renderer is hit", () => {
    mocks.resolveFeature.mockReturnValue({ tapRoute: () => "/hunt/district/380" });
    const onClose = vi.fn();
    render(<TapQueryPanel results={[group("hunting-districts", 1)]} onClose={onClose} active />);
    expect(mocks.navigate).toHaveBeenCalledWith("/hunt/district/380");
    expect(onClose).toHaveBeenCalled();
  });

  it("still navigates when the district tap also hit other layers underneath", () => {
    // Public Lands / cadastral sit under nearly every district tap.
    mocks.resolveFeature.mockImplementation((id: string) =>
      id === "hunting-districts" ? { tapRoute: () => "/hunt/district/380" } : {},
    );
    const onClose = vi.fn();
    render(
      <TapQueryPanel
        results={[group("public-land-ownership", 1), group("hunting-districts", 1)]}
        onClose={onClose}
        active
      />,
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/hunt/district/380");
  });

  it("does not navigate for layers without a tapRoute", () => {
    mocks.resolveFeature.mockReturnValue({});
    render(<TapQueryPanel results={[group("fas", 1)]} onClose={vi.fn()} active />);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});

describe("TapQueryPanel — failure notice", () => {
  it("surfaces a layers-couldn't-respond notice when the failure store has entries", () => {
    mocks.failures = [{ layerTitle: "Cadastral" }, { layerTitle: "BLM" }];
    render(<TapQueryPanel results={[group("fas", 1)]} onClose={vi.fn()} active />);
    expect(screen.getByText("2 layers couldn't respond")).toBeTruthy();
    expect(screen.getByText(/Cadastral, BLM/)).toBeTruthy();
  });
});

describe("TapQueryPanel — dismissal", () => {
  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<TapQueryPanel results={[group("fas", 1)]} onClose={onClose} active />);
    fireEvent.click(screen.getByLabelText("Close popup"));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("TapQueryPanel — responsive rail vs modal", () => {
  const stubMatchMedia = (matches: boolean): void => {
    window.matchMedia = ((query: string) => ({
      matches,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  };

  it("mobile (<768px): renders a modal dialog WITH a dismiss backdrop", () => {
    stubMatchMedia(false);
    const { container } = render(
      <TapQueryPanel results={[group("fas", 1)]} onClose={vi.fn()} active />,
    );
    const shell = container.querySelector(".tap-query-shell")!;
    expect(shell.getAttribute("role")).toBe("dialog");
    expect(shell.getAttribute("aria-modal")).toBe("true");
    expect(container.querySelector(".tap-query-shell__backdrop")).not.toBeNull();
  });

  it("desktop/tablet (>=768px): docks as a non-modal rail with NO backdrop", () => {
    stubMatchMedia(true);
    const { container } = render(
      <TapQueryPanel results={[group("fas", 1)]} onClose={vi.fn()} active />,
    );
    const shell = container.querySelector(".tap-query-shell")!;
    expect(shell.classList.contains("tap-query-shell--rail")).toBe(true);
    expect(shell.getAttribute("role")).toBe("complementary");
    expect(shell.getAttribute("aria-modal")).toBeNull();
    // No backdrop → the map stays visible + interactive beside the rail.
    expect(container.querySelector(".tap-query-shell__backdrop")).toBeNull();
  });

  it("rail mode: Escape still closes the panel", () => {
    stubMatchMedia(true);
    const onClose = vi.fn();
    render(<TapQueryPanel results={[group("fas", 1)]} onClose={onClose} active />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("TapQueryPanel — N more features here", () => {
  it("shows the affordance when there are more candidates", () => {
    const more = moreOf(["hunting-districts", "wmas"], vi.fn().mockResolvedValue([]));
    render(<TapQueryPanel results={[group("wmas", 1)]} onClose={vi.fn()} active more={more} />);
    expect(screen.getByText(/2 more features here/i)).toBeTruthy();
  });

  it("keeps a takeover single feature in-panel (does not escalate) when candidates exist", () => {
    mocks.resolveFeature.mockReturnValue({ presentation: "takeover" });
    const more = moreOf(["hunting-districts"], vi.fn().mockResolvedValue([]));
    render(<TapQueryPanel results={[group("wmas", 1)]} onClose={vi.fn()} active more={more} />);
    // Kept in-panel: the takeover portal is NOT opened, and the card renders
    // compact (multiFeature) so it isn't an inline takeover monster.
    expect(mocks.openTakeover).not.toHaveBeenCalled();
    expect(screen.getByTestId("feature-card").getAttribute("data-multi")).toBe("true");
  });

  it("queries and appends the other layers when tapped", async () => {
    const run = vi.fn().mockResolvedValue([group("hunting-districts", 1)]);
    const more = moreOf(["hunting-districts"], run);
    render(<TapQueryPanel results={[group("wmas", 1)]} onClose={vi.fn()} active more={more} />);
    fireEvent.click(screen.getByText(/1 more feature here/i));
    expect(run).toHaveBeenCalledTimes(1);
    // Both the original WMA card and the appended HD card are present.
    await waitFor(() => expect(screen.getAllByTestId("feature-card")).toHaveLength(2));
    const cards = screen.getAllByTestId("feature-card");
    expect(cards.some((c) => c.getAttribute("data-layer") === "hunting-districts")).toBe(true);
  });

  it("shows the empty message when no other features are found at the exact spot", async () => {
    const run = vi.fn().mockResolvedValue([]);
    const more = moreOf(["hunting-districts"], run);
    render(<TapQueryPanel results={[group("wmas", 1)]} onClose={vi.fn()} active more={more} />);
    fireEvent.click(screen.getByText(/1 more feature here/i));
    expect(await screen.findByText(/No other features at this exact spot/i)).toBeTruthy();
  });

  it("does not show the affordance with no candidates", () => {
    render(<TapQueryPanel results={[group("fas", 1)]} onClose={vi.fn()} active more={null} />);
    expect(screen.queryByText(/more feature/i)).toBeNull();
  });
});
