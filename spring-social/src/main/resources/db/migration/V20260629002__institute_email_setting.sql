-- Configurable multi-account email system — Phase 2 (routing).
-- Per-institute default sending account. One row per institute; the dispatcher resolves
-- the sending account as: manual override → institute default → global default. The
-- default account is independent of whitelabel (any institute may set one explicitly);
-- whitelabel just surfaces the control more prominently in the institute editor.

CREATE TABLE IF NOT EXISTS institute_email_setting (
    id                 BIGINT   NOT NULL AUTO_INCREMENT,
    institute_code     INT      NOT NULL,
    default_account_id BIGINT   NULL,            -- → email_account.id (null = fall back to global default)
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by         BIGINT   NULL,
    PRIMARY KEY (id),
    UNIQUE KEY ux_institute_email_setting_code (institute_code),
    KEY ix_institute_email_setting_account (default_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
