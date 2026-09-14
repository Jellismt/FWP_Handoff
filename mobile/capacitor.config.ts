/**
 * @file capacitor.config.ts
 * @module engage-mt/mobile
 * @description Capacitor configuration. Points `webDir` at the sibling
 *              `web/dist/` Vite build.
 *
 *              Added Camera + Share plugin config for the field-
 *              tools waypoint photo capture + share-sheet flows. iOS
 *              and Android require usage-description strings in
 *              `Info.plist` (`NSCameraUsageDescription`,
 *              `NSPhotoLibraryUsageDescription`) and
 *              `AndroidManifest.xml` (`<uses-permission
 *              android:name="android.permission.CAMERA"/>`) — see
 *              `docs/rules/mobile.md` § Permissions.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-06-02
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "gov.mt.fwp.engagemt",
  appName: "Engage MT",
  webDir: "../web/dist",
  // `bundledWebRuntime` removed (deprecated in Capacitor 6).
  ios: {
    // "never" (not "automatic") — the app is full-bleed under
    // `viewport-fit=cover` and handles the notch / home indicator itself via
    // `env(safe-area-inset-*)` in CSS. With "automatic", WKWebView auto-insets
    // its scroll view, which zeroes out those env() values and leaves the
    // native background showing as a band behind the status bar (the app
    // header then renders clipped under the Dynamic Island).
    contentInset: "never",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Splash background now matches the FWP Blue brand spine
      // (#002855) official palette. The legacy hunter-green
      // did not pass the brand refresh audit.
      launchShowDuration: 1200,
      backgroundColor: "#002855",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      // DARK content on FWP Blue surface — light text on dark blue.
      style: "DARK",
      backgroundColor: "#002855",
    },
    Keyboard: {
      // Resize behavior: keep the viewport intact when the keyboard
      // opens so forms don't jump. Each component is responsible for
      // its own scroll-into-view.
      resize: "native",
      style: "dark",
    },
    Camera: {
      // Photo capture is rear-camera by default for waypoint
      // attachments; user can switch in the picker. Photos compress to
      // 0.85 quality which is plenty for evidence shots + keeps the
      // device-side cache small.
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;
