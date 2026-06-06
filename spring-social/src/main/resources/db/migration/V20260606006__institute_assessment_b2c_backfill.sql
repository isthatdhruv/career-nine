-- ---------------------------------------------------------------------------
-- V20260606006__institute_assessment_b2c_backfill.sql
--
-- B2C campaigns carry institute_code (campaigns.institute_code → institute_detail),
-- so an institute's real assessment set = B2B mappings UNION the assessments attached
-- to that institute's campaigns. The original catalog backfill (V20260606001) only
-- pulled the B2B sources, so institute-tied B2C campaign assessments were missing.
--
-- This backfills those into institute_assessment so Reports Hub (which reads the
-- catalog) surfaces B2B mappings AND B2C campaign assessments for an institute.
-- Idempotent; campaigns with NULL institute_code (legacy/wildcard) are skipped.
-- ---------------------------------------------------------------------------

INSERT INTO institute_assessment (institute_code, assessment_id, is_active, created_at, updated_at)
SELECT DISTINCT c.institute_code, cam.assessment_id, TRUE, NOW(), NOW()
FROM campaigns c
JOIN campaign_assessment_mapping cam ON cam.campaign_id = c.campaign_id
WHERE c.institute_code IS NOT NULL
  AND (cam.is_deleted = 0 OR cam.is_deleted IS NULL)
  AND NOT EXISTS (
      SELECT 1 FROM institute_assessment ia
      WHERE ia.institute_code = c.institute_code AND ia.assessment_id = cam.assessment_id
  );
