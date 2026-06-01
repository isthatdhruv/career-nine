-- ---------------------------------------------------------------------------
-- V20260601004__migrate_questionnaire_fks.sql
--
-- Translate each questionnaire's single (report_type_id, report_subtype_id) FK
-- into a questionire_report_template row, flagged is_default=TRUE (the old
-- single mapping becomes the default). The subtype maps to the synthesized
-- template code engine_code + '_' + subtype_code (see V20260601002).
--
-- Questionnaires that were never backfilled (NULL report_subtype_id) get no
-- row here; ops map a template via the admin UI afterwards (the first mapped
-- is auto-flagged default).
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO questionire_report_template
  (questionnaire_id, report_template_id, is_default)
SELECT
  q.questionnaire_id,
  tpl.report_template_id,
  TRUE
FROM questionire q
JOIN report_subtype rs ON rs.report_subtype_id = q.report_subtype_id
JOIN report_type    rt ON rt.report_type_id    = rs.report_type_id
JOIN report_template tpl ON tpl.code = CONCAT(rt.code, '_', rs.code)
WHERE q.report_subtype_id IS NOT NULL;
