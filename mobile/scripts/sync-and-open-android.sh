#!/usr/bin/env bash
# Engage MT — build web, sync to Android, open Android Studio.
# Build the web bundle, sync it into the Android project, and open Android Studio.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "→ Building web (Vite)…"
bash "$REPO_ROOT/mobile/scripts/lib/web-build.sh"

echo "→ Pruning mobile-excluded assets (regs PDFs)…"
node "$REPO_ROOT/scripts/prune-mobile-assets.mjs"

echo "→ Syncing to Android (capacitor)…"
( cd "$REPO_ROOT/mobile" && npx cap sync android )

echo "→ Opening Android Studio…"
( cd "$REPO_ROOT/mobile" && npx cap open android )
