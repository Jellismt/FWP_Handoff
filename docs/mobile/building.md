# Building the mobile app

The fastest ways to put an installable Engage MT build in someone's hands.
Signed store releases are in [store-release.md](store-release.md).

## One-time toolchain setup (macOS)

```bash
npm run mobile:doctor      # see what's missing (✅/❌ table with fix commands)
npm run mobile:bootstrap   # installs JDK 21, Android SDK 36, CocoaPods, fastlane (Homebrew)
# open a fresh shell (or `source ~/.zshrc`) so JAVA_HOME / ANDROID_HOME take effect
```

CocoaPods needs a UTF-8 terminal (`pod install` fails under Ruby 4 with
"Unicode Normalization not appropriate for ASCII-8BIT" otherwise):

```bash
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
```

Two things the bootstrap can't do for you:

- **Accept the Xcode license:** `sudo xcodebuild -license accept`. Until you
  do, Homebrew installs fail with a confusing error (and
  `xcodebuild -version` succeeds anyway, so it's easy to miss). Both
  `mobile:doctor` and the bootstrap detect this and print the fix.
- **Install an iOS simulator runtime** (Xcode ships them as separate ~8.5 GB
  downloads): `xcodebuild -downloadPlatform iOS`. Without one, builds fail
  with "Found no destinations / Supported platforms is empty" — the build
  script detects this and prints the same fix.

## Android debug APK

```bash
npm run apk
# → mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Under the hood: web build → `cap sync android` (regenerates the Gradle
project + copies `web/dist` in) → `gradlew assembleDebug`. The result is an
**unsigned debug** build — fine for internal testing and sideloading.

You can also open `mobile/android/` in Android Studio (or IntelliJ with the
Android plugin) and hit Run — it's a plain Gradle project
(`npx cap open android`, or `npm run mobile:android` to build + open).

### Run it on a physical phone

```bash
# Phone: Settings → About → tap "Build number" 7× → enable "USB debugging".
APK="mobile/android/app/build/outputs/apk/debug/app-debug.apk"
adb devices                # confirm the phone shows as "device"
adb install -r "$APK"
adb shell monkey -p gov.mt.fwp.engagemt -c android.intent.category.LAUNCHER 1
```

…or copy the `.apk` to the phone and tap it (allow "install from unknown
sources"). `adb` ships with the SDK at `$ANDROID_HOME/platform-tools`.

### Run it on an emulator

```bash
# One-time: install the emulator + a system image, create an AVD
SM="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
yes | "$SM" "emulator" "system-images;android-35;google_apis;arm64-v8a"
echo no | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" \
  create avd -n EngageMT -k "system-images;android-35;google_apis;arm64-v8a" --device pixel_7

"$ANDROID_HOME/emulator/emulator" -avd EngageMT &   # leave running
adb wait-for-device
adb install -r "mobile/android/app/build/outputs/apk/debug/app-debug.apk"
adb shell monkey -p gov.mt.fwp.engagemt -c android.intent.category.LAUNCHER 1
```

Tail logs while it runs: `adb logcat -s Capacitor:V chromium:V` (the WebView's
JS console rides the `Capacitor/Console` tag).

> **Emulator GPU note:** the ArcGIS WebGL map is heavy. Software GL
> (`-gpu swiftshader_indirect`) renders it but slowly; prefer a real device or
> a host-GPU AVD (`-gpu host`). Also: an incremental Gradle build can serve a
> stale APK after an asset change — measure/ship from a clean build.

## iOS simulator build

```bash
npm run ios:sim
# → mobile/ios/App/build/Build/Products/Debug-iphonesimulator/App.app
```

Install + launch on a simulator:

```bash
# If a simulator is already booted (e.g. from Xcode):
APP="mobile/ios/App/build/Build/Products/Debug-iphonesimulator/App.app"
xcrun simctl install booted "$APP"
xcrun simctl launch booted gov.mt.fwp.engagemt
```

Or create one first: pick a runtime + device type with
`xcrun simctl list runtimes|devicetypes`, `xcrun simctl create … && xcrun
simctl boot …`, then `open -a Simulator`.

A build for a **physical iPhone** (or TestFlight) additionally requires Apple
Developer Program enrollment and signing — see
[store-release.md](store-release.md).

## Handing a build to a tester

A tester needs no toolchain: build on any Mac with the toolchain and share the
artifact.

```bash
npm run apk       # → mobile/android/app/build/outputs/apk/debug/app-debug.apk
adb install mobile/android/app/build/outputs/apk/debug/app-debug.apk

npm run ios:sim   # → an App.app for the iOS Simulator
xcrun simctl install booted <path-to>/App.app
```

The native projects are kept buildable by `check:native-config`,
`check:plugin-parity`, and `mobile/capacitor.config.test.ts` in `npm run verify`.

## Troubleshooting

- **Web build red → mobile build red.** Every path starts with
  `npm run build --workspace web`; fix TypeScript/Vite errors first.
- **Map crashes on Android:** confirm `android:largeHeap="true"` is still in
  `AndroidManifest.xml`. If the crash is a `java.lang.OutOfMemoryError` on
  first map render, that flag is the guard. If it is a renderer-process kill,
  the flag is irrelevant — profile the WebView process instead
  ([../rules/mobile.md](../rules/mobile.md)).
- **Plugin errors on web:** `@capacitor/*` code must be guarded — see the
  platform-guard pattern in [../rules/mobile.md](../rules/mobile.md).
- **Native config drift:** `npm run check:plugin-parity` and
  `npm run check:native-config` (both inside `npm run verify`) catch
  plugin-version and app-id/version drift between workspaces.
