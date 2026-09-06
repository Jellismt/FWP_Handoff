-- ============================================================================
-- 0019_gis_layer_registry.sql — ESRI GIS-layer linkage (tabular DB ⇄ live GIS)
-- ----------------------------------------------------------------------------
-- The regs DB is TABULAR: it stores district/portion/restricted-area CODES and
-- links to FWP's live public ESRI service for geometry (never stores geometry).
-- This table makes that linkage self-describing — a downstream consumer (or an
-- FWP DBA reading the Oracle port) learns, per geometry-bearing entity kind, the
-- exact live layer + join field. Seeded from @engage-mt/regs-shared/arcgisLayers
-- (the single source of truth, shared with the web layer registry). Geometry
-- resolution is client-side against these layers; see ADR-0061 addendum.
-- oracle-note: pure DDL — VARCHAR→VARCHAR2, SMALLINT→NUMBER(5), CHECK IN identical;
--   no spatial types here (that is the whole point — geometry stays in ESRI).
-- ============================================================================

-- Up Migration

-- Self-describing service URL alongside the existing arcgis_layer_id/arcgis_key_fld.
ALTER TABLE regs.geography ADD COLUMN arcgis_service_url VARCHAR(300);

CREATE TABLE regs.gis_layer (
  gis_layer_key  VARCHAR(40) PRIMARY KEY,
  entity_kind    VARCHAR(20) NOT NULL CHECK (entity_kind IN
                 ('DISTRICT','PORTION','RESTRICTED_AREA')),
  service_url    VARCHAR(300) NOT NULL,
  layer_id       SMALLINT NOT NULL,
  -- Primary join attribute on the ESRI layer (DISTRICT; NAME for Mtn Lion;
  -- PORTIONNAME for restricted areas).
  key_field      VARCHAR(30) NOT NULL DEFAULT 'DISTRICT',
  -- Portion/restricted only: field naming the specific portion/area (SHAPECODE / REG).
  sub_key_field  VARCHAR(30),
  display_name   VARCHAR(120) NOT NULL,
  species_scope  VARCHAR(80),
  -- District layers reference a geography row; portions/restricted areas are null.
  geography_code VARCHAR(20) REFERENCES regs.geography,
  -- 1 = field schema individually probed against the live service; 0 = name-confirmed,
  -- schema inferred from a same-kind sibling (see scripts/qc/check-gis-registry.mjs).
  schema_probed  SMALLINT NOT NULL DEFAULT 0 CHECK (schema_probed IN (0,1))
);
CREATE INDEX ix_gis_layer_kind ON regs.gis_layer (entity_kind);

-- Down Migration
DROP TABLE IF EXISTS regs.gis_layer;
ALTER TABLE regs.geography DROP COLUMN arcgis_service_url;
