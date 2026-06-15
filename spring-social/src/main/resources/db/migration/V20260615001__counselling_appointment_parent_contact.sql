-- Optional parent/guardian contact captured at booking time. The confirmation and
-- reminders are sent to these in addition to the student's own email/phone, on all
-- channels (email + WhatsApp) — there is no per-recipient "preferred channel" choice.
ALTER TABLE counselling_appointment
    ADD COLUMN parent_email VARCHAR(255) NULL AFTER student_contact_phone,
    ADD COLUMN parent_phone VARCHAR(30)  NULL AFTER parent_email;
