-- ============================================================================
-- 0021_drop_2025_dea.sql — retire the 2025 DEA season from the live DB
-- ----------------------------------------------------------------------------
-- The app carries only the current Deer/Elk/Antelope book forward (2026+). The
-- 2025 season year was seeded as a lookup row plus its source-document row, but
-- no regulation content was ever loaded against it — every ETL (loadDeaJson /
-- loadAntelope / fees / restricted / sunrise-sunset / content) defaults to 2026,
-- and district.first_season is set to 2026. So the only 2025 rows are the two
-- deleted here; both are childless. seed.ts no longer seeds 2025.
--
-- Targeted (not cascading) on purpose: if an unexpected child row references
-- season_year 2025, this FAILS LOUDLY on the FK rather than silently deleting
-- real data — surface it and handle deliberately.
-- oracle-note: plain DELETE DML — identical on Oracle; no spatial dependency.
-- ============================================================================

-- Up Migration
DELETE FROM regs.source_document WHERE season_year = 2025;
DELETE FROM regs.season_year     WHERE season_year = 2025;

-- Down Migration
-- Restore the two 2025 seed rows (the prior seed.ts state). Idempotent-safe via
-- WHERE NOT EXISTS to match the seed's portable insert style.
INSERT INTO regs.season_year (season_year, starts_on, ends_on, adopted_on, status_code)
SELECT 2025, DATE '2025-03-01', DATE '2026-02-28', DATE '2024-12-19', 'DRAFT'
WHERE NOT EXISTS (SELECT 1 FROM regs.season_year WHERE season_year = 2025);

INSERT INTO regs.source_document
  (season_year, doc_code, title, file_name, adopted_on, valid_from, valid_to)
SELECT 2025, 'dea-2025', '2025 Montana Deer, Elk & Antelope Hunting Regulations',
       '2025-dea-regulations-final-for-web.pdf', DATE '2024-12-19',
       DATE '2025-03-01', DATE '2026-02-28'
WHERE NOT EXISTS (
  SELECT 1 FROM regs.source_document WHERE season_year = 2025 AND doc_code = 'dea-2025'
);
