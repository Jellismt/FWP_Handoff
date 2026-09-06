-- ============================================================================
-- 0020_retire_geom_sidecars.sql — remove the unused PostGIS geometry sidecars
-- ----------------------------------------------------------------------------
-- The regs DB is tabular: geometry lives in FWP's live public ESRI layers and is
-- resolved client-side by district/portion/restricted code (see 0019 + ADR-0061
-- addendum). The sidecar tables from 0011 (district_geom/portion_geom/rarea_geom)
-- were never populated — syncDistrictCodes.ts fetches returnGeometry=false — and
-- nothing reads them. This drops them so PostGIS leaves the schema entirely and
-- the Oracle port has ZERO spatial blast radius (no SDO_GEOMETRY translation).
--
-- Filename deliberately has no "postgis" so it runs even under SKIP_POSTGIS=1
-- (unlike 0011, which the runner skips). DROP … IF EXISTS is safe whether or not
-- the tables were ever created.
-- oracle-note: pure DROP DDL — identical on Oracle; no spatial dependency.
-- ============================================================================

-- Up Migration
DROP TABLE IF EXISTS regs.rarea_geom;
DROP TABLE IF EXISTS regs.portion_geom;
DROP TABLE IF EXISTS regs.district_geom;

-- Down Migration
-- Irreversible by design: geometry is external ESRI now (ADR-0061 addendum).
-- To reintroduce sidecars you would re-enable migration 0011 on a PostGIS host;
-- this no-op keeps the runner's one-step rollback valid without resurrecting them.
SELECT 1;
