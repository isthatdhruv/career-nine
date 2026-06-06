-- ---------------------------------------------------------------------------
-- V20260606001__institute_assessment_catalog.sql
--
-- B2B redesign — the Institute<->Assessment catalog (Layer 1).
--
-- A direct join row "this assessment is offered by this institute", decoupled
-- from the per-level registration links. Set in the institute-creation wizard's
-- "Map Assessments" step, and kept in sync by the unified mapping page (every
-- createMapping upserts the matching catalog row).
--
-- Backfilled from BOTH legacy sources, deduped:
--   * assessment_institute_mapping  (the per-level flow)
--   * school_assessment_config      (the school-level flow — its assessments do
--                                     not appear in assessment_institute_mapping)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS institute_assessment (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    institute_code INT          NOT NULL,
    assessment_id  BIGINT       NOT NULL,
    is_active      BOOLEAN      DEFAULT TRUE,
    created_at     datetime(6)  NULL,
    updated_at     datetime(6)  NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_institute_assessment (institute_code, assessment_id)
);

-- Backfill from the per-level mapping flow (active rows only), deduped.
INSERT INTO institute_assessment (institute_code, assessment_id, is_active, created_at, updated_at)
SELECT DISTINCT m.institute_code, m.assessment_id, TRUE, NOW(), NOW()
FROM assessment_institute_mapping m
WHERE m.is_active = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM institute_assessment ia
      WHERE ia.institute_code = m.institute_code AND ia.assessment_id = m.assessment_id
  );

-- Backfill from the school-level config flow (active rows only), deduped.
INSERT INTO institute_assessment (institute_code, assessment_id, is_active, created_at, updated_at)
SELECT DISTINCT c.institute_code, c.assessment_id, TRUE, NOW(), NOW()
FROM school_assessment_config c
WHERE c.is_active = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM institute_assessment ia
      WHERE ia.institute_code = c.institute_code AND ia.assessment_id = c.assessment_id
  );
