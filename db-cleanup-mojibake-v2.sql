-- ============================================================
--  Mojibake cleanup v2 — career-9 assessment database
-- ============================================================
--  Why a v2:
--    The original db-cleanup-mojibake.sql only repaired 4 tables
--    (assessment_questions, assessment_question_options,
--     language_question, language_option). Mojibake came back because:
--      a) Section instructions and other text live in OTHER tables
--         that were never cleaned (e.g. Questionnaire_Section_Instruction,
--         questionnaire_language, demographic_*, careers, question_sections).
--      b) New rows kept getting corrupted on write — now fixed in code
--         (corrected MojibakeFixer + outgoing Jackson serializer +
--         characterEncoding=UTF-8 on the JDBC URLs).
--
--  This script finds mojibake in EVERY text column DB-wide and repairs
--  it with a guard that PROTECTS non-Latin text (Hindi/Devanagari, emoji).
--
--  SAFETY:
--    * The code fix already makes the app DISPLAY correctly, so this
--      script is for cleaning data at rest (reports, exports, DB tools).
--    * Run STEP 2 (discovery) and STEP 4a (preview) and eyeball them
--      BEFORE the STEP 4b transaction. COMMIT only if previews look right.
--    * BACKUP first (see bottom of file).
-- ============================================================


-- -------- STEP 1: Inspect column charsets ------------------
-- Anything still on latin1 will keep corrupting. utf8mb4 is the target.
SELECT table_name, column_name, character_set_name, collation_name
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND data_type IN ('char','varchar','text','tinytext','mediumtext','longtext')
ORDER BY character_set_name, table_name, column_name;


-- -------- STEP 2: DISCOVERY — where is mojibake, DB-wide? ---
-- READ-ONLY. Lists every text column that contains the mojibake
-- signature and how many rows are affected. This is the "where else
-- is it showing" answer — run it and keep the output.
--
-- Signature explained: real mojibake always begins with a UTF-8 lead
-- byte misread as Ã/Â/â followed by a continuation char, so we match:
--   'â€…'  (smart quotes / en-em dash / bullet, from E2 80/82 …)
--   'Ã…'   (accented Latin letters: é→Ã©, ñ→Ã±, etc.)
--   'Â…'   (nbsp, ©, ®, °, etc.: ©→Â©)
-- (Validated against MySQL 8.4: this simple 3-alternative form is matched by
--  the ICU regex engine; the STEP 4 guards make over-matching harmless.)
SET @SIGNATURE = 'â€|Ã|Â';

