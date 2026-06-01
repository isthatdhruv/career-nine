-- ---------------------------------------------------------------------------
-- V20260601007__seed_report_template_permissions.sql
--
-- Permission catalog for the collapsed report_template system. Mirrors the
-- grants from V20260526008/009. The old report_type.* / report_subtype.* codes
-- are left in place as short-lived aliases so the FE and BE can deploy
-- independently; they are removed in the Phase 4 cleanup migration.
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO permission (code, description) VALUES
  ('report_template.read',            'View report templates catalog'),
  ('report_template.create',          'Create a new report template'),
  ('report_template.update',          'Update report template metadata'),
  ('report_template.upload_template', 'Upload / replace a report template HTML'),
  ('report_template.delete',          'Delete a report template'),
  ('report_template.map',             'Map / unmap templates to questionnaires and set the default');

-- SUPERADMIN: everything.
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'SUPERADMIN' AND p.code IN (
  'report_template.read',
  'report_template.create',
  'report_template.update',
  'report_template.upload_template',
  'report_template.delete',
  'report_template.map'
);

-- Admin: read + create + update + upload_template + map (no delete).
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'Admin' AND p.code IN (
  'report_template.read',
  'report_template.create',
  'report_template.update',
  'report_template.upload_template',
  'report_template.map'
);

-- School Admin + Counsellor: read-only on the catalog.
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name IN ('School Admin', 'Counsellor') AND p.code IN (
  'report_template.read'
);
