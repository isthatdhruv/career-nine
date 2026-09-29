-- Which product a generated dashboard belongs to.
--
-- The release pipeline was written for Navigator 360 alone. A college can now run both
-- Navigator 360 and Navigator Pro, and the two dashboards are different pages built from
-- different engines. Before this column, releasing a Pro assessment would also have
-- cleared is_current on the school's 360 rows (markCurrentAssessment spans the whole
-- institute), taking the 360 dashboard off the air as a side effect.
--
-- engine_code scopes "current" to one product: a release marks its own assessment
-- current among rows of the same engine and leaves the other product untouched.
--
-- Defaults to 'navigator_360' so every row written before this migration keeps reading
-- as the dashboard it always was.
--
-- Idempotent: Flyway runs before Hibernate ddl-auto, so on a database where a prior boot
-- already added the column a plain ADD COLUMN would fail. MySQL has no
-- ADD COLUMN IF NOT EXISTS, hence the PREPARE/EXECUTE guards.

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'principal_dashboard_data'
      AND COLUMN_NAME = 'engine_code'),
  'SELECT 1',
  'ALTER TABLE principal_dashboard_data ADD COLUMN engine_code VARCHAR(32) NOT NULL DEFAULT ''navigator_360''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- The dashboard's entry point is now (institute, engine, is_current, scope_level).
SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'principal_dashboard_data'
      AND INDEX_NAME = 'idx_pdd_engine_current'),
  'SELECT 1',
  'CREATE INDEX idx_pdd_engine_current ON principal_dashboard_data (institute_code, engine_code, is_current, scope_level)');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
