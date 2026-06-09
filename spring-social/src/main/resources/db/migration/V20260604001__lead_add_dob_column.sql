-- ---------------------------------------------------------------------------
-- V20260604001__lead_add_dob_column.sql
--
-- Lead -> Student provisioning (career-9.com student form).
--
-- The student lead form now collects a date of birth, which becomes the
-- student's login secret (students authenticate with username + DOB; DOB is
-- NOT hashed — see User.dobDate / UserRepository.findByUsernameAndDobDate).
-- The `leads` table previously had no place to store it (DOB only survived
-- inside the free-form `extras` JSON blob), so add a dedicated, typed column.
--
-- NULLABLE: non-student leads (SCHOOL / PARENT) and any legacy/partial student
-- lead simply leave it NULL. A student lead with a NULL dob cannot be turned
-- into a loginable student (LeadStudentService skips it and logs a warning).
-- ---------------------------------------------------------------------------

ALTER TABLE leads
  ADD COLUMN dob DATE NULL AFTER classes_offered;
