#!/usr/bin/env bash
# @file release-ios.sh
# @module engage-mt/mobile/scripts
# @description iOS release build + archive + export. Requires Apple Developer
#              Program enrollment (J-021). Reads signing config from
#              mobile/.env.local (gitignored). Fails loudly with a clear message
#              when credentials are missing — useful CI signal.
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

# Force a UTF-8 locale so CocoaPods (String#unicode_normalize) doesn't crash with
# "Unicode Normalization not appropriate for ASCII-8BIT" when the shell has no
# locale set (empty LANG in CI / non-interactive shells). Honors an existing one.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

ENV_FILE="$MOBILE_DIR/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Missing $ENV_FILE"
  echo "   Create it from the committed template, then fill in your values:"
  echo "     cp mobile/.env.local.example mobile/.env.local"
  echo "   (APPLE_TEAM_ID, IOS_BUNDLE_ID, IOS_PROVISIONING_PROFILE)"
  echo "   Per J-021 in JAMIE-TODOS.md."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${APPLE_TEAM_ID:?APPLE_TEAM_ID missing from $ENV_FILE}"
: "${IOS_BUNDLE_ID:?IOS_BUNDLE_ID missing from $ENV_FILE}"
: "${IOS_PROVISIONING_PROFILE:?IOS_PROVISIONING_PROFILE missing from $ENV_FILE}"

echo "▶ Engage MT iOS release"
echo "  Team:    $APPLE_TEAM_ID"
echo "  Bundle:  $IOS_BUNDLE_ID"
echo "  Profile: $IOS_PROVISIONING_PROFILE"

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
npx cap sync ios

# 3. Install Pods (Apple Developer + Xcode + CocoaPods required).
cd "$MOBILE_DIR/ios/App"
if command -v pod >/dev/null; then
  echo ""
  echo "▶ Installing CocoaPods..."
  pod install
else
  echo "⚠️  CocoaPods not found; skipping pod install. Install with: sudo gem install cocoapods"
fi

# 4. Build + archive via xcodebuild.
if command -v xcodebuild >/dev/null && [ -d /Applications/Xcode.app ]; then
  echo ""
  echo "▶ Archiving via xcodebuild..."
  xcodebuild -workspace App.xcworkspace \
    -scheme App \
    -configuration Release \
    -archivePath "$MOBILE_DIR/ios/build/EngageMT.xcarchive" \
    -allowProvisioningUpdates \
    DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
    PRODUCT_BUNDLE_IDENTIFIER="$IOS_BUNDLE_ID" \
    archive

  echo ""
  echo "✅ Archive built: $MOBILE_DIR/ios/build/EngageMT.xcarchive"
  echo "   Verify it's correctly signed: npm run verify:signing"
  echo "   Next: open the archive in Xcode → Window → Organizer → Distribute App"
else
  echo "⚠️  Xcode not installed; archive step skipped."
  echo "   Install Xcode from the App Store and re-run."
fi
