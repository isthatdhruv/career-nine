-- ============================================================================
-- Counselling Phase 2 / 3a — transition test (run in MySQL Workbench)
--
-- The app's lifecycle sweeps run on timers:
--   * hold-release sweep   ~ every 1 minute   (Phase 3a)
--   * session-close sweep  ~ every 5 minutes  (Phase 2)
-- So: seed a row, wait, re-query to watch it transition. No curl needed.
-- (If you don't want to wait, tell me and I'll fire the sweep instantly via the
--  admin trigger endpoint.)
--
-- IMPORTANT: connect to the SAME database the app uses. The app runs on schema
-- `career-9`. Run STEP 0 first and confirm it matches before seeding.
-- ============================================================================

-- ─── STEP 0 — confirm you're on the right database ──────────────────────────
USE `career-9`;
SELECT DATABASE() AS current_db;                 -- expect: career-9
SELECT id, name, email, is_active FROM counsellors ORDER BY id LIMIT 5;  -- expect the test counsellor (id 1)


-- ============================================================================
-- TEST A — Phase 3a: soft-hold auto-release  (self-contained, no student needed)
-- ============================================================================

-- A1. Seed a slot that is "held" with a TTL that already expired, no booking.
INSERT INTO counselling_slot
  (counsellor_id, date, start_time, end_time, duration_minutes,
   status, mode, is_manually_created, is_blocked, version, held_until, created_at)
VALUES
  (1, CURDATE(), '23:00:00', '23:30:00', 30,
   'REQUESTED', 'ONLINE', 1, 0, 0, DATE_SUB(NOW(), INTERVAL 1 MINUTE), NOW());

SET @slot_a := LAST_INSERT_ID();
SELECT id, status, held_until FROM counselling_slot WHERE id = @slot_a;   -- status=REQUESTED

-- A2. Wait ~70 seconds for the hold sweep, then run this again:
SELECT id, status, held_until FROM counselling_slot WHERE id = @slot_a;
-- ✅ PASS = status flipped to 'AVAILABLE' and held_until is NULL.


-- ============================================================================
-- TEST B — Phase 2: no-show -> MISSED + session credit-back
-- (needs a real student id; credit-back needs an entitlement row)
-- ============================================================================

-- B0. Find a student id to use and (optionally) an entitlement to credit back.
SELECT id, name, email FROM student_user ORDER BY id DESC LIMIT 5;   -- pick <STUDENT_ID>
-- Optional, to test credit-back, find an entitlement with sessions used:
SELECT entitlement_id, counselling_sessions_total, counselling_sessions_used
FROM student_entitlement
WHERE counselling_active = 1 AND counselling_sessions_used > 0 LIMIT 5;  -- pick <ENTITLEMENT_ID>

-- B1. Seed a slot that ENDED 5 minutes ago, plus a CONFIRMED appointment on it
--     with NO check-in (checkin_verified_at = NULL  ->  no-show path).
INSERT INTO counselling_slot
  (counsellor_id, date, start_time, end_time, duration_minutes,
   status, mode, is_manually_created, is_blocked, version, created_at)
VALUES
  (1, CURDATE(), '08:00:00', TIME(DATE_SUB(NOW(), INTERVAL 5 MINUTE)), 30,
   'REQUESTED', 'ONLINE', 1, 0, 0, NOW());
SET @slot_b := LAST_INSERT_ID();

INSERT INTO counselling_appointment
  (slot_id, student_id, counsellor_id, status, mode, entitlement_id, attended, created_at)
VALUES
  (@slot_b, <STUDENT_ID>, 1, 'CONFIRMED', 'ONLINE', <ENTITLEMENT_ID_OR_NULL>, NULL, NOW());
SET @appt_b := LAST_INSERT_ID();

SELECT id, status, checkin_verified_at, attended, entitlement_id
FROM counselling_appointment WHERE id = @appt_b;   -- status=CONFIRMED

-- B2. Wait ~5 min for the session-close sweep (or ask me to trigger it), re-run:
SELECT id, status, attended FROM counselling_appointment WHERE id = @appt_b;
-- ✅ PASS = status = 'MISSED'.
-- If you set an entitlement, also confirm the session was credited back:
-- SELECT counselling_sessions_used FROM student_entitlement WHERE entitlement_id = <ENTITLEMENT_ID>;
--   (counselling_sessions_used should have decreased by 1)

-- B3. (Optional) COMPLETED path: set a check-in and re-age the slot, then wait/trigger:
-- UPDATE counselling_appointment SET status='CONFIRMED', checkin_verified_at = NOW() WHERE id = @appt_b;
-- UPDATE counselling_slot SET end_time = TIME(DATE_SUB(NOW(), INTERVAL 5 MINUTE)) WHERE id = @slot_b;
--   -> after the sweep: appointment status = 'COMPLETED', attended = 1.


-- ============================================================================
-- CLEANUP — remove the test rows when done
-- ============================================================================
-- DELETE FROM counselling_appointment WHERE id = @appt_b;
-- DELETE FROM counselling_slot WHERE id IN (@slot_a, @slot_b);
