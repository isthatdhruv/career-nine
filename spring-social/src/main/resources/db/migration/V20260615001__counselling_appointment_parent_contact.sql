-- Optional parent/guardian contact captured at booking time. The confirmation and
-- reminders are sent to these in addition to the student's own email/phone, on all
-- channels (email + WhatsApp) — there is no per-recipient "preferred channel" choice.
--
-- Idempotent: each column is added only if absent. These are entity-mapped
-- columns; Flyway runs before Hibernate ddl-auto, so on a DB where a prior boot
-- already let ddl-auto add them, a plain ADD COLUMN would fail with "Duplicate
-- column name". MySQL has no ADD COLUMN IF NOT EXISTS, hence the PREPARE/EXECUTE
-- guards (mirrors V20260610002).
SET @ddl1 := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
           AND COLUMN_NAME = 'parent_email'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN parent_email VARCHAR(255) NULL AFTER student_contact_phone');
PREPARE s1 FROM @ddl1; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @ddl2 := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
           AND COLUMN_NAME = 'parent_phone'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN parent_phone VARCHAR(30) NULL AFTER parent_email');
PREPARE s2 FROM @ddl2; EXECUTE s2; DEALLOCATE PREPARE s2;
