-- ---------------------------------------------------------------------------
-- V20260625001__seed_school_admin_role_group.sql
--
-- School Admin Phase 1 — login + differentiation linkage.
--
-- Creates the `SCHOOL_ADMIN` role and a `school_admin` role group so a user
-- assigned to that group resolves the persona on login. The frontend seal
-- (PrivateRoutes.isPureSchoolAdmin) matches the Role.name 'SCHOOL_ADMIN' in
-- currentUser.roles and bounces a pure school admin into /school/*. Mirrors the
-- counsellor seed (V20260610001).
--
-- roles[] resolution (User.getRole / PermissionRepository.findCodesForUser) walks:
--   user_role_group_mapping -> role_role_group_mapping -> role(.name) -> role_permission -> permission
-- so this links a Role named 'SCHOOL_ADMIN' to a role_group named 'school_admin'.
-- The group MUST have display=1 or it won't appear in the User Management
-- assign-role-group dropdown (RoleGroupController.getAllRoles -> findByDisplay(true)).
--
-- Scope of THIS migration (step 1): role + group + link + URL whitelist only.
-- Permissions (e.g. dashboard.school.insights.read) and the School Reports page
-- land in step 2. User->group assignment and the per-assignment institute ABAC
-- scope (user_role_scope) are environment/user-specific and are NOT seeded here
-- (do them via the admin UI + a user_role_scope insert).
--
-- Idempotent / forward-only: `role` and `role_group` have NON-UNIQUE `name`, so
-- inserts are guarded with NOT EXISTS rather than INSERT IGNORE. Re-running is a
-- no-op. (Flyway also applies each version exactly once.)
-- ---------------------------------------------------------------------------

-- 1. Ensure the SCHOOL_ADMIN role exists.
INSERT INTO role (name, display)
SELECT * FROM (SELECT 'SCHOOL_ADMIN' AS name, b'1' AS display) AS t
WHERE NOT EXISTS (SELECT 1 FROM role WHERE name = 'SCHOOL_ADMIN');

-- 2. Ensure the 'school_admin' role group exists (display=1 → assignable in UI).
INSERT INTO role_group (name, display)
SELECT * FROM (SELECT 'school_admin' AS name, b'1' AS display) AS t
WHERE NOT EXISTS (SELECT 1 FROM role_group WHERE name = 'school_admin');

-- 3. Link the SCHOOL_ADMIN role to the 'school_admin' role group (guarded; picks
--    MIN ids in case legacy data holds duplicate names; derived-table wrap avoids 1093).
INSERT INTO role_role_group_mapping (role_id, role_group_id, display)
SELECT t.rid, t.gid, b'1'
FROM (
  SELECT (SELECT MIN(id) FROM role        WHERE name = 'SCHOOL_ADMIN') AS rid,
         (SELECT MIN(id) FROM role_group  WHERE name = 'school_admin') AS gid
) t
WHERE t.rid IS NOT NULL AND t.gid IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM (SELECT role_id, role_group_id FROM role_role_group_mapping) x
    WHERE x.role_id = t.rid AND x.role_group_id = t.gid
  );

-- 4. Whitelist the /school/* URL space for the SCHOOL_ADMIN role so the FE
--    RequirePermission URL gate (role_url -> urlAllowed) and the aside menu pass.
--    The '*' suffix is a wildcard, covering /school/dashboard and future /school/*
--    pages. role_url has UNIQUE(role_id, path) → INSERT IGNORE is idempotent.
INSERT IGNORE INTO role_url (role_id, path)
SELECT id, '/school/*' FROM role WHERE name = 'SCHOOL_ADMIN';
