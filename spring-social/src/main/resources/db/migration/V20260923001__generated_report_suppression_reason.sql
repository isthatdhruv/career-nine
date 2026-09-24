-- Navigator Pro gates (R1 attention, R3 weak peak, R4 no signal, R5 incomplete)
-- decline to generate a report. The row keeps report_status = 'suppressed' and
-- this column carries "<rule>: <reason>" so the Reports Hub can show why, and
-- the suppressed list doubles as the counselling queue until that is automated.
--
-- Renumbered from V20260910001: main had already applied migrations up to
-- V20260922002, so the old version would be skipped by in-order Flyway on
-- staging and production. Idempotent, because dev databases already ran the old
-- version and Hibernate ddl-auto may have added the column first.
SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'generated_report'
           AND COLUMN_NAME = 'suppression_reason'),
  'SELECT 1',
  'ALTER TABLE generated_report ADD COLUMN suppression_reason VARCHAR(500) NULL AFTER pdf_status');
PREPARE s1 FROM @s; EXECUTE s1; DEALLOCATE PREPARE s1;
