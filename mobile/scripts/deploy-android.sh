#!/usr/bin/env bash
# @file deploy-android.sh
# @module engage-mt/mobile/scripts
# @description Repeatable "rebuild + run on the connected Android device/emulator"
#              loop — the Android analog of deploy-iphone.sh. Builds the web app,
#              prunes mobile-excluded assets, syncs Capacitor, assembles a DEBUG
#              APK (auto-signed with the built-in debug key — no account, no
#              keystore, no trust step), and installs + launches it on the
#              connected device via adb. Unlike iOS, `cap sync android` is safe to
#              run every build (no CocoaPods/Ruby layer) and REGENERATES
#              capacitor.settings.gradle, so plugin paths self-heal against npm
#              workspace hoisting — no symlink patching needed. Toolchain
#              (JDK 21 + Android SDK) is auto-located so this works in a bare
#              shell. One-time setup + full loop docs: docs/mobile/building.md
# @author Jamie Ellis / Engage MT
# @created 2026-07-02
# @updated 2026-07-02
# @version 1.0.0
#
# FWP Engage MT — Montana's Official Gateway to the Outdoors
# Licensed under the MIT License.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$MOBILE_DIR")"
ANDROID_DIR="$MOBILE_DIR/android"
APP_ID="gov.mt.fwp.engagemt"
APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      echo "Usage: npm run mobile:emulator"
      echo "  Builds web + syncs Capacitor + assembles a debug APK, then installs"
      echo "  and launches it on the connected Android device/emulator via adb."
      echo "  Target a specific device with:  ANDROID_SERIAL=<serial> npm run mobile:emulator"
      exit 0 ;;
  esac
done

echo "▶ Engage MT — rebuild → Android"

# 1. Toolchain: make the build self-sufficient in a bare shell.
#    JDK 21 ships via Homebrew openjdk@21 but isn't registered with macOS
#    java_home, so a fresh shell has no `java`. Resolve JAVA_HOME the same way
#    bootstrap-mobile.sh does, preferring a canonical JDK home.
if ! java -version 2>&1 | grep -q 'version "21'; then
  for cand in \
    "$(/usr/libexec/java_home -v 21 2>/dev/null || true)" \
    "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" \
    "$(brew --prefix openjdk@21 2>/dev/null || true)" \
    "/opt/homebrew/opt/openjdk@21"; do
    if [ -n "$cand" ] && [ -x "$cand/bin/java" ]; then
      export JAVA_HOME="$cand"; export PATH="$cand/bin:$PATH"; break
    fi
  done
fi
if ! java -version 2>&1 | grep -q 'version "21'; then
  echo "❌ JDK 21 not found. Run: npm run mobile:bootstrap"; exit 1
fi

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$ANDROID_HOME/platform-tools/adb"
[ -x "$ADB" ] || ADB="$(command -v adb || true)"
if [ -z "$ADB" ] || [ ! -x "$ADB" ]; then
  echo "❌ adb not found (looked in \$ANDROID_HOME/platform-tools and PATH)."
  echo "   Run: npm run mobile:bootstrap"; exit 1
fi
echo "  JAVA_HOME=${JAVA_HOME:-<system>}"
echo "  ANDROID_HOME=$ANDROID_HOME"

# 2. Pick the target device BEFORE the long build, so we fail fast if none.
#    (Portable to macOS bash 3.2 — no `mapfile`.)
DEVICE_LIST="$("$ADB" devices | awk 'NR>1 && $2=="device"{print $1}')"
DEV_COUNT="$(printf '%s\n' "$DEVICE_LIST" | grep -c . || true)"
if [ "$DEV_COUNT" -eq 0 ]; then
  echo "❌ No Android device/emulator connected. Start an emulator (Android Studio"
  echo "   → Device Manager) or plug in a device with USB debugging, then retry."
  exit 1
fi
FIRST_DEV="$(printf '%s\n' "$DEVICE_LIST" | head -1)"
SERIAL="${ANDROID_SERIAL:-$FIRST_DEV}"
if [ "$DEV_COUNT" -gt 1 ] && [ -z "${ANDROID_SERIAL:-}" ]; then
  echo "❌ Multiple devices connected: $(printf '%s' "$DEVICE_LIST" | tr '\n' ' ')"
  echo "   Pick one: ANDROID_SERIAL=<serial> npm run mobile:emulator"
  exit 1
fi
echo "  target device: $SERIAL"

# 3. Web bundle.
echo ""
echo "▶ Building web bundle…"
bash "$REPO_ROOT/mobile/scripts/lib/web-build.sh"

# 4. Prune mobile-excluded assets (regs PDFs, ~134 MB).
echo ""
echo "▶ Pruning mobile-excluded assets…"
node "$REPO_ROOT/scripts/prune-mobile-assets.mjs"

# 5. Capacitor sync — regenerates capacitor.settings.gradle (self-heals plugin
#    paths against workspace hoisting), copies web assets, updates plugins.
echo ""
echo "▶ Syncing Capacitor (android)…"
( cd "$MOBILE_DIR" && npx cap sync android )

# 6. Assemble the debug APK (auto-signed with the debug keystore).
echo ""
echo "▶ Assembling debug APK (Gradle)…"
( cd "$ANDROID_DIR" && ./gradlew assembleDebug )

if [ ! -f "$APK" ]; then
  echo "❌ Build finished but APK not found at: $APK"; exit 1
fi

# 7. Install + launch on the target device.
echo ""
echo "▶ Installing on $SERIAL…"
# `install -r` fails with INSTALL_FAILED_UPDATE_INCOMPATIBLE if a build with a
# different signing key is present (e.g. a signed release APK from a dry-run).
# Fall back to uninstall+install so the debug loop always recovers.
if ! "$ADB" -s "$SERIAL" install -r "$APK" 2>/tmp/engagemt-adb-install.err; then
  if grep -qi "signatures do not match\|UPDATE_INCOMPATIBLE" /tmp/engagemt-adb-install.err; then
    echo "  ↳ signature mismatch (a differently-signed build is installed) — reinstalling clean"
    "$ADB" -s "$SERIAL" uninstall "$APP_ID" >/dev/null 2>&1 || true
    "$ADB" -s "$SERIAL" install "$APK"
  else
    cat /tmp/engagemt-adb-install.err; exit 1
  fi
fi
echo "▶ Launching $APP_ID…"
# `am start` on the main activity is more deterministic than `monkey` for
# bringing the app to the foreground after a reinstall.
"$ADB" -s "$SERIAL" shell am start -n "$APP_ID/.MainActivity" >/dev/null 2>&1 || true

echo ""
echo "✅ Engage MT is running on $SERIAL."
echo ""
echo "   Watch logs:   $ADB -s $SERIAL logcat -s Capacitor Capacitor/Console chromium"
echo "   Screenshot:   $ADB -s $SERIAL exec-out screencap -p > /tmp/emu.png && open /tmp/emu.png"
echo "   Next change:  edit web code → re-run 'npm run mobile:emulator'."
