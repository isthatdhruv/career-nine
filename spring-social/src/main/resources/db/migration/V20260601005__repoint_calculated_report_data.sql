-- ---------------------------------------------------------------------------
-- V20260601005__repoint_calculated_report_data.sql
--
-- Re-key calculated_report_data from (report_type_id, report_subtype_id) to a
-- single report_template_id. The cached placeholder JSON is regenerable, so
-- rows that cannot be mapped (NULL subtype) are simply purged rather than
-- preserved — the next report call recomputes them.
-- ---------------------------------------------------------------------------

-- 1. Add the new FK column (nullable during backfill).
ALTER TABLE calculated_report_data
  ADD COLUMN report_template_id BIGINT NULL;

-- 2. Backfill via the synthesized template code (engine_code + '_' + subtype_code).
UPDATE calculated_report_data c
JOIN report_subtype  rs  ON rs.report_subtype_id = c.report_subtype_id
JOIN report_type     rt  ON rt.report_type_id    = rs.report_type_id
JOIN report_template tpl ON tpl.code = CONCAT(rt.code, '_', rs.code)
SET c.report_template_id = tpl.report_template_id;

-- 3. Purge unmappable (regenerable) cache rows so the column can be NOT NULL.
DELETE FROM calculated_report_data WHERE report_template_id IS NULL;

-- 4. Drop the old constraints + columns (unique first, then FKs, then columns).
ALTER TABLE calculated_report_data
  DROP INDEX uk_calc_student_assessment_type_subtype,
  DROP FOREIGN KEY fk_calc_report_type,
  DROP FOREIGN KEY fk_calc_report_subtype,
  DROP COLUMN report_type_id,
  DROP COLUMN report_subtype_id;

-- 5. Lock in the new shape.
ALTER TABLE calculated_report_data
  MODIFY COLUMN report_template_id BIGINT NOT NULL,
  ADD CONSTRAINT fk_calc_report_template FOREIGN KEY (report_template_id)
    REFERENCES report_template(report_template_id),
  ADD CONSTRAINT uk_calc_student_assessment_template
    UNIQUE (user_student_id, assessment_id, report_template_id);
