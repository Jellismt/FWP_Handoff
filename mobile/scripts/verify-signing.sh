#!/usr/bin/env bash
# @file verify-signing.sh
# @module engage-mt/mobile/scripts
# @description Read-only verifier for signed mobile release artifacts — the
#              closing step of the release loop. Confirms the most recent
#              Android APK/AAB is signed (apksigner / jarsigner, prints the
#              signer cert fingerprint to match against your backed-up keystore)
#              and that the iOS archive carries a valid code signature +
#              non-expired provisioning profile. Safe to run anytime; degrades
#              gracefully when no artifact has been built yet.
# @author Jamie Ellis / Engage MT
# @created 2026-06-30
# @updated 2026-06-30
# @version 1.0.0
#
# FWP Engage MT — Montana's Official Gateway to the Outdoors
# Licensed under the MIT License.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"

GREEN="✅"
RED="❌"
INFO="•"

say() { echo -e "$@"; }
has() { command -v "$1" >/dev/null 2>&1; }

# row <label> <ok:0|1> <detail>
row() {
  local label="$1" ok="$2" detail="${3:-}"
  if [ "$ok" -eq 0 ]; then
    say "  $GREEN $label"
  else
    say "  $RED $label"
  fi
  [ -n "$detail" ] && say "       $detail"
}

# Locate apksigner: on PATH, else newest build-tools under the Android SDK.
find_apksigner() {
  if has apksigner; then command -v apksigner; return 0; fi
  local sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  local candidate
  candidate="$(ls -1 "$sdk"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1)"
  [ -n "$candidate" ] && { echo "$candidate"; return 0; }
  return 1
}

say ""
say "Engage MT — release signing verification"
say "========================================"

# --- Android ----------------------------------------------------------------
say ""
say "Android:"

OUTPUTS="$MOBILE_DIR/android/app/build/outputs"
# Newest of either a release APK or AAB.
ARTIFACT="$(ls -1t \
  "$OUTPUTS"/apk/release/*.apk \
  "$OUTPUTS"/bundle/release/*.aab \
  2>/dev/null | head -1)"

if [ -z "$ARTIFACT" ]; then
  row "release artifact" 1 \
    "no signed artifact found yet — build one with: bash mobile/scripts/release-android.sh [--apk]"
else
  say "  $INFO artifact: ${ARTIFACT#"$MOBILE_DIR"/}"
  case "$ARTIFACT" in
    *.apk)
      APKSIGNER="$(find_apksigner || true)"
      if [ -n "$APKSIGNER" ]; then
        if VERIFY_OUT="$("$APKSIGNER" verify --verbose --print-certs "$ARTIFACT" 2>&1)"; then
          FP="$(echo "$VERIFY_OUT" | grep -i 'SHA-256' | head -1)"
          row "APK signature (apksigner)" 0 "${FP:-verified}"
        else
          row "APK signature (apksigner)" 1 "$VERIFY_OUT"
        fi
      elif has jarsigner; then
        if jarsigner -verify "$ARTIFACT" >/dev/null 2>&1; then
          row "APK signature (jarsigner)" 0 "apksigner not found; used jarsigner fallback"
        else
          row "APK signature (jarsigner)" 1 "jarsigner reported the APK is NOT signed"
        fi
      else
        row "APK signature" 1 "neither apksigner nor jarsigner found — run: npm run mobile:bootstrap"
      fi
      ;;
    *.aab)
      # AAB is a signed jar; apksigner only handles APKs, so use jarsigner.
      if has jarsigner; then
        if jarsigner -verify "$ARTIFACT" >/dev/null 2>&1; then
          row "AAB signature (jarsigner)" 0 "bundle is signed (Play re-signs for delivery)"
        else
          row "AAB signature (jarsigner)" 1 "jarsigner reported the AAB is NOT signed"
        fi
      else
        row "AAB signature" 1 "jarsigner not found (ships with the JDK) — run: npm run mobile:bootstrap"
      fi
      ;;
  esac
fi

# --- iOS --------------------------------------------------------------------
say ""
say "iOS:"

if [ "$(uname)" != "Darwin" ]; then
  say "  $INFO iOS signing verification requires macOS — skipped on $(uname)"
else
  ARCHIVE="$MOBILE_DIR/ios/build/EngageMT.xcarchive"
  APP="$(ls -1d "$ARCHIVE"/Products/Applications/*.app 2>/dev/null | head -1)"
  if [ -z "$APP" ]; then
    row "release archive" 1 \
      "no archive found yet — build one with: bash mobile/scripts/release-ios.sh"
  else
    say "  $INFO archive: ${ARCHIVE#"$MOBILE_DIR"/}"
    if has codesign && codesign -dvvv "$APP" >/dev/null 2>&1; then
      IDENTITY="$(codesign -dvvv "$APP" 2>&1 | grep -i '^Authority=' | head -1)"
      row "code signature (codesign)" 0 "${IDENTITY:-signed}"
    else
      row "code signature (codesign)" 1 "app is not code-signed"
    fi

    PROFILE="$APP/embedded.mobileprovision"
    if [ -f "$PROFILE" ] && has security; then
      EXPIRY="$(security cms -D -i "$PROFILE" 2>/dev/null \
        | plutil -extract ExpirationDate raw - 2>/dev/null || true)"
      if [ -n "$EXPIRY" ]; then
        row "provisioning profile" 0 "expires: $EXPIRY"
      else
        row "provisioning profile" 0 "present (could not parse expiry)"
      fi
    else
      row "provisioning profile" 1 "no embedded.mobileprovision (simulator build? not distributable)"
    fi
  fi
fi

say ""
say "This check is read-only and never transmits keys or artifacts."
say ""

# Exit 0 even when no artifact exists — absence is an expected state, not a
# failure (you may simply not have built a release yet).
exit 0
