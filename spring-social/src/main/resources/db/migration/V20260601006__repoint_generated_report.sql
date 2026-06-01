-- ---------------------------------------------------------------------------
-- V20260601006__repoint_generated_report.sql
--
-- Re-key generated_report from report_subtype_id to report_template_id. Unlike
-- the calculated cache, these rows hold real report URLs and are NOT purged —
-- report_template_id stays nullable so any historical row that cannot map is
-- preserved. type_of_report (= engine_code) is RETAINED so the existing
-- String-keyed GeneratedReportController / repository queries keep working.
-- ---------------------------------------------------------------------------

-- 1. Add the new FK column.
ALTER TABLE generated_report
  ADD COLUMN report_template_id BIGINT NULL,
  ADD CONSTRAINT fk_genrep_template FOREIGN KEY (report_template_id)
    REFERENCES report_template(report_template_id);

-- 2. Backfill via the synthesized template code.
UPDATE generated_report gr
JOIN report_subtype  rs  ON rs.report_subtype_id = gr.report_subtype_id
JOIN report_type     rt  ON rt.report_type_id    = rs.report_type_id
JOIN report_template tpl ON tpl.code = CONCAT(rt.code, '_', rs.code)
SET gr.report_template_id = tpl.report_template_id;

-- 3. Swap the unique constraint: (student, assessment, type, subtype) ->
--    (student, assessment, template). Drop the old subtype FK + column.
ALTER TABLE generated_report
  DROP INDEX uk_student_assessment_type_subtype,
  DROP FOREIGN KEY fk_genrep_subtype,
  DROP COLUMN report_subtype_id,
  ADD CONSTRAINT uk_student_assessment_template
    UNIQUE (user_student_id, assessment_id, report_template_id);
