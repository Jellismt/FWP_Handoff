#!/usr/bin/env node
/**
 * @file check-ios-privacy-manifest.mjs
 * @module engage-mt/scripts
 * @description App Store submission gate. Apple has REQUIRED an app-level
 *              privacy manifest (`PrivacyInfo.xcprivacy`) since iOS 17.4 —
 *              its absence is an automatic App Store rejection. This gate
 *              fails the build if:
 *                • `mobile/ios/App/App/PrivacyInfo.xcprivacy` is missing, or
 *                • it is not well-formed plist XML, or
 *                • it does not declare the four required top-level keys
 *                  (NSPrivacyTracking / NSPrivacyTrackingDomains /
 *                  NSPrivacyCollectedDataTypes / NSPrivacyAccessedAPITypes), or
 *                • the App target's project.pbxproj does not reference the
 *                  manifest (so it would never ship inside App.app), or
 *                • the Android FileProvider config reintroduces a `path="."`
 *                  external-storage root (an over-broad grant).
 *
 *              Belt-and-suspenders companion to check:security-headers and
 *              check:capacitor-imports. Wired into `npm run verify`.
 *              See: docs/mobile/store-release.md.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-02
 * @updated 2026-07-02
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const MANIFEST = resolve(REPO_ROOT, "mobile/ios/App/App/PrivacyInfo.xcprivacy");
const PBXPROJ = resolve(REPO_ROOT, "mobile/ios/App/App.xcodeproj/project.pbxproj");
const FILE_PATHS = resolve(
  REPO_ROOT,
  "mobile/android/app/src/main/res/xml/file_paths.xml",
);

const REQUIRED_KEYS = [
  "NSPrivacyTracking",
  "NSPrivacyTrackingDomains",
  "NSPrivacyCollectedDataTypes",
  "NSPrivacyAccessedAPITypes",
];

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

// ─── 1. Manifest exists + is well-formed + declares the required keys ────
if (!existsSync(MANIFEST)) {
  fail(
    "mobile/ios/App/App/PrivacyInfo.xcprivacy is MISSING.\n" +
      "  Apple requires an app-level privacy manifest (iOS 17.4+) — the App\n" +
      "  Store rejects submissions without one. See docs/mobile/store-release.md.",
  );
}

const xml = readFileSync(MANIFEST, "utf8");
if (!/<plist\b/.test(xml) || !/<dict>/.test(xml)) {
  fail("PrivacyInfo.xcprivacy is not a well-formed plist (no <plist>/<dict>).");
}
const missing = REQUIRED_KEYS.filter((k) => !xml.includes(`<key>${k}</key>`));
if (missing.length > 0) {
  fail(`PrivacyInfo.xcprivacy is missing required key(s): ${missing.join(", ")}`);
}

// ─── 2. The App target actually bundles it ───────────────────────────────
if (existsSync(PBXPROJ)) {
  const pbx = readFileSync(PBXPROJ, "utf8");
  if (!pbx.includes("PrivacyInfo.xcprivacy")) {
    fail(
      "project.pbxproj does not reference PrivacyInfo.xcprivacy — it would not\n" +
        "  ship inside App.app. Add it to the App target's Copy Bundle Resources.",
    );
  }
}

// ─── 3. Android FileProvider did not regain an external-storage root ─────
if (existsSync(FILE_PATHS)) {
  const fp = readFileSync(FILE_PATHS, "utf8");
  if (/<external-path\b[^>]*path\s*=\s*"\."/.test(fp)) {
    fail(
      'file_paths.xml exposes an <external-path path="."> root again — the\n' +
        "  over-broad FileProvider grant is not allowed. Keep only the\n" +
        "  cache-path root that @capacitor/camera requires.",
    );
  }
}

console.log(
  "✓ iOS privacy manifest present + bundled; Android FileProvider scoped",
);
