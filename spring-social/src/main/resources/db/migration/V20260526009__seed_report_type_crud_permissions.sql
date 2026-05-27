-- ---------------------------------------------------------------------------
-- V20260526009__seed_report_type_crud_permissions.sql
--
-- Seed CRUD permissions for the ReportType catalog (added when the FE got an
-- MQT-style admin page that surfaces create / edit / delete for top-level
-- report types). Grants follow the same pattern as
-- V20260526008__seed_report_pipeline_permissions.sql.
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO permission (code, description) VALUES
  ('report_type.create', 'Create a new report type'),
  ('report_type.update', 'Update report type metadata'),
  ('report_type.delete', 'Delete a report type');

-- SUPERADMIN: every new permission.
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'SUPERADMIN' AND p.code IN (
  'report_type.create',
  'report_type.update',
  'report_type.delete'
);

-- Admin: create + update (no delete).
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'Admin' AND p.code IN (
  'report_type.create',
  'report_type.update'
);
