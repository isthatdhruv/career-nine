-- Break between consecutive generated slots on a weekly availability template.
--
--   availability_template.break_minutes  Gap in minutes left after each slot before the
--                                        next one starts (30-min slots + 10-min break run
--                                        10:00, 10:40, 11:20 …). NULL / 0 = back-to-back,
--                                        the historic behaviour.
--
-- Entity-mapped, so ddl-auto: update would add it on its own; pinned here to keep the
-- schema reproducible from migrations alone.
--
-- Idempotent: added only if absent. Flyway runs BEFORE Hibernate ddl-auto, so on any
-- database where a prior boot already created it a plain ADD COLUMN would fail with
-- "Duplicate column name". MySQL has no ADD COLUMN IF NOT EXISTS, hence the
-- PREPARE/EXECUTE guard.

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'availability_template'
      AND COLUMN_NAME = 'break_minutes'),
  'SELECT 1',
  'ALTER TABLE availability_template ADD COLUMN break_minutes INT NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
