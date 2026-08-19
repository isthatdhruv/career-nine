-- ---------------------------------------------------------------------------
-- V20260603002__counselling_mode_and_contact.sql
--
-- Online vs offline counselling + student contact capture at booking.
--
--   availability_template.mode  — ONLINE | OFFLINE. Counsellor tags each
--                                  recurring availability block; materialized
--                                  slots inherit it. Defaults ONLINE.
--   counselling_slot.mode       — ONLINE | OFFLINE. Set from the template on
--                                  materialization, or directly for manual slots.
--   counsellors.office_address  — physical address shared with the student for
--                                  OFFLINE sessions (NULL until the counsellor
--                                  fills it in their profile).
--   counselling_appointment.*   — per-booking snapshot so the confirmation
--                                  email and student record are stable even if
--                                  the slot/counsellor later changes:
--                                    mode                     ONLINE | OFFLINE
--                                    location                 office address copied at book time (OFFLINE)
--                                    student_contact_name/email/phone
--                                    preferred_contact_method EMAIL | PHONE | WHATSAPP
--
-- All columns are additive and nullable / defaulted, so existing rows are
-- unaffected. Existing slots/templates backfill to ONLINE (matches the prior
-- behaviour where every confirmed session carried only a meeting link).
--
-- Idempotent: guarded with information_schema checks so the migration is a no-op
-- for any column that already exists. MySQL has no `ADD COLUMN IF NOT EXISTS`,
-- and in some environments Hibernate `ddl-auto` may have already added these
-- entity-mapped columns — a plain ADD COLUMN then fails with "Duplicate column
-- name" (this bit prod on 2026-08-13 when the migration ran out-of-order after
-- the columns existed). The PREPARE/EXECUTE guard makes re-runs safe.
-- ---------------------------------------------------------------------------

SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'availability_template'
           AND COLUMN_NAME = 'mode'),
  'SELECT 1',
  'ALTER TABLE availability_template ADD COLUMN mode VARCHAR(20) NOT NULL DEFAULT ''ONLINE''');
PREPARE s1 FROM @s; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'counselling_slot'
           AND COLUMN_NAME = 'mode'),
  'SELECT 1',
  'ALTER TABLE counselling_slot ADD COLUMN mode VARCHAR(20) NOT NULL DEFAULT ''ONLINE''');
PREPARE s2 FROM @s; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'counsellors'
           AND COLUMN_NAME = 'office_address'),
  'SELECT 1',
  'ALTER TABLE counsellors ADD COLUMN office_address TEXT NULL');
PREPARE s3 FROM @s; EXECUTE s3; DEALLOCATE PREPARE s3;

SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'counselling_appointment'
           AND COLUMN_NAME = 'mode'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN mode VARCHAR(20) NULL');
PREPARE s4 FROM @s; EXECUTE s4; DEALLOCATE PREPARE s4;

SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'counselling_appointment'
           AND COLUMN_NAME = 'location'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN location TEXT NULL');
PREPARE s5 FROM @s; EXECUTE s5; DEALLOCATE PREPARE s5;

SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'counselling_appointment'
           AND COLUMN_NAME = 'student_contact_name'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN student_contact_name VARCHAR(255) NULL');
PREPARE s6 FROM @s; EXECUTE s6; DEALLOCATE PREPARE s6;

SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'counselling_appointment'
           AND COLUMN_NAME = 'student_contact_email'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN student_contact_email VARCHAR(255) NULL');
PREPARE s7 FROM @s; EXECUTE s7; DEALLOCATE PREPARE s7;

SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'counselling_appointment'
           AND COLUMN_NAME = 'student_contact_phone'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN student_contact_phone VARCHAR(30) NULL');
PREPARE s8 FROM @s; EXECUTE s8; DEALLOCATE PREPARE s8;

SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'counselling_appointment'
           AND COLUMN_NAME = 'preferred_contact_method'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN preferred_contact_method VARCHAR(20) NULL');
PREPARE s9 FROM @s; EXECUTE s9; DEALLOCATE PREPARE s9;
