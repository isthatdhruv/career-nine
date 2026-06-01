-- ---------------------------------------------------------------------------
-- V20260511005__student_info_backfill.sql
--
-- Phase 14 (ABAC Data Foundation) — Plan 14-03.
--
-- Backfills student_info.session_id from each row's institute's currently-
-- active institute_session. Unresolvable rows stay NULL and are recorded
-- in a one-time report table for product/ops to reconcile.
--
-- course_code is NOT backfilled here — see plan 14-03 Backfill rules.
-- studentClass is a free integer with no enforceable mapping to
-- institute_courses.course_code; product must provide the mapping.
--
-- SCHEMA CHAIN (verified against entity sources before writing this SQL):
--   student_info.institute_id
--     -> institute_courses.institute_id          (column DOES exist; InstituteCourse.java:44)
--     -> institute_courses.course_code           (PK; referenced by institute_branch.course_id)
--     -> institute_branch.branch_id              (PK; referenced by institute_branch_batch_map.branch_id)
--     -> institute_branch_batch_map.batch_id     (matches institute_session.batch_id)
--     -> institute_session.session_id
--
-- NOTE: institute_batch's PK is `batch_id` (NOT `id`) per InstituteBatch.java:26-27,
-- and institute_batch has NO `institute_id` column. Do NOT reference either of
-- those — both would raise MySQL ERROR 1054 and leave Flyway in a failed-marker
-- state blocking all subsequent migrations.
--
-- Backfill rule (LOCKED — do not change in this migration):
--   For each student_info row WHERE institute_id IS NOT NULL AND session_id IS NULL,
--   set session_id = MAX(isess.session_id) where isess is reachable via the
--   chain above AND isess.display = 1. MAX() is the deterministic tiebreaker
--   when multiple active sessions exist for one institute.
--
-- This migration is IDEMPOTENT: it only updates rows where session_id IS NULL,
-- so re-running on a fully-backfilled DB is a no-op. The report table is
-- append-only; each run inserts new rows tagged with run_at = NOW().
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS student_info_backfill_report (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  run_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status          VARCHAR(64)  NOT NULL,           -- RESOLVED | NO_INSTITUTE | no_session_resolution_path | SUMMARY
  institute_id    INT          NULL,
  student_info_id INT          NULL,
  notes           VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_report_status (status),
  KEY idx_report_inst   (institute_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Step 1 — Resolve session_id via the courses -> branch -> branch_batch_map
--          -> session chain. If the chain produces 0 rows for some institute,
--          that institute's students stay NULL and are classified
--          `no_session_resolution_path` in Step 2.
-- ---------------------------------------------------------------------------

UPDATE student_info si
JOIN (
  -- For each institute, pick the active session with the largest session_id
  -- among all sessions reachable through the courses->branch->bbm chain.
  SELECT ic.institute_id           AS institute_id,
         MAX(isess.session_id)     AS picked_session_id
  FROM institute_courses ic
  JOIN institute_branch ib
    ON ib.course_id = ic.course_code
  JOIN institute_branch_batch_map ibbm
    ON ibbm.branch_id = ib.branch_id
  JOIN institute_session isess
    ON isess.batch_id = ibbm.batch_id
  WHERE isess.display = 1
  GROUP BY ic.institute_id
) picked ON picked.institute_id = si.institute_id
SET si.session_id = picked.picked_session_id
WHERE si.session_id IS NULL
  AND si.institute_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 2 — Record resolution stats in the report table.
--          One row per (status, institute_id, student_info_id) for unresolved
--          rows; a summary row per institute for resolved counts; a final
--          global SUMMARY row.
-- ---------------------------------------------------------------------------

-- 2a. Resolved rows — one summary row per institute
INSERT INTO student_info_backfill_report (status, institute_id, student_info_id, notes)
SELECT 'RESOLVED', si.institute_id, NULL,
       CONCAT('resolved_count=', COUNT(*))
FROM student_info si
WHERE si.session_id IS NOT NULL
GROUP BY si.institute_id;

-- 2b. Unresolved rows with NULL institute (cannot resolve at all)
INSERT INTO student_info_backfill_report (status, institute_id, student_info_id, notes)
SELECT 'NO_INSTITUTE', NULL, si.id, NULL
FROM student_info si
WHERE si.institute_id IS NULL
  AND si.session_id IS NULL;

-- 2c. Unresolved rows where institute is set but the join chain returned no
--     active session (covers all of: no course rows for institute, no branch
--     rows for course, no branch_batch_map rows, no display=1 session).
INSERT INTO student_info_backfill_report (status, institute_id, student_info_id, notes)
SELECT 'no_session_resolution_path', si.institute_id, si.id, NULL
FROM student_info si
WHERE si.session_id IS NULL
  AND si.institute_id IS NOT NULL;

-- 2d. Final global summary row
INSERT INTO student_info_backfill_report (status, institute_id, student_info_id, notes)
SELECT 'SUMMARY', NULL, NULL,
       CONCAT('total=', (SELECT COUNT(*) FROM student_info),
              ' resolved=', (SELECT COUNT(*) FROM student_info WHERE session_id IS NOT NULL),
              ' unresolved=', (SELECT COUNT(*) FROM student_info WHERE session_id IS NULL));
