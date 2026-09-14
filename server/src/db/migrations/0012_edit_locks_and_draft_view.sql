-- ============================================================================
-- 0012_edit_locks_and_draft_view.sql — uniform optimistic-lock columns + draft view
-- ----------------------------------------------------------------------------
-- Wave 1 gave lock columns (updated_by/updated_at/revision) to instrument/opportunity/
-- note but NOT to hunt_area/district_portion/restricted_area — so those tables couldn't
-- be safely CRUD'd. Add them uniformly. Attach the audit trigger to district_portion
-- (hunt_area + restricted_area already have one). Add v_regs_unified_draft: a byte-twin
-- of v_regs_unified that includes DRAFT rows — the pending-state projection the pre-publish
-- diff endpoint reads.
-- ============================================================================

-- Up Migration

ALTER TABLE regs.hunt_area
  ADD COLUMN updated_by VARCHAR(120) NOT NULL DEFAULT 'system',
  ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN revision   INTEGER NOT NULL DEFAULT 1;

ALTER TABLE regs.district_portion
  ADD COLUMN updated_by VARCHAR(120) NOT NULL DEFAULT 'system',
  ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN revision   INTEGER NOT NULL DEFAULT 1;

ALTER TABLE regs.restricted_area
  ADD COLUMN updated_by VARCHAR(120) NOT NULL DEFAULT 'system',
  ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN revision   INTEGER NOT NULL DEFAULT 1;

CREATE TRIGGER trg_audit_portion AFTER INSERT OR UPDATE OR DELETE ON regs.district_portion
  FOR EACH ROW EXECUTE FUNCTION regs.fn_audit_row('portion_id');

-- Draft-inclusive twin of v_regs_unified (0010): everything except ARCHIVED rows.
-- Kept byte-identical apart from the final predicate so the diff endpoint compares
-- like-for-like against the published snapshot.
-- oracle-note: same json_agg → JSON_ARRAYAGG rewrite as v_regs_unified.
CREATE VIEW regs.v_regs_unified_draft AS
SELECT
  o.season_year,
  li.species_code || ':' || g.app_geo_type || ':' || d.district_code
    || ':' || li.instr_code || ':' || lac.class_code || ':' || o.split_seq  AS rule_id,
  li.species_code                       AS species,
  'dea'                                 AS species_group,
  g.app_geo_type                        AS geography_type,
  d.district_code                       AS geography_id,
  d.region_id                           AS region,
  d.district_name                       AS district_name,
  lac.display_label                     AS legal_animal,
  li.display_name                       AS required_license,
  li.is_draw                            AS is_draw,
  (
    SELECT json_agg(json_build_object('weapon', st.weapon_label, 'range', sw.raw_range)
                    ORDER BY st.sort_order, sw.window_seq)::text
    FROM regs.season_window sw
    JOIN regs.season_type st ON st.season_type_code = sw.season_type_code
    WHERE sw.opportunity_id = o.opportunity_id
      AND sw.raw_range IS NOT NULL
  )                                     AS weapon_windows,
  CASE WHEN li.quota_unlimited = 1 THEN NULL ELSE li.quota_current END AS quota,
  CASE
    WHEN li.otc_from IS NOT NULL THEN 'OTC: ' || to_char(li.otc_from, 'FMMon DD')
    WHEN li.apply_by IS NOT NULL THEN to_char(li.apply_by, 'FMMon DD')
    ELSE NULL
  END                                   AS apply_by_date,
  o.validity_note                       AS opportunity_specific,
  to_char(sd.adopted_on, 'YYYY-MM-DD')  AS effective_date,
  to_char(sd.valid_to,  'YYYY-MM-DD')   AS expires_date,
  sd.doc_code                           AS source_reg_id
FROM regs.opportunity o
JOIN regs.license_instrument li  ON li.instrument_id = o.instrument_id
JOIN regs.legal_animal_class lac ON lac.animal_class_id = o.animal_class_id
JOIN regs.hunt_area_member ham   ON ham.hunt_area_id = o.hunt_area_id
JOIN regs.district d ON d.district_id = COALESCE(
       ham.district_id,
       (SELECT dp.district_id FROM regs.district_portion dp WHERE dp.portion_id = ham.portion_id))
JOIN regs.geography g ON g.geography_code = d.geography_code
LEFT JOIN regs.source_document sd ON sd.source_doc_id = o.source_doc_id
WHERE o.record_status <> 'ARCHIVED'
  AND li.record_status <> 'ARCHIVED';

-- Down Migration
DROP VIEW IF EXISTS regs.v_regs_unified_draft;
DROP TRIGGER IF EXISTS trg_audit_portion ON regs.district_portion;
ALTER TABLE regs.restricted_area DROP COLUMN IF EXISTS revision, DROP COLUMN IF EXISTS updated_at, DROP COLUMN IF EXISTS updated_by;
ALTER TABLE regs.district_portion DROP COLUMN IF EXISTS revision, DROP COLUMN IF EXISTS updated_at, DROP COLUMN IF EXISTS updated_by;
ALTER TABLE regs.hunt_area DROP COLUMN IF EXISTS revision, DROP COLUMN IF EXISTS updated_at, DROP COLUMN IF EXISTS updated_by;
