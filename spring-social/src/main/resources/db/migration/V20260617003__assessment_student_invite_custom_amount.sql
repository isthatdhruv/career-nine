-- ---------------------------------------------------------------------------
-- V20260617003__assessment_student_invite_custom_amount.sql
--
-- Per-student invites can override the selected pricing tier's base price with a
-- custom amount (INR) that THIS student pays. The tier still supplies the
-- inclusions (report/dashboard/counselling/LMS); only the charged amount differs.
-- NULL = charge the tier's own price.
-- ---------------------------------------------------------------------------

ALTER TABLE assessment_student_invite
    ADD COLUMN custom_amount BIGINT NULL;
