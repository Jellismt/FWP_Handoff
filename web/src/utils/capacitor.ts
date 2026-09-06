/**
 * @file capacitor.ts
 * @module engage-mt/utils
 * @description Single home for Capacitor platform detection.
 *              Every mobile service (`haptics`, `cameraService`,
 *              `shareService`, `tileDownloader`,
 *              `offlineBootstrap`) would otherwise duplicate
 *              the same `(window as { Capacitor?: …}).Capacitor?.
 *              isNativePlatform?.()` cast. One source of truth here
 *              prevents drift and makes the detection mockable in
 *              vitest.
 *
 *              Use `isCapacitor()` to gate dynamic imports of
 *              `@capacitor/*` plugins so the web bundle never pulls in
 *              native-only code. Use `getPlatform()` when the same
 *              call path needs different behavior between iOS and
 *              Android (rare — usually you only need "native or not").
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-14
 * @version 1.2.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/** Shape of the Capacitor global that the runtime exposes on `window`. */
interface CapacitorWindow {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => "ios" | "android" | "web";
  };
}

/**
 * `true` when running inside a Capacitor native shell (iOS / Android),
 * `false` in any browser (including iOS Safari home-screen PWA).
 *
 * SSR-safe: returns `false` when `window` is undefined.
 */
export const isCapacitor = (): boolean => {
  if (typeof window === "undefined") return false;
  return Boolean((window as CapacitorWindow).Capacitor?.isNativePlatform?.());
};

/**
 * Resolve the current Capacitor platform. Returns `"web"` for any
 * browser context including PWA. Useful when the share / geo URL
 * format needs to switch between iOS and Android (e.g., `geo:` URI
 * vs a platform maps URL).
 */
export const getPlatform = (): "ios" | "android" | "web" => {
  if (typeof window === "undefined") return "web";
  return (window as CapacitorWindow).Capacitor?.getPlatform?.() ?? "web";
};

/**
 * Semantic capability gates for the web-vs-mobile field-tool boundary
 *. The web app is a *planning* surface — plan by drawing and
 * measuring — while the durable field companion is the Capacitor app
 * (real GPS, camera, `@capacitor/preferences` + filesystem, offline tiles).
 * These predicates are the single source of truth for which map tools are
 * mobile-only, so the gate lives in one place instead of scattered
 * `isCapacitor()` checks. A future "PWA with capture" or Electron variant
 * flips one line here rather than every call site.
 */

/**
 * `true` where live GPS capture makes sense: recording a moving GPS track.
 * This is pointless in a desktop browser and only durable on-device, so the
 * track-recorder UI is mobile-only.
 *
 * This is the narrowed successor to the former
 * `supportsFieldCapture()`. Dropping a WAYPOINT is NO LONGER gated: web users
 * can drop pins (planning) and hand them to their phone via the send-to-phone
 * flow. Only GPS track recording + offline downloads remain mobile-only.
 */
export const supportsGpsCapture = (): boolean => isCapacitor();

/**
 * `true` where downloading a map area for offline use is real. On web the
 * tile pipeline is a no-op (nothing is written), so the entry points are
 * hidden rather than shown as dead controls.
 */
export const supportsOfflineDownload = (): boolean => isCapacitor();
