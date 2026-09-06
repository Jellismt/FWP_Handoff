/**
 * @file MapToolRail.test.tsx
 * @module engage-mt/map
 * @description Regression guards for the clustered map tool rail. Two
 *              things must hold: (1) the web-vs-mobile field-tool split — the
 *              Capture cluster and the Drop-waypoint tool appear ONLY in the
 *              Capacitor app (field capture), never on the web planning surface;
 *              (2) the record-track behavior survived the move into the Capture
 *              cluster — an idle tap starts a recording, and a second tap while
 *              live does NOT stop it (the on-map HUD owns stop, so the rail can
 *              never lose a track by accident). Plus a cluster-popover a11y smoke.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expectNoAxeViolations } from "@/test/axeSmoke";
import { useTrackRecorderStore } from "@/services/field/trackRecorder";

// Mock the capability predicates so we can flip the platform per test. isCapacitor
// and everything else stay real.
const gate = vi.hoisted(() => ({ capture: false }));
vi.mock("@/utils/capacitor", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/capacitor")>();
  return {
    ...actual,
    // GPS capture (track recording) + offline downloads are the
    // mobile-only gates now; waypoint dropping is ungated.
    supportsGpsCapture: () => gate.capture,
    supportsOfflineDownload: () => gate.capture,
  };
});

// Imported after the mock is registered.
const { MapToolRail } = await import("./MapToolRail");

const renderRail = (): void => {
  render(
    <MemoryRouter>
      <MapToolRail />
    </MemoryRouter>,
  );
};

// Minimal geolocation stub so recorder start()'s watchPosition doesn't fall into
// the "device can't record" error path (which would flip us to paused).
const installGeoStub = (): void => {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition: () => 1,
      clearWatch: () => undefined,
      getCurrentPosition: () => undefined,
    },
  });
};

describe("MapToolRail — web planning surface", () => {
  beforeEach(() => {
    gate.capture = false;
    useTrackRecorderStore.getState().discard();
  });

  it("shows Markup + Measure clusters but NOT the Capture cluster (GPS/offline mobile-only)", () => {
    renderRail();
    expect(screen.getByRole("button", { name: "Markup tools" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Measure tools" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Capture tools" })).not.toBeInTheDocument();
  });

  it("INCLUDES Drop-waypoint in the Markup cluster on web", () => {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Markup tools" }));
    // Tool-arming rows are menuitemradio; one-shot actions are menuitem.
    expect(screen.getByRole("menuitemradio", { name: /Draw a shape/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Enter coordinates/ })).toBeInTheDocument();
    // Waypoint dropping is available on the web — it is a planning tool.
    expect(screen.getByRole("menuitemradio", { name: /Drop a waypoint/ })).toBeInTheDocument();
  });
});

describe("MapToolRail — mobile field app", () => {
  beforeEach(() => {
    installGeoStub();
    gate.capture = true;
    useTrackRecorderStore.getState().discard();
  });

  it("exposes the Capture cluster and Drop-waypoint tool", () => {
    renderRail();
    expect(screen.getByRole("button", { name: "Capture tools" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Markup tools" }));
    expect(screen.getByRole("menuitemradio", { name: /Drop a waypoint/ })).toBeInTheDocument();
  });

  it("Record: an idle tap starts a recording; a second tap while live does not stop it", () => {
    renderRail();
    // Open Capture, start recording.
    fireEvent.click(screen.getByRole("button", { name: "Capture tools" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Record a track/ }));
    expect(useTrackRecorderStore.getState().status).toBe("recording");

    // Reopen Capture — the row now reads "Recording a track"; tapping is a no-op.
    fireEvent.click(screen.getByRole("button", { name: "Capture tools" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Recording a track/ }));
    expect(useTrackRecorderStore.getState().status).toBe("recording");
  });
});

describe("MapToolRail — cluster popover a11y", () => {
  beforeEach(() => {
    gate.capture = false;
  });

  it("trigger toggles aria-expanded and Esc closes the menu", () => {
    renderRail();
    const trigger = screen.getByRole("button", { name: "Measure tools" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "Measure tools" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("an open cluster menu is axe-clean", async () => {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Markup tools" }));
    // The menu is portaled to <body>, so axe the whole document body.
    await expectNoAxeViolations(document.body);
  });
});

describe("MapToolRail — keyboard", () => {
  beforeEach(() => {
    gate.capture = false;
    useTrackRecorderStore.getState().discard();
  });

  it("is a single Tab stop and arrows move focus between pills", () => {
    renderRail();
    const rail = screen.getByRole("toolbar", { name: "Map tools" });
    const pills = Array.from(rail.querySelectorAll<HTMLButtonElement>("button"));
    expect(pills.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    pills[0].focus();
    fireEvent.keyDown(pills[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(pills[1]);
    expect(pills[1].tabIndex).toBe(0);
    expect(pills[0].tabIndex).toBe(-1);
  });

  it("Escape closes an open cluster and returns focus to its trigger", () => {
    renderRail();
    const trigger = screen.getByRole("button", { name: "Markup tools" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("menu", { name: "Markup tools" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Markup tools" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
