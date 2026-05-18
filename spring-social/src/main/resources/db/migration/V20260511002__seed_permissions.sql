-- ---------------------------------------------------------------------------
-- V20260511002__seed_permissions.sql
--
-- Phase 14 (ABAC Data Foundation) — Plan 14-02.
--
-- Seeds the `permission` table with the canonical verb catalog defined in
-- docs/AUTH_REDESIGN_PLAN.md §3.2 and represented in Java by the
-- com.kccitm.api.security.PermissionCode enum.
--
-- Idempotent: re-running on a partially-seeded DB updates descriptions on
-- existing codes (via ON DUPLICATE KEY UPDATE) and inserts the missing ones.
-- Adding a new permission later requires:
--   1. Add a new enum constant to PermissionCode.java
--   2. Write a follow-up forward-only migration (e.g. V<today>NNN__add_<code>_permission.sql)
--      with a single INSERT ... ON DUPLICATE KEY UPDATE statement
-- DO NOT re-edit this file once it has been applied to any environment.
--
-- Row count: 28 (matches PermissionCode.values().length).
-- TODO(product-review): default descriptions are engineer-authored; product
-- may want to refine wording before any of these strings surface in the UI.
-- ---------------------------------------------------------------------------

INSERT INTO permission (code, description) VALUES
  ('institute.read',         'View institute details'),
  ('institute.write',        'Create or update institutes'),
  ('institute.delete',       'Delete institutes'),
  ('session.read',           'View academic sessions'),
  ('session.write',          'Create or update sessions'),
  ('class.read',             'View classes / courses'),
  ('class.write',            'Create or update classes / courses'),
  ('section.read',           'View sections'),
  ('section.write',          'Create or update sections'),
  ('student.read',           'View students'),
  ('student.write',          'Create or update students'),
  ('student.import_bulk',    'Bulk-import students from CSV/Excel'),
  ('assessment.read',        'View assessments'),
  ('assessment.create',      'Create assessments'),
  ('assessment.publish',     'Publish assessments to students'),
  ('assessment.delete',      'Delete assessments'),
  ('campaign.read',          'View marketing/payment campaigns'),
  ('campaign.write',         'Create or update campaigns'),
  ('campaign.publish',       'Publish/activate campaigns'),
  ('report.read',            'View generated reports'),
  ('report.export',          'Export reports (PDF/Excel)'),
  ('user.read',              'View user accounts'),
  ('user.write',             'Create or update user accounts'),
  ('user.toggle_active',     'Activate or deactivate users'),
  ('payment.refund',         'Issue payment refunds'),
  ('payment.webhook.handle', 'Handle Razorpay webhook (system role)'),
  ('role.assign',            'Assign roles to users'),
  ('permission.grant',       'Grant/revoke individual permissions')
ON DUPLICATE KEY UPDATE description = VALUES(description);
