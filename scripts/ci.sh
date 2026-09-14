#!/usr/bin/env bash
# @file ci.sh
# @module engage-mt/scripts
# @description Runner-agnostic continuous-integration entry point. Any CI system
#              (GitLab, Azure DevOps, Jenkins, a cron on a build box) runs this one
#              script after `npm ci`; it is the same gate developers run locally
#              (`npm run verify`) plus the Playwright e2e/axe suite and, when the
#              `gitleaks` binary is installed, a secret scan.
#
#              Requirements on the runner: Node 20+, Chromium for Playwright
#              (`cd web && npx playwright install --with-deps chromium`), and a
#              Postgres for the server database tests — either a Docker daemon
#              (the script starts a throwaway container) or `TEST_DATABASE_URL`
#              pointing at an empty database. Without one of those the run FAILS:
#              a green CI must mean the regs API was fully verified.
#
#              Usage: bash scripts/ci.sh [--no-e2e]
# @author Jamie Ellis / Engage MT
# @created 2026-09-06
# @updated 2026-09-06
# @version 1.0.0
#
# FWP Engage MT — Montana's Official Gateway to the Outdoors
# Licensed under the MIT License.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUN_E2E=1
for arg in "$@"; do
  case "$arg" in
    --no-e2e) RUN_E2E=0 ;;
    *) echo "Unknown arg: $arg (accepted: --no-e2e)"; exit 2 ;;
  esac
done

# CI=1 → Playwright forbids `test.only`, retries once, single worker.
# VERIFY_REQUIRE_DB=1 → the database test step fails instead of skipping.
export CI=1
export VERIFY_REQUIRE_DB=1

bash scripts/verify-local.sh || exit $?

if [ "$RUN_E2E" = "1" ]; then
  bash scripts/verify-local.sh --e2e || exit $?
fi

if command -v gitleaks >/dev/null 2>&1; then
  echo ""
  echo "▶ Secret scan (gitleaks)"
  gitleaks detect --no-banner --redact --source "$ROOT" || exit $?
  echo "✅ Secret scan"
else
  echo ""
  echo "ℹ️  gitleaks not installed — secret scan skipped (install it on the runner to enable)."
fi

echo ""
echo "✅ CI PASSED"
