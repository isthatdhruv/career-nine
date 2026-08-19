-- ---------------------------------------------------------------------------
-- V20260603003__counselling_reminders_otp_checkin.sql
--
-- Multi-offset reminders, session check-in via OTP, and attendance tracking.
--
--   counselling_reminder_sent  — idempotency ledger for the multi-offset
--                                reminder scheduler. One row per
--                                (appointment, audience, offset) actually sent,
--                                so a re-run of the cron never double-sends.
--                                  audience    : STUDENT | COUNSELLOR
--                                  offset_code : T12H | T4H | T2H | T15M
--
--   counselling_checkin_otp    — one active OTP per appointment used to verify
--                                the student has arrived. The counsellor reads
--                                the code from the student and enters it.
--                                code_hash is a BCrypt-style hash (never the
--                                raw code); attempts caps brute-force.
--
--   counselling_appointment.*  — attendance / session-progress snapshot:
--                                  session_started_at   when check-in succeeded
--                                  checkin_verified_at   when OTP was verified
--                                  attended              TRUE once verified
--
-- All additive; existing rows are unaffected. The legacy reminder24h_sent /
-- reminder1h_sent flags on counselling_appointment are left in place (no longer
-- written) so any in-flight rows keep their history.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS plus information_schema guards, because
-- in some environments Hibernate `ddl-auto` has already created these
-- entity-mapped tables/columns before this migration runs (out-of-order after a
-- merge). Hibernate creates the tables without the FK constraints, so those are
-- guard-added separately.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS counselling_reminder_sent (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  appointment_id  BIGINT       NOT NULL,
  audience        VARCHAR(20)  NOT NULL,
  offset_code     VARCHAR(10)  NOT NULL,
  sent_at         DATETIME     NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_reminder_sent UNIQUE (appointment_id, audience, offset_code)
);

CREATE TABLE IF NOT EXISTS counselling_checkin_otp (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  appointment_id  BIGINT       NOT NULL,
  code_hash       VARCHAR(255) NOT NULL,
  expires_at      DATETIME     NOT NULL,
  attempts        INT          NOT NULL DEFAULT 0,
  verified_at     DATETIME     NULL,
  created_at      DATETIME     NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_checkin_otp_appt UNIQUE (appointment_id)
);

SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = DATABASE()
           AND TABLE_NAME = 'counselling_reminder_sent'
           AND CONSTRAINT_NAME = 'fk_reminder_sent_appt'),
  'SELECT 1',
  'ALTER TABLE counselling_reminder_sent ADD CONSTRAINT fk_reminder_sent_appt FOREIGN KEY (appointment_id) REFERENCES counselling_appointment (id) ON DELETE CASCADE');
PREPARE s1 FROM @s; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = DATABASE()
           AND TABLE_NAME = 'counselling_checkin_otp'
           AND CONSTRAINT_NAME = 'fk_checkin_otp_appt'),
  'SELECT 1',
  'ALTER TABLE counselling_checkin_otp ADD CONSTRAINT fk_checkin_otp_appt FOREIGN KEY (appointment_id) REFERENCES counselling_appointment (id) ON DELETE CASCADE');
PREPARE s2 FROM @s; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'counselling_appointment'
           AND COLUMN_NAME = 'session_started_at'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN session_started_at DATETIME NULL');
PREPARE s3 FROM @s; EXECUTE s3; DEALLOCATE PREPARE s3;

SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'counselling_appointment'
           AND COLUMN_NAME = 'checkin_verified_at'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN checkin_verified_at DATETIME NULL');
PREPARE s4 FROM @s; EXECUTE s4; DEALLOCATE PREPARE s4;

SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'counselling_appointment'
           AND COLUMN_NAME = 'attended'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN attended BOOLEAN NULL');
PREPARE s5 FROM @s; EXECUTE s5; DEALLOCATE PREPARE s5;
