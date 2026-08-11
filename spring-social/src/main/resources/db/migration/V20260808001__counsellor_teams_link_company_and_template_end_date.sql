-- Counsellor company name + permanent Microsoft Teams link, and an end date for a
-- recurring weekly availability template.
--
--   counsellors.company_name        Organisation the counsellor works for. Optional.
--   counsellors.meeting_link        The counsellor's own permanent Teams meeting URL. Every
--                                   ONLINE session of theirs uses it; sessions run on Teams
--                                   and nothing else, so there is no generated fallback.
--   availability_template.end_date  Last date the schedule applies to. NULL means it keeps
--                                   running (bounded only by the materialisation window).
--
-- These are entity-mapped and would appear on their own under ddl-auto: update. Pinning
-- them here keeps the schema reproducible from migrations alone — a fresh database, or one
-- brought up with ddl-auto tightened to validate, still gets them.
--
-- Idempotent: added only if absent. Flyway runs BEFORE Hibernate ddl-auto, so on any
-- database where a prior boot already created them a plain ADD COLUMN would fail with
-- "Duplicate column name", and a failed migration stops the application from starting.
-- MySQL has no ADD COLUMN IF NOT EXISTS, hence the PREPARE/EXECUTE guards.

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counsellors'
      AND COLUMN_NAME = 'company_name'),
  'SELECT 1',
  'ALTER TABLE counsellors ADD COLUMN company_name VARCHAR(200) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counsellors'
      AND COLUMN_NAME = 'meeting_link'),
  'SELECT 1',
  'ALTER TABLE counsellors ADD COLUMN meeting_link VARCHAR(1000) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'availability_template'
      AND COLUMN_NAME = 'end_date'),
  'SELECT 1',
  'ALTER TABLE availability_template ADD COLUMN end_date DATE NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
