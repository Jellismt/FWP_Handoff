/**
 * @file useTheme.test.ts
 * @module engage-mt/hooks
 * @description Covers the useTheme DOM-sync hook: it mirrors
 *              the resolved theme onto <html> (data-color-scheme + colorScheme),
 *              toggles the Calcite mode classes, and swaps the ArcGIS theme
 *              stylesheet href, and exposes preference/resolved/setPreference.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-13
 * @updated 2026-06-13
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTheme } from "./useTheme";

beforeEach(() => {
  // ArcGIS theme swap targets this link if present.
  const link = document.createElement("link");
  link.id = "arcgis-theme";
  document.head.appendChild(link);
});

afterEach(() => {
  document.getElementById("arcgis-theme")?.remove();
  // Reset to the app default so tests don't bleed.
  const { result } = renderHook(() => useTheme());
  act(() => result.current.setPreference("light"));
});

describe("useTheme", () => {
  it("reflects an explicit dark preference onto <html> + Calcite + ArcGIS", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference("dark"));

    expect(result.current.preference).toBe("dark");
    expect(result.current.resolved).toBe("dark");
    const root = document.documentElement;
    expect(root.getAttribute("data-color-scheme")).toBe("dark");
    expect(root.classList.contains("calcite-mode-dark")).toBe(true);
    expect(root.classList.contains("calcite-mode-light")).toBe(false);
    const link = document.getElementById("arcgis-theme") as HTMLLinkElement;
    expect(link.href).toContain("/dark/main.css");
  });

  it("swaps back to light", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference("dark"));
    act(() => result.current.setPreference("light"));

    expect(result.current.resolved).toBe("light");
    const root = document.documentElement;
    expect(root.getAttribute("data-color-scheme")).toBe("light");
    expect(root.classList.contains("calcite-mode-light")).toBe(true);
    expect((document.getElementById("arcgis-theme") as HTMLLinkElement).href).toContain(
      "/light/main.css",
    );
  });

  it("exposes a stable setter", () => {
    const { result } = renderHook(() => useTheme());
    expect(typeof result.current.setPreference).toBe("function");
  });
});
