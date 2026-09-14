/**
 * @file WaypointCard.test.tsx
 * @module engage-mt/map/featureCards
 * @description Behavior coverage for the user-waypoint Tier-2 renderer
 *              (synthetic layer `engage-mt-field-waypoint`). Drives the
 *              registered summary / subtitle / Body / Actions through the
 *              registry against a live `useFieldToolsStore`, exercising the
 *              read view, the removed-waypoint fallback, the DD⇄DMS coord
 *              toggle, the edit form, the conditions-captured block, the
 *              tags / photo / accuracy branches, and the two-step delete.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../index";
import { resolveFeature } from "@/components/map/featureCards/core/registry";
import { fixtureProps } from "@/test/fixtures";
import { useFieldToolsStore, type Waypoint } from "@/store/field/fieldToolsStore";

const LAYER = "engage-mt-field-waypoint";

const mkWaypoint = (over: Partial<Waypoint> = {}): Waypoint => ({
  id: "wp-1",
  kind: "general",
  name: "Elk wallow",
  lat: 45.6789,
  lon: -110.1234,
  createdAt: "2026-06-01T12:00:00.000Z",
  updatedAt: "2026-06-01T12:00:00.000Z",
  photos: [],
  tags: [],
  ...over,
});

/** Seed the store with a single waypoint and clear transient flags. */
const seed = (wp: Waypoint): void => {
  useFieldToolsStore.setState({ waypoints: [wp], lastCreatedId: null });
};

const renderBody = (id: string) => {
  const renderer = resolveFeature(LAYER);
  if (!renderer) throw new Error("WaypointCard not registered");
  const Body = renderer.Body;
  return render(
    <MemoryRouter>
      <Body {...fixtureProps(LAYER, { attrs: { id } })} />
    </MemoryRouter>,
  );
};

const renderActions = (id: string) => {
  const renderer = resolveFeature(LAYER);
  if (!renderer?.Actions) throw new Error("WaypointCard Actions not registered");
  const Actions = renderer.Actions;
  return render(
    <MemoryRouter>
      <Actions {...fixtureProps(LAYER, { attrs: { id } })} />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  useFieldToolsStore.getState().clearAll();
});
afterEach(() => {
  useFieldToolsStore.getState().clearAll();
});

describe("WaypointCard — registry metadata", () => {
  it("summary uses the name, falling back to a default label", () => {
    const r = resolveFeature(LAYER)!;
    expect(r.summary({ name: "Blind #3" })).toBe("Blind #3");
    expect(r.summary({})).toBe("Saved waypoint");
  });

  it("subtitle pairs the kind label with formatted coords", () => {
    const r = resolveFeature(LAYER)!;
    expect(r.subtitle?.({ kind: "kill-site", lat: 45.5, lon: -110.5 })).toMatch(/Kill/i);
    // Coords appear when lat/lon are numeric.
    expect(r.subtitle?.({ kind: "camp", lat: 45.5, lon: -110.5 })).toMatch(/45\.5/);
    // No coords → bare kind label.
    expect(r.subtitle?.({ kind: "camp" })).not.toMatch(/45/);
  });
});

describe("WaypointCard — read view", () => {
  it("renders the removed-waypoint fallback when the id is not in the store", () => {
    seed(mkWaypoint());
    const { container } = renderBody("does-not-exist");
    expect(container.textContent ?? "").toMatch(/was removed/i);
  });

  it("shows the kind label, name, and DD coords (no duplicate saved-date badge)", () => {
    seed(mkWaypoint({ kind: "camp", name: "Base camp" }));
    const { container } = renderBody("wp-1");
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/Base camp/);
    expect(txt).toMatch(/Camp/i);
    // The "Saved <date>" badge duplicated the Edited pill — removed.
    expect(txt).not.toMatch(/Saved /);
    // Decimal-degrees coords rounded to 5 places.
    expect(txt).toMatch(/45\.67890/);
    expect(txt).toMatch(/-110\.12340/);
  });

  it("toggles the coordinate readout between DD and DMS", () => {
    seed(mkWaypoint());
    renderBody("wp-1");
    const toggle = screen.getByRole("button", {
      name: /degrees-minutes-seconds/i,
    });
    // DD initially — a bare decimal string.
    expect(toggle.textContent ?? "").toMatch(/45\.67890/);
    fireEvent.click(toggle);
    // DMS after toggle — contains the degree/minute glyphs.
    const dms = screen.getByRole("button", { name: /decimal degrees/i });
    expect(dms.textContent ?? "").toMatch(/['″]|N|W/);
  });

  it("renders notes, tags, GPS accuracy, and an edited date when present", () => {
    seed(
      mkWaypoint({
        notes: "Fresh sign near the aspen line",
        tags: ["archery", "morning"],
        accuracyAtCapture: 6.4,
        updatedAt: "2026-06-05T12:00:00.000Z",
      }),
    );
    const { container } = renderBody("wp-1");
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/Fresh sign near the aspen line/);
    expect(txt).toMatch(/archery, morning/);
    expect(txt).toMatch(/±6 m/); // rounded accuracy
    expect(txt).toMatch(/Edited/i);
  });

  it("offers no Capture-conditions affordance (weather capture removed)", () => {
    seed(mkWaypoint());
    renderBody("wp-1");
    expect(screen.queryByRole("button", { name: /Capture conditions/i })).not.toBeInTheDocument();
  });
});

describe("WaypointCard — edit flow", () => {
  it("opens the edit form and persists an edited name to the store", () => {
    seed(mkWaypoint({ name: "Old name" }));
    renderBody("wp-1");
    fireEvent.click(screen.getByRole("button", { name: /^Edit$/i }));

    const nameInput = screen.getByDisplayValue("Old name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "New name" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(useFieldToolsStore.getState().waypoints[0].name).toBe("New name");
  });

  it("auto-enters edit mode when the pin was the last long-press create", () => {
    seed(mkWaypoint());
    useFieldToolsStore.setState({ lastCreatedId: "wp-1" });
    renderBody("wp-1");
    // The name input is present only in edit mode.
    expect(screen.getByDisplayValue("Elk wallow")).toBeInTheDocument();
    // lastCreatedId is consumed on mount.
    expect(useFieldToolsStore.getState().lastCreatedId).toBeNull();
  });
});

describe("WaypointCard — Actions", () => {
  it("renders no inline actions when the waypoint is gone (panel X closes)", () => {
    seed(mkWaypoint());
    renderActions("missing-id");
    expect(screen.queryByRole("button", { name: /Close/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Share pin/i })).not.toBeInTheDocument();
  });

  it("arms delete on first tap and removes the waypoint on the confirm tap", () => {
    seed(mkWaypoint());
    const { container } = renderActions("wp-1");
    const deleteBtn = within(container).getByRole("button", { name: /Delete/i });
    fireEvent.click(deleteBtn);
    // First tap arms — copy changes, waypoint still present.
    expect(within(container).getByText(/Tap to confirm/i)).toBeInTheDocument();
    expect(useFieldToolsStore.getState().waypoints).toHaveLength(1);
    // Second tap confirms.
    fireEvent.click(within(container).getByRole("button", { name: /Tap to confirm/i }));
    expect(useFieldToolsStore.getState().waypoints).toHaveLength(0);
  });
});
