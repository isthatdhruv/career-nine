-- ---------------------------------------------------------------------------
-- V20260526002__create_intermediary_scores.sql
--
-- Shared per-(student, assessment) RIASEC / MI / aptitude / SOI / values
-- store. One row per student-assessment pair regardless of how many subtype
-- reports are rendered. Used by Navigator + Pager pipelines.
--
-- BET does NOT write to this table — its intermediate is a structurally
-- different MQT-id score map (see plan Risk #6).
-- ---------------------------------------------------------------------------

CREATE TABLE intermediary_scores (
  intermediary_scores_id BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_student_id        BIGINT       NOT NULL,
  assessment_id          BIGINT       NOT NULL,
  scores_json            JSON         NOT NULL,
  engine_version         VARCHAR(40)  NOT NULL,
  calculated_at          DATETIME     NOT NULL,
  CONSTRAINT uk_intermediary_student_assessment UNIQUE (user_student_id, assessment_id),
  INDEX idx_intermediary_assessment (assessment_id),
  INDEX idx_intermediary_student    (user_student_id)
);
