/**
 * @file nativeChrome.ts
 * @module engage-mt/services/mobile
 * @description Native window-chrome control for the Capacitor shell — the
 *              status bar (@capacitor/status-bar) and the launch splash
 *              (@capacitor/splash-screen).
 *
 *              The status bar sits directly above the AppHeader, which under the
 *              two-color theme is grey in light mode and FWP Blue in dark mode
 *              (see docs/rules/fwp-brand.md). `applyNativeChromeTheme()` keeps
 *              the bar in step — but only Android can actually be repainted:
 *
 *                • Android — `setBackgroundColor` works, so the bar takes the
 *                  app chrome colour and the glyph style flips to contrast it.
 *                • iOS — Capacitor pins the WebView BELOW the status bar, so the
 *                  strip above it is the native view background (FWP Blue) and
 *                  neither CSS nor `setBackgroundColor` (Android-only) can
 *                  recolour it. Glyphs therefore stay light so they always
 *                  contrast that blue. Making it follow the theme would require
 *                  a native change; tracked as a known limitation.
 *
 *              We deliberately do NOT tint the status bar to the active module
 *              accent — the header is never module-tinted.
 *
 *              `initNativeChrome()` is called once at boot. `hideSplash()` is
 *              called after first meaningful paint so the splash never lingers
 *              past the app being interactive (rather than relying solely on
 *              the config's auto-hide timer).
 *
 * every entry point is guarded; the plugins are
 *              dynamically imported only on native so they never enter the web
 *              bundle. No-op on web.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-01
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createLogger } from "@/utils/logger";
import { getPlatform, isCapacitor } from "@/utils/capacitor";

const log = createLogger("native-chrome");

interface StatusBarPlugin {
  setStyle: (opts: { style: string }) => Promise<void>;
  setOverlaysWebView: (opts: { overlay: boolean }) => Promise<void>;
}

interface SplashScreenPlugin {
  hide: (opts?: { fadeOutDuration?: number }) => Promise<void>;
}

/**
 * Configure the status bar at boot.
 *
 * Android: keep the WebView BELOW the status bar (`overlay: false`) so the app
 * content never slides under it. We do NOT brand the bar: on Android 15 / API 35
 * `setStatusBarColor` is deprecated + ignored, and going edge-to-edge would need
 * a native WindowInsets→CSS `env(safe-area-inset-*)` bridge that Capacitor's
 * WebView doesn't provide (verified on-device: env() stays 0, so content clips).
 * The bar therefore shows the system default — legible, follows device theme.
 *
 * iOS: `overlay` is a no-op; the bar is a fixed FWP-Blue native strip above the
 * full-bleed WebView, so its glyphs are set light (`Style.Dark`) once — that's
 * correct in BOTH app themes and never changes (the strip can't be recoloured
 * from the WebView).
 *
 * Neither platform's status bar tracks the in-app theme (both are outside the
 * WebView's reach on their respective OS), so there is no per-theme status-bar
 * work — this runs once at boot. Safe to call on web (no-op).
 */
export const initNativeChrome = async (): Promise<void> => {
  if (!isCapacitor()) return;
  try {
    // Literal import so Vite bundles @capacitor/status-bar into a lazy chunk that
    // resolves in the native WebView. (A @vite-ignore'd variable import leaves an
    // unresolvable bare specifier → the catch below swallows it and the status bar
    // is never styled.) Only fetched inside this isCapacitor() guard → no web load.
    const { StatusBar, Style } = (await import("@capacitor/status-bar")) as unknown as {
      StatusBar: StatusBarPlugin;
      Style: { Dark: string; Light: string };
    };
    await StatusBar.setOverlaysWebView({ overlay: false });
    // iOS only: light glyphs on the fixed FWP-Blue strip. Android leaves the
    // system status bar to the device (see the doc above).
    if (getPlatform() === "ios") {
      await StatusBar.setStyle({ style: Style.Dark });
    }
  } catch (err) {
    log.warn("Failed to initialize status bar", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

/**
 * Hide the launch splash once the app is interactive. Idempotent — the plugin
 * tolerates being called after an auto-hide already fired. No-op on web.
 */
export const hideSplash = async (): Promise<void> => {
  if (!isCapacitor()) return;
  try {
    // Literal import so Vite bundles @capacitor/splash-screen into a lazy chunk
    // that resolves in the native WebView (a @vite-ignore'd variable import would
    // silently fail and the splash would only ever hide on the config auto-timer).
    const { SplashScreen } = (await import("@capacitor/splash-screen")) as unknown as {
      SplashScreen: SplashScreenPlugin;
    };
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch (err) {
    log.warn("Failed to hide splash screen", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
