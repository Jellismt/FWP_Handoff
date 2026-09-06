-- ============================================================================
-- 0027_portion_snapshot.sql — carry district-PORTION identity through the regs
-- ----------------------------------------------------------------------------
-- Portions were modeled (regs.district_portion + hunt_area_member.portion_id) but
-- the two unified views COALESCE a portion member to its parent district, dropping
-- the portion (the documented info loss in 0010/0012). This surfaces it: both views
-- gain portion_code + portion_name (via a LEFT JOIN to district_portion), and the
-- published_regulations snapshot gains the same two nullable columns.
--
-- Back-compat is deliberate:
--   * geography_id stays the parent district_code → every existing whole-district
--     query keeps working unchanged.
--   * portion_code is appended to rule_id ONLY for portion rows, so non-portion
--     rule_ids are byte-identical to before (no diff churn, no snapshot PK change
--     for existing rows).
--   * the new columns are nullable → older published snapshots read back as NULL.
-- oracle-note: unchanged json_agg → JSON_ARRAYAGG rewrite still applies.
-- ============================================================================

-- Up Migration

ALTER TABLE regs.published_regulations
  ADD COLUMN portion_code VARCHAR(40),
  ADD COLUMN portion_name VARCHAR(200);

CREATE OR REPLACE VIEW regs.v_regs_unified AS
SELECT
  o.season_year,
  li.species_code || ':' || g.app_geo_type || ':' || d.district_code
    || ':' || li.instr_code || ':' || lac.class_code || ':' || o.split_seq
    || CASE WHEN dp.portion_code IS NOT NULL THEN ':' || dp.portion_code ELSE '' END AS rule_id,
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
  sd.doc_code                           AS source_reg_id,
  dp.portion_code                       AS portion_code,
  dp.portion_name                       AS portion_name
FROM regs.opportunity o
JOIN regs.license_instrument li  ON li.instrument_id = o.instrument_id
JOIN regs.legal_animal_class lac ON lac.animal_class_id = o.animal_class_id
JOIN regs.hunt_area_member ham   ON ham.hunt_area_id = o.hunt_area_id
LEFT JOIN regs.district_portion dp ON dp.portion_id = ham.portion_id
JOIN regs.district d ON d.district_id = COALESCE(ham.district_id, dp.district_id)
JOIN regs.geography g ON g.geography_code = d.geography_code
LEFT JOIN regs.source_document sd ON sd.source_doc_id = o.source_doc_id
WHERE o.record_status = 'PUBLISHED'
  AND li.record_status = 'PUBLISHED';

CREATE OR REPLACE VIEW regs.v_regs_unified_draft AS
SELECT
  o.season_year,
  li.species_code || ':' || g.app_geo_type || ':' || d.district_code
    || ':' || li.instr_code || ':' || lac.class_code || ':' || o.split_seq
    || CASE WHEN dp.portion_code IS NOT NULL THEN ':' || dp.portion_code ELSE '' END AS rule_id,
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
  sd.doc_code                           AS source_reg_id,
  dp.portion_code                       AS portion_code,
  dp.portion_name                       AS portion_name
FROM regs.opportunity o
JOIN regs.license_instrument li  ON li.instrument_id = o.instrument_id
JOIN regs.legal_animal_class lac ON lac.animal_class_id = o.animal_class_id
JOIN regs.hunt_area_member ham   ON ham.hunt_area_id = o.hunt_area_id
LEFT JOIN regs.district_portion dp ON dp.portion_id = ham.portion_id
JOIN regs.district d ON d.district_id = COALESCE(ham.district_id, dp.district_id)
JOIN regs.geography g ON g.geography_code = d.geography_code
LEFT JOIN regs.source_document sd ON sd.source_doc_id = o.source_doc_id
WHERE o.record_status <> 'ARCHIVED'
  AND li.record_status <> 'ARCHIVED';

-- Down Migration
-- Restore the pre-portion view definitions (0010 / 0012) and drop the columns.
DROP VIEW IF EXISTS regs.v_regs_unified_draft;
DROP VIEW IF EXISTS regs.v_regs_unified;

CREATE VIEW regs.v_regs_unified AS
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
WHERE o.record_status = 'PUBLISHED'
  AND li.record_status = 'PUBLISHED';

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

ALTER TABLE regs.published_regulations
  DROP COLUMN IF EXISTS portion_name,
  DROP COLUMN IF EXISTS portion_code;
