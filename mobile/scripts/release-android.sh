#!/usr/bin/env bash
# @file release-android.sh
# @module engage-mt/mobile/scripts
# @description Android **release** build via Gradle. Default output is an AAB
#              (Android App Bundle — what the Play Store wants); pass `--apk`
#              for a standalone signed APK (direct sideload / non-Play
#              distribution). Reads signing config from the gitignored
#              mobile/android/keystore.properties (create it with
#              gen-keystore.sh). Fails loudly when the keystore is missing.
# / J-022.
# @author Jamie Ellis / Engage MT
# @created 2026-05-29
# @updated 2026-06-30
# @version 1.1.0
#
# FWP Engage MT — Montana's Official Gateway to the Outdoors
# Licensed under the MIT License.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$MOBILE_DIR")"

# --- args -------------------------------------------------------------------
# --apk : build a standalone signed APK (assembleRelease) instead of the
#         default AAB (bundleRelease).
WANT_APK=0
for arg in "$@"; do
  case "$arg" in
    --apk) WANT_APK=1 ;;
    *) echo "Unknown option: $arg (supported: --apk)"; exit 2 ;;
  esac
done

# The Android Gradle build reads the keystore from rootProject.file(
# "keystore.properties") — i.e. mobile/android/keystore.properties — so that
# is the path we must check (NOT android/app/...). Keep this in lockstep with
# mobile/android/app/build.gradle.
KEYSTORE_FILE="$MOBILE_DIR/android/keystore.properties"
if [ ! -f "$KEYSTORE_FILE" ]; then
  echo "❌ Missing $KEYSTORE_FILE"
  echo "   Without it, Gradle produces an UNSIGNED release the stores reject."
  echo ""
  echo "   Create it the easy way:"
  echo "     bash mobile/scripts/gen-keystore.sh"
  echo ""
  echo "   …or by hand (template: mobile/android/keystore.properties.example):"
  echo "     storeFile=app/engagemt.keystore"
  echo "     storePassword=<keystore password>"
  echo "     keyAlias=engagemt"
  echo "     keyPassword=<key password>"
  echo "   Per J-022 in JAMIE-TODOS.md."
  exit 1
fi

echo "▶ Engage MT Android release"

# 1. Build the web bundle.
cd "$REPO_ROOT/web"
echo ""
echo "▶ Building web bundle..."
bash "$REPO_ROOT/mobile/scripts/lib/web-build.sh"

# 1b. Prune mobile-excluded assets (regs PDFs, ~134 MB) before sync.
echo ""
echo "▶ Pruning mobile-excluded assets..."
node "$REPO_ROOT/scripts/prune-mobile-assets.mjs"

# 2. Sync Capacitor.
cd "$MOBILE_DIR"
echo ""
echo "▶ Syncing Capacitor..."
npx cap sync android

# 3. Build the signed artifact.
cd "$MOBILE_DIR/android"
echo ""
if [ "$WANT_APK" -eq 1 ]; then
  echo "▶ Building signed release APK via Gradle..."
  ./gradlew assembleRelease
  OUT_PATH="$MOBILE_DIR/android/app/build/outputs/apk/release/app-release.apk"
  NEXT="Sideload it (adb install) or distribute the file directly."
else
  echo "▶ Building release bundle (AAB) via Gradle..."
  ./gradlew bundleRelease
  OUT_PATH="$MOBILE_DIR/android/app/build/outputs/bundle/release/app-release.aab"
  NEXT="Upload to Play Console → Internal testing."
fi

echo ""
if [ -f "$OUT_PATH" ]; then
  echo "✅ Built: $OUT_PATH"
  echo "   Verify it's correctly signed: npm run verify:signing"
  echo "   Next: $NEXT"
else
  echo "⚠️  Build completed but artifact not found at expected path:"
  echo "   $OUT_PATH"
  echo "   Check Gradle output."
  exit 1
fi
