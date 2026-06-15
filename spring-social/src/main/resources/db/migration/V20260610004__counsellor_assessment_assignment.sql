-- ---------------------------------------------------------------------------
-- V20260610004__counsellor_assessment_assignment.sql
--
-- Counselling Phase 4 — admin assigns counsellors to assessments.
--
-- Counsellors create their own slots; the admin decides which counsellor(s)
-- handle counselling for a given assessment. The booking flow then offers a
-- student only slots from counsellors assigned to their assessment (intersected
-- with the institute filter). If an assessment has no assignment rows, the flow
-- falls back to the institute filter alone (backward compatible).
--
-- CREATE TABLE IF NOT EXISTS keeps this idempotent and tolerant of Hibernate
-- ddl-auto having already created the entity-mapped table on a prior boot.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS counsellor_assessment_assignment (
  id             BIGINT       NOT NULL AUTO_INCREMENT,
  counsellor_id  BIGINT       NOT NULL,
  assessment_id  BIGINT       NOT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  assigned_by    BIGINT       NULL,
  created_at     DATETIME     NULL,
  updated_at     DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_counsellor_assessment (counsellor_id, assessment_id),
  KEY idx_caa_assessment (assessment_id),
  CONSTRAINT fk_caa_counsellor FOREIGN KEY (counsellor_id) REFERENCES counsellors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
