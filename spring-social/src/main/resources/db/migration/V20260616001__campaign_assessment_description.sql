-- ---------------------------------------------------------------------------
-- V20260616001__campaign_assessment_description.sql
--
-- Per-assessment marketing blurb for B2C campaigns. An admin sets it on the
-- "Assessments in this campaign" table (campaign edit page) and it renders
-- under the assessment name on the public registration card.
--
--   * campaign_assessment_mapping.description — free text (TEXT), nullable.
--     NULL/blank means the public card simply omits the line.
--
-- Idempotent AND table-tolerant: the ALTER is skipped if the column already
-- exists OR the target table does not exist yet. campaign_assessment_mapping is
-- an entity-mapped table; Flyway runs before Hibernate ddl-auto, so on a DB
-- where the table hasn't been created yet, ddl-auto will create it later WITH
-- the new column. MySQL has no ADD COLUMN IF NOT EXISTS, hence the
-- PREPARE/EXECUTE guard.
-- ---------------------------------------------------------------------------

SET @ddl1 := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaign_assessment_mapping')
  AND NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaign_assessment_mapping'
           AND COLUMN_NAME = 'description'),
  'ALTER TABLE campaign_assessment_mapping ADD COLUMN description TEXT NULL AFTER counselling_model',
  'SELECT 1');
PREPARE s1 FROM @ddl1; EXECUTE s1; DEALLOCATE PREPARE s1;
