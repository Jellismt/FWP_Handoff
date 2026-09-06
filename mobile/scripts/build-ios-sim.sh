#!/usr/bin/env bash
# @file build-ios-sim.sh
# @module engage-mt/mobile/scripts
# @description One-command iOS **simulator** build — the iOS counterpart to
#              build-apk.sh. Builds web, syncs Capacitor, pod-installs, and
#              runs an unsigned `xcodebuild` for the simulator, then prints the
#              `simctl install` command + reveals the .app. NO Apple account
#              needed (simulator only). A device/TestFlight build needs Apple
#              Developer enrollment (J-021) — see release-ios.sh.
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
APP_DIR="$MOBILE_DIR/ios/App"

# CocoaPods 1.16.x calls String#unicode_normalize on the install path, which
# raises "Unicode Normalization not appropriate for ASCII-8BIT" when the shell
# has no UTF-8 locale (empty LANG/LC_ALL — the norm in CI / non-interactive
# shells, though not in a login Terminal). Force a UTF-8 locale so `pod install`
# / `cap sync` never crash on it. Honors an already-set locale.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

if [ "$(uname)" != "Darwin" ]; then
  echo "❌ iOS builds require macOS + Xcode."
  exit 1
fi

# Fail early + actionably if Xcode / CocoaPods aren't ready.
if ! bash "$REPO_ROOT/scripts/doctor-mobile.sh" --require ios --quiet; then
  echo ""
  echo "↳ Run 'npm run mobile:bootstrap' to install CocoaPods (and verify Xcode)."
  exit 1
fi

echo "▶ Engage MT — iOS simulator build"

# 1. Web bundle.
echo ""
echo "▶ Building web bundle…"
bash "$REPO_ROOT/mobile/scripts/lib/web-build.sh"

# 1b. Prune mobile-excluded assets (regs PDFs, ~134 MB) from web/dist before sync.
echo ""
echo "▶ Pruning mobile-excluded assets…"
node "$REPO_ROOT/scripts/prune-mobile-assets.mjs"

# 1c. Remove our own derived-data dir before syncing. `cap sync` runs pod install,
# which triggers an `xcodebuild clean`; that clean refuses to delete an App/build
# directory it didn't create itself ("was not created by the build system"), so a
# leftover from a previous run of THIS script (which builds into `-derivedDataPath
# build`) makes the next sync fail. Clearing it keeps the script idempotent — and
# a simulator build is a clean build anyway.
rm -rf "$APP_DIR/build"

# 2. Capacitor sync — regenerate the native iOS project (incl. the Podfile) and
# pod-install. A FULL `cap sync` (not just `cap copy`) is deliberate: npm
# workspace hoisting can relocate a Capacitor plugin between the repo-root and
# mobile/ node_modules WITHOUT changing any pod version, which silently
# invalidates the committed Podfile's relative paths (the Pods target then
# references moved source files → "Build input files cannot be found"). The
# Podfile.lock↔Manifest.lock check can't see that path drift, so we always
# regenerate. With the UTF-8 locale exported above, pod install no longer
# crashes under Homebrew Ruby 4.x.
echo ""
echo "▶ Syncing Capacitor (ios) — regenerates the Podfile + pod install…"
if ! ( cd "$MOBILE_DIR" && npx cap sync ios ); then
  echo ""
  echo "❌ 'cap sync ios' failed. If the error mentions 'unicode_normalize' or a"
  echo "   Ruby stacktrace, CocoaPods is fighting your active Ruby (Homebrew Ruby"
  echo "   4.x breaks CocoaPods 1.16.x on some setups even with a UTF-8 locale)."
  echo "   Fixes:"
  echo "     • use system Ruby:  sudo gem install cocoapods   (then re-run), or"
  echo "     • run the sync under a Ruby ≤ 3.3 via rbenv/rvm."
  exit 1
fi

# 3b. Xcode 26 ships platform runtimes as separate downloads. Without an iOS
# simulator runtime there are zero simulator destinations and xcodebuild fails
# with a cryptic "Found no destinations / Supported platforms is empty". Catch
# it here with the one-line fix (an ~8.5 GB one-time download).
if ! xcrun simctl list runtimes 2>/dev/null | grep -qi "iOS"; then
  echo ""
  echo "❌ No iOS Simulator runtime is installed (Xcode 26 downloads these separately)."
  echo "   Run this once (~8.5 GB), then re-run:"
  echo "     xcodebuild -downloadPlatform iOS"
  exit 1
fi

# 4. Unsigned simulator build into a known derived-data path.
echo ""
echo "▶ Building for the iOS Simulator (unsigned)…"
( cd "$APP_DIR" && xcodebuild \
    -workspace App.xcworkspace \
    -scheme App \
    -configuration Debug \
    -sdk iphonesimulator \
    -derivedDataPath build \
    CODE_SIGN_IDENTITY="" \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGNING_ALLOWED=NO \
    build )

SIM_APP="$APP_DIR/build/Build/Products/Debug-iphonesimulator/App.app"

echo ""
if [ -d "$SIM_APP" ]; then
  echo "✅ Simulator app built:"
  echo "   $SIM_APP"
  echo ""
  echo "   Boot a simulator + install + launch:"
  echo "     xcrun simctl boot 'iPhone 15' 2>/dev/null || true"
  echo "     open -a Simulator"
  echo "     xcrun simctl install booted \"$SIM_APP\""
  echo "     xcrun simctl launch booted gov.mt.fwp.engagemt"
  echo ""
  echo "   Simulator only — a physical iPhone or TestFlight needs Apple"
  echo "   Developer enrollment (J-021). See mobile/scripts/release-ios.sh."
  command -v open >/dev/null 2>&1 && open -R "$SIM_APP" || true
else
  echo "⚠️  Build finished but the .app was not found at:"
  echo "   $SIM_APP"
  echo "   Check the xcodebuild output above."
  exit 1
fi
