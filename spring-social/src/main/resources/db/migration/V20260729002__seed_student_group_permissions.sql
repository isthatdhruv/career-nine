-- ---------------------------------------------------------------------------
-- V20260729002__seed_student_group_permissions.sql
--
-- Permission catalog entries for the student-group feature. Every
-- PermissionCode enum value must appear in an `INSERT INTO permission` seed
-- migration or PermissionCatalogSeedCoverageTest fails.
--
-- Seeding the catalog does NOT grant anything — these still have to be attached
-- to a role before any user holds them.
-- ---------------------------------------------------------------------------

INSERT INTO permission (code, description) VALUES
  ('student_group.read',           'View student groups, their members and their contact persons'),
  ('student_group.create',         'Create a student group in an institute'),
  ('student_group.update',         'Rename, describe, activate or deactivate a student group'),
  ('student_group.delete',         'Delete a student group'),
  ('student_group.member.manage',  'Add or remove students in a student group'),
  ('student_group.contact.assign', 'Allot or remove contact persons on a student group')
ON DUPLICATE KEY UPDATE description = VALUES(description);
