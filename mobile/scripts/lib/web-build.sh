#!/usr/bin/env bash
#
# web-build.sh — Build the web app for a MOBILE bundle.
#
# One source of truth for how every mobile build produces web/dist. It injects
# the dedicated regs API base (VITE_FWP_REGS_API_BASE) so hunting regs go LIVE
# when the phone is online, while Tier-2 datasets stay bundled (VITE_FWP_API_BASE
# is deliberately left UNSET on mobile). The build-time regs snapshot remains the
# offline floor for a never-been-online fresh install..
#
# Override the base for staging:  VITE_FWP_REGS_API_BASE=https://… <mobile script>
#
# Called by all mobile build scripts in place of `npm run build`. Runs the build
# in a subshell so the caller's cwd is unchanged.
#
# FWP Engage MT — Montana's Official Gateway to the Outdoors
# Licensed under the MIT License.
set -euo pipefail

# Resolve the repo root from this script's location (…/mobile/scripts/lib).
REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"

# Public Regs Manager API (no auth). Overridable via the env var for staging.
REGS_BASE="${VITE_FWP_REGS_API_BASE:-https://regs-api-production.up.railway.app/api/v1/fwp}"

# A mobile binary ships whatever built-in regs copy is committed; refuse a stale one.
node "$REPO_ROOT/scripts/check-regs-floor-age.mjs"

echo "▶ Building web bundle for mobile (regs live base: $REGS_BASE; Tier-2 stays bundled)"
( cd "$REPO_ROOT/web" && VITE_FWP_REGS_API_BASE="$REGS_BASE" npm run build )
