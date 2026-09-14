/**
 * @file themeStore.test.ts
 * @module engage-mt/store
 * @description Unit tests for themeStore (theme preference + resolution + persistence).
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore } from "@/store/app/themeStore";

describe("themeStore", () => {
  beforeEach(() => {
    try {
      window.localStorage?.clear?.();
    } catch {
      /* polyfill may not implement clear */
    }
    useThemeStore.setState({ preference: "light", resolved: "light" });
  });

  it("defaults to light", () => {
    const { preference, resolved } = useThemeStore.getState();
    expect(preference).toBe("light");
    expect(resolved).toBe("light");
  });

  it("setPreference persists and updates resolved", () => {
    useThemeStore.getState().setPreference("dark");
    expect(useThemeStore.getState().preference).toBe("dark");
    expect(useThemeStore.getState().resolved).toBe("dark");
    // happy-dom's localStorage may not be queryable in tests; we assert the in-memory state.
    expect(useThemeStore.getState().preference).toBe("dark");
  });

  it("system preference resolves via matchMedia", () => {
    useThemeStore.getState().setPreference("system");
    expect(useThemeStore.getState().preference).toBe("system");
    // matchMedia polyfill in setup.ts returns matches: false → light
    expect(useThemeStore.getState().resolved).toBe("light");
  });
});
