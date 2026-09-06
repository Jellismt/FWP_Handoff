/**
 * @file useLocate.test.ts
 * @module engage-mt/hooks
 * @description The best-of-window fix: early return on a good fix, best seen
 *              at the deadline, error without any fix, and the single-reading
 *              fallback.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bestFixWithin, getCurrentCoords } from "./useLocate";

vi.mock("@capacitor/geolocation", () => {
  throw new Error("not installed in this test");
});

type Fix = { lat: number; lon: number; accuracy: number };
const fix = (accuracy: number): Fix => ({ lat: 46, lon: -111, accuracy });

const makeSource = (script: Array<{ at: number; fix?: Fix; error?: string }>) => {
  const stop = vi.fn();
  return {
    stop,
    source: {
      watch: async (onFix: (c: Fix) => void, onError: (m: string) => void) => {
        for (const step of script) {
          setTimeout(() => (step.fix ? onFix(step.fix) : onError(step.error ?? "err")), step.at);
        }
        return stop;
      },
      once: vi.fn(async () => fix(80)),
    },
  };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("bestFixWithin", () => {
  it("resolves early on a good-enough fix and stops watching", async () => {
    const { source, stop } = makeSource([
      { at: 100, fix: fix(60) },
      { at: 200, fix: fix(15) },
    ]);
    const p = bestFixWithin(source, 4000, 20);
    await vi.advanceTimersByTimeAsync(250);
    await expect(p).resolves.toEqual(fix(15));
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("returns the best fix seen when the window closes", async () => {
    const { source } = makeSource([
      { at: 100, fix: fix(60) },
      { at: 300, fix: fix(35) },
    ]);
    const p = bestFixWithin(source, 1000, 20);
    await vi.advanceTimersByTimeAsync(1100);
    await expect(p).resolves.toEqual(fix(35));
  });

  it("rejects when no fix arrives and an error is reported", async () => {
    const { source } = makeSource([{ at: 50, error: "denied" }]);
    const expectation = expect(bestFixWithin(source, 1000, 20)).rejects.toThrow("denied");
    await vi.advanceTimersByTimeAsync(100);
    await expectation;
  });
});

describe("getCurrentCoords", () => {
  it("falls back to a single reading when the window produces nothing", async () => {
    const getCurrentPosition = vi.fn((ok: (p: unknown) => void) =>
      ok({ coords: { latitude: 46, longitude: -111, accuracy: 80 } }),
    );
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { watchPosition: () => 1, clearWatch: vi.fn(), getCurrentPosition },
    });
    const p = getCurrentCoords();
    await vi.advanceTimersByTimeAsync(4100);
    await expect(p).resolves.toEqual(fix(80));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });
});
