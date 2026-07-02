-- ---------------------------------------------------------------------------
-- V20260702001__seed_student_impersonate_permission.sql
--
-- Seeds the student.impersonate permission (PermissionCode.STUDENT_IMPERSONATE),
-- which gates POST /admin/impersonate/student/{userStudentId} — the Data Download
-- "Open as Student" action that mints a short-lived student JWT for admin
-- impersonation.
--
-- Idempotent: ON DUPLICATE KEY UPDATE (re-runnable; matches V20260521001).
-- Seeded WITHOUT an automatic role grant: impersonation is privileged, so the
-- correct role assignment is environment-specific and made via the Roles &
-- Permissions UI. Super-admins bypass all checks and can use it immediately.
-- ---------------------------------------------------------------------------

INSERT INTO permission (code, description) VALUES
  ('student.impersonate', 'Open a student''s dashboard as that student (admin impersonation)')
ON DUPLICATE KEY UPDATE description = VALUES(description);
