-- ---------------------------------------------------------------------------
-- V20260526008__seed_report_pipeline_permissions.sql
--
-- Seed permission catalog entries for the unified report-generation
-- pipeline (Phase 1 of plan 1-b-2-indexed-valley) and grant them to existing
-- roles. ABAC (per-institute scoping) is layered on at the @PreAuthorize
-- level via @auth.instituteOfStudent(...) and does not need schema changes.
--
-- generated_report.create is intentionally NOT re-inserted here — it was
-- seeded in V20260512001__seed_phase15_permissions.sql.
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO permission (code, description) VALUES
  ('report_type.read',                'View report types catalog'),
  ('report_subtype.read',             'View report subtypes catalog'),
  ('report_subtype.create',           'Create a new report subtype'),
  ('report_subtype.update',           'Update subtype metadata (display name, render folder)'),
  ('report_subtype.upload_template',  'Upload / replace the HTML template for a subtype'),
  ('report_subtype.delete',           'Delete a report subtype'),
  ('calculated_report_data.read',     'View persisted calculated report payloads (dashboards)'),
  ('intermediary_scores.read',        'View persisted intermediary score payloads (dashboards)');

-- ---------------------------------------------------------------------------
-- RBAC: grant the new permissions to existing roles.
-- ---------------------------------------------------------------------------

-- SUPERADMIN: every new permission.
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'SUPERADMIN' AND p.code IN (
  'report_type.read',
  'report_subtype.read',
  'report_subtype.create',
  'report_subtype.update',
  'report_subtype.upload_template',
  'report_subtype.delete',
  'calculated_report_data.read',
  'intermediary_scores.read'
);

-- Admin: read + create + update + upload_template (no delete).
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'Admin' AND p.code IN (
  'report_type.read',
  'report_subtype.read',
  'report_subtype.create',
  'report_subtype.update',
  'report_subtype.upload_template',
  'calculated_report_data.read',
  'intermediary_scores.read'
);

-- School Admin + Counsellor: read-only on the catalog + dashboards. Template
-- authoring is platform-level — they don't get upload_template.
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name IN ('School Admin', 'Counsellor') AND p.code IN (
  'report_type.read',
  'report_subtype.read',
  'calculated_report_data.read',
  'intermediary_scores.read'
);
