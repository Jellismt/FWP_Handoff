/**
 * @file BasemapPicker.test.tsx
 * @module engage-mt/map
 * @description — covers the basemap picker's behavior + a11y contract:
 *              the trigger reflects the active basemap, opening reveals a
 *              `radiogroup` of all three options with the active one checked,
 *              selecting an option updates the store and closes the popover,
 *              and Escape closes without changing the basemap. Guards the
 *              discoverability upgrade from the old blind toggle.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BasemapPicker } from "./BasemapPicker";
import { useMapModeStore } from "@/store/map/mapModeStore";

beforeEach(() => {
  useMapModeStore.setState({ basemap: "satellite" });
});

afterEach(() => cleanup());

describe("BasemapPicker", () => {
  it("trigger reflects the active basemap and is collapsed by default", () => {
    render(<BasemapPicker />);
    const trigger = screen.getByRole("button", { name: /Basemap: Satellite/i });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("opens a radiogroup of all three basemaps with the active one checked", () => {
    render(<BasemapPicker />);
    fireEvent.click(screen.getByRole("button", { name: /Change basemap/i }));

    const group = screen.getByRole("radiogroup", { name: /choose a basemap/i });
    expect(group).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Satellite"),
      expect.stringContaining("Hybrid"),
      expect.stringContaining("Topographic"),
    ]);
    expect(screen.getByRole("radio", { name: /Satellite/i }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("selecting an option updates the store and closes the popover", () => {
    render(<BasemapPicker />);
    fireEvent.click(screen.getByRole("button", { name: /Change basemap/i }));
    fireEvent.click(screen.getByRole("radio", { name: /Topographic/i }));

    expect(useMapModeStore.getState().basemap).toBe("topo-vector");
    expect(screen.queryByRole("radiogroup")).toBeNull();
    // Trigger label now reflects the new choice.
    expect(screen.getByRole("button", { name: /Basemap: Topographic/i })).toBeTruthy();
  });

  it("Escape closes the popover without changing the basemap", () => {
    render(<BasemapPicker />);
    fireEvent.click(screen.getByRole("button", { name: /Change basemap/i }));
    expect(screen.getByRole("radiogroup")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(useMapModeStore.getState().basemap).toBe("satellite");
  });
});
