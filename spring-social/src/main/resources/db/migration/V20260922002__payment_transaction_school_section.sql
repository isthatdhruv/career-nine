-- Carry the section chosen on a campaign registration form through to the
-- student record created when payment succeeds.
--
-- The free path writes StudentInfo.school_section_id inline, but a paid
-- registration only creates the student later, in the payment webhook, from
-- payment_transaction. That row held student_class but no section, so the
-- section a parent picked was dropped for every paid registration.
--
-- Nullable by design: campaigns can run for an institute with no sections
-- configured, and the picker is optional for buyers who do not know the section.
ALTER TABLE payment_transaction
    ADD COLUMN school_section_id INT NULL AFTER student_class;
