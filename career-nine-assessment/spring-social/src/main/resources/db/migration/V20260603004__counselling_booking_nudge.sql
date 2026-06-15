-- ---------------------------------------------------------------------------
-- V20260603004__counselling_booking_nudge.sql
--
-- Tracks the "you've paid for counselling but haven't booked yet" nudge so it
-- is sent at most once per entitlement. NULL = not yet nudged; a timestamp = a
-- nudge has been dispatched. Additive and nullable; existing rows are untouched.
-- ---------------------------------------------------------------------------

ALTER TABLE student_entitlements
  ADD COLUMN counselling_nudge_sent_at DATETIME NULL;
