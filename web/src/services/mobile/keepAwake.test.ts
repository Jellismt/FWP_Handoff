/**
 * @file keepAwake.test.ts
 * @module engage-mt/services/mobile
 * @description On the device the native plugin is held once and released once;
 *              in a browser the Screen Wake Lock is acquired, re-acquired when
 *              the tab becomes visible again, and released on demand; without
 *              either the call reports false.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isCapacitor: vi.fn(() => false),
  keepAwake: vi.fn(async () => undefined),
  allowSleep: vi.fn(async () => undefined),
}));
vi.mock("@/utils/capacitor", () => ({ isCapacitor: h.isCapacitor }));
vi.mock("@/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@capacitor-community/keep-awake", () => ({
  KeepAwake: { keepAwake: h.keepAwake, allowSleep: h.allowSleep },
}));

import { allowScreenSleep, isScreenHeldAwake, keepScreenAwake } from "./keepAwake";

const makeSentinel = () => {
  const listeners: Array<() => void> = [];
  return {
    release: vi.fn(async () => listeners.forEach((l) => l())),
    addEventListener: (_t: "release", cb: () => void) => listeners.push(cb),
    /** Simulates the platform dropping the lock (tab backgrounded). */
    drop: () => listeners.forEach((l) => l()),
  };
};

let request: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  h.isCapacitor.mockReturnValue(false);
  await allowScreenSleep();
  vi.clearAllMocks();
  request = vi.fn(async () => makeSentinel());
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
});
afterEach(() => {
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined });
});

describe("keepAwake on the device", () => {
  it("holds the native lock once and releases it once", async () => {
    h.isCapacitor.mockReturnValue(true);
    await expect(keepScreenAwake()).resolves.toBe(true);
    await expect(keepScreenAwake()).resolves.toBe(true);
    expect(h.keepAwake).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalled();
    expect(isScreenHeldAwake()).toBe(true);
    await allowScreenSleep();
    await allowScreenSleep();
    expect(h.allowSleep).toHaveBeenCalledTimes(1);
    expect(isScreenHeldAwake()).toBe(false);
  });

  it("reports false when the plugin fails", async () => {
    h.isCapacitor.mockReturnValue(true);
    h.keepAwake.mockRejectedValueOnce(new Error("not implemented"));
    await expect(keepScreenAwake()).resolves.toBe(false);
    expect(isScreenHeldAwake()).toBe(false);
  });
});

describe("keepAwake in a browser", () => {
  it("acquires once, releases once", async () => {
    await expect(keepScreenAwake()).resolves.toBe(true);
    await expect(keepScreenAwake()).resolves.toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(isScreenHeldAwake()).toBe(true);
    await allowScreenSleep();
    expect(isScreenHeldAwake()).toBe(false);
  });

  it("re-acquires when the tab becomes visible after the platform dropped the lock", async () => {
    await keepScreenAwake();
    const first = (await request.mock.results[0]!.value) as ReturnType<typeof makeSentinel>;
    first.drop();
    expect(isScreenHeldAwake()).toBe(false);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(isScreenHeldAwake()).toBe(true);
  });

  it("reports false without the API", async () => {
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined });
    await expect(keepScreenAwake()).resolves.toBe(false);
    expect(isScreenHeldAwake()).toBe(false);
  });
});
