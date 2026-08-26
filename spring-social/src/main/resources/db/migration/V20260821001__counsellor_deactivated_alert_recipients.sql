-- Who hears about a counsellor being deactivated.
--
-- Deactivating a counsellor now settles their whole diary: every upcoming session is either
-- parked with a rebooking link to the student, or cancelled with a promise that the team will
-- be in touch. The second group needs a human to actually get in touch, so the alert naming
-- them has to reach someone — it is the only record that those students are waiting.
--
-- Seeded with the three people the team named. Recipients live in email_notification_recipient
-- rather than in code so the list is changed on the Notification Recipients screen without a
-- deploy; the same table already serves the lead alerts. Adding, removing or pausing anyone
-- here later is an admin action, not a migration.
--
-- Note sushil.jha@career-9.com belongs to a user whose login is currently inactive. That is
-- deliberate and harmless: a recipient row is an address, not a session — the mail is
-- delivered whether or not that person can sign in.

INSERT INTO email_notification_recipient (email_type, email, label, recipient_kind, active)
VALUES
    ('COUNSELLOR_DEACTIVATED_ALERT', 'bhoovesh.sharma@career-9.com', 'Bhoovesh Sharma', 'TO', 1),
    ('COUNSELLOR_DEACTIVATED_ALERT', 'sushil.jha@career-9.com',      'Sushil Jha',      'TO', 1),
    ('COUNSELLOR_DEACTIVATED_ALERT', 'gunjan@career-9.com',          'Gunjan Jha',      'TO', 1)
ON DUPLICATE KEY UPDATE
    label  = VALUES(label),
    active = VALUES(active);
