#!/usr/bin/env bash
# @file build-apk.sh
# @module engage-mt/mobile/scripts
# @description One-command Android **debug** APK. Builds the web bundle, syncs
#              Capacitor, runs `gradlew assembleDebug`, then prints + reveals
#              the installable APK. Unsigned — for internal testing / sideload.
#              No keystore or store account needed. For a Play-ready signed
#              build use release-android.sh.
# @author Jamie Ellis / Engage MT
# @created 2026-06-30
# @updated 2026-06-30
# @version 1.0.0
#
# FWP Engage MT — Montana's Official Gateway to the Outdoors
# Licensed under the MIT License.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$MOBILE_DIR")"

# Fail early + actionably if the toolchain isn't ready (Java / Android SDK).
if ! bash "$REPO_ROOT/scripts/doctor-mobile.sh" --require android --quiet; then
  echo ""
  echo "↳ Run 'npm run mobile:bootstrap' to install the Android toolchain,"
  echo "  or grab a prebuilt APK from GitHub → Actions → Mobile (Capacitor)."
  exit 1
fi

echo "▶ Engage MT — Android debug APK"

# 1. Web bundle.
echo ""
echo "▶ Building web bundle…"
bash "$REPO_ROOT/mobile/scripts/lib/web-build.sh"

# 1b. Prune mobile-excluded assets (regs PDFs, ~134 MB) from web/dist before sync.
echo ""
echo "▶ Pruning mobile-excluded assets…"
node "$REPO_ROOT/scripts/prune-mobile-assets.mjs"

# 2. Capacitor sync.
echo ""
echo "▶ Syncing Capacitor (android)…"
( cd "$MOBILE_DIR" && npx cap sync android )

# 3. Gradle debug build.
echo ""
echo "▶ Building debug APK via Gradle…"
( cd "$MOBILE_DIR/android" && ./gradlew assembleDebug )

APK_PATH="$MOBILE_DIR/android/app/build/outputs/apk/debug/app-debug.apk"

echo ""
if [ -f "$APK_PATH" ]; then
  echo "✅ APK built:"
  echo "   $APK_PATH"
  echo ""
  echo "   Install on a connected device/emulator:  adb install \"$APK_PATH\""
  echo "   …or AirDrop / copy it to an Android phone and tap to install."
  # Reveal in Finder on macOS (no-op elsewhere).
  command -v open >/dev/null 2>&1 && open -R "$APK_PATH" || true
else
  echo "⚠️  Build finished but APK not found at the expected path:"
  echo "   $APK_PATH"
  echo "   Check the Gradle output above."
  exit 1
fi
