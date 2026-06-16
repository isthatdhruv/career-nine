-- ---------------------------------------------------------------------------
-- V20260609003__payment_txn_held_counselling_slot.sql
--
-- PAY_LATER counselling support for the assessment-mapping flow.
--
-- When a link is configured PAY_LATER, the student picks a counselling slot
-- BEFORE paying. We hold that slot and stash the student's chosen slot + contact
-- details on the PaymentTransaction so the Razorpay webhook can, on successful
-- payment, finalise the counselling appointment in one place (alongside the
-- existing B2B entitlement activation).
--
-- All columns are nullable — they are only populated for PAY_LATER counselling
-- transactions; every other payment leaves them null.
--
-- Idempotent: each column is added only if absent. These are entity-mapped
-- columns; Flyway runs before Hibernate ddl-auto, so on a DB where a prior boot
-- already let ddl-auto add them, a plain ADD COLUMN would fail with "Duplicate
-- column name". MySQL has no ADD COLUMN IF NOT EXISTS, hence the PREPARE/EXECUTE
-- guards (mirrors V20260610002).
-- ---------------------------------------------------------------------------

SET @ddl1 := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transaction'
           AND COLUMN_NAME = 'counselling_slot_id'),
  'SELECT 1',
  'ALTER TABLE payment_transaction ADD COLUMN counselling_slot_id BIGINT NULL');
PREPARE s1 FROM @ddl1; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @ddl2 := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transaction'
           AND COLUMN_NAME = 'counselling_contact_name'),
  'SELECT 1',
  'ALTER TABLE payment_transaction ADD COLUMN counselling_contact_name VARCHAR(200) NULL');
PREPARE s2 FROM @ddl2; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @ddl3 := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transaction'
           AND COLUMN_NAME = 'counselling_contact_phone'),
  'SELECT 1',
  'ALTER TABLE payment_transaction ADD COLUMN counselling_contact_phone VARCHAR(20) NULL');
PREPARE s3 FROM @ddl3; EXECUTE s3; DEALLOCATE PREPARE s3;

SET @ddl4 := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transaction'
           AND COLUMN_NAME = 'counselling_contact_email'),
  'SELECT 1',
  'ALTER TABLE payment_transaction ADD COLUMN counselling_contact_email VARCHAR(200) NULL');
PREPARE s4 FROM @ddl4; EXECUTE s4; DEALLOCATE PREPARE s4;

SET @ddl5 := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transaction'
           AND COLUMN_NAME = 'counselling_contact_method'),
  'SELECT 1',
  'ALTER TABLE payment_transaction ADD COLUMN counselling_contact_method VARCHAR(20) NULL');
PREPARE s5 FROM @ddl5; EXECUTE s5; DEALLOCATE PREPARE s5;
