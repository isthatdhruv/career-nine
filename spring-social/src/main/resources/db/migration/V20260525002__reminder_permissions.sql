-- ---------------------------------------------------------------------------
-- V20260525002__reminder_permissions.sql
--
-- Seed permission catalog entries for the Reminder Management page and link
-- them to role groups (RBAC). ABAC is layered on top via existing
-- user_role_scope (institute_id, etc.) — no schema change needed.
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO permission (code, description) VALUES
  ('reminders.view',                    'Open the Reminder Management page'),
  ('reminders.config.read',             'Read reminder system configuration'),
  ('reminders.config.edit',             'Edit enable/disable, cron, lead-time, caps'),
  ('reminders.template.edit',           'Edit subject + body templates'),
  ('reminders.logs.view',               'View delivery log and analytics'),
  ('reminders.suppressions.manage',     'Add / remove per-student opt-outs'),
  ('reminders.send.manual',             'Trigger a manual reminder send'),
  ('reminders.send.test',               'Send a test email from the template editor');

-- ---------------------------------------------------------------------------
-- Ensure the helper roles exist (idempotent — role.name is non-unique).
-- ---------------------------------------------------------------------------
INSERT INTO role (name, display)
SELECT * FROM (SELECT 'B2C_OPS' AS name, b'1' AS display) AS t
WHERE NOT EXISTS (SELECT 1 FROM role WHERE name = 'B2C_OPS');

INSERT INTO role (name, display)
SELECT * FROM (SELECT 'SCHOOL_PRINCIPAL' AS name, b'1' AS display) AS t
WHERE NOT EXISTS (SELECT 1 FROM role WHERE name = 'SCHOOL_PRINCIPAL');

INSERT INTO role (name, display)
SELECT * FROM (SELECT 'SUPERADMIN' AS name, b'1' AS display) AS t
WHERE NOT EXISTS (SELECT 1 FROM role WHERE name = 'SUPERADMIN');

-- ---------------------------------------------------------------------------
-- Ensure the helper role groups exist.
-- ---------------------------------------------------------------------------
INSERT INTO role_group (name, display)
SELECT * FROM (SELECT 'b2c_ops' AS name, b'1' AS display) AS t
WHERE NOT EXISTS (SELECT 1 FROM role_group WHERE name = 'b2c_ops');

INSERT INTO role_group (name, display)
SELECT * FROM (SELECT 'school_principal' AS name, b'1' AS display) AS t
WHERE NOT EXISTS (SELECT 1 FROM role_group WHERE name = 'school_principal');

INSERT INTO role_group (name, display)
SELECT * FROM (SELECT 'superadmin' AS name, b'1' AS display) AS t
WHERE NOT EXISTS (SELECT 1 FROM role_group WHERE name = 'superadmin');

-- Link each role to its role_group (idempotent — role_role_group_mapping uses
-- composite (role_id, role_group_id) so re-running INSERT IGNORE is safe).
INSERT IGNORE INTO role_role_group_mapping (role_id, role_group_id, display)
SELECT r.id, rg.id, b'1' FROM role r, role_group rg
WHERE (r.name = 'SUPERADMIN'        AND rg.name = 'superadmin')
   OR (r.name = 'B2C_OPS'           AND rg.name = 'b2c_ops')
   OR (r.name = 'SCHOOL_PRINCIPAL'  AND rg.name = 'school_principal');

-- ---------------------------------------------------------------------------
-- RBAC: link roles to the reminder permissions.
-- ---------------------------------------------------------------------------

-- SUPERADMIN: every reminder permission.
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'SUPERADMIN' AND p.code IN (
  'reminders.view',
  'reminders.config.read',
  'reminders.config.edit',
  'reminders.template.edit',
  'reminders.logs.view',
  'reminders.suppressions.manage',
  'reminders.send.manual',
  'reminders.send.test'
);

-- B2C_OPS: view + config + logs + manual + test (no template editing).
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'B2C_OPS' AND p.code IN (
  'reminders.view',
  'reminders.config.read',
  'reminders.config.edit',
  'reminders.logs.view',
  'reminders.send.manual',
  'reminders.send.test'
);

-- SCHOOL_PRINCIPAL: read-only config + logs + manual send (scoped by ABAC).
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'SCHOOL_PRINCIPAL' AND p.code IN (
  'reminders.view',
  'reminders.config.read',
  'reminders.logs.view',
  'reminders.send.manual',
  'reminders.send.test'
);
