-- ---------------------------------------------------------------------------
-- V20260716001__student_assessment_mapping_completed_at.sql
--
-- Records when a student finished an assessment, so the Reports Hub can show
-- and filter on a completion date.
--
-- 1. completed_at on student_assessment_mapping — stamped in
--    AssessmentSubmissionProcessorService at the same point `status` flips to
--    "completed", inside the same transaction, so the date can never disagree
--    with the status.
--
-- 2. One-time backfill for rows that completed before this column existed.
--    The real completion time was never recorded anywhere and cannot be
--    recovered: neither assessment_answer nor assessment_raw_score carries a
--    timestamp. Historical rows therefore borrow generated_report.created_at
--    (report *generation* time) as an approximation. A student may have several
--    generated_report rows for one assessment — the unique key includes
--    report_template_id — so the earliest is used, being closest to when they
--    actually finished.
--
--    Two deliberate consequences:
--      - Students who completed but whose report was never generated stay NULL
--        and render as "—"; there is no basis to guess a date for them.
--      - Backfilled dates lag real completion by however long generation waited.
--    Both are acceptable because this migration's run time is a clean boundary:
--    any completed_at at or before it is a proxy, anything after is stamped at
--    submit. The provenance stays recoverable from the data without a marker
--    column.
--
-- Idempotent: guarded with an information_schema check so the migration is a
-- no-op if the column already exists. MySQL has no `ADD COLUMN IF NOT EXISTS`,
-- and Hibernate `ddl-auto` (which runs after Flyway) may have already added
-- this entity-mapped column — a plain ADD COLUMN would then fail with
-- "Duplicate column name". The backfill self-guards on `completed_at IS NULL`,
-- so a re-run never overwrites a real stamped date with the proxy.
-- ---------------------------------------------------------------------------

SET @add_completed_at := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'student_assessment_mapping'
           AND COLUMN_NAME = 'completed_at'),
  'SELECT 1',
  'ALTER TABLE student_assessment_mapping ADD COLUMN completed_at DATETIME NULL');
PREPARE s1 FROM @add_completed_at; EXECUTE s1; DEALLOCATE PREPARE s1;

-- Backfill historical completions from their earliest generated report.
UPDATE student_assessment_mapping sam
JOIN (
  SELECT user_student_id,
         assessment_id,
         MIN(created_at) AS first_report_at
  FROM generated_report
  WHERE created_at IS NOT NULL
  GROUP BY user_student_id, assessment_id
) gr
  ON gr.user_student_id = sam.user_student_id
 AND gr.assessment_id   = sam.assessment_id
SET sam.completed_at = gr.first_report_at
WHERE sam.status = 'completed'
  AND sam.completed_at IS NULL;
