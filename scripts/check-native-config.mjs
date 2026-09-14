/**
 * @file check-native-config.mjs
 * @module engage-mt/scripts
 * @description Native store-config sanity gate. The app id, version, signing, and
 *              security-critical flags live in FOUR different files across two
 *              native toolchains (capacitor.config.ts, the iOS pbxproj + privacy
 *              manifest, the Android build.gradle + manifest). Nothing else keeps
 *              them in lockstep, so a single stale edit can ship a mismatched
 *              bundle id, a wrong version, a hardcoded signing team, or a silently
 *              regressed security flag — each an App Store / Play rejection or a
 *              runtime footgun. This gate asserts they agree. Zero dependencies —
 *              plain Node ESM.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-02
 * @updated 2026-07-02
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...seg) => join(ROOT, ...seg);

/** Minimum Android targetSdk Google Play accepts for new/updated apps (2025). */
const MIN_TARGET_SDK = 35;

const failures = [];
const read = (path) => {
  if (!existsSync(path)) {
    failures.push(`missing required file: ${path.replace(ROOT + "/", "")}`);
    return "";
  }
  return readFileSync(path, "utf8");
};

const capConfig = read(p("mobile", "capacitor.config.ts"));
const pbxproj = read(p("mobile", "ios", "App", "App.xcodeproj", "project.pbxproj"));
const gradle = read(p("mobile", "android", "app", "build.gradle"));
const variables = read(p("mobile", "android", "variables.gradle"));
const manifest = read(p("mobile", "android", "app", "src", "main", "AndroidManifest.xml"));
const infoPlist = read(p("mobile", "ios", "App", "App", "Info.plist"));
const privacyPath = p("mobile", "ios", "App", "App", "PrivacyInfo.xcprivacy");
const privacy = read(privacyPath);

const first = (re, text) => {
  const m = re.exec(text);
  return m ? m[1].trim() : null;
};
const all = (re, text) => {
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1].trim());
  return out;
};

