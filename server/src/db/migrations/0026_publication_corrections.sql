-- ============================================================================
-- 0026_publication_corrections.sql — first-class mid-year corrections
-- ----------------------------------------------------------------------------
-- A mid-year correction has always been mechanically possible (edit the published
-- year's rows → re-publish → v2, v3, … each with a changelog note), but it was never
-- distinguishable from a first publish or surfaceable as an errata feed. These columns
-- promote a correction to a first-class record ON the publication event itself (which
-- already IS the per-version snapshot marker — no new table needed): every re-publish of
-- an already-live year (version >= 2) is flagged is_correction, with an optional plain-
-- English summary + the affected D/E/A scope, so the staff "Corrections & updates" screen
-- and the public /hunting/corrections feed can both read them.
--
-- Oracle-portable by construction: plain BOOLEAN + VARCHAR columns, no jsonb, no ON
-- CONFLICT (ADR-0061). affected_species / affected_districts are simple comma-joined
-- strings (a CLOB in Oracle would over-model a short scope hint).
--
-- oracle-note: BOOLEAN → NUMBER(1) DEFAULT 0 with a CHECK (0,1) on Oracle < 23ai
--   (mirror the 0/1 pattern already used for is_draw / quota_unlimited); the backfill
--   `WHERE version >= 2` and the DROP COLUMNs are portable as written.
-- ============================================================================

-- Up Migration

ALTER TABLE regs.publication ADD COLUMN is_correction     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE regs.publication ADD COLUMN correction_summary VARCHAR(2000);
ALTER TABLE regs.publication ADD COLUMN affected_species   VARCHAR(200);
ALTER TABLE regs.publication ADD COLUMN affected_districts  VARCHAR(2000);

-- Backfill: the first publish of any year is the book, not a correction; every later
-- version is by definition a mid-year correction of an already-live snapshot.
UPDATE regs.publication SET is_correction = true WHERE version >= 2;

-- Down Migration

ALTER TABLE regs.publication DROP COLUMN IF EXISTS affected_districts;
ALTER TABLE regs.publication DROP COLUMN IF EXISTS affected_species;
ALTER TABLE regs.publication DROP COLUMN IF EXISTS correction_summary;
ALTER TABLE regs.publication DROP COLUMN IF EXISTS is_correction;
