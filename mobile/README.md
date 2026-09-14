# Engage MT — Mobile (Capacitor 8.x)

This directory wraps the web build at `../web/dist/` as iOS and Android native apps.

## Generate a build (the easy way)

Full guide: [`docs/mobile/README.md`](../docs/mobile/README.md).

- **No toolchain?** Ask a teammate with the toolchain to run `npm run apk`
  (Android) or `npm run ios:sim` (iOS Simulator) and hand you the artifact;
  `npm run mobile:doctor` lists what you would need to build locally.
- **On your own Mac:**
  ```bash
  npm run mobile:doctor      # what's installed / missing (✅/❌)
  npm run mobile:bootstrap   # install JDK 21 + Android SDK + CocoaPods + fastlane (once)
  npm run apk                # → Android debug APK (revealed in Finder)
  npm run ios:sim            # → iOS simulator build
  ```
- **Signed/Play-ready:** `bash mobile/scripts/gen-keystore.sh` once, then
  `bash mobile/scripts/release-android.sh [--apk]`.

The debug APK and simulator build need **no store account**. A physical-iPhone /
TestFlight build needs Apple enrollment (J-021); a Play listing needs Play Console (J-022).

## First-time setup (do this once per machine)

```bash
cd mobile
npm install
npx cap add ios
npx cap add android
```

`cap add` generates the Xcode and Android Studio projects under `mobile/ios/` and `mobile/android/`. Only commit the config files we intentionally edit; generated build folders are gitignored — see the root `.gitignore`.

After `cap add`, run the sync-and-open pipeline once to make sure everything links up:

```bash
# From repo root:
npm run mobile:ios
npm run mobile:android
```

## Build pipeline

The two scripts in `mobile/scripts/` are the canonical build pipeline. Both do:

1. `cd web && npm run build` — produces `web/dist/`.
2. `cd mobile && npx cap sync <platform>` — copies dist + plugins into the platform project.
3. `cd mobile && npx cap open <platform>` — launches Xcode / Android Studio.

The root `package.json` exposes them as `npm run mobile:ios` and `npm run mobile:android`.

## Plugin policy

Allowed plugins (one-liner justifications below are the policy record). All pinned to
exact `8.x` versions in `mobile/package.json` and mirrored in `web/package.json`:

- `@capacitor/geolocation` — locate-me + foreground track recording, **on-device only** (SEC-002).
- `@capacitor/camera` — waypoint photos in field tools.
- `@capacitor/filesystem` — offline tile packages + GPX/KML share-file import.
- `@capacitor/preferences` — small key/value persistence (theme, tokens, snapshots).
- `@capacitor/network` — connectivity state for the offline banner + adaptive UI.
- `@capacitor/share` — native share sheet for waypoints + tracks.
- `@capacitor/haptics` — field-tool feedback, e.g. track save/discard (`navigator.vibrate` fallback on web).
- `@capacitor/keyboard` — keyboard inset handling in sheets + forms.
- `@capacitor/status-bar` + `@capacitor/splash-screen` — visual polish.
- `@capacitor/app` — back-button + lifecycle events.

Add any new plugin only with a one-line justification appended to this list.

## On-device-only location

Per the bootstrap brief, **no user coordinates leave the device**. The `@capacitor/geolocation` plugin returns coords directly to the in-process map view; there is no telemetry, analytics, or backend transmission of location data. See `docs/rules/mobile.md`.

## What is NOT in this directory yet

- App Store / Play Store submission — blocked on Apple Developer (J-021) + Play Console
  (J-022) enrollment. See [`PRE-FLIGHT.md`](PRE-FLIGHT.md) for the store-cutover runbook.
- Signing keys — pending (the _infrastructure_ is built; only the secrets are pending).
  Android: run `bash mobile/scripts/gen-keystore.sh` (template
  `mobile/android/keystore.properties.example` → gitignored `keystore.properties`). iOS:
  `cp mobile/.env.local.example mobile/.env.local` and fill it. Verify any signed build with
  `npm run verify:signing`; check credential readiness with `npm run mobile:doctor`.

> Note: `mobile/ios/` and `mobile/android/` **are** generated and tracked. The `cap add`
> step in setup above is only needed on a fresh clone if the platform folders are missing.

## Versioning

- **iOS** — `CFBundleShortVersionString` (marketing version) + `CFBundleVersion` (build) in
  `mobile/ios/App/App/Info.plist`; the release build reads the build number from the `BUILD_NUMBER` env var (else a timestamp).
- **Android** — `versionName` + `versionCode` in `mobile/android/app/build.gradle`;
  `versionCode` reads the `VERSION_CODE` env var (defaults to `1` for local dev).

Bump the marketing version on both platforms together for a public release.
