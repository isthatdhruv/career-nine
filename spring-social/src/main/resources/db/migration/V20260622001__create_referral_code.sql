-- ---------------------------------------------------------------------------
-- V20260622001__create_referral_code.sql
--
-- Referral code feature. Mirrors the promo_code design but scoped to a single
-- institute and one-or-more of that institute's assessments, and tracks which
-- students registered under each code (the "referral" of that code).
--
--   referral_code             -- the codes (one institute each), with the usual
--                                expiry / max_uses / current_uses / is_active levers
--   referral_code_assessment  -- code -> assessment join (a code may cover many
--                                assessments of its institute)
--   student_referral          -- which student became the referral of which code.
--                                UNIQUE(user_student_id) enforces the rule that a
--                                student can use only ONE referral code.
--
-- payment_transaction.referral_code carries the code from registration through to
-- the paid webhook, where the student row is finally created and linked (mirrors
-- how promo_code is threaded through the same ledger).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `referral_code` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `institute_code` int NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `expires_at` datetime DEFAULT NULL,
  `max_uses` int DEFAULT NULL,
  `current_uses` int DEFAULT '0',
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_referral_code_code` (`code`),
  KEY `idx_referral_code_institute` (`institute_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `referral_code_assessment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `referral_code_id` bigint NOT NULL,
  `assessment_id` bigint NOT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_referral_code_assessment` (`referral_code_id`,`assessment_id`),
  KEY `idx_rca_assessment` (`assessment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `student_referral` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_student_id` bigint NOT NULL,
  `referral_code_id` bigint NOT NULL,
  `assessment_id` bigint DEFAULT NULL,
  `institute_code` int DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_student_referral_student` (`user_student_id`),
  KEY `idx_student_referral_code` (`referral_code_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Carry the referral code through the payment ledger (paid path links on webhook
-- success, exactly like promo_code). Guarded so re-runs on a migrated DB are safe.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payment_transaction'
    AND COLUMN_NAME = 'referral_code'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `payment_transaction` ADD COLUMN `referral_code` varchar(50) NULL',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Permission catalog (mirrors the promo_code.* family; idempotent).
INSERT INTO permission (code, description) VALUES
  ('referral_code.read',     'View referral codes'),
  ('referral_code.read.all', 'View all referral codes across scopes'),
  ('referral_code.create',   'Create referral codes'),
  ('referral_code.update',   'Update referral codes'),
  ('referral_code.delete',   'Delete referral codes')
ON DUPLICATE KEY UPDATE description = VALUES(description);
