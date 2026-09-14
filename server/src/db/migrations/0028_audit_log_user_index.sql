-- ============================================================================
-- 0028_audit_log_user_index.sql — index for the audit log's "by user" filter
-- ----------------------------------------------------------------------------
-- The staff audit log filters on changed_by (case-insensitive) and pages by
-- audit_id descending; ix_audit_when and ix_audit_table already serve the time
-- and table filters. Down drops the index.
-- ============================================================================

-- Up Migration
CREATE INDEX IF NOT EXISTS ix_audit_by_user ON regs.audit_log (lower(changed_by), audit_id DESC);

-- Down Migration
DROP INDEX IF EXISTS regs.ix_audit_by_user;
