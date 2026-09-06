/**
 * @file nativeChrome.test.ts
 * @module engage-mt/services/mobile
 * @description Unit tests for the native window-chrome control (status bar +
 *              launch splash). Mocks @capacitor/status-bar and
 *              @capacitor/splash-screen at the import seam to verify: no-op on
 *              web, the FWP-blue / light-glyph / no-overlay status-bar setup on
 *              native, splash hide with the fade duration, and — critically —
 *              that a plugin error resolves quietly (a chrome failure must never
 *              crash boot).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isCapacitor: vi.fn(() => true),
  getPlatform: vi.fn(() => "android" as "ios" | "android" | "web"),
  setStyle: vi.fn(async () => undefined),
  setOverlaysWebView: vi.fn(async () => undefined),
  hide: vi.fn(async () => undefined),
}));

vi.mock("@/utils/capacitor", () => ({
  isCapacitor: h.isCapacitor,
  getPlatform: h.getPlatform,
}));
vi.mock("@/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@capacitor/status-bar", () => ({
  StatusBar: {
    setStyle: h.setStyle,
    setOverlaysWebView: h.setOverlaysWebView,
  },
  Style: { Dark: "DARK", Light: "LIGHT" },
}));
vi.mock("@capacitor/splash-screen", () => ({
  SplashScreen: { hide: h.hide },
}));

import { initNativeChrome, hideSplash } from "./nativeChrome";

beforeEach(() => {
  vi.clearAllMocks();
  h.isCapacitor.mockReturnValue(true);
});

describe("initNativeChrome", () => {
  it("is a no-op on web", async () => {
    h.isCapacitor.mockReturnValue(false);
    await initNativeChrome();
    expect(h.setOverlaysWebView).not.toHaveBeenCalled();
  });

  it("keeps the WebView below the status bar (no overlay) so content never clips", async () => {
    h.getPlatform.mockReturnValue("android");
    await initNativeChrome();
    expect(h.setOverlaysWebView).toHaveBeenCalledWith({ overlay: false });
  });

  it("Android: leaves the system status-bar glyphs to the device (no override)", async () => {
    h.getPlatform.mockReturnValue("android");
    await initNativeChrome();
    expect(h.setStyle).not.toHaveBeenCalled();
  });

  it("iOS: sets light glyphs (Style.Dark) once for the fixed blue strip", async () => {
    h.getPlatform.mockReturnValue("ios");
    await initNativeChrome();
    expect(h.setOverlaysWebView).toHaveBeenCalledWith({ overlay: false });
    expect(h.setStyle).toHaveBeenCalledWith({ style: "DARK" });
  });

  it("resolves quietly when the status-bar plugin throws (boot must not crash)", async () => {
    h.setOverlaysWebView.mockRejectedValueOnce(new Error("no status bar on this device"));
    await expect(initNativeChrome()).resolves.toBeUndefined();
  });
});

describe("hideSplash", () => {
  it("is a no-op on web", async () => {
    h.isCapacitor.mockReturnValue(false);
    await hideSplash();
    expect(h.hide).not.toHaveBeenCalled();
  });

  it("hides the splash with a fade-out on native", async () => {
    await hideSplash();
    expect(h.hide).toHaveBeenCalledWith({ fadeOutDuration: 200 });
  });

  it("resolves quietly when the splash plugin throws", async () => {
    h.hide.mockRejectedValueOnce(new Error("already hidden"));
    await expect(hideSplash()).resolves.toBeUndefined();
  });
});