SELECT
  c.table_name,
  c.column_name,
  CONCAT(
    'SELECT COUNT(*) FROM `', c.table_name, '` ',
    'WHERE `', c.column_name, '` REGEXP ''', @SIGNATURE, ''''
  ) AS count_query
FROM information_schema.columns c
WHERE c.table_schema = DATABASE()
  AND c.data_type IN ('char','varchar','text','tinytext','mediumtext','longtext')
ORDER BY c.table_name, c.column_name;
-- ^ This produces a list of ready-to-run COUNT queries. To get live
--   counts automatically instead, use the procedure in STEP 4 with
--   @DRY_RUN = 1 (it logs counts without changing anything).


-- -------- STEP 3: Convert every text table to utf8mb4 ------
-- Idempotent: tables already on utf8mb4 are unaffected. Existing
-- garbled bytes survive verbatim and are fixed in STEP 4.
ALTER DATABASE `career-9` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- (On staging use `career-9-staging`.)

-- Generate the per-table ALTERs (copy the output, review, then run):
SELECT DISTINCT CONCAT(
  'ALTER TABLE `', table_name,
  '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
) AS alter_stmt
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND data_type IN ('char','varchar','text','tinytext','mediumtext','longtext')
  AND character_set_name <> 'utf8mb4';


-- ============================================================
--  STEP 4: Repair — guarded, full-coverage stored procedure
-- ============================================================
--  The guard makes this safe to run across the whole DB:
--    1. latin1-safe check  `col = CONVERT(CONVERT(col USING latin1) USING utf8mb4)`
--       → skips any row containing a non-latin1 character, so genuine
--         Hindi/Devanagari/emoji text is NEVER touched.
--    2. signature check    → skips legit isolated accented letters
--         (e.g. "café") that aren't mojibake.
--    3. change check       → only rewrites rows the repair actually changes.
--
--  Set @DRY_RUN = 1 first to LOG counts only (no writes). Then set it
--  to 0 inside a transaction to apply, and COMMIT/ROLLBACK after review.

DROP PROCEDURE IF EXISTS fix_mojibake_all;
DELIMITER //
CREATE PROCEDURE fix_mojibake_all(IN p_dry_run TINYINT)
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_tbl  VARCHAR(255);
  DECLARE v_col  VARCHAR(255);
  DECLARE v_sig  VARCHAR(255) DEFAULT 'â€|Ã|Â';
  DECLARE v_n    INT;
  DECLARE cur CURSOR FOR
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND data_type IN ('char','varchar','text','tinytext','mediumtext','longtext');
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  DROP TEMPORARY TABLE IF EXISTS _mojibake_log;
  CREATE TEMPORARY TABLE _mojibake_log (tbl VARCHAR(255), col VARCHAR(255), rows_affected INT);

  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO v_tbl, v_col;
    IF done THEN LEAVE read_loop; END IF;

    -- Count rows that are mojibake AND latin1-safe AND actually change.
    SET @cnt_sql = CONCAT(
      'SELECT COUNT(*) INTO @row_n FROM `', v_tbl, '` ',
      'WHERE `', v_col, '` IS NOT NULL ',
      '  AND `', v_col, '` REGEXP ''', v_sig, ''' ',
      '  AND `', v_col, '` COLLATE utf8mb4_bin = CONVERT(CONVERT(`', v_col, '` USING latin1) USING utf8mb4) COLLATE utf8mb4_bin ',
      '  AND CONVERT(CAST(CONVERT(`', v_col, '` USING latin1) AS BINARY) USING utf8mb4) COLLATE utf8mb4_bin <> `', v_col, '` COLLATE utf8mb4_bin'
    );
    PREPARE st FROM @cnt_sql; EXECUTE st; DEALLOCATE PREPARE st;
    SET v_n = @row_n;

    IF v_n > 0 THEN
      INSERT INTO _mojibake_log VALUES (v_tbl, v_col, v_n);
      IF p_dry_run = 0 THEN
        SET @upd_sql = CONCAT(
          'UPDATE `', v_tbl, '` SET `', v_col, '` = ',
          'CONVERT(CAST(CONVERT(`', v_col, '` USING latin1) AS BINARY) USING utf8mb4) ',
          'WHERE `', v_col, '` IS NOT NULL ',
          '  AND `', v_col, '` REGEXP ''', v_sig, ''' ',
          '  AND `', v_col, '` COLLATE utf8mb4_bin = CONVERT(CONVERT(`', v_col, '` USING latin1) USING utf8mb4) COLLATE utf8mb4_bin ',
          '  AND CONVERT(CAST(CONVERT(`', v_col, '` USING latin1) AS BINARY) USING utf8mb4) COLLATE utf8mb4_bin <> `', v_col, '` COLLATE utf8mb4_bin'
        );
        PREPARE st FROM @upd_sql; EXECUTE st; DEALLOCATE PREPARE st;
      END IF;
    END IF;
  END LOOP;
  CLOSE cur;

  SELECT tbl, col, rows_affected FROM _mojibake_log ORDER BY rows_affected DESC;
END //
DELIMITER ;


-- -------- STEP 4a: DRY RUN (no writes) — review the plan ---
CALL fix_mojibake_all(1);
-- ^ Shows every column that WOULD be fixed and how many rows. Sanity-check it.


-- -------- STEP 4b: APPLY (transactional) -------------------
-- Eyeball a few specific repairs before committing, e.g.:
--   SELECT instruction_text,
--          CONVERT(CAST(CONVERT(instruction_text USING latin1) AS BINARY) USING utf8mb4) AS fixed
--   FROM Questionnaire_Section_Instruction
--   WHERE instruction_text REGEXP 'â€|Ã|Â' LIMIT 20;
START TRANSACTION;
CALL fix_mojibake_all(0);
-- Verify: re-run the dry counter; everything should now be 0.
CALL fix_mojibake_all(1);   -- expect an empty result set
-- If the repaired text looks correct and the verify is empty:
COMMIT;
-- If anything looks wrong:
-- ROLLBACK;


-- -------- STEP 5: Cleanup --------------------------------
-- DROP PROCEDURE IF EXISTS fix_mojibake_all;


-- ============================================================
--  BACKUP FIRST (run from a shell BEFORE STEP 4b)
-- ============================================================
--  Windows PowerShell:
--    $ts = Get-Date -Format yyyyMMdd_HHmm
--    mysqldump -h <host> -P <port> -u root -p career-9 `
--      > "backup_pre_mojibake_v2_$ts.sql"
-- ============================================================
