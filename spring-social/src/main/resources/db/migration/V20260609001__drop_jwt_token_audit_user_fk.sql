-- Drop the FK jwt_token_audit.user_id -> student_user.id.
--
-- WHY: JwtTokenAuditService.record() runs in a REQUIRES_NEW transaction so an
-- audit-write failure can never roll back token issuance. That is intentional.
-- But the FK forced the audit INSERT to take a shared lock on the parent
-- student_user row for the FK check. During B2C/school registration the parent
-- user row is INSERTed by the OUTER (still-uncommitted) transaction, so the
-- separate REQUIRES_NEW audit insert blocked on it for innodb_lock_wait_timeout
-- (50s) and then failed -> every brand-new-user registration returned HTTP 500.
--
-- REQUIRES_NEW (audit independent of caller) is fundamentally incompatible with
-- an FK to a row the caller has not committed. Audit/log tables should not hard-
-- FK to hot transactional tables; user_id stays as a plain indexed column
-- (idx_jta_user is retained), so lookups by user are unaffected.
--
-- Guarded so it is a no-op if the constraint is already absent (e.g. it was
-- dropped manually for the immediate hotfix, or never created on a fresh DB).
SET @fk := (
  SELECT constraint_name
  FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'jwt_token_audit'
    AND constraint_name = 'fk_jta_user'
    AND constraint_type = 'FOREIGN KEY'
  LIMIT 1
);
SET @sql := IF(@fk IS NOT NULL,
  'ALTER TABLE jwt_token_audit DROP FOREIGN KEY fk_jta_user',
  'SELECT ''fk_jta_user already absent — nothing to drop''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
