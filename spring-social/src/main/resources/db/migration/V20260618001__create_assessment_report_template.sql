-- ---------------------------------------------------------------------------
-- V20260618001__create_assessment_report_template.sql
--
-- Many-to-many link: one assessment offers several report templates. The
-- is_default flag marks the template generation uses when no explicit template
-- id is passed (at most one default per assessment, enforced in app code; the
-- first template mapped is auto-flagged default).
--
-- Supersedes questionire_report_template (questionnaire-anchored mapping). The
-- template + default are now chosen per assessment, so assessments that share a
-- questionnaire can carry different report templates.
--
-- Backfill below migrates the existing questionnaire mappings by fanning each
-- one out to every assessment that uses that questionnaire (assessment_table
-- holds the questionnaire_id FK), carrying the is_default flag. Because each
-- assessment has at most one questionnaire and (questionnaire, template) is
-- unique, no (assessment, template) duplicate can arise. The old table is left
-- in place for now and dropped in a later migration once this is verified.
-- ---------------------------------------------------------------------------

CREATE TABLE assessment_report_template (
  assessment_report_template_id BIGINT  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  assessment_id                 BIGINT  NOT NULL,
  report_template_id            BIGINT  NOT NULL,
  is_default                    BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uk_art_assessment_template UNIQUE (assessment_id, report_template_id),
  CONSTRAINT fk_art_assessment FOREIGN KEY (assessment_id)
    REFERENCES assessment_table(assessment_id),
  CONSTRAINT fk_art_template FOREIGN KEY (report_template_id)
    REFERENCES report_template(report_template_id),
  INDEX idx_art_assessment (assessment_id)
);

-- Migrate existing questionnaire-anchored mappings to the assessment(s) that use
-- each questionnaire, preserving the default flag.
INSERT INTO assessment_report_template (assessment_id, report_template_id, is_default)
SELECT a.assessment_id, q.report_template_id, q.is_default
FROM questionire_report_template q
JOIN assessment_table a ON a.questionnaire_id = q.questionnaire_id;
