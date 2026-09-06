/**
 * @file capacitorPreferencesStorage.test.ts
 * @module engage-mt/store
 * @description Regression tests for the Zustand StateStorage adapter, guarding
 *              MOB-D1: resolving a promise WITH the @capacitor/preferences plugin
 *              proxy made the proxy look thenable, so the unwrap called
 *              `Preferences.then()` → "not implemented on android". The fix caches
 *              the module namespace and destructures Preferences synchronously.
 *              The `then`-that-throws mock below reproduces the exact footgun: if
 *              the adapter ever awaits the bare proxy again, `then` fires and the
 *              test fails.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/capacitor", () => ({ isCapacitor: vi.fn() }));

// A Preferences stand-in that mimics the Capacitor plugin proxy: accessing
// `.then` yields a function (so the object looks thenable), and CALLING it
// throws — exactly what the native bridge does with an unknown method. If the
// adapter resolves a promise with this object, the unwrap invokes `then` and
// this throws, failing the test — the MOB-D1 guard.
const store = new Map<string, string>();
const thenTrap = vi.fn(() => {
  throw new Error('"Preferences.then()" is not implemented on android');
});
const Preferences = {
  get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
  set: vi.fn(async ({ key, value }: { key: string; value: string }) => void store.set(key, value)),
  remove: vi.fn(async ({ key }: { key: string }) => void store.delete(key)),
  get then() {
    return thenTrap;
  },
};

vi.mock("@capacitor/preferences", () => ({ Preferences }));

import { isCapacitor } from "@/utils/capacitor";
import { platformStorage } from "./capacitorPreferencesStorage";

describe("capacitorPreferencesStorage", () => {
  beforeEach(() => {
    store.clear();
    thenTrap.mockClear();
    Preferences.get.mockClear();
    Preferences.set.mockClear();
    Preferences.remove.mockClear();
    window.localStorage.clear();
    vi.mocked(isCapacitor).mockReturnValue(true);
  });

  it("round-trips set → get → remove via the Preferences plugin without tripping the proxy `then`", async () => {
    const s = platformStorage();
    await s.setItem("k", "v");
    expect(Preferences.set).toHaveBeenCalledWith({ key: "k", value: "v" });
    await expect(s.getItem("k")).resolves.toBe("v");
    await s.removeItem("k");
    await expect(s.getItem("k")).resolves.toBeNull();
    // The core assertion: the plugin proxy's `then` was NEVER invoked.
    expect(thenTrap).not.toHaveBeenCalled();
  });

  it("returns null (never throws) when the plugin read fails", async () => {
    Preferences.get.mockRejectedValueOnce(new Error("boom"));
    const s = platformStorage();
    await expect(s.getItem("missing")).resolves.toBeNull();
  });

  it("uses localStorage on the web path (isCapacitor false)", async () => {
    vi.mocked(isCapacitor).mockReturnValue(false);
    const s = platformStorage();
    await s.setItem("web", "1");
    expect(window.localStorage.getItem("web")).toBe("1");
    expect(Preferences.set).not.toHaveBeenCalled();
  });
});
