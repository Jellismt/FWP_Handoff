/**
 * @file keepAwake.ts
 * @module engage-mt/services/mobile
 * @description Keeps the screen on while a track is recording. Recording is
 *              foreground-only, so a screen that locks would pause it. On the
 *              device the native keep-awake plugin holds the lock (works on
 *              every supported iOS and Android version); in a browser the
 *              Screen Wake Lock API is used where it exists and re-acquired
 *              when the tab becomes visible again. Browsers without either
 *              report false and the caller carries on.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { isCapacitor } from "@/utils/capacitor";
import { createLogger } from "@/utils/logger";

const log = createLogger("keep-awake");

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: "release", cb: () => void) => void;
}

interface WakeLockLike {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
}

let nativeHeld = false;
let sentinel: WakeLockSentinelLike | null = null;
let wanted = false;
let visibilityBound = false;

const warn = (what: string, err: unknown): void =>
  log.warn(what, { error: err instanceof Error ? err.message : String(err) });

const wakeLock = (): WakeLockLike | null =>
  typeof navigator !== "undefined"
    ? ((navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock ?? null)
    : null;

const acquireNative = async (): Promise<boolean> => {
  try {
    const { KeepAwake } = await import("@capacitor-community/keep-awake");
    await KeepAwake.keepAwake();
    nativeHeld = true;
    return true;
  } catch (err) {
    warn("native keepAwake failed", err);
    return false;
  }
};

const releaseNative = async (): Promise<void> => {
  if (!nativeHeld) return;
  nativeHeld = false;
  try {
    const { KeepAwake } = await import("@capacitor-community/keep-awake");
    await KeepAwake.allowSleep();
  } catch (err) {
    warn("native allowSleep failed", err);
  }
};

const acquireWeb = async (): Promise<boolean> => {
  const api = wakeLock();
  if (!api) return false;
  try {
    const next = await api.request("screen");
    next.addEventListener("release", () => {
      if (sentinel === next) sentinel = null;
    });
    sentinel = next;
    return true;
  } catch (err) {
    warn("wake lock request failed", err);
    return false;
  }
};

const onVisibilityChange = (): void => {
  if (wanted && sentinel === null && document.visibilityState === "visible") void acquireWeb();
};

/** Hold the screen awake until `allowScreenSleep`. Returns whether a lock was obtained. */
export const keepScreenAwake = async (): Promise<boolean> => {
  wanted = true;
  if (isCapacitor()) return nativeHeld || acquireNative();
  if (typeof document !== "undefined" && !visibilityBound) {
    document.addEventListener("visibilitychange", onVisibilityChange);
    visibilityBound = true;
  }
  if (sentinel) return true;
  return acquireWeb();
};

export const allowScreenSleep = async (): Promise<void> => {
  wanted = false;
  await releaseNative();
  const current = sentinel;
  sentinel = null;
  if (!current) return;
  try {
    await current.release();
  } catch (err) {
    warn("wake lock release failed", err);
  }
};

export const isScreenHeldAwake = (): boolean => nativeHeld || sentinel !== null;
