-- Mail automation engine (phase 1): admin-configured automations, engine settings, and the
-- columns that tie every send-log row back to the automation and job that produced it.
--
-- Everything the engine does at runtime lives in Redis; these tables only change when an
-- admin edits something. Behaviour is unchanged until mail_setting engine_enabled = true.

CREATE TABLE IF NOT EXISTS mail_automation (
    id                       BIGINT       NOT NULL AUTO_INCREMENT,
    automation_key           VARCHAR(80)  NULL,             -- stable key for seeded rows
    name                     VARCHAR(160) NOT NULL,
    description              TEXT         NULL,
    trigger_events           VARCHAR(600) NULL,             -- CSV of MailEvent keys
    cron_expression          VARCHAR(64)  NULL,             -- schedule trigger (with audience_key)
    audience_key             VARCHAR(80)  NULL,
    conditions               VARCHAR(600) NULL,             -- CSV of MailPredicate keys
    delay_minutes            INT          NOT NULL DEFAULT 0,
    relative_to_field        VARCHAR(60)  NULL,             -- event date field for relative timing
    relative_offsets_minutes VARCHAR(300) NULL,             -- CSV ints, negative = before
    repeat_every_minutes     INT          NULL,
    max_sends                INT          NULL,
    template_id              BIGINT       NULL,             -- -> email_template.id
    email_type               VARCHAR(60)  NULL,
    recipient_roles          VARCHAR(200) NULL,             -- CSV of MailRecipientRole
    extra_recipients         TEXT         NULL,
    cancel_on_events         VARCHAR(600) NULL,             -- CSV of MailEvent keys
    delivery_mode            VARCHAR(12)  NOT NULL DEFAULT 'QUEUED',
    recheck_before_send      TINYINT(1)   NOT NULL DEFAULT 0,
    respect_quiet_hours      TINYINT(1)   NOT NULL DEFAULT 1,
    channel                  VARCHAR(20)  NOT NULL DEFAULT 'EMAIL',
    scope_institutes         TEXT         NULL,             -- CSV institute codes; NULL = all
    topic                    VARCHAR(60)  NULL,             -- consent topic (phase 4)
    enabled                  TINYINT(1)   NOT NULL DEFAULT 1,
    paused                   TINYINT(1)   NOT NULL DEFAULT 0,
    seed_origin              VARCHAR(20)  NULL,             -- SEED | MANUAL
    created_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by               BIGINT       NULL,
    PRIMARY KEY (id),
    KEY ix_mail_automation_key (automation_key),
    KEY ix_mail_automation_enabled (enabled, paused)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mail_setting (
    setting_key   VARCHAR(80) NOT NULL,
    setting_value TEXT        NULL,
    updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by    BIGINT      NULL,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- email_send_log: which automation / job / event produced the row (guarded, entity-mapped).
SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_send_log' AND COLUMN_NAME = 'automation_id'),
  'SELECT 1', 'ALTER TABLE email_send_log ADD COLUMN automation_id BIGINT NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_send_log' AND COLUMN_NAME = 'job_id'),
  'SELECT 1', 'ALTER TABLE email_send_log ADD COLUMN job_id VARCHAR(40) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_send_log' AND COLUMN_NAME = 'event_key'),
  'SELECT 1', 'ALTER TABLE email_send_log ADD COLUMN event_key VARCHAR(60) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_send_log' AND INDEX_NAME = 'ix_email_send_log_automation'),
  'SELECT 1', 'ALTER TABLE email_send_log ADD KEY ix_email_send_log_automation (automation_id, status, created_at)');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- Permissions (assignment to roles via the role-management UI; super-admin bypasses).
INSERT INTO permission (code, description) VALUES
    ('mail_automation.read', 'View mail automations, the send queue and engine settings'),
    ('mail_automation.edit', 'Create and edit mail automations, manage the queue and engine settings')
ON DUPLICATE KEY UPDATE description = VALUES(description);
