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
-- ---------------------------------------------------------------------------

CREATE TABLE counselling_reminder_sent (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  appointment_id  BIGINT       NOT NULL,
  audience        VARCHAR(20)  NOT NULL,
  offset_code     VARCHAR(10)  NOT NULL,
  sent_at         DATETIME     NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_reminder_sent UNIQUE (appointment_id, audience, offset_code),
  CONSTRAINT fk_reminder_sent_appt FOREIGN KEY (appointment_id)
      REFERENCES counselling_appointment (id) ON DELETE CASCADE
);

CREATE TABLE counselling_checkin_otp (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  appointment_id  BIGINT       NOT NULL,
  code_hash       VARCHAR(255) NOT NULL,
  expires_at      DATETIME     NOT NULL,
  attempts        INT          NOT NULL DEFAULT 0,
  verified_at     DATETIME     NULL,
  created_at      DATETIME     NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_checkin_otp_appt UNIQUE (appointment_id),
  CONSTRAINT fk_checkin_otp_appt FOREIGN KEY (appointment_id)
      REFERENCES counselling_appointment (id) ON DELETE CASCADE
);

ALTER TABLE counselling_appointment
  ADD COLUMN session_started_at  DATETIME NULL,
  ADD COLUMN checkin_verified_at DATETIME NULL,
  ADD COLUMN attended            BOOLEAN  NULL;
