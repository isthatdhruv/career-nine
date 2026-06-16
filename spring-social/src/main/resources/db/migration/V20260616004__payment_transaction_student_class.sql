-- ---------------------------------------------------------------------------
-- V20260616004__payment_transaction_student_class.sql
--
-- Carries the student's grade through the pay-first (Path A) flow. On Path A the
-- StudentInfo is not created at registration — it's created later by the Razorpay
-- webhook from the fields snapshotted on the PaymentTransaction. Class-based
-- campaigns resolve the student's grade at registration time, so we stamp it on
-- the transaction here and the webhook copies it onto StudentInfo.studentClass
-- (the value report generation uses to pick the grade-specific template).
--
--   * payment_transaction.student_class — grade number (e.g. 10), nullable.
--     NULL for non-class campaigns or non-numeric classes ("Nursery").
--
-- Idempotent AND table-tolerant: the ALTER is skipped if the column already
-- exists OR the table does not exist yet (entity-mapped table; Flyway runs before
-- Hibernate ddl-auto, which creates it from the JPA entity WITH the new column).
-- MySQL has no ADD COLUMN IF NOT EXISTS, hence the PREPARE/EXECUTE guard.
-- ---------------------------------------------------------------------------

SET @ddl1 := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transaction')
  AND NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transaction'
           AND COLUMN_NAME = 'student_class'),
  'ALTER TABLE payment_transaction ADD COLUMN student_class INT NULL AFTER student_dob',
  'SELECT 1');
PREPARE s1 FROM @ddl1; EXECUTE s1; DEALLOCATE PREPARE s1;
