#!/usr/bin/env bash
# @file deploy-iphone.sh
# @module engage-mt/mobile/scripts
# @description Repeatable "rebuild + push to my connected iPhone" loop for
#              free-Apple-ID device testing (no App Store, no paid account).
#              Rebuilds the web bundle, prunes mobile-excluded assets, and copies
#              the fresh bundle into the Xcode project so you just press ⌘R.
#              DEFAULT path uses `cap copy` (NOT `cap sync`) — it never runs
#              `pod install`, sidestepping the CocoaPods-1.16 crash under
#              Homebrew Ruby 4.x. Use --sync only when you add/change a native
#              Capacitor plugin (rare). One-time setup + full loop docs:
#              docs/mobile/building.md
# @author Jamie Ellis / Engage MT
# @created 2026-07-01
# @updated 2026-07-01
# @version 1.0.0
#
# FWP Engage MT — Montana's Official Gateway to the Outdoors
# Licensed under the MIT License.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$MOBILE_DIR")"
APP_DIR="$MOBILE_DIR/ios/App"

DO_SYNC=0
for arg in "$@"; do
  case "$arg" in
    --sync) DO_SYNC=1 ;;
    -h|--help)
      echo "Usage: npm run mobile:iphone [-- --sync]"
      echo "  (default)  web build + prune + cap copy ios  → press ⌘R in Xcode"
      echo "  --sync     also runs cap sync (native plugin changes; may hit CocoaPods)"
      exit 0 ;;
  esac
done

if [ "$(uname)" != "Darwin" ]; then
  echo "❌ iOS builds require macOS + Xcode."
  exit 1
fi

echo "▶ Engage MT — rebuild → iPhone"

# 1. Web bundle.
echo ""
echo "▶ Building web bundle…"
bash "$REPO_ROOT/mobile/scripts/lib/web-build.sh"

# 2. Prune mobile-excluded assets (regs PDFs, ~134 MB) before the copy.
echo ""
echo "▶ Pruning mobile-excluded assets…"
node "$REPO_ROOT/scripts/prune-mobile-assets.mjs"

# 2b. Heal Capacitor plugin symlinks. npm workspace hoisting can relocate some
# @capacitor/* plugins to the ROOT node_modules while the generated CocoaPods
# project still expects them under mobile/node_modules (the Podfile paths). A
# missing plugin there surfaces in Xcode as "Build input files cannot be found"
# (e.g. CapacitorStatusBar). Re-point them with symlinks so the in-sync Pods
# resolve — no `pod install` needed (it crashes under Homebrew Ruby 4.x).
# Idempotent: only links what's missing.
echo ""
echo "▶ Healing Capacitor plugin symlinks (workspace hoisting)…"
POD_APP="$MOBILE_DIR/ios/App"
if [ -f "$POD_APP/Podfile" ]; then
  healed=0
  while IFS= read -r plug; do
    dest="$MOBILE_DIR/node_modules/@capacitor/$plug"
    src="$REPO_ROOT/node_modules/@capacitor/$plug"
    if [ ! -e "$dest" ] && [ -d "$src" ]; then
      mkdir -p "$MOBILE_DIR/node_modules/@capacitor"
      ln -s "../../../node_modules/@capacitor/$plug" "$dest" \
        && { echo "  ↳ linked @capacitor/$plug (hoisted to root)"; healed=$((healed+1)); }
    fi
  done < <(grep -oE "'\.\./\.\./node_modules/@capacitor/[a-z-]+" "$POD_APP/Podfile" | sed 's#.*/@capacitor/##' | sort -u)
  [ "$healed" -eq 0 ] && echo "  ↳ all plugin paths already resolve ✅"
fi

# 3. Push the fresh bundle into the native project.
echo ""
if [ "$DO_SYNC" -eq 1 ]; then
  # Full sync — only needed when a native plugin was added/changed. This may run
  # `pod install`, which crashes under Homebrew Ruby 4.x (CocoaPods 1.16). If it
  # does, run 'sudo gem install cocoapods' (system Ruby) or a Ruby ≤ 3.3, then retry.
  echo "▶ Syncing Capacitor (ios, full) — plugin changes…"
  ( cd "$MOBILE_DIR" && npx cap sync ios )
else
  # Fast path: copy web assets + config only. No pod install → no Ruby-4 crash.
  echo "▶ Copying web bundle into Xcode project (cap copy)…"
  ( cd "$MOBILE_DIR" && npx cap copy ios )
fi

# 4. Make sure Xcode is open on the workspace so ⌘R is all that's left.
echo ""
if pgrep -x Xcode >/dev/null 2>&1; then
  echo "▶ Xcode already open — new bundle is in place."
else
  echo "▶ Opening Xcode…"
  ( cd "$MOBILE_DIR" && npx cap open ios )
fi

echo ""
echo "✅ Fresh build is staged."
echo ""
echo "   In Xcode:  select your iPhone in the device dropdown, then press ⌘R (Run)."
echo "   The app reinstalls on your phone in a few seconds."
echo ""
echo "   First time only? See the one-time setup (Apple ID sign-in, trust device):"
echo "     docs/mobile/building.md"