// ── 1. App id agrees across all three declarations ─────────────────────────
const capId = first(/appId:\s*["']([^"']+)["']/, capConfig);
const iosIds = all(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g, pbxproj).map((s) => s.replace(/["']/g, ""));
const androidId = first(/applicationId\s+["']([^"']+)["']/, gradle);
const idSet = new Set([capId, androidId, ...iosIds].filter(Boolean));
if (idSet.size > 1) {
  failures.push(
    `app id mismatch — capacitor.config=${capId}, android=${androidId}, ios=${[...new Set(iosIds)].join("/")}. All must equal one bundle id.`,
  );
}

// ── 2. Marketing version agrees (Android versionName ↔ iOS MARKETING_VERSION) ─
const versionName = first(/versionName\s+["']([^"']+)["']/, gradle);
const iosVersions = [...new Set(all(/MARKETING_VERSION = ([^;]+);/g, pbxproj))];
if (versionName && iosVersions.length && !(iosVersions.length === 1 && iosVersions[0] === versionName)) {
  failures.push(
    `version mismatch — Android versionName="${versionName}" vs iOS MARKETING_VERSION=${iosVersions.join("/")}. Keep them in lockstep.`,
  );
}

// ── 3. No stale hardcoded signing team in the iOS project ───────────────────
for (const team of all(/DEVELOPMENT_TEAM = ([^;]+);/g, pbxproj)) {
  if (team.replace(/["']/g, "") !== "") {
    failures.push(
      `iOS DEVELOPMENT_TEAM is hardcoded to ${team} in project.pbxproj — blank it ("") so release-ios.sh injects the real team from .env.local and a stale id can't break signing.`,
    );
    break;
  }
}

// ── 4. Android targetSdk meets the Play floor ──────────────────────────────
const targetSdk = Number(first(/targetSdkVersion\s*=\s*(\d+)/, variables));
if (!Number.isFinite(targetSdk) || targetSdk < MIN_TARGET_SDK) {
  failures.push(`Android targetSdkVersion is ${targetSdk || "unset"} — Google Play requires ≥ ${MIN_TARGET_SDK}.`);
}

// ── 5. Security-critical Android flags haven't regressed ───────────────────
if (!/android:largeHeap="true"/.test(manifest)) {
  failures.push('AndroidManifest.xml is missing android:largeHeap="true" — the guard against the Java-heap OutOfMemoryError seen on first map render (see docs/rules/mobile.md).');
}
if (!/android:usesCleartextTraffic="false"/.test(manifest)) {
  failures.push('AndroidManifest.xml is missing android:usesCleartextTraffic="false" — HTTPS-only must stay enforced.');
}

// ── 6. iOS privacy manifest present + declares no tracking ─────────────────
if (privacy && !/<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(privacy)) {
  failures.push("PrivacyInfo.xcprivacy must declare <key>NSPrivacyTracking</key><false/> to match the 'Data Not Collected' store disclosure.");
}

// ── 7. Dangerous Android permission ⇒ matching iOS usage string ────────────
if (/android\.permission\.CAMERA/.test(manifest) && !/NSCameraUsageDescription/.test(infoPlist)) {
  failures.push("Android declares CAMERA but iOS Info.plist has no NSCameraUsageDescription — App Store rejects camera use without a purpose string.");
}
if (/android\.permission\.ACCESS_(FINE|COARSE)_LOCATION/.test(manifest) && !/NSLocationWhenInUseUsageDescription/.test(infoPlist)) {
  failures.push("Android declares location but iOS Info.plist has no NSLocationWhenInUseUsageDescription — App Store rejects location use without a purpose string.");
}

// ── 8. Background location must be declared on both sides AND implemented ──
// A capability declared with nothing behind it is a store-review rejection and
// was removed from this app once for exactly that reason. If either platform
// asks for background location, every part of the pair must be present.
const androidBackgroundLocation = /android\.permission\.ACCESS_BACKGROUND_LOCATION/.test(manifest);
const iosBackgroundLocation =
  /<key>UIBackgroundModes<\/key>[\s\S]{0,400}?<string>location<\/string>/.test(infoPlist);

if (androidBackgroundLocation) {
  if (!/android\.permission\.FOREGROUND_SERVICE_LOCATION/.test(manifest)) {
    failures.push("Android declares ACCESS_BACKGROUND_LOCATION but not FOREGROUND_SERVICE_LOCATION — required since API 34, so background location cannot work at targetSdk 35.");
  }
  if (!/android:foregroundServiceType\s*=\s*"[^"]*location/.test(manifest)) {
    failures.push('Android declares ACCESS_BACKGROUND_LOCATION but registers no <service android:foregroundServiceType="location"> — the permission would be requested with nothing implemented behind it.');
  }
  if (!/android\.permission\.POST_NOTIFICATIONS/.test(manifest)) {
    failures.push("Android declares ACCESS_BACKGROUND_LOCATION but not POST_NOTIFICATIONS — the mandatory persistent notification cannot be shown on Android 13+.");
  }
}
if (iosBackgroundLocation && !/NSLocationAlwaysAndWhenInUseUsageDescription/.test(infoPlist)) {
  failures.push("iOS declares the location background mode but has no NSLocationAlwaysAndWhenInUseUsageDescription — App Store rejects Always location without a purpose string.");
}
if (androidBackgroundLocation !== iosBackgroundLocation) {
  const declared = androidBackgroundLocation ? "Android" : "iOS";
  const other = androidBackgroundLocation ? "iOS" : "Android";
  failures.push(`Background location is declared on ${declared} but not ${other} — the two platforms must agree, or the feature silently works on one and not the other.`);
}

if (failures.length > 0) {
  console.error("\n❌ check:native-config — store-config drift found:\n");
  for (const f of failures) console.error("   • " + f);
  console.error("");
  process.exit(1);
}

console.log(
  `✅ check:native-config — bundle id (${capId}), version (${versionName}), signing, targetSdk ${targetSdk}, security flags, and privacy manifest all consistent.`,
);
