-- ---------------------------------------------------------------------------
-- V20260521001__seed_phase0_permission_catalog_gaps.sql
--
-- Phase 0 (Tasks 0.3 + 0.4) of the auth remediation plan (docs/AUTH_REMEDIATION_PLAN.md).
--
-- Closes every enum->seed gap surfaced by PermissionCatalogSeedCoverageTest. These
-- PermissionCode enum values existed in code but were never inserted into the
-- `permission` table by any prior migration, so under auth.enforce-mode=enforce
-- (Phase 6) no role could be granted them and the endpoints they gate would 403:
--
--   * dashboard.admin.refresh   — NEW (Task 0.3): POST /dashboard/admin/snapshot/refresh
--   * permission.refresh        — POST /permission/refresh (catalog refresh action)
--   * role.url.update           — PUT /role/{id}/urls (manage a role's allowed React URLs)
--   * payment.update            — payment state update / nudge / link-resend
--   * student_management.read   — Student Management page (roster, no data downloads)
--   * student_management.update — Student Management page (allot / reset / edit)
--
-- Idempotent: the permission INSERT uses ON DUPLICATE KEY UPDATE (re-runnable; matches
-- V20260512001). The dashboard.admin.refresh grant is data-driven and INSERT IGNORE'd —
-- it mirrors the new permission onto whatever roles already hold dashboard.admin.read, so
-- admins keep view/refresh parity. The other five codes are seeded WITHOUT an automatic
-- grant: the correct role assignment is environment-specific and is made via the Roles &
-- Permissions UI; the Phase 6 soak uses the grant-coverage diagnostic in
-- src/test/java/com/kccitm/api/archtest/README.md to confirm each is granted before the
-- enforce flip. Super-admins bypass all checks regardless.
-- ---------------------------------------------------------------------------

INSERT INTO permission (code, description) VALUES
  ('dashboard.admin.refresh',   'Force-recompute the admin dashboard snapshot'),
  ('permission.refresh',        'Run the permission catalog refresh'),
  ('role.url.update',           'Manage which React URLs a role grants access to'),
  ('payment.update',            'Update payment state and send nudge / link-resend communications'),
  ('student_management.read',   'View Student Management page (no data downloads)'),
  ('student_management.update', 'Allot / reset / edit students from Student Management')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- Grant dashboard.admin.refresh to every role that already has dashboard.admin.read.
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_read ON p_read.id = rp.permission_id AND p_read.code = 'dashboard.admin.read'
JOIN permission p_new  ON p_new.code = 'dashboard.admin.refresh';
