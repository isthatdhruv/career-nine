-- ---------------------------------------------------------------------------
-- V20260610003__counselling_price.sql
--
-- Counselling Phase 3b — pay-before-book pricing.
--
-- When a student books a counselling slot that their entitlement does NOT
-- include (counselling inactive, or no sessions remaining), they pay per
-- session via Razorpay before the booking is confirmed. The price is
-- configured PER TIER and snapshotted onto the entitlement at activation
-- (mirroring how counselling_sessions_total etc. are snapshotted), so the
-- booking flow reads a stable price from the entitlement.
--
--   * assessment_mapping_tier.counselling_price — the per-session price an
--     admin sets on a B2B mapping tier (INR, whole rupees). NULL = fall back
--     to the configurable global default (app.counselling.default-price).
--   * student_entitlement.counselling_price — snapshot of the above at grant
--     time; the booking flow charges this amount for an extra session.
--   * payment_transaction.purpose — discriminator for non-assessment payments
--     ("COUNSELLING_EXTRA": a standalone paid counselling session).
--
-- Idempotent AND table-tolerant: each ALTER is skipped if the column already
-- exists OR the target table does not exist yet. These are entity-mapped tables;
-- Flyway runs before Hibernate ddl-auto, so on a DB where a table hasn't been
-- created yet, ddl-auto will create it later WITH the new column. MySQL has no
-- ADD COLUMN IF NOT EXISTS, hence the PREPARE/EXECUTE guards.
-- ---------------------------------------------------------------------------

SET @ddl1 := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_mapping_tier')
  AND NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_mapping_tier'
           AND COLUMN_NAME = 'counselling_price'),
  'ALTER TABLE assessment_mapping_tier ADD COLUMN counselling_price INT NULL',
  'SELECT 1');
PREPARE s1 FROM @ddl1; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @ddl2 := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_entitlement')
  AND NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_entitlement'
           AND COLUMN_NAME = 'counselling_price'),
  'ALTER TABLE student_entitlement ADD COLUMN counselling_price INT NULL',
  'SELECT 1');
PREPARE s2 FROM @ddl2; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @ddl3 := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transaction')
  AND NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transaction'
           AND COLUMN_NAME = 'purpose'),
  'ALTER TABLE payment_transaction ADD COLUMN purpose VARCHAR(30) NULL',
  'SELECT 1');
PREPARE s3 FROM @ddl3; EXECUTE s3; DEALLOCATE PREPARE s3;
