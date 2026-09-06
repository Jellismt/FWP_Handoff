# Mobile (Capacitor)

The mobile app is **the web build wrapped**, not a second codebase. Capacitor 8
generates real native projects — `mobile/android/` (Gradle) and `mobile/ios/`
(Xcode) — whose main view is a WebView loading `web/dist`, with a bridge to
native APIs (geolocation, camera, filesystem, preferences, share, …).

```
1. Web build     npm run build --workspace web   → static SPA in web/dist/
2. cap sync      npx cap sync (from mobile/)     → generates/updates the native
                                                   projects + copies web/dist in
3. Native build  Android: gradlew → APK/AAB      iOS: xcodebuild/Xcode → .app/.ipa
```

The npm scripts bundle these steps — never run them piecemeal out of order.

| Doc | What's inside |
|---|---|
| [building.md](building.md) | Toolchain setup (`mobile:doctor` / `mobile:bootstrap`), debug APK, iOS simulator build, running on devices/emulators |
| [store-release.md](store-release.md) | Keystore generation (you create and own it), signed AAB, fastlane iOS pipeline, store accounts |

## Key facts

- **App id:** `gov.mt.fwp.engagemt` · **App name:** Engage MT
- **Android:** minSdk 24 (Android 7.0+), compileSdk 36, targetSdk 35, JDK 21,
  Gradle 8.11.1 — required by the Capacitor 8 plugin set
- **iOS:** deployment target iOS 15.0; builds require Xcode + CocoaPods
- **Offline behavior:** all reference data ships in the bundle; regulations
  fetch **live when online** (the mobile build bakes
  `VITE_FWP_REGS_API_BASE`) and fall back to the bundled snapshot offline —
  refresh that snapshot before every store build
  ([../deploy/data-refresh.md](../deploy/data-refresh.md))
- **Track recording:** foreground-only; the screen stays awake while recording
  (`@capacitor-community/keep-awake`),
  and a lock, app switch, or lost fix is recorded as a gap (new segment) rather
  than a straight line ([../rules/mobile.md](../rules/mobile.md))
- **Offline map areas:** downloaded on the device from USGS The National Map
  (zoom 6–16, public domain) together with land ownership and district
  boundaries for the same box, plus a fresh copy of the regulations and the
  facts for every hunting district inside it; stored under the app data
  directory, deleted when the area is removed, and reconciled with the disk
  on launch
- **Bundle pruning:** mobile builds run `scripts/prune-mobile-assets.mjs`
  (drops web-only heavy assets from the wrapped bundle); the mobile build
  scripts wire it in automatically
- **Native memory:** `AndroidManifest.xml` sets `android:largeHeap="true"` to
  raise the app's Java heap after an out-of-memory error on first map render.
  It does not govern WebView/WebGL memory, which lives in a separate process —
  see [../rules/mobile.md](../rules/mobile.md) for what to measure before
  removing it
- **Conventions:** platform-guard patterns, plugin policy, and native
  lifecycle seams are in [../rules/mobile.md](../rules/mobile.md); mobile
  screen-reader specifics in
  [../rules/mobile-accessibility.md](../rules/mobile-accessibility.md)

## Command surface (from the repo root)

| Command | Does |
|---|---|
| `npm run mobile:doctor` | Print toolchain readiness (✅/❌ + fix commands) |
| `npm run mobile:bootstrap` | Install the whole toolchain (macOS/Homebrew) |
| `npm run apk` | Android **debug** APK |
| `npm run ios:sim` | iOS **simulator** app |
| `npm run mobile:android` / `mobile:ios` | Build + sync + open Android Studio / Xcode |
| `npm run mobile:emulator` / `mobile:iphone` | Build + deploy to a connected emulator / iPhone |
| `bash mobile/scripts/gen-keystore.sh` | Create the Android release keystore (once) |
| `bash mobile/scripts/release-android.sh [--apk]` | Signed AAB (or standalone APK) |
| `bash mobile/scripts/release-ios.sh` | iOS archive (device/TestFlight; needs Apple enrollment) |
| `npm run verify:signing` | Confirm a built artifact is correctly signed |

> All build paths depend on a green web build — the scripts run
> `npm run build --workspace web` internally.
