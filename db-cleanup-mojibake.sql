-- ============================================================
--  Mojibake cleanup script for career-9 / kcc_student database
-- ============================================================
--  Run ON THE POPULATED SERVER (staging / production), NOT
--  on a local empty DB.
--
--  Order of operations:
--    1. BACKUP first (see README at bottom of file)
--    2. Run sections in order, top to bottom
--    3. Step 5 wraps the destructive UPDATEs in a transaction
--       so you can ROLLBACK if previews look wrong
-- ============================================================


-- -------- STEP 1: Inspect current column charsets ----------
-- If `character_set_name` shows `latin1`, that's why the
-- corruption is happening. utf8mb4 is the target.

SELECT table_name, column_name, character_set_name, collation_name
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN ('assessment_questions','assessment_question_options',
                     'language_question','language_option')
  AND column_name IN ('question_text','option_text');


-- -------- STEP 2: Count affected rows ----------------------

SELECT 'assessment_questions'        AS tbl, COUNT(*) AS bad_rows
FROM assessment_questions        WHERE question_text REGEXP '[\x80-\x9F]'
UNION ALL
SELECT 'assessment_question_options', COUNT(*)
FROM assessment_question_options WHERE option_text   REGEXP '[\x80-\x9F]'
UNION ALL
SELECT 'language_question',           COUNT(*)
FROM language_question           WHERE question_text REGEXP '[\x80-\x9F]';


-- -------- STEP 3: PREVIEW the cleanup (read-only) ----------
-- Verify `after_fix` shows clean text (it's, "hello", —, etc.)
-- BEFORE running the UPDATE in step 5.

SELECT option_id,
       option_text                                                                  AS before_fix,
       CONVERT(CAST(CONVERT(option_text USING latin1) AS BINARY) USING utf8mb4)     AS after_fix
FROM assessment_question_options
WHERE option_text REGEXP '[\x80-\x9F]'
LIMIT 30;


-- -------- STEP 4: Convert column charsets to utf8mb4 -------
-- Run AFTER step 3 preview looks correct, BEFORE step 5.
-- The CONVERT TO step rewrites column definitions; existing
-- garbled bytes survive verbatim into the new utf8mb4 column,
-- and step 5 then fixes them.

ALTER DATABASE `career-9` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE assessment_questions        CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE assessment_question_options CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE language_question           CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE language_option             CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- -------- STEP 5: Repair garbled rows (TRANSACTIONAL) ------
-- Wrapped in a transaction. Run the SELECT count at the
-- bottom; if everything looks right, COMMIT. Otherwise ROLLBACK.

START TRANSACTION;

UPDATE assessment_questions
SET question_text = CONVERT(CAST(CONVERT(question_text USING latin1) AS BINARY) USING utf8mb4)
WHERE question_text REGEXP '[\x80-\x9F]';

UPDATE assessment_question_options
SET option_text = CONVERT(CAST(CONVERT(option_text USING latin1) AS BINARY) USING utf8mb4)
WHERE option_text REGEXP '[\x80-\x9F]';

UPDATE language_question
SET question_text = CONVERT(CAST(CONVERT(question_text USING latin1) AS BINARY) USING utf8mb4)
WHERE question_text REGEXP '[\x80-\x9F]';

-- Verification — should all return 0:
SELECT 'questions' AS src, COUNT(*) AS still_bad FROM assessment_questions        WHERE question_text REGEXP '[\x80-\x9F]'
UNION ALL
SELECT 'options',    COUNT(*) FROM assessment_question_options WHERE option_text   REGEXP '[\x80-\x9F]'
UNION ALL
SELECT 'lang_q',     COUNT(*) FROM language_question           WHERE question_text REGEXP '[\x80-\x9F]';

-- If all zeros and spot-checks of repaired rows look good:
COMMIT;
-- If anything looks wrong:
-- ROLLBACK;


-- -------- STEP 6: Smoke-test after deploy ------------------
-- After the new backend (with MojibakeFixer + UTF-8 JDBC) is
-- live, create a test question via the UI containing  '  and  "
-- Then re-run step 2. Counts must stay at 0.


-- ============================================================
--  Backup commands (run from a shell BEFORE step 5)
-- ============================================================
--  Linux / macOS:
--    mysqldump -h <host> -P <port> -u root -p career-9 \
--      > backup_pre_mojibake_$(date +%Y%m%d_%H%M).sql
--
--  Windows PowerShell:
--    $ts = Get-Date -Format yyyyMMdd_HHmm
--    mysqldump -h <host> -P <port> -u root -p career-9 `
--      > "backup_pre_mojibake_$ts.sql"
--
--  Or in MySQL Workbench:
--    Server  ->  Data Export  ->  select schema career-9
--                ->  Export to Self-Contained File
--                ->  Start Export
-- ============================================================
