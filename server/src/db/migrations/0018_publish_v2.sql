-- ============================================================================
-- 0018_publish_v2.sql — publish-pipeline glue for fees
-- ----------------------------------------------------------------------------
-- v_fees_flat gives publish.ts a single SELECT to materialize published_fees the
-- same way it uses v_regs_unified for regulations. Content publishes directly from
-- content_section (no fan-out needed). product_price rows audit via the parent
-- product's revision bump (no per-price trigger).
-- ============================================================================

-- Up Migration

CREATE VIEW regs.v_fees_flat AS
SELECT
  lp.season_year,
  lp.product_code,
  lp.display_name,
  lp.product_kind,
  lp.species_code,
  pp.audience_code,
  pp.price_cents,
  to_char(lp.apply_by, 'FMMon DD')  AS apply_by,
  lp.chart_note,
  pp.price_note,
  lp.sort_order
FROM regs.license_product lp
JOIN regs.product_price pp ON pp.product_id = lp.product_id
WHERE lp.record_status = 'PUBLISHED';

-- Down Migration
DROP VIEW IF EXISTS regs.v_fees_flat;
