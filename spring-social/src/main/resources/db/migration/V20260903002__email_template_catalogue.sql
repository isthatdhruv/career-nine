-- Mail catalogue (Phase 1 of the mail automation work).
--
-- Every mail the system sends, including copy that used to live only in Java, is seeded
-- into email_template so it can be seen, previewed, linted and reviewed on the dashboard.
-- These columns carry provenance (where the copy came from, whether the sender actually
-- renders it yet, whether anyone edited it since) and the admin's review state.
--
-- Entity-mapped, so ddl-auto: update would add them on its own; pinned here to keep the
-- schema reproducible from migrations alone. Idempotent via the PREPARE/EXECUTE guard
-- (same pattern as V20260825001): Flyway runs before Hibernate, but a database that
-- already booted with the new entity would otherwise fail on "Duplicate column name".

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_template'
      AND COLUMN_NAME = 'mail_key'),
  'SELECT 1',
  'ALTER TABLE email_template ADD COLUMN mail_key VARCHAR(80) NULL');  -- fine-grained id, e.g. payment.success
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_template'
      AND COLUMN_NAME = 'text_template'),
  'SELECT 1',
  'ALTER TABLE email_template ADD COLUMN text_template MEDIUMTEXT NULL');  -- plain-text alternative
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_template'
      AND COLUMN_NAME = 'mail_class'),
  'SELECT 1',
  'ALTER TABLE email_template ADD COLUMN mail_class VARCHAR(20) NULL');  -- TRANSACTIONAL | SUBSCRIBED | INTERNAL
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_template'
      AND COLUMN_NAME = 'seed_origin'),
  'SELECT 1',
  'ALTER TABLE email_template ADD COLUMN seed_origin VARCHAR(20) NULL');  -- SEED | CODE_PORT | REMINDER_CONFIG | MANUAL
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_template'
      AND COLUMN_NAME = 'source_ref'),
  'SELECT 1',
  'ALTER TABLE email_template ADD COLUMN source_ref VARCHAR(300) NULL');  -- Class#method (path:lines) the copy was lifted from
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_template'
      AND COLUMN_NAME = 'seeded_hash'),
  'SELECT 1',
  'ALTER TABLE email_template ADD COLUMN seeded_hash CHAR(64) NULL');  -- sha256 of subject|body|text at seed time
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_template'
      AND COLUMN_NAME = 'port_state'),
  'SELECT 1',
  'ALTER TABLE email_template ADD COLUMN port_state VARCHAR(20) NOT NULL DEFAULT ''PORTED''');  -- PORTED | CONTENT_ONLY
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_template'
      AND COLUMN_NAME = 'variant_flags'),
  'SELECT 1',
  'ALTER TABLE email_template ADD COLUMN variant_flags VARCHAR(300) NULL');  -- comma list of {{#flag}} names the body branches on
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_template'
      AND COLUMN_NAME = 'review_status'),
  'SELECT 1',
  'ALTER TABLE email_template ADD COLUMN review_status VARCHAR(20) NOT NULL DEFAULT ''NOT_REVIEWED''');  -- NOT_REVIEWED | APPROVED | NEEDS_CHANGE
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_template'
      AND COLUMN_NAME = 'review_notes'),
  'SELECT 1',
  'ALTER TABLE email_template ADD COLUMN review_notes TEXT NULL');  -- reviewer's notes
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_template'
      AND COLUMN_NAME = 'reviewed_by'),
  'SELECT 1',
  'ALTER TABLE email_template ADD COLUMN reviewed_by BIGINT NULL');  -- user id
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_template'
      AND COLUMN_NAME = 'reviewed_at'),
  'SELECT 1',
  'ALTER TABLE email_template ADD COLUMN reviewed_at DATETIME NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_template'
      AND INDEX_NAME = 'ix_email_template_mail_key'),
  'SELECT 1',
  'ALTER TABLE email_template ADD KEY ix_email_template_mail_key (mail_key)');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- Label the three flagship seeds; anything else that already exists was typed by an admin.
UPDATE email_template
   SET seed_origin = 'SEED', mail_key = LOWER(email_type)
 WHERE seed_origin IS NULL
   AND name IN ('Login credentials (default)', 'New lead alert (default)', 'Lead acknowledgement (default)');
UPDATE email_template SET seed_origin = 'MANUAL' WHERE seed_origin IS NULL;
