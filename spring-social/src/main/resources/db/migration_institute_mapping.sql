-- =============================================================================
-- Phase 1 migration — campaign-to-institute mapping & student institute history
-- =============================================================================
--
-- Hibernate (ddl-auto: update) will automatically:
--   - add `campaigns.institute_code INT NULL`
--   - create the `user_student_institute_history` table
-- ...on application startup, because the entities declare them.
--
-- This script handles the parts Hibernate WON'T do:
--   1. Relax user_student.institute_id NOT NULL (Hibernate update never
--      removes existing NOT NULL constraints).
--   2. Backfill membership rows for every existing student that already has
--      a primary institute, so the per-institute drop UI shows correct state
--      for legacy data.
--   3. Add the FK constraints Hibernate skipped.
-- =============================================================================

-- 1. Allow NULL institute on user_student. New campaigns always set it; legacy
--    campaigns without a mapped institute may leave it NULL until the admin
--    backfills the campaign and re-runs registration.
ALTER TABLE user_student MODIFY institute_id INT NULL;

-- 2. Backfill the membership table with every existing (student, primary
--    institute) pair so the admin UI shows them correctly. Idempotent: skips
--    rows already present (uniqueness on user_student_id + institute_code).
INSERT IGNORE INTO user_student_institute_history
    (user_student_id, institute_code, source, added_at, is_dropped)
SELECT user_student_id, institute_id, 'initial', NOW(), FALSE
FROM user_student
WHERE institute_id IS NOT NULL;

-- 3. Add FKs Hibernate skipped (idempotent — wrap with IF NOT EXISTS via
--    information_schema check, since MySQL doesn't have IF NOT EXISTS for
--    constraints).
SET @fk_exists := (SELECT COUNT(*) FROM information_schema.table_constraints
                   WHERE constraint_schema = DATABASE()
                     AND table_name = 'campaigns'
                     AND constraint_name = 'fk_campaign_institute');
SET @sql := IF(@fk_exists = 0,
    'ALTER TABLE campaigns ADD CONSTRAINT fk_campaign_institute FOREIGN KEY (institute_code) REFERENCES institute_detail(institute_code)',
    'SELECT ''fk_campaign_institute already exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =============================================================================
-- Phase 2 (run AFTER admin has filled institute_code on every campaign)
-- =============================================================================
-- ALTER TABLE campaigns MODIFY institute_code INT NOT NULL;
