-- ---------------------------------------------------------------------------
-- V20260601002__migrate_subtypes_to_templates.sql
--
-- Seed one report_template row per existing report_subtype so legacy
-- questionnaires (mapped via subtype) and the runtime engine pipeline have
-- templates to resolve. The globally-unique code is synthesized as
-- engine_code + '_' + subtype_code (subtype codes collide across types, e.g.
-- legacy/insight vs pager/insight). engine_code carries the parent type code;
-- template URL/key/uploadedAt/render_folder copy across. assessment_id stays
-- NULL (engine templates map to questionnaires, not a single assessment).
--
-- Idempotent: INSERT IGNORE on the unique code skips rows already migrated.
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO report_template
  (template_name, code, engine_code, template_url, template_spaces_key,
   template_uploaded_at, spaces_render_folder)
SELECT
  rs.display_name                      AS template_name,
  CONCAT(rt.code, '_', rs.code)        AS code,
  rt.code                              AS engine_code,
  rs.template_spaces_url               AS template_url,
  rs.template_spaces_key               AS template_spaces_key,
  rs.template_uploaded_at              AS template_uploaded_at,
  rs.spaces_render_folder              AS spaces_render_folder
FROM report_subtype rs
JOIN report_type rt ON rt.report_type_id = rs.report_type_id;
