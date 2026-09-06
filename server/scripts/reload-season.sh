#!/usr/bin/env bash
# ============================================================================
# reload-season.sh — reset + full ETL reload + republish for one season year.
# ----------------------------------------------------------------------------
# The DELETE-DRAFT loaders (loadDeaJson, loadAntelope) fail on an already-PUBLISHED
# year (unique-constraint collision). This flips the year's working rows back to
# DRAFT first — the public API keeps serving the immutable published_* snapshot the
# whole time, so there is no live outage — then re-runs the full ETL pipeline and
# leaves the year DRAFT for a staff review + publish (or pass PUBLISH=1 to auto-publish).
#
# Usage (against the target DB, e.g. via `railway run`):
#   DATABASE_URL=... DEA_JSON=... [YEAR=2026] [PUBLISH=1] bash server/scripts/reload-season.sh
# ALWAYS `npm run backup` (pg_dump) before running this against production.
# ============================================================================
set -euo pipefail
YEAR="${YEAR:-2026}"
cd "$(dirname "$0")/.."

echo "▶ reload-season: year=$YEAR (DB from \$DATABASE_URL)"
echo "  … resetting working rows PUBLISHED→DRAFT (snapshot still served)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<SQL
UPDATE regs.license_instrument SET record_status='DRAFT' WHERE season_year=$YEAR AND record_status='PUBLISHED';
UPDATE regs.opportunity        SET record_status='DRAFT' WHERE season_year=$YEAR AND record_status='PUBLISHED';
UPDATE regs.district_note      SET record_status='DRAFT' WHERE season_year=$YEAR AND record_status='PUBLISHED';
UPDATE regs.license_product    SET record_status='DRAFT' WHERE season_year=$YEAR AND record_status='PUBLISHED';
UPDATE regs.content_section    SET record_status='DRAFT' WHERE season_year=$YEAR AND record_status='PUBLISHED';
UPDATE regs.important_date     SET record_status='DRAFT' WHERE season_year=$YEAR AND record_status='PUBLISHED';
UPDATE regs.contact            SET record_status='DRAFT' WHERE season_year=$YEAR AND record_status='PUBLISHED';
UPDATE regs.season_year        SET status_code='DRAFT'   WHERE season_year=$YEAR;
SQL

for t in phase-a antelope multi-district restricted-areas fees-content pamphlet-content \
         sunrise-sunset sunrise-sunset-grid region-maps pamphlet-assets important-dates contacts; do
  echo "  … etl:$t"
  npm run --silent "etl:$t" "$YEAR" >/dev/null 2>&1 || { echo "  ✗ etl:$t FAILED"; exit 1; }
done

echo "  … audit:book"
npm run --silent audit:book >/dev/null 2>&1 && echo "  ✓ audit green" || echo "  ⚠ audit reported findings — review before publishing"

if [ "${PUBLISH:-0}" = "1" ]; then
  echo "  … publishing $YEAR"
  npx --yes tsx -e "import{publishSeasonYear}from'./src/services/publish.ts';import{closePool}from'./src/db/pool.ts';(async()=>{const r=await publishSeasonYear($YEAR,'etl@fwp.mt.gov','full pamphlet parity reload');console.log('  publish:',JSON.stringify(r));await closePool();})().catch(e=>{console.error(e);process.exit(1);});"
else
  echo "  ▷ year left DRAFT — review in the staff app, then publish."
fi
echo "▶ reload-season done."
