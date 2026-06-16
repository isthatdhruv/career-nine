-- ---------------------------------------------------------------------------
-- V20260610002__counselling_entitlement_and_slot_hold.sql
--
-- Counselling Phase 3 (backend core):
--
-- 1. entitlement_id on counselling_appointment — records which entitlement a
--    booking drew its session from, so the lifecycle sweep can credit the
--    session back on a no-show ("always rebookable, no forfeit").
--
-- 2. held_until on counselling_slot — a soft-hold expiry. When a slot is held
--    during the pick-slot -> pay window it is stamped with a short TTL; a sweep
--    releases REQUESTED slots whose held_until has passed and that never became
--    a confirmed appointment.
--
-- Both columns are nullable and additive; safe forward-only migration.
--
-- Idempotent: guarded with information_schema checks so the migration is a no-op
-- if the column already exists. MySQL has no `ADD COLUMN IF NOT EXISTS`, and in
-- some environments Hibernate `ddl-auto` (which runs after Flyway) may have
-- already added these entity-mapped columns — a plain ADD COLUMN would then fail
-- with "Duplicate column name". The PREPARE/EXECUTE guard makes re-runs safe.
-- ---------------------------------------------------------------------------

SET @add_entitlement_id := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'counselling_appointment'
           AND COLUMN_NAME = 'entitlement_id'),
  'SELECT 1',
  'ALTER TABLE counselling_appointment ADD COLUMN entitlement_id BIGINT NULL');
PREPARE s1 FROM @add_entitlement_id; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @add_held_until := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'counselling_slot'
           AND COLUMN_NAME = 'held_until'),
  'SELECT 1',
  'ALTER TABLE counselling_slot ADD COLUMN held_until DATETIME NULL');
PREPARE s2 FROM @add_held_until; EXECUTE s2; DEALLOCATE PREPARE s2;
