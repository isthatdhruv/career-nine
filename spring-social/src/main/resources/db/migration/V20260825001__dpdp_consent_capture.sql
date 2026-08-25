-- DPDP (Digital Personal Data Protection Act, 2023) parental-consent capture.
--
--   student_info.dpdp_consent_at    Server-side timestamp of the parental consent given
--                                   on the registration form. Stamped on every student
--                                   registration path; NULL for pre-existing students and
--                                   admin/bulk-created ones.
--   payment_transaction.dpdp_consent  Consent flag carried on paid registrations, whose
--                                   student row is only created later by the Razorpay
--                                   webhook (which stamps dpdp_consent_at from it).
--
-- Entity-mapped, so ddl-auto: update would add them on its own; pinned here to keep the
-- schema reproducible from migrations alone.
--
-- Idempotent: added only if absent. Flyway runs BEFORE Hibernate ddl-auto, so on any
-- database where a prior boot already created them a plain ADD COLUMN would fail with
-- "Duplicate column name". MySQL has no ADD COLUMN IF NOT EXISTS, hence the
-- PREPARE/EXECUTE guards.

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_info'
      AND COLUMN_NAME = 'dpdp_consent_at'),
  'SELECT 1',
  'ALTER TABLE student_info ADD COLUMN dpdp_consent_at DATETIME NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transaction'
      AND COLUMN_NAME = 'dpdp_consent'),
  'SELECT 1',
  'ALTER TABLE payment_transaction ADD COLUMN dpdp_consent TINYINT(1) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
