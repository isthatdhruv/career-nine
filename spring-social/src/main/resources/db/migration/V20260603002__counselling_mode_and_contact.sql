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
-- ---------------------------------------------------------------------------

ALTER TABLE availability_template
  ADD COLUMN mode VARCHAR(20) NOT NULL DEFAULT 'ONLINE';

ALTER TABLE counselling_slot
  ADD COLUMN mode VARCHAR(20) NOT NULL DEFAULT 'ONLINE';

ALTER TABLE counsellors
  ADD COLUMN office_address TEXT NULL;

ALTER TABLE counselling_appointment
  ADD COLUMN mode                     VARCHAR(20)  NULL,
  ADD COLUMN location                 TEXT         NULL,
  ADD COLUMN student_contact_name     VARCHAR(255) NULL,
  ADD COLUMN student_contact_email    VARCHAR(255) NULL,
  ADD COLUMN student_contact_phone    VARCHAR(30)  NULL,
  ADD COLUMN preferred_contact_method VARCHAR(20)  NULL;
