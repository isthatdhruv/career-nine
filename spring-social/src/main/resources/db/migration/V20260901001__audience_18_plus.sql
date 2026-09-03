-- "Audience is 18+" toggle on cohort mapping rows.
--
--   campaign_class_assessment.audience_18_plus     B2C class routes (per class/cohort row)
--   campaign_assessment_mapping.audience_18_plus   B2C non-class deep links
--   assessment_institute_mapping.audience_18_plus  B2B link + invite (the mapping row IS the cohort)
--   school_assessment_config.audience_18_plus      School per-class rows
--
-- When set, the student registration page for that cohort switches from the
-- parental-consent DPDP wording and "Parent's Email/Phone" headers to adult
-- self-consent wording and "Your Email/Your Phone". NULL/FALSE keeps the
-- existing minor flow, so every legacy row is unaffected.
--
-- Entity-mapped, so ddl-auto: update would add them on its own; pinned here to keep the
-- schema reproducible from migrations alone.
--
-- Idempotent: added only if absent. Flyway runs BEFORE Hibernate ddl-auto, so on any
-- database where a prior boot already created them a plain ADD COLUMN would fail with
-- "Duplicate column name". MySQL has no ADD COLUMN IF NOT EXISTS, hence the
-- PREPARE/EXECUTE guards.

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaign_class_assessment'
      AND COLUMN_NAME = 'audience_18_plus'),
  'SELECT 1',
  'ALTER TABLE campaign_class_assessment ADD COLUMN audience_18_plus BOOLEAN DEFAULT FALSE');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaign_assessment_mapping'
      AND COLUMN_NAME = 'audience_18_plus'),
  'SELECT 1',
  'ALTER TABLE campaign_assessment_mapping ADD COLUMN audience_18_plus BOOLEAN DEFAULT FALSE');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_institute_mapping'
      AND COLUMN_NAME = 'audience_18_plus'),
  'SELECT 1',
  'ALTER TABLE assessment_institute_mapping ADD COLUMN audience_18_plus BOOLEAN DEFAULT FALSE');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_assessment_config'
      AND COLUMN_NAME = 'audience_18_plus'),
  'SELECT 1',
  'ALTER TABLE school_assessment_config ADD COLUMN audience_18_plus BOOLEAN DEFAULT FALSE');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
