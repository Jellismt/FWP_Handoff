-- ============================================================================
-- 0024_content_category_expand.sql — add FRONT_MATTER + CWD content categories
-- ----------------------------------------------------------------------------
-- The full-pamphlet parity pass needs two new content_section categories the original
-- 0014 CHECK did not carry: FRONT_MATTER (director's letter, highlights, reminders, how-
-- to-use, commission adoption, discrimination notice) and CWD (the pp.4 CWD-management
-- pages). Nonresident info folds into LICENSING/DRAWING; contacts + important dates are
-- structured tables, not content. The constraint is named explicitly for Oracle parity.
-- ============================================================================

-- Up Migration

ALTER TABLE regs.content_section DROP CONSTRAINT IF EXISTS content_section_category_check;
ALTER TABLE regs.content_section ADD CONSTRAINT content_section_category_check
  CHECK (category IN
    ('FRONT_MATTER','DEFINITIONS','LICENSING','LAWS_RULES','YOUTH','DISABILITY',
     'DRAWING','SAFETY','ACCESS','CWD','OTHER'));

-- Down Migration
ALTER TABLE regs.content_section DROP CONSTRAINT IF EXISTS content_section_category_check;
ALTER TABLE regs.content_section ADD CONSTRAINT content_section_category_check
  CHECK (category IN
    ('DEFINITIONS','LICENSING','LAWS_RULES','YOUTH','DISABILITY',
     'DRAWING','SAFETY','ACCESS','OTHER'));
