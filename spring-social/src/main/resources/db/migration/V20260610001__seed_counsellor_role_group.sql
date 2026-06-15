-- ---------------------------------------------------------------------------
-- V20260610001__seed_counsellor_role_group.sql
--
-- Counselling Phase 1 — counsellor portal auth linkage.
--
-- Creates a real, seeded `counsellor` role group so a counsellor who logs in
-- through the unified /auth/login session (User-backed, provider=local) resolves
-- the permission bundle the counsellor portal endpoints require. Mirrors the
-- student seed (V20260522001).
--
-- Permission resolution (PermissionRepository.findCodesForUser) walks:
--   user_role_group_mapping -> role_role_group_mapping -> role -> role_permission -> permission
-- so this links the existing COUNSELLOR role (it also carries the read bundle
-- seeded in V20260511003) to a role_group named 'counsellor'. Counsellor
-- ProvisioningService maps each counsellor User to that group on approval.
--
-- Idempotent / forward-only: `role` and `role_group` have NON-UNIQUE `name`, so
-- inserts are guarded with NOT EXISTS rather than INSERT IGNORE. Re-running is a
-- no-op. (Flyway also applies each version exactly once.)
-- ---------------------------------------------------------------------------

-- 1. Ensure the COUNSELLOR role exists (V20260511003 already references it by name).
INSERT INTO role (name, display)
SELECT * FROM (SELECT 'COUNSELLOR' AS name, b'1' AS display) AS t
WHERE NOT EXISTS (SELECT 1 FROM role WHERE name = 'COUNSELLOR');

-- 2. Ensure the 'counsellor' role group exists.
INSERT INTO role_group (name, display)
SELECT * FROM (SELECT 'counsellor' AS name, b'1' AS display) AS t
WHERE NOT EXISTS (SELECT 1 FROM role_group WHERE name = 'counsellor');

-- 3. Re-assert the counsellor-portal permission codes (already seeded by
--    V20260512001; this self-contained safety net makes the bundle resolve even
--    on a DB missing that seed). `permission.code` is UNIQUE → INSERT IGNORE safe.
INSERT IGNORE INTO permission (code, description) VALUES
  ('counsellor.read',                              'Read counsellor profile'),
  ('counsellor.update',                            'Update counsellor profile'),
  ('counsellor_institute_mapping.read',            'Read counsellor institute mappings'),
  ('counsellor_media.create',                      'Upload counsellor media'),
  ('counsellor_media.delete',                      'Delete counsellor media'),
  ('counselling.availability_template.create',     'Create availability templates'),
  ('counselling.availability_template.read',       'Read availability templates'),
  ('counselling.availability_template.update',     'Update availability templates'),
  ('counselling.availability_template.delete',     'Delete availability templates'),
  ('counselling.slot.create',                      'Create counselling slots'),
  ('counselling.slot.read',                        'Read counselling slots'),
  ('counselling.slot.update',                      'Update counselling slots'),
  ('counselling.slot.delete',                      'Delete counselling slots'),
  ('counselling.appointment.read',                 'Read counselling appointments'),
  ('counselling.appointment.update',               'Update counselling appointments'),
  ('counselling.session_notes.create',             'Create session notes'),
  ('counselling.session_notes.read',               'Read session notes'),
  ('counselling.session_notes.update',             'Update session notes'),
  ('counselling.rating.read',                      'Read counselling ratings'),
  ('counselling.block_date.create',                'Request block dates'),
  ('counselling.block_date.read',                  'Read block date requests'),
  ('counselling.block_date.update',                'Update block date requests'),
  ('counselling.notification.read',                'Read counselling notifications'),
  ('counselling.notification.update',              'Update counselling notifications');

-- 4. Map the counsellor-portal codes to the COUNSELLOR role (INSERT IGNORE —
--    (role_id, permission_id) is the PK; the read bundle from V20260511003 stays).
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'COUNSELLOR' AND p.code IN (
  'counsellor.read', 'counsellor.update',
  'counsellor_institute_mapping.read',
  'counsellor_media.create', 'counsellor_media.delete',
  'counselling.availability_template.create', 'counselling.availability_template.read',
  'counselling.availability_template.update', 'counselling.availability_template.delete',
  'counselling.slot.create', 'counselling.slot.read',
  'counselling.slot.update', 'counselling.slot.delete',
  'counselling.appointment.read', 'counselling.appointment.update',
  'counselling.session_notes.create', 'counselling.session_notes.read', 'counselling.session_notes.update',
  'counselling.rating.read',
  'counselling.block_date.create', 'counselling.block_date.read', 'counselling.block_date.update',
  'counselling.notification.read', 'counselling.notification.update'
);

-- 5. Link the COUNSELLOR role to the 'counsellor' role group (guarded; picks MIN
--    ids in case legacy data holds duplicate names; derived-table wrap avoids 1093).
INSERT INTO role_role_group_mapping (role_id, role_group_id, display)
SELECT t.rid, t.gid, b'1'
FROM (
  SELECT (SELECT MIN(id) FROM role        WHERE name = 'COUNSELLOR') AS rid,
         (SELECT MIN(id) FROM role_group  WHERE name = 'counsellor') AS gid
) t
WHERE t.rid IS NOT NULL AND t.gid IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM (SELECT role_id, role_group_id FROM role_role_group_mapping) x
    WHERE x.role_id = t.rid AND x.role_group_id = t.gid
  );

-- 6. Whitelist the counsellor portal URL space for the COUNSELLOR role so the FE
--    RequirePermission URL gate (role_url -> urlAllowed) passes. The '*' suffix is
--    a wildcard, covering /counsellor/dashboard, /counsellor/appointments, etc.
--    role_url has UNIQUE(role_id, path) → INSERT IGNORE is idempotent.
INSERT IGNORE INTO role_url (role_id, path)
SELECT id, '/counsellor/*' FROM role WHERE name = 'COUNSELLOR';

-- ---------------------------------------------------------------------------
-- 7. Counsellor -> login User linkage is handled in Java, NOT here.
--
--    Originally this migration back-filled `student_user` directly, but that is
--    unsafe: Flyway runs BEFORE Hibernate `ddl-auto`, so entity-managed columns
--    on the legacy `student_user` table (e.g. the `isActive` / `is_super_admin`
--    columns declared on the User entity) may not exist yet at migration time —
--    the raw INSERT failed with "Unknown column 'isActive'".
--
--    Instead, CounsellorService.toggleActive() now find-or-creates the local
--    login User (provider = 'local', reusing the counsellor's BCrypt
--    password_hash) and links it on approval, then provisions the counsellor
--    role group/scope. That runs after ddl-auto, so Hibernate maps every column
--    correctly and covers both newly-registered and pre-existing counsellors.
-- ---------------------------------------------------------------------------
