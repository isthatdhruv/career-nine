-- ---------------------------------------------------------------------------
-- V20260522001__seed_student_role_group.sql
--
-- Unified Student Access surgery — Phase 0 (R4).
--
-- Creates a real, seeded `student` role group that confers the least-privilege
-- permission bundle a student needs for the dashboard + the external assessment
-- app (login -> discover -> take -> submit -> results). Replaces the previously
-- hardcoded, unseeded `roleGroupRepository.getById(3L)` assignment.
--
-- Permission resolution (PermissionRepository.findCodesForUser) walks:
--   user_role_group_mapping -> role_role_group_mapping -> role -> role_permission -> permission
-- so this migration links a STUDENT role (carrying the 16 codes) to a role_group
-- named 'student'. The provisioning service maps each student User to that group.
--
-- Idempotent / forward-only: `role` and `role_group` have NON-UNIQUE `name`, so
-- inserts are guarded with NOT EXISTS rather than INSERT IGNORE. Re-running is a
-- no-op. (Flyway also applies each version exactly once.)
-- ---------------------------------------------------------------------------

-- 1. Ensure the STUDENT role exists (the seed in V20260511003 already references it).
INSERT INTO role (name, display)
SELECT * FROM (SELECT 'STUDENT' AS name, b'1' AS display) AS t
WHERE NOT EXISTS (SELECT 1 FROM role WHERE name = 'STUDENT');

-- 2. Ensure the 'student' role group exists.
INSERT INTO role_group (name, display)
SELECT * FROM (SELECT 'student' AS name, b'1' AS display) AS t
WHERE NOT EXISTS (SELECT 1 FROM role_group WHERE name = 'student');

-- 3. Re-assert the 16 permission codes (already seeded by V20260512001; this is a
--    self-contained safety net so the role bundle resolves even on a DB missing
--    that seed). `permission.code` is UNIQUE, so INSERT IGNORE is safe.
INSERT IGNORE INTO permission (code, description) VALUES
  ('user.me',                              'Read own authenticated user/profile'),
  ('user.update',                          'Update own user record'),
  ('student_info.read',                    'Read own student info'),
  ('student_info.update',                  'Update own student info'),
  ('student_demographic_response.create',  'Submit demographic field responses'),
  ('student_demographic_response.read',    'Read demographic fields / contact info'),
  ('student_demographic_response.update',  'Update demographic contact info'),
  ('assessment.read',                      'Read an assessment + its questionnaire'),
  ('assessment.prefetch',                  'Prefetch first active assessment'),
  ('assessment.start',                     'Start (mark ongoing) an assessment'),
  ('heartbeat.ping',                       'Send assessment live-tracking heartbeat'),
  ('assessment_answer.read',               'Read / restore own assessment answers'),
  ('assessment_answer.update',             'Autosave / rate own assessment answers'),
  ('assessment_answer.submit',             'Submit assessment answers'),
  ('assessment_proctoring.create',         'Submit proctoring telemetry'),
  ('generated_report.read',                'Read own generated reports');

-- 4. Map the 16 codes to the STUDENT role (INSERT IGNORE — (role_id, permission_id) is PK).
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'STUDENT' AND p.code IN (
  'user.me', 'user.update',
  'student_info.read', 'student_info.update',
  'student_demographic_response.create', 'student_demographic_response.read', 'student_demographic_response.update',
  'assessment.read', 'assessment.prefetch', 'assessment.start', 'heartbeat.ping',
  'assessment_answer.read', 'assessment_answer.update', 'assessment_answer.submit',
  'assessment_proctoring.create',
  'generated_report.read'
);

-- 5. Link the STUDENT role to the 'student' role group (guarded; picks MIN ids in
--    case legacy data holds duplicate names; derived-table wrap avoids MySQL 1093).
INSERT INTO role_role_group_mapping (role_id, role_group_id, display)
SELECT t.rid, t.gid, b'1'
FROM (
  SELECT (SELECT MIN(id) FROM role        WHERE name = 'STUDENT') AS rid,
         (SELECT MIN(id) FROM role_group  WHERE name = 'student') AS gid
) t
WHERE t.rid IS NOT NULL AND t.gid IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM (SELECT role_id, role_group_id FROM role_role_group_mapping) x
    WHERE x.role_id = t.rid AND x.role_group_id = t.gid
  );

-- 6. Whitelist the student dashboard URL space for the STUDENT role so the frontend
--    RequirePermission URL gate (role_url -> urlAllowed) passes for students. The
--    '*' suffix is a wildcard in urlAllowed, covering /student/dashboard,
--    /student/assessments, /student/reports, /student/student-info, etc.
--    role_url has UNIQUE(role_id, path), so INSERT IGNORE is idempotent.
INSERT IGNORE INTO role_url (role_id, path)
SELECT id, '/student/*' FROM role WHERE name = 'STUDENT';
