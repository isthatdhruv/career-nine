-- Configurable multi-account email system — Phase 3 (templates).
-- Reusable subject + HTML body per send-scenario, with {{placeholders}} and a per-template
-- SYNC/ASYNC delivery mode. Exactly one default template per email_type (enforced in the
-- service). Default template content is seeded per send-scenario as each sender migrates.

CREATE TABLE IF NOT EXISTS email_template (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    name             VARCHAR(160) NOT NULL,
    email_type       VARCHAR(60)  NOT NULL,
    subject_template VARCHAR(500) NULL,
    body_template    MEDIUMTEXT   NULL,
    is_default       TINYINT(1)   NOT NULL DEFAULT 0,
    delivery_mode    VARCHAR(10)  NOT NULL DEFAULT 'ASYNC',
    active           TINYINT(1)   NOT NULL DEFAULT 1,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by       BIGINT       NULL,
    PRIMARY KEY (id),
    KEY ix_email_template_type (email_type, is_default, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO permission (code, description) VALUES
    ('email_template.read', 'View email templates'),
    ('email_template.edit', 'Create, edit and delete email templates')
ON DUPLICATE KEY UPDATE description = VALUES(description);
