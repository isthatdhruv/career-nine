-- Check-in no longer generates or sends a code.
--
-- The code a counsellor types in is the student's DOB-derived counselling OTP — the same four
-- digits already printed on their report. It is recomputed at verification time and never
-- stored, so there is nothing to hash: counselling_checkin_otp is now purely an attempt
-- counter, an expiry window, and an "already checked in" marker.
--
-- code_hash is kept rather than dropped so historical rows (from when a random 6-digit code
-- was generated and sent) stay readable. New rows leave it null, which the NOT NULL
-- constraint would otherwise reject.

ALTER TABLE counselling_checkin_otp
    MODIFY COLUMN code_hash VARCHAR(255) NULL;
