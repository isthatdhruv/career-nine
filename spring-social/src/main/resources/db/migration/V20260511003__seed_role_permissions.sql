-- ---------------------------------------------------------------------------
-- V20260511003__seed_role_permissions.sql
--
-- Phase 14 (ABAC Data Foundation) — Plan 14-02.
--
-- Seeds `role_permission` with a sensible default Role.name -> permission_code
-- bundle for every role we currently expect to exist in the `role` table.
-- The mapping is intentionally a baseline, NOT a final product decision —
-- each block carries a -- PRODUCT-REVIEW: comment marker. Product must
-- review and adjust before Phase 15 flips authorization to enforce mode.
--
-- Pattern:
--   INSERT IGNORE INTO role_permission (role_id, permission_id)
--   SELECT r.id, p.id FROM role r, permission p
--   WHERE r.name = '<RoleName>' AND p.code IN ('<code1>', '<code2>', ...);
--
-- If a Role.name doesn't exist in this environment, the SELECT returns 0
-- rows and the INSERT is a no-op (safe). The INSERT IGNORE makes re-runs
-- idempotent — duplicate (role_id, permission_id) PK collisions are
-- silently skipped.
--
-- DO NOT re-edit this file after it has been applied. To adjust the
-- mapping in production, write a follow-up forward-only migration with
-- the specific INSERTs / DELETEs needed.
-- ---------------------------------------------------------------------------

-- PRODUCT-REVIEW: SUPER_ADMIN gets every permission (the full catalog).
-- TODO(product-review): confirm before Phase 15. If you want a non-catalog
-- "super-admin bypass" semantic instead, set User.superAdmin=true on the
-- principal and leave the role unmapped — see AUTH_REDESIGN_PLAN.md §3.4.
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'SUPER_ADMIN';

-- PRODUCT-REVIEW: INSTITUTE_ADMIN — full control of their scoped institute(s).
-- Includes user.write + role.assign so they can manage staff within scope.
-- TODO(product-review): confirm omissions — does NOT include institute.delete,
-- payment.refund, payment.webhook.handle, permission.grant.
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'INSTITUTE_ADMIN' AND p.code IN (
  'institute.read', 'institute.write',
  'session.read', 'session.write',
  'class.read', 'class.write',
  'section.read', 'section.write',
  'student.read', 'student.write', 'student.import_bulk',
  'assessment.read', 'assessment.create', 'assessment.publish', 'assessment.delete',
  'campaign.read', 'campaign.write', 'campaign.publish',
  'report.read', 'report.export',
  'user.read', 'user.write', 'user.toggle_active',
  'role.assign'
);

-- PRODUCT-REVIEW: PRINCIPAL — single-institute admin. Same as INSTITUTE_ADMIN
-- minus institute.write, assessment.delete, campaign.write, campaign.publish,
-- user.write, user.toggle_active, role.assign.
-- TODO(product-review): confirm PRINCIPAL retains student.write (today: yes —
-- they manage student records). Confirm campaign.read-only is acceptable.
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'PRINCIPAL' AND p.code IN (
  'institute.read',
  'session.read',
  'class.read', 'class.write',
  'section.read', 'section.write',
  'student.read', 'student.write', 'student.import_bulk',
  'assessment.read', 'assessment.create', 'assessment.publish',
  'campaign.read',
  'report.read', 'report.export',
  'user.read'
);

-- PRODUCT-REVIEW: TEACHER — read students + run/grade assessments + export
-- reports for their scoped classes/sections. No student.write (student
-- records are created by admins / bulk-import).
-- TODO(product-review): confirm TEACHER has assessment.publish (today: yes —
-- class-teacher publishes to their section) or should that require admin
-- escalation?
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'TEACHER' AND p.code IN (
  'institute.read',
  'session.read',
  'class.read',
  'section.read',
  'student.read',
  'assessment.read', 'assessment.create', 'assessment.publish',
  'report.read', 'report.export'
);

-- PRODUCT-REVIEW: COUNSELLOR — read-only over students + reports.
-- TODO(product-review): confirm COUNSELLOR has report.export (PII concern?)
-- or read-only without export.
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'COUNSELLOR' AND p.code IN (
  'institute.read',
  'session.read',
  'class.read',
  'section.read',
  'student.read',
  'assessment.read',
  'report.read', 'report.export'
);

-- PRODUCT-REVIEW: STUDENT — take assessments, view own reports.
-- TODO(product-review): confirm STUDENT permission bundle. Note ABAC scope
-- filters (Phase 15) further restrict to own records only.
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'STUDENT' AND p.code IN (
  'assessment.read',
  'report.read'
);

-- PRODUCT-REVIEW: B2C_STUDENT — same as STUDENT for now. Differentiation
-- happens via the campaign-payment provisioning flow, not via permissions.
-- TODO(product-review): confirm B2C_STUDENT == STUDENT, or differentiate.
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'B2C_STUDENT' AND p.code IN (
  'assessment.read',
  'report.read'
);

-- PRODUCT-REVIEW: WEBHOOK — system-to-system role. Reserved for Razorpay
-- webhook callers; should NEVER be assigned to a human user.
-- TODO(product-review): confirm the WEBHOOK role-name string actually exists
-- in role table. If not, follow-up migration must INSERT it before this seed
-- can attach payment.webhook.handle.
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'WEBHOOK' AND p.code IN (
  'payment.webhook.handle'
);
