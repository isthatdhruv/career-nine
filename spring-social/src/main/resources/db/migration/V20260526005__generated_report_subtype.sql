-- ---------------------------------------------------------------------------
-- V20260526005__generated_report_subtype.sql
--
-- Extend generated_report with report_subtype_id so the same student-
-- assessment pair can carry one row per rendered variant. Broadens the
-- unique constraint to (student, assessment, type, subtype).
--
-- ALSO: rename legacy type_of_report='navigator' → 'legacy' so it matches
-- the report_type.code='legacy' seeded in V20260526006 (per plan Risk #7).
-- This must happen BEFORE the unique-key swap and BEFORE V20260526007's
-- backfill JOIN against report_type.
-- ---------------------------------------------------------------------------

-- Step 1: rename legacy rows so the V007 backfill JOIN matches.
UPDATE generated_report
SET type_of_report = 'legacy'
WHERE type_of_report = 'navigator';

-- Step 2: add the new column.
ALTER TABLE generated_report
  ADD COLUMN report_subtype_id BIGINT NULL,
  ADD CONSTRAINT fk_genrep_subtype FOREIGN KEY (report_subtype_id)
    REFERENCES report_subtype(report_subtype_id);

-- Step 3: swap the unique constraint. NULL values in the new column are
-- treated as distinct by MySQL until V20260526007's backfill populates them.
ALTER TABLE generated_report
  DROP INDEX uk_student_assessment_type,
  ADD CONSTRAINT uk_student_assessment_type_subtype
    UNIQUE (user_student_id, assessment_id, type_of_report, report_subtype_id);
