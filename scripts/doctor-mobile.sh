#!/usr/bin/env bash
# @file doctor-mobile.sh
# @module engage-mt/scripts
# @description Read-only mobile-build readiness check. Prints a ✅/❌ table of
#              every prerequisite (Node, Java 21, Android SDK, Xcode,
#              CocoaPods, fastlane) with the exact fix command for each gap.
#              Used standalone (`npm run mobile:doctor`) and as a guard by the
#              build scripts via `--require android|ios`.
# @author Jamie Ellis / Engage MT
# @created 2026-06-30
# @updated 2026-06-30
# @version 1.0.0
#
# FWP Engage MT — Montana's Official Gateway to the Outdoors
# Licensed under the MIT License.

set -uo pipefail

# --- args -------------------------------------------------------------------
# --require android|ios|android-release|ios-release : exit non-zero (and stay
#   quiet on success) when that target's prerequisites aren't all met. The
#   plain platform gates (android|ios) guard UNSIGNED builds; the *-release
#   gates additionally require the signing credentials. Used as a guard by
#   build-apk.sh / build-ios-sim.sh (and optionally before a store push).
# Parsed with an explicit "expecting value" flag so `--require <value>` works
# regardless of where it sits relative to other flags (a `shift` inside a
# `for arg in "$@"` loop does NOT advance the iterator — it silently
# mis-parses when --quiet precedes --require).
REQUIRE=""
QUIET=0
expect_require=0
for arg in "$@"; do
  if [ "$expect_require" -eq 1 ]; then REQUIRE="$arg"; expect_require=0; continue; fi
  case "$arg" in
    --require=*) REQUIRE="${arg#*=}" ;;
    --require) expect_require=1 ;;
    --quiet) QUIET=1 ;;
  esac
done

GREEN="✅"
RED="❌"

# Tracks whether the required platform is fully satisfied.
android_ok=1
ios_ok=1
# Signed-release credential readiness (advisory unless --require *-release).
android_release_ok=1
ios_release_ok=1

say() { [ "$QUIET" -eq 1 ] || echo -e "$@"; }

# row <label> <ok:0|1> <fix-command>
row() {
  local label="$1" ok="$2" fix="$3"
  if [ "$ok" -eq 0 ]; then
    say "  $GREEN $label"
  else
    say "  $RED $label"
    say "       fix: $fix"
  fi
}

# has <cmd> → 0 if on PATH
has() { command -v "$1" >/dev/null 2>&1; }

say ""
say "Engage MT — mobile build readiness"
say "=================================="

# --- shared -----------------------------------------------------------------
say ""
say "Shared:"
node_ok=1; has node && node_ok=0
row "Node.js $(has node && node --version)" "$node_ok" "install Node 20+ (https://nodejs.org)"

# Xcode license blocks Homebrew installs AND iOS/Android builds on macOS even
# though `xcodebuild -version` succeeds without it — check it explicitly.
if [ "$(uname)" = "Darwin" ] && has xcodebuild; then
  license_ok=0
  xcodebuild -license check >/dev/null 2>&1 || license_ok=1
  row "Xcode license accepted" "$license_ok" "sudo xcodebuild -license accept   # one-time, needs your password"
fi

# --- android ----------------------------------------------------------------
say ""
say "Android (APK):"

# The Capacitor 8.4 plugins (e.g. @capacitor/camera) declare a Java-21
# toolchain, so a JDK >= 21 must be discoverable — not just any java. The
# macOS /usr/bin/java stub exists but errors when no JDK is installed, so only
# parse a version from a java that actually runs.
java_ok=1
java_ver=""
if has java && java -version >/dev/null 2>&1; then
  java_ver="$(java -version 2>&1 | head -1 | sed -E 's/.*version "([0-9]+).*/\1/')"
  [ "${java_ver:-0}" -ge 21 ] 2>/dev/null && java_ok=0
fi
row "Java (JDK 21+)${java_ver:+ — found $java_ver}" "$java_ok" "npm run mobile:bootstrap   # installs openjdk@21"

sdk_ok=1
# Android SDK is found via ANDROID_HOME / ANDROID_SDK_ROOT or the default path.
SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
if [ -d "$SDK_DIR" ] && { [ -d "$SDK_DIR/platform-tools" ] || has sdkmanager; }; then sdk_ok=0; fi
row "Android SDK ($SDK_DIR)" "$sdk_ok" "npm run mobile:bootstrap   # installs cmdline-tools + platform 36"

# Compute android readiness explicitly (avoid the earlier double-assign).
if [ "$java_ok" -eq 0 ] && [ "$sdk_ok" -eq 0 ]; then android_ok=0; else android_ok=1; fi

# --- ios --------------------------------------------------------------------
say ""
say "iOS (simulator build):"

if [ "$(uname)" = "Darwin" ]; then
  xcode_ok=1; has xcodebuild && xcodebuild -version >/dev/null 2>&1 && xcode_ok=0
  row "Xcode ($(has xcodebuild && xcodebuild -version 2>/dev/null | head -1))" "$xcode_ok" "install Xcode from the App Store, then: xcode-select --install"

  pod_ok=1; has pod && pod_ok=0
  row "CocoaPods" "$pod_ok" "npm run mobile:bootstrap   # installs cocoapods"

  if [ "$xcode_ok" -eq 0 ] && [ "$pod_ok" -eq 0 ]; then ios_ok=0; else ios_ok=1; fi
