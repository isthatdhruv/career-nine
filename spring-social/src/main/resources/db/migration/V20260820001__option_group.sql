-- Group tag for the "dropdown" question type. On such questions the student portal
-- shows a dropdown of the distinct groups below the question text; picking a group
-- filters the visible options to that group's options. Each option belongs to exactly
-- one group, so the picked group is derivable from the saved optionIds and needs no
-- column on assessment_answer. NULL on every option of the four legacy question types.
--
-- Idempotent: the column is added only if absent. It is an entity-mapped column;
-- Flyway runs before Hibernate ddl-auto, so on a DB where a prior boot already let
-- ddl-auto add it, a plain ADD COLUMN would fail with "Duplicate column name".
-- MySQL has no ADD COLUMN IF NOT EXISTS, hence the PREPARE/EXECUTE guard
-- (mirrors V20260615001).
SET @ddl1 := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_question_options'
           AND COLUMN_NAME = 'option_group'),
  'SELECT 1',
  'ALTER TABLE assessment_question_options ADD COLUMN option_group VARCHAR(255) NULL AFTER option_image_url');
PREPARE s1 FROM @ddl1; EXECUTE s1; DEALLOCATE PREPARE s1;
