#!/usr/bin/env bash
# @file test-with-db.sh
# @module engage-mt/server
# @description Runs the server's full vitest suite — unit AND database
#              integration tests — against a throwaway Postgres started with
#              docker compose. The compose teardown always runs, and the script
#              exits with vitest's status, so a red suite can never report green.
#              `TEST_DATABASE_URL` is what switches vitest into the DB mode
#              (see vitest.config.ts).
# @author Jamie Ellis / Engage MT
# @created 2026-09-06
# @updated 2026-09-06
# @version 1.0.0
#
# FWP Engage MT — Montana's Official Gateway to the Outdoors
# Licensed under the MIT License.

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

COMPOSE="docker compose -f docker-compose.test.yml"
$COMPOSE up -d --wait || { echo "❌ could not start the test Postgres container"; exit 1; }
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/regs_test npx vitest run "$@"
rc=$?
$COMPOSE down
exit $rc