else
  say "  (iOS builds require macOS — skipped on $(uname))"
  ios_ok=1
fi

# --- store-release credential preflight (advisory) -------------------------
# Repo root = parent of this script's dir (scripts/ lives at the repo root).
REPO_ROOT="$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"
MOBILE="$REPO_ROOT/mobile"

# Reads a key's value out of a `key=value` env/properties file; empty if absent.
prop() { [ -f "$1" ] && grep -E "^$2=" "$1" 2>/dev/null | head -1 | cut -d= -f2- || true; }

say ""
say "Store release — tooling (optional; only for signed / TestFlight builds):"
fastlane_ok=1; has fastlane && fastlane_ok=0
row "fastlane" "$fastlane_ok" "npm run mobile:bootstrap   # installs fastlane"

# --- Android signed-release credentials ------------------------------------
say ""
say "Android signed release (credentials):"

KS_PROPS="$MOBILE/android/keystore.properties"
ks_props_ok=1; [ -f "$KS_PROPS" ] && ks_props_ok=0
row "keystore.properties" "$ks_props_ok" "bash mobile/scripts/gen-keystore.sh   # create + back it up"

# storeFile inside keystore.properties is relative to mobile/android
# (rootProject). Resolve it + confirm the keystore file actually exists.
ks_file_ok=1
if [ "$ks_props_ok" -eq 0 ]; then
  STORE_REL="$(prop "$KS_PROPS" storeFile)"
  [ -n "$STORE_REL" ] && [ -f "$MOBILE/android/$STORE_REL" ] && ks_file_ok=0
  row "keystore file ($STORE_REL)" "$ks_file_ok" "storeFile in keystore.properties points at a missing file"
fi

play_json_ok=1; [ -f "$MOBILE/android/fastlane/play-key.json" ] && play_json_ok=0
row "Play service-account JSON (fastlane upload)" "$play_json_ok" "Play Console → Setup → API access → drop at mobile/android/fastlane/play-key.json"

if [ "$ks_props_ok" -eq 0 ] && [ "$ks_file_ok" -eq 0 ]; then android_release_ok=0; else android_release_ok=1; fi

# --- iOS signed-release credentials ----------------------------------------
say ""
say "iOS signed release (credentials):"

ENV_LOCAL="$MOBILE/.env.local"
env_ok=1
if [ -f "$ENV_LOCAL" ] \
  && [ -n "$(prop "$ENV_LOCAL" APPLE_TEAM_ID)" ] \
  && [ -n "$(prop "$ENV_LOCAL" IOS_BUNDLE_ID)" ] \
  && [ -n "$(prop "$ENV_LOCAL" IOS_PROVISIONING_PROFILE)" ]; then
  env_ok=0
fi
row ".env.local (3 keys non-empty)" "$env_ok" "cp mobile/.env.local.example mobile/.env.local   # then fill APPLE_TEAM_ID etc."

appfile_ok=1; [ -f "$MOBILE/ios/fastlane/Appfile" ] && appfile_ok=0
row "ios/fastlane/Appfile" "$appfile_ok" "cp mobile/ios/fastlane/Appfile.example mobile/ios/fastlane/Appfile   # fill apple_id + team_id"

authkey_ok=1; ls "$MOBILE"/ios/fastlane/AuthKey_*.p8 >/dev/null 2>&1 && authkey_ok=0
row "App Store Connect API key (AuthKey_*.p8)" "$authkey_ok" "App Store Connect → Keys → drop AuthKey_<id>.p8 in mobile/ios/fastlane/"

if [ "$env_ok" -eq 0 ] && [ "$appfile_ok" -eq 0 ] && [ "$authkey_ok" -eq 0 ]; then ios_release_ok=0; else ios_release_ok=1; fi

say ""
say "Next:"
say "  • Android APK (no signing): npm run apk"
say "  • iOS simulator build:      npm run ios:sim"
say "  • Verify a signed build:    npm run verify:signing"
say "  • Missing tools above:      npm run mobile:bootstrap"
say ""

# --- gate -------------------------------------------------------------------
case "$REQUIRE" in
  android)
    if [ "$android_ok" -ne 0 ]; then
      echo "❌ Android prerequisites missing. Run: npm run mobile:bootstrap" >&2
      exit 1
    fi
    ;;
  ios)
    if [ "$ios_ok" -ne 0 ]; then
      echo "❌ iOS prerequisites missing. Run: npm run mobile:bootstrap (macOS only)" >&2
      exit 1
    fi
    ;;
  android-release)
    if [ "$android_release_ok" -ne 0 ]; then
      echo "❌ Android signed-release credentials missing. Run: bash mobile/scripts/gen-keystore.sh" >&2
      exit 1
    fi
    ;;
  ios-release)
    if [ "$ios_release_ok" -ne 0 ]; then
      echo "❌ iOS signed-release credentials missing. See: cp mobile/.env.local.example mobile/.env.local" >&2
      exit 1
    fi
    ;;
esac

exit 0
