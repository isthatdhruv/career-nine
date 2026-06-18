-- Effective-from date for a counsellor's availability template. Slots are
-- materialized from max(start_date, tomorrow) onward. NULL = start immediately.
--
-- Idempotent: added only if absent. This is an entity-mapped column; Flyway runs
-- before Hibernate ddl-auto, so on a DB where a prior boot already let ddl-auto
-- add it, a plain ADD COLUMN would fail with "Duplicate column name". MySQL has
-- no ADD COLUMN IF NOT EXISTS, hence the PREPARE/EXECUTE guard (mirrors V20260610002).
SET @ddl1 := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'availability_template'
           AND COLUMN_NAME = 'start_date'),
  'SELECT 1',
  'ALTER TABLE availability_template ADD COLUMN start_date DATE NULL AFTER mode');
PREPARE s1 FROM @ddl1; EXECUTE s1; DEALLOCATE PREPARE s1;
