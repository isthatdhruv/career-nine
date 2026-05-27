-- ---------------------------------------------------------------------------
-- V20260526006__seed_report_types_and_subtypes.sql
--
-- Seed the three report types and their subtypes. template_spaces_url +
-- template_spaces_key + template_uploaded_at start NULL — the post-migration
-- bootstrap (one-time) uploads the current classpath templates to Spaces and
-- populates them; afterwards admins upload via PUT /report-subtype/{id}/template.
--
-- Idempotent via INSERT IGNORE so repeat applies don't error.
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO report_type (code, display_name) VALUES
  ('legacy', 'Navigator 18-Page'),
  ('pager',  'Navigator 4-Pager'),
  ('bet',    'BET');

INSERT IGNORE INTO report_subtype (report_type_id, code, display_name, spaces_render_folder)
SELECT rt.report_type_id, x.code, x.display_name, x.spaces_render_folder
FROM report_type rt
JOIN (
  SELECT 'legacy' AS type_code, 'insight' AS code, 'Insight Navigator (6-8)'  AS display_name, 'navigator-reports/insight' AS spaces_render_folder
  UNION ALL SELECT 'legacy', 'subject', 'Subject Navigator (9-10)',  'navigator-reports/subject'
  UNION ALL SELECT 'legacy', 'career',  'Career Navigator (11-12)',  'navigator-reports/career'
  UNION ALL SELECT 'pager',  'insight', 'Insight 4-Pager (6-8)',     'pager-reports/insight'
  UNION ALL SELECT 'pager',  'subject', 'Subject 4-Pager (9-10)',    'pager-reports/subject'
  UNION ALL SELECT 'pager',  'career',  'Career 4-Pager (11-12)',    'pager-reports/career'
  UNION ALL SELECT 'bet',    'default', 'BET (single template)',     'bet-reports/default'
) x ON x.type_code = rt.code;
