-- Standing recipient lists for automatic notifications.
--
-- Every email in the system until now took its recipients as arguments from the calling
-- code. This table is the first place a recipient is CONFIGURED rather than passed: "when
-- a lead arrives, tell these people". Keyed by email_type so the same table serves any
-- future trigger without another table or another admin page.
--
-- lead_type / source are optional narrowing filters, NULL meaning "any". A row with both
-- NULL receives every lead; a row with lead_type='SCHOOL' receives only school leads. The
-- filters are matched case-insensitively in the service.

CREATE TABLE IF NOT EXISTS email_notification_recipient (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    email_type     VARCHAR(60)  NOT NULL,
    email          VARCHAR(320) NOT NULL,
    -- Display label for the admin list ("Sales desk", "Ops"), not used in the message.
    label          VARCHAR(160) NULL,
    -- TO / CC / BCC. Recipients are grouped by this when the message is assembled.
    recipient_kind VARCHAR(10)  NOT NULL DEFAULT 'TO',
    -- NULL = every lead type. Otherwise SCHOOL / PARENT / STUDENT.
    lead_type      VARCHAR(20)  NULL,
    -- NULL = every source. Otherwise matched against Lead.source (e.g. 'website-signup').
    source         VARCHAR(100) NULL,
    active         TINYINT(1)   NOT NULL DEFAULT 1,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by     BIGINT       NULL,
    PRIMARY KEY (id),
    -- The dispatch-time lookup: everything active for one scenario.
    KEY ix_enr_type_active (email_type, active),
    -- One row per (scenario, address, filter pair). Stops a double-click from mailing the
    -- same desk twice; MySQL treats NULLs as distinct here, which is the behaviour we want
    -- (an "all leads" row and a "SCHOOL only" row for the same address are both legitimate).
    UNIQUE KEY uq_enr_type_email_filters (email_type, email, lead_type, source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO permission (code, description) VALUES
    ('email_recipient.read', 'View automatic-notification recipient lists'),
    ('email_recipient.edit', 'Add, edit and remove automatic-notification recipients')
ON DUPLICATE KEY UPDATE description = VALUES(description);
