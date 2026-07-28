-- Configurable multi-account email system — Phase 1.
-- Tables for sending accounts + the universal send log, a bootstrap global-default
-- account matching today's Gmail identity, and the admin permissions.

CREATE TABLE IF NOT EXISTS email_account (
    id                    BIGINT       NOT NULL AUTO_INCREMENT,
    name                  VARCHAR(120) NOT NULL,
    provider              VARCHAR(20)  NOT NULL,           -- GMAIL | ODOO
    mode                  VARCHAR(20)  NULL,               -- API | SMTP (Gmail only)
    from_email            VARCHAR(200) NOT NULL,
    from_name             VARCHAR(200) NULL,
    credentials_encrypted TEXT         NULL,               -- AES-GCM via EncryptedStringConverter
    is_global_default     TINYINT(1)   NOT NULL DEFAULT 0,
    active                TINYINT(1)   NOT NULL DEFAULT 1,
    created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by           BIGINT        NULL,
    PRIMARY KEY (id),
    KEY ix_email_account_global_default (is_global_default, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_send_log (
    id              BIGINT      NOT NULL AUTO_INCREMENT,
    email_type      VARCHAR(60) NULL,
    recipient       VARCHAR(320) NULL,
    subject         VARCHAR(500) NULL,
    account_id      BIGINT      NULL,
    template_id     BIGINT      NULL,
    institute_code  INT         NULL,
    user_student_id BIGINT      NULL,
    delivery_mode   VARCHAR(10) NULL,                      -- SYNC | ASYNC
    status          VARCHAR(10) NOT NULL,                  -- QUEUED | SENT | FAILED | SKIPPED
    error_message   TEXT        NULL,
    created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at         DATETIME    NULL,
    PRIMARY KEY (id),
    KEY ix_email_send_log_created (created_at),
    KEY ix_email_send_log_status (status),
    KEY ix_email_send_log_type (email_type),
    KEY ix_email_send_log_recipient (recipient)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bootstrap default: behaves exactly like today (Gmail API, classpath service account,
-- impersonating notifications@career-9.net). credentials_encrypted is seeded as plaintext
-- JSON (no "v1:"/"plain:" prefix) which EncryptedStringConverter reads back verbatim; the
-- next admin save re-writes it encrypted. Only seeded when the table is empty.
INSERT INTO email_account (name, provider, mode, from_email, from_name,
                           credentials_encrypted, is_global_default, active)
SELECT 'Career-9 Default (Gmail API)', 'GMAIL', 'API', 'notifications@career-9.net', NULL,
       '{"useClasspathDefault":true}', 1, 1
FROM dual
WHERE NOT EXISTS (SELECT 1 FROM email_account);

-- Admin permissions (assignment to roles is handled via the role-management UI; super-admin
-- bypasses). Mirrors the seed pattern in V20260624002.
INSERT INTO permission (code, description) VALUES
    ('email_account.read', 'View configured email accounts'),
    ('email_account.edit', 'Create, edit and delete email accounts'),
    ('email_account.test', 'Send a test email through an email account'),
    ('email_log.read',     'View the email send log')
ON DUPLICATE KEY UPDATE description = VALUES(description);
