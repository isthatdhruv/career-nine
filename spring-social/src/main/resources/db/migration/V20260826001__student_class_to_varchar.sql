-- ---------------------------------------------------------------------------
-- V20260826001__student_class_to_varchar.sql
--
-- Class labels become free-form strings. The system only ever needed the
-- class row's autoincrement id plus a display name (school_classes already
-- stores className as VARCHAR); storing the student's class as a parsed INT
-- forced every writer through Integer.parseInt and broke on labels like
-- "10-A", "XII" or college courses ("B.Tech CSE – Year 2"). The numeric
-- grade is now derived on demand by GradeParser only where band logic needs
-- it (report template selection, dashboard grade bands).
--
-- Converts all four columns that snapshot a student's class label:
--   * student_info.student_class
--   * payment_transaction.student_class          (Path A snapshot, copied to
--                                                 student_info by the webhook)
--   * report_generation_log.student_class_at_attempt
--   * general_assessment_result.student_class
--
-- MySQL converts existing INT values in place (9 -> '9'); no data rewrite.
--
-- Idempotent AND table-tolerant: each MODIFY runs only if the table exists
-- and the column is still integer-typed. Fresh databases get the columns
-- created as VARCHAR directly by Hibernate ddl-auto from the JPA entities.
-- ---------------------------------------------------------------------------

SET @ddl1 := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_info'
           AND COLUMN_NAME = 'student_class' AND DATA_TYPE IN ('int','bigint','smallint','tinyint')),
  'ALTER TABLE student_info MODIFY COLUMN student_class VARCHAR(64) NULL',
  'SELECT 1');
PREPARE s1 FROM @ddl1; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @ddl2 := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transaction'
           AND COLUMN_NAME = 'student_class' AND DATA_TYPE IN ('int','bigint','smallint','tinyint')),
  'ALTER TABLE payment_transaction MODIFY COLUMN student_class VARCHAR(64) NULL',
  'SELECT 1');
PREPARE s2 FROM @ddl2; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @ddl3 := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report_generation_log'
           AND COLUMN_NAME = 'student_class_at_attempt' AND DATA_TYPE IN ('int','bigint','smallint','tinyint')),
  'ALTER TABLE report_generation_log MODIFY COLUMN student_class_at_attempt VARCHAR(64) NULL',
  'SELECT 1');
PREPARE s3 FROM @ddl3; EXECUTE s3; DEALLOCATE PREPARE s3;

SET @ddl4 := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'general_assessment_result'
           AND COLUMN_NAME = 'student_class' AND DATA_TYPE IN ('int','bigint','smallint','tinyint')),
  'ALTER TABLE general_assessment_result MODIFY COLUMN student_class VARCHAR(64) NULL',
  'SELECT 1');
PREPARE s4 FROM @ddl4; EXECUTE s4; DEALLOCATE PREPARE s4;
