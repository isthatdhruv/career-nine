-- ---------------------------------------------------------------------------
-- V20260729004__fix_student_group_institute_fk.sql
--
-- Repairs a wrong foreign key introduced by V20260729001.
--
-- THE BUG
-- V20260729001 created student_group's institute FK against the LEGACY table:
--     REFERENCES institute_detail (institute_code)
-- but the InstituteDetail entity maps to `institute_detail_new`
-- (InstituteDetail.java @Table). Every other migration in this project targets
-- institute_detail_new; V20260729001 was the only outlier.
--
-- The two layers therefore validated against different tables:
--   - StudentGroupService.create() resolves the institute through JPA, so it
--     hits institute_detail_new, finds the row, and passes its 404 guard.
--   - MySQL then enforced the FK against legacy institute_detail, where that
--     institute_code does not exist -> errno 1452.
-- Symptom: "Institute not found" never logged, but POST /student-groups failed
-- with a constraint violation.
--
-- WHY DEV NEVER SAW IT
-- ddl-auto: update is on in every profile, so on dev Hibernate created
-- student_group first, deriving the FK from the @ManyToOne on StudentGroup —
-- which points at the entity's table, the correct institute_detail_new. Flyway's
-- CREATE TABLE IF NOT EXISTS then no-opped and the bad FK never materialised.
-- On prod the table did not pre-exist, so Flyway created it with the bad FK.
-- The idempotency guard kept the migration green while letting the two
-- environments diverge. Dev cannot reproduce this.
--
-- V20260729001 is deliberately NOT edited — it has already been applied, and
-- changing it would break Flyway's checksum validation everywhere. A fresh
-- environment therefore still creates the wrong FK and this migration corrects
-- it moments later, which is the intended flow.
--
-- IDEMPOTENT AND NAME-AGNOSTIC
-- The constraint name differs by origin: Flyway names it
-- fk_student_group_institute, Hibernate generates something like FK<hash>. This
-- migration looks the constraint up by (table, column, referenced table) rather
-- than by name, so it is a no-op on dev where the FK is already correct and a
-- real repair on prod.
--
-- IF THIS MIGRATION FAILS with errno 1452 on the ADD CONSTRAINT, student_group
-- holds rows whose institute_code is absent from institute_detail_new. Find them
-- with:
--     SELECT sg.id, sg.institute_code, sg.name FROM student_group sg
--     LEFT JOIN institute_detail_new i ON i.institute_code = sg.institute_code
--     WHERE i.institute_code IS NULL;
-- Failing loudly is deliberate: silently leaving the table without a FK would
-- hide the same class of bug this migration exists to fix.
-- ---------------------------------------------------------------------------

-- 1. Drop any FK on student_group(institute_code) that does NOT point at
--    institute_detail_new. Resolved by shape, not by name.
SET @bad_fk := (
  SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'student_group'
     AND COLUMN_NAME = 'institute_code'
     AND REFERENCED_TABLE_NAME IS NOT NULL
     AND REFERENCED_TABLE_NAME <> 'institute_detail_new'
   LIMIT 1);

SET @drop_bad_fk := IF(@bad_fk IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE student_group DROP FOREIGN KEY ', @bad_fk));
PREPARE s1 FROM @drop_bad_fk; EXECUTE s1; DEALLOCATE PREPARE s1;

-- 2. Add the correct FK, unless one already points at institute_detail_new
--    (dev, where Hibernate got there first).
SET @has_good_fk := (
  SELECT COUNT(*)
    FROM information_schema.KEY_COLUMN_USAGE
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'student_group'
     AND COLUMN_NAME = 'institute_code'
     AND REFERENCED_TABLE_NAME = 'institute_detail_new');

SET @add_good_fk := IF(@has_good_fk > 0,
  'SELECT 1',
  'ALTER TABLE student_group
     ADD CONSTRAINT fk_student_group_institute
     FOREIGN KEY (institute_code) REFERENCES institute_detail_new (institute_code)');
PREPARE s2 FROM @add_good_fk; EXECUTE s2; DEALLOCATE PREPARE s2;
