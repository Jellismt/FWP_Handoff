-- ============================================================================
-- 0025_published_district_notes.sql — public snapshot for per-district notes
-- ----------------------------------------------------------------------------
-- district_note (0006) has the full DRAFT/PUBLISHED workflow and publish.ts flips
-- its record_status, but it was never materialized into a published_* snapshot —
-- so the notes (CWD sampling mandates, access closures, agency phone numbers)
-- could never reach the public API. The Engage MT app's District Regulations
-- panel has rendered an always-empty "District notes" TipBlock since Phase 44.
-- This snapshot mirrors the 0022 important-dates pattern: immutable per
-- (season_year, version), read-only for the public v2 endpoint.
-- ============================================================================

-- Up Migration

-- note_id is part of the PK because (district, note_seq) is NOT unique in the
-- working table (verified in prod 2026-07-07: 79 notes, 77 distinct pairs).
CREATE TABLE regs.published_district_notes (
  season_year   SMALLINT NOT NULL,
  version       INTEGER  NOT NULL,
  note_id       BIGINT   NOT NULL,
  district_code VARCHAR(10) NOT NULL,
  geography_code VARCHAR(20) NOT NULL,
  species_code  VARCHAR(20),
  note_seq      SMALLINT NOT NULL,
  note_text     VARCHAR(2000) NOT NULL,
  CONSTRAINT pk_published_district_notes
    PRIMARY KEY (season_year, version, note_id)
);
CREATE INDEX ix_pub_district_notes_lookup
  ON regs.published_district_notes (season_year, version, district_code);

-- Down Migration
DROP TABLE IF EXISTS regs.published_district_notes;
