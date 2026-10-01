-- Lower bound for the "range" selection rule (options_count is the upper
-- bound), e.g. "pick 2 or 3". Idempotent, because Hibernate ddl-auto may have
-- added the column first on dev/staging.
SET @s := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'assessment_questions'
           AND COLUMN_NAME = 'min_options_allowed'),
  'SELECT 1',
  'ALTER TABLE assessment_questions ADD COLUMN min_options_allowed INT NULL AFTER options_count');
PREPARE s1 FROM @s; EXECUTE s1; DEALLOCATE PREPARE s1;
