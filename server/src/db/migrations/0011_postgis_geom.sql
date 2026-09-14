-- ============================================================================
-- 0011_postgis_geom.sql — PostGIS geometry sidecars (RETIRED by 0020)
-- ----------------------------------------------------------------------------
-- HISTORICAL / DO NOT REVIVE. These sidecars were never populated (the ETL syncs
-- codes only, returnGeometry=false) and nothing read them. Migration 0020 drops
-- them; the regs DB is tabular and links to live public ESRI layers by key
-- (0019 regs.gis_layer + ADR-0061 addendum). Kept append-only for history; still
-- skipped by the runner under SKIP_POSTGIS=1. The block below is the original 0011.
-- ----------------------------------------------------------------------------
-- Geometry is isolated to sidecar tables so the core schema (0001-0010) applies
-- without PostGIS. If the Railway Postgres image lacks PostGIS, skip this migration
-- (the app degrades to text boundary_desc + client-side ArcGIS resolution; the
-- server-side regulation-at-point endpoint simply returns 501).
-- oracle-note: these 3 tables + the point-query become SDO_GEOMETRY / SDO_CONTAINS
--   on Oracle — the ENTIRE spatial blast radius of the port.
-- ============================================================================

-- Up Migration
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE regs.district_geom (
  district_id BIGINT PRIMARY KEY REFERENCES regs.district,
  geom        geometry(MultiPolygon, 4326) NOT NULL,
  source_etag VARCHAR(100),
  synced_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_district_geom ON regs.district_geom USING gist (geom);

CREATE TABLE regs.portion_geom (
  portion_id BIGINT PRIMARY KEY REFERENCES regs.district_portion,
  geom       geometry(MultiPolygon, 4326) NOT NULL,
  derivation VARCHAR(200),
  synced_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_portion_geom ON regs.portion_geom USING gist (geom);

CREATE TABLE regs.rarea_geom (
  rarea_id   BIGINT PRIMARY KEY REFERENCES regs.restricted_area,
  geom       geometry(MultiPolygon, 4326) NOT NULL,
  derivation VARCHAR(200),
  synced_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_rarea_geom ON regs.rarea_geom USING gist (geom);

-- Down Migration
DROP TABLE IF EXISTS regs.rarea_geom;
DROP TABLE IF EXISTS regs.portion_geom;
DROP TABLE IF EXISTS regs.district_geom;
