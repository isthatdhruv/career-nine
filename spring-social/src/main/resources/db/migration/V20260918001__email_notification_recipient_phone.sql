-- A WhatsApp number against each configured alert recipient.
--
-- Every email the system sends is accompanied by a WhatsApp to the same people. For student,
-- counsellor, contact-person and lead mail the number is found by looking the address up in the
-- record it belongs to. The internal ops alerts -- a new lead, a counsellor deactivated -- have
-- no such record: their recipients are bare addresses typed into the Notification Recipients
-- screen, so there was nowhere for a number to live and those alerts went out on email alone.
--
-- Nullable, and blank is a perfectly good answer: a recipient with no number simply keeps
-- receiving the email exactly as before. Nobody's personal number is assumed or inferred --
-- an admin types it in for the people who want alerts on their phone.
ALTER TABLE email_notification_recipient
    ADD COLUMN phone VARCHAR(30) NULL AFTER email;
