-- ---------------------------------------------------------------------------
-- V20260526003__create_calculated_report_data.sql
--
-- Reusable, per-(student, assessment, type, subtype) JSON payload of the
-- placeholders fed to the rendered HTML template. Computed once per (force
-- OR engine-version-change OR cache-miss), re-rendered on every report call
-- so template edits propagate without recomputing.
-- ---------------------------------------------------------------------------

CREATE TABLE calculated_report_data (
  calculated_report_data_id BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_student_id           BIGINT      NOT NULL,
  assessment_id             BIGINT      NOT NULL,
  report_type_id            BIGINT      NOT NULL,
  report_subtype_id         BIGINT      NOT NULL,
  calculated_json           JSON        NOT NULL,
  engine_version            VARCHAR(40) NOT NULL,
  calculated_at             DATETIME    NOT NULL,
  CONSTRAINT uk_calc_student_assessment_type_subtype
    UNIQUE (user_student_id, assessment_id, report_type_id, report_subtype_id),
  CONSTRAINT fk_calc_report_type    FOREIGN KEY (report_type_id)
    REFERENCES report_type(report_type_id),
  CONSTRAINT fk_calc_report_subtype FOREIGN KEY (report_subtype_id)
    REFERENCES report_subtype(report_subtype_id),
  INDEX idx_calc_assessment (assessment_id),
  INDEX idx_calc_student    (user_student_id)
);
