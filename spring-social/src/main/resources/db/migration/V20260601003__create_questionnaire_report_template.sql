-- ---------------------------------------------------------------------------
-- V20260601003__create_questionnaire_report_template.sql
--
-- Many-to-many link: one questionnaire offers several report templates. The
-- is_default flag marks the template generation uses when no explicit template
-- id is passed (at most one default per questionnaire, enforced in app code;
-- the first template mapped is auto-flagged default).
--
-- The questionnaire table is the (historically misspelled) `Questionire`, PK
-- column `questionnaire_id` (see Questionnaire.java).
-- ---------------------------------------------------------------------------

CREATE TABLE questionire_report_template (
  questionire_report_template_id BIGINT  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  questionnaire_id               BIGINT  NOT NULL,
  report_template_id             BIGINT  NOT NULL,
  is_default                     BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uk_qrt_questionnaire_template UNIQUE (questionnaire_id, report_template_id),
  CONSTRAINT fk_qrt_questionnaire FOREIGN KEY (questionnaire_id)
    REFERENCES questionire(questionnaire_id),
  CONSTRAINT fk_qrt_template FOREIGN KEY (report_template_id)
    REFERENCES report_template(report_template_id),
  INDEX idx_qrt_questionnaire (questionnaire_id)
);
