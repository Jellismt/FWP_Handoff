#!/usr/bin/env bash
# Engage MT — build web, sync to iOS, open Xcode.
# Build the web bundle, sync it into the iOS project, and open Xcode.

set -euo pipefail

# UTF-8 locale so `cap sync`'s pod install doesn't crash under Homebrew Ruby 4.x
# on a locale-less shell (String#unicode_normalize / ASCII-8BIT). Honors an
# already-set locale.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

# Repo root is two levels up from this script.
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "→ Building web (Vite)…"
bash "$REPO_ROOT/mobile/scripts/lib/web-build.sh"

echo "→ Pruning mobile-excluded assets (regs PDFs)…"
node "$REPO_ROOT/scripts/prune-mobile-assets.mjs"

echo "→ Syncing to iOS (capacitor)…"
( cd "$REPO_ROOT/mobile" && npx cap sync ios )

echo "→ Opening Xcode…"
( cd "$REPO_ROOT/mobile" && npx cap open ios )
