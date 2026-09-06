/**
 * @file capacitor.test.ts
 * @module engage-mt/utils
 * @description Coverage for the `isCapacitor()` +
 *              `getPlatform()` detection helpers. Mocks the global
 *              Capacitor shape that `@capacitor/core` injects on native.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-10
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isCapacitor, getPlatform } from "./capacitor";

interface MockCap {
  isNativePlatform?: () => boolean;
  getPlatform?: () => "ios" | "android" | "web";
}

describe("isCapacitor / getPlatform", () => {
  const originalCap = (globalThis as unknown as { Capacitor?: MockCap }).Capacitor;

  beforeEach(() => {
    delete (globalThis as unknown as { Capacitor?: MockCap }).Capacitor;
  });

  afterEach(() => {
    if (originalCap === undefined) {
      delete (globalThis as unknown as { Capacitor?: MockCap }).Capacitor;
    } else {
      (globalThis as unknown as { Capacitor?: MockCap }).Capacitor = originalCap;
    }
  });

  it("isCapacitor returns false when no Capacitor global is present", () => {
    expect(isCapacitor()).toBe(false);
  });

  it("isCapacitor returns true when Capacitor.isNativePlatform() returns true", () => {
    (globalThis as unknown as { Capacitor?: MockCap }).Capacitor = {
      isNativePlatform: () => true,
    };
    expect(isCapacitor()).toBe(true);
  });

  it("isCapacitor returns false when Capacitor.isNativePlatform() returns false", () => {
    (globalThis as unknown as { Capacitor?: MockCap }).Capacitor = {
      isNativePlatform: () => false,
    };
    expect(isCapacitor()).toBe(false);
  });

  it("getPlatform defaults to 'web' when Capacitor global is missing", () => {
    expect(getPlatform()).toBe("web");
  });

  it("getPlatform returns the Capacitor-reported platform", () => {
    (globalThis as unknown as { Capacitor?: MockCap }).Capacitor = {
      getPlatform: () => "ios",
    };
    expect(getPlatform()).toBe("ios");
  });

  it("getPlatform handles android", () => {
    (globalThis as unknown as { Capacitor?: MockCap }).Capacitor = {
      getPlatform: () => "android",
    };
    expect(getPlatform()).toBe("android");
  });
});
