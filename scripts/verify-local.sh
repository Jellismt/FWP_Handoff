#!/usr/bin/env bash
# @file verify-local.sh
# @module engage-mt/scripts
# @description The one quality gate. `npm run verify` runs it before any merge
#              or deploy; `scripts/ci.sh` runs it on a hosted runner. Fail-fast:
#              the first red step ends the run. Two modes:
#                • default → lint · type-check · every workspace's tests (with
#                  coverage where floors exist) · production build · the
#                  repository audits. Deterministic and offline, except for the
#                  server's database integration tests, which run when a Docker
#                  daemon or TEST_DATABASE_URL is available and are reported as
#                  SKIPPED otherwise (VERIFY_REQUIRE_DB=1 turns that skip into
#                  a failure — what scripts/ci.sh does).
#                • --e2e → the Playwright e2e + axe suite (`npm run verify:e2e`).
#                  Needs network and a full headless map render, so it is a
#                  separate opt-in run.
# @author Jamie Ellis / Engage MT
# @created 2026-06-30
# @updated 2026-09-06
# @version 2.0.0
#
# FWP Engage MT — Montana's Official Gateway to the Outdoors
# Licensed under the MIT License.

set -uo pipefail

# --- args -------------------------------------------------------------------
MODE="core"
for arg in "$@"; do
  case "$arg" in
    --e2e) MODE="e2e" ;;
    *) echo "Unknown arg: $arg (accepted: --e2e)"; exit 2 ;;
  esac
done

# --- locate repo root (works from any cwd) ----------------------------------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The ArcGIS SDK bundle pushes Vite past the default ~2 GB Node heap (OOM,
# exit 134); every build path uses the same 4 GB heap.
export NODE_OPTIONS="--max-old-space-size=4096"

START=$(date +%s)
SKIPPED=()

# step "Label" cmd...  -> hard gate: on failure, print summary and exit 1.
step() {
  local label="$1"; shift
  echo ""
  echo "──────────────────────────────────────────────────────────────"
  echo "▶ $label"
  echo "──────────────────────────────────────────────────────────────"
  if "$@"; then
    echo "✅ $label"
  else
    local end; end=$(date +%s)
    echo "❌ $label — FAILED"
    echo ""
    echo "══════════════════════════════════════════════════════════════"
    echo "❌ VERIFY FAILED in $((end - START))s at: $label"
    echo "   Fix it, then re-run before pushing."
    exit 1
  fi
}

# Server database integration tests (server/test/integration — RBAC, edit
# locks, publish atomicity, audit rows). They need a Postgres: a caller-provided
# TEST_DATABASE_URL, or a Docker daemon for the throwaway compose container.
db_tests() {
  if [ -n "${TEST_DATABASE_URL:-}" ]; then
    (cd server && npx vitest run)
  elif docker info >/dev/null 2>&1; then
    npm run test:server --workspace server
  elif [ "${VERIFY_REQUIRE_DB:-0}" = "1" ]; then
    echo "❌ Server database tests could not run: no Docker daemon and no TEST_DATABASE_URL,"
    echo "   and VERIFY_REQUIRE_DB=1 requires them."
    return 1
  else
    echo "⚠️  SKIPPED: server database integration tests (server/test/integration)."
    echo "    No Docker daemon and no TEST_DATABASE_URL. Start Docker, or point TEST_DATABASE_URL"
    echo "    at an empty Postgres, then re-run. The regs API is NOT fully verified until these run."
    SKIPPED+=("Server database integration tests")
  fi
}

# ============================================================================
# --e2e : Playwright e2e + axe
# ============================================================================
if [ "$MODE" = "e2e" ]; then
  echo "▶ Playwright e2e+axe suite (opt-in). Needs network + full map render."
  # Playwright's webServer runs `npm run preview` against web/dist, so a build
  # must exist first.
  step "Build (vite, 4 GB heap)"      npm run build --workspace web
  # Idempotent — chromium is cached after the first run. Skip --with-deps
  # (Linux-only OS packages; on macOS it would just prompt for sudo).
  step "Ensure Playwright chromium"   bash -c 'cd web && npx playwright install chromium'
  step "e2e + axe (Playwright)"       bash -c 'cd web && npx playwright test'

  END=$(date +%s)
  echo ""
  echo "══════════════════════════════════════════════════════════════"
  echo "✅ E2E PASSED in $((END - START))s."
  exit 0
fi

# ============================================================================
# default : lint · type-check · tests · build · audits
# ============================================================================
step "Install (root + workspaces)"   npm install --no-fund --no-audit
step "Lint (eslint + stylelint + prettier + units)" npm run lint --workspace web
step "Type-check (tsc -b --noEmit)"  bash -c 'cd web && npx tsc -b --noEmit'
step "Lint (server + staff)"         npm run lint --workspace server --workspace staff
step "Type-check (server + staff)"   npm run typecheck --workspace server --workspace staff
step "Shared contract type-check"    npm run typecheck:contract --workspace shared
step "Unit + integration tests (coverage)" npm run test --workspace web -- --coverage
step "Unit tests (server + shared + staff, coverage)" npm run test --workspace server --workspace shared --workspace staff -- --coverage
step "Unit tests (mobile)"                npm run test --workspace mobile
step "Unit tests (build + qc scripts)" npm run test:scripts
step "Server database integration tests (Postgres)" db_tests
step "Build (vite, 4 GB heap)"       npm run build --workspace web
step "Bundle size budget"            npm run check:bundle   --workspace web
step "Calcite icon allowlist"        npm run check:calcite-assets --workspace web
step "Data manifest audit"           npm run check:manifest --workspace web
step "CSP allowlist drift"           npm run check:csp-allowlist --workspace web
step "Security-header parity"        npm run check:security-headers
step "Container config sanity"       npm run check:container-config
step "iOS privacy manifest"          npm run check:ios-privacy-manifest
step "Stub registry audit"           npm run check:stubs    --workspace web
step "Data freshness check"          npm run check:data-freshness
step "Built-in regs copy age"        npm run check:regs-floor
step "Doc link integrity"            npm run check:doc-links
step "Capacitor native-import guard" npm run check:capacitor-imports
step "Capacitor plugin parity"       npm run check:plugin-parity
step "Native store-config sanity"    npm run check:native-config
step "GIS-layer registry drift"      npm run check:gis-registry
step "Montana-scoping (national layers)" npm run check:montana-scoping
step "npm audit (moderate+)"         npm audit --audit-level=moderate --workspaces

# --- summary ----------------------------------------------------------------
# Reached only if every hard step passed (step() exits on the first failure).
END=$(date +%s)
echo ""
echo "══════════════════════════════════════════════════════════════"
if [ "${#SKIPPED[@]}" -gt 0 ]; then
  echo "⚠️  VERIFY PASSED WITH SKIPS in $((END - START))s:"
  for s in "${SKIPPED[@]}"; do echo "   • $s"; done
  echo "   Everything that ran is green; the skipped step still needs a run before delivery."
else
  echo "✅ VERIFY PASSED in $((END - START))s — safe to push / deploy."
fi
echo "   (For the a11y/e2e suite too, run \`npm run verify:e2e\`.)"
