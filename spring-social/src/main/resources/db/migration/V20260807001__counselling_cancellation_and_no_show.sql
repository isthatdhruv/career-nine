-- Counselling cancellation + no-show attribution.
-- See docs/COUNSELLING_CANCELLATION.md §9.1.
--
-- The problem being solved: today a session that does not happen is recorded only as
-- MISSED against the student, whatever actually occurred. A counsellor who never turns up,
-- or who turns up and forgets the OTP, produces the same row as a student who skipped.
-- Once a miss costs the student money that becomes a charge for someone else's absence, so
-- the row has to record WHO caused it.
--
-- Idempotent: every column and index is added only if absent. These are entity-mapped
-- columns and Flyway runs BEFORE Hibernate ddl-auto, so on any database where a prior boot
-- already let ddl-auto add them, a plain ADD COLUMN fails with "Duplicate column name" —
-- and a failed migration stops the application from starting at all. MySQL has no
-- ADD COLUMN IF NOT EXISTS, hence the PREPARE/EXECUTE guards (mirrors V20260615001).

-- ── Cancellation attribution ────────────────────────────────────────────────────
-- STUDENT / COUNSELLOR / ADMIN. Drives the miss allowance, which tallies STUDENT only.
SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
      AND COLUMN_NAME = 'cancelled_by_role'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN cancelled_by_role VARCHAR(20) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- Who performed it. Required for admin cancellations: without a named admin a student
-- could reset her allowance simply by phoning in each time.
SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
      AND COLUMN_NAME = 'cancelled_by_user_id'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN cancelled_by_user_id BIGINT NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
      AND COLUMN_NAME = 'cancellation_reason'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN cancellation_reason VARCHAR(50) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
      AND COLUMN_NAME = 'cancellation_note'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN cancellation_note TEXT NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
      AND COLUMN_NAME = 'cancelled_at'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN cancelled_at DATETIME NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── No-show attribution ─────────────────────────────────────────────────────────
-- STUDENT (counsellor marked her absent) or COUNSELLOR (neither the OTP nor an absent
-- mark was recorded, so the party holding both tools was not there).
SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
      AND COLUMN_NAME = 'missed_by_role'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN missed_by_role VARCHAR(20) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- When the counsellor marked her absent. Also the audit trail for an action that is
-- only permitted inside the session window.
SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
      AND COLUMN_NAME = 'marked_absent_at'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN marked_absent_at DATETIME NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- Which counsellor marked it, so a pattern of over-marking is visible.
SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
      AND COLUMN_NAME = 'marked_absent_by'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN marked_absent_by BIGINT NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── Dispute ─────────────────────────────────────────────────────────────────────
-- Non-null means UNDER_REVIEW and the strike is suspended. Resolved-null therefore
-- means unresolved, which counts as no strike: an open dispute is not evidence.
SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
      AND COLUMN_NAME = 'dispute_raised_at'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN dispute_raised_at DATETIME NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
      AND COLUMN_NAME = 'dispute_resolved_at'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN dispute_resolved_at DATETIME NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
      AND COLUMN_NAME = 'dispute_resolved_by'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN dispute_resolved_by BIGINT NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── Counsellor-caused reschedule ────────────────────────────────────────────────
-- Set when the system moved this appointment because the counsellor cancelled or did
-- not appear. Such a session is exempt from the student's 2-hour window: she never
-- chose the time.
SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
      AND COLUMN_NAME = 'force_shifted'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN force_shifted BOOLEAN NOT NULL DEFAULT FALSE');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- The time it was moved FROM, so the portal can explain the change instead of silently
-- showing a different hour.
SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
      AND COLUMN_NAME = 'shifted_from_start'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN shifted_from_start DATETIME NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- The allowance query filters on entitlement + role; the review sweep scans by status.
-- Guarded for the same reason as the columns: MySQL has no CREATE INDEX IF NOT EXISTS.
SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
      AND INDEX_NAME = 'idx_ca_entitlement_cancelled_role'),
  'SELECT 1',
  'CREATE INDEX idx_ca_entitlement_cancelled_role ON counselling_appointment (entitlement_id, cancelled_by_role)');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'counselling_appointment'
      AND INDEX_NAME = 'idx_ca_entitlement_missed_role'),
  'SELECT 1',
  'CREATE INDEX idx_ca_entitlement_missed_role ON counselling_appointment (entitlement_id, missed_by_role)');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
