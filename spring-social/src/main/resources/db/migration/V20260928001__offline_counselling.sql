-- Offline counselling: schools that run counselling themselves. An offline counsellor maps a
-- school's students to themselves and records each in-person session from the counsellor
-- portal. The session is stored as an ordinary COMPLETED counselling_appointment (origin
-- OFFLINE_RECORD) on a synthetic slot, so photos, the audit log, the principal dashboard and
-- report release all keep working unchanged.
--
--   * counsellors.is_offline               — admin-set flag that grants the offline page.
--   * counselling_appointment.assessment_id — the assessment a session counsels ("done" is
--                                             per student per assessment).
--   * counselling_appointment.origin        — NULL for bookings, 'OFFLINE_RECORD' for records.
--   * idx_ca_student_assessment            — the "done for this assessment?" lookup.
--   * uk_scm_student                       — student_counsellor_mapping becomes one row per
--                                            student, so re-mapping moves the row.
--   * counselling_otp_guard                — per-student wrong-OTP counter and lock.
--
-- Idempotent AND table-tolerant, because Flyway runs BEFORE Hibernate ddl-auto:
--   (a) prod-like DB, tables without the new columns    -> everything is added;
--   (b) DB where a prior boot let ddl-auto add them     -> each guard sees it and skips;
--   (c) fresh DB, counselling tables not created yet    -> the ALTERs are skipped and ddl-auto
--       creates the tables from the entities, which declare the same index/constraint names.
-- The names MUST match the entity annotations: ddl-auto only recognises an index by name and
-- otherwise adds a hash-named duplicate (it already did so on student_assessment_mapping).
-- MySQL has no ADD COLUMN / CREATE INDEX IF NOT EXISTS, hence the PREPARE/EXECUTE guards
-- (mirrors V20260807001 and V20260616004).

-- ── counsellors.is_offline ──────────────────────────────────────────────────────
SET @ddl := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counsellors')
  AND NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counsellors'
           AND COLUMN_NAME = 'is_offline'),
  'ALTER TABLE counsellors ADD COLUMN is_offline TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── counselling_appointment.assessment_id ───────────────────────────────────────
SET @ddl := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment')
  AND NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
           AND COLUMN_NAME = 'assessment_id'),
  'ALTER TABLE counselling_appointment ADD COLUMN assessment_id BIGINT NULL',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── counselling_appointment.origin ──────────────────────────────────────────────
SET @ddl := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment')
  AND NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
           AND COLUMN_NAME = 'origin'),
  'ALTER TABLE counselling_appointment ADD COLUMN origin VARCHAR(20) NULL',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── idx_ca_student_assessment ───────────────────────────────────────────────────
SET @ddl := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
           AND COLUMN_NAME = 'assessment_id')
  AND NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
           AND INDEX_NAME = 'idx_ca_student_assessment'),
  'CREATE INDEX idx_ca_student_assessment ON counselling_appointment (student_id, assessment_id)',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── student_counsellor_mapping: one row per student ─────────────────────────────
-- Dedupe first or the unique key cannot be added: keep the student's active row, and among
-- equals the newest (highest id). A row is deleted when a better one exists for the same
-- student. Empty in prod; nothing has an FK to this table. Skipped once the key exists.
SET @ddl := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_counsellor_mapping')
  AND NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_counsellor_mapping'
           AND INDEX_NAME = 'uk_scm_student'),
  'DELETE m1 FROM student_counsellor_mapping m1
     JOIN student_counsellor_mapping m2
       ON m1.student_id = m2.student_id
      AND (COALESCE(m1.is_active, 1) < COALESCE(m2.is_active, 1)
           OR (COALESCE(m1.is_active, 1) = COALESCE(m2.is_active, 1) AND m1.id < m2.id))',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_counsellor_mapping')
  AND NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_counsellor_mapping'
           AND INDEX_NAME = 'uk_scm_student'),
  'ALTER TABLE student_counsellor_mapping ADD CONSTRAINT uk_scm_student UNIQUE (student_id)',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── counselling_otp_guard ───────────────────────────────────────────────────────
-- Wrong-OTP counter per student for the offline "Mark done" form. Keyed by student so that
-- re-mapping the student never resets it. No FK: user_student may not exist yet when Flyway
-- runs on a fresh database, and the row is harmless if the student is later purged (the purge
-- deletes it anyway). Times are IST wall-clock (CounsellingClock).
CREATE TABLE IF NOT EXISTS counselling_otp_guard (
    student_id                   BIGINT   NOT NULL,
    failed_attempts              INT      NOT NULL DEFAULT 0,
    window_started_at            DATETIME NULL,
    total_failures               INT      NOT NULL DEFAULT 0,
    locked_until                 DATETIME NULL,
    last_failed_by_counsellor_id BIGINT   NULL,
    updated_at                   DATETIME NULL,
    PRIMARY KEY (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
