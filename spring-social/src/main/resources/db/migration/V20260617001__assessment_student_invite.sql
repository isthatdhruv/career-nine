-- ---------------------------------------------------------------------------
-- V20260617001__assessment_student_invite.sql
--
-- Per-student assessment invites.
--
-- An admin pre-selects a specific, already-existing student of an institute and
-- binds them to a mapping + a custom-priced tier, minting a one-student token.
-- The student opens the token's link, sees a pre-filled registration page, pays
-- the tier price, and takes the assessment — reusing the existing B2B payment +
-- entitlement + provisioning pipeline (the PaymentTransaction carries the
-- existing user_student_id, so the webhook never creates a new account).
--
-- Hibernate ddl-auto on the second datasource is `validate`, so every column the
-- @Column annotations declare must exist here with matching names/types.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS assessment_student_invite (
    invite_id        BIGINT       NOT NULL AUTO_INCREMENT,
    mapping_id       BIGINT       NOT NULL,
    tier_id          BIGINT       NOT NULL,
    user_student_id  BIGINT       NOT NULL,
    assessment_id    BIGINT       NOT NULL,
    institute_code   INT          NOT NULL,
    token            VARCHAR(36)  NOT NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    expires_at       datetime(6)  NULL,
    created_at       datetime(6)  NULL,
    updated_at       datetime(6)  NULL,
    PRIMARY KEY (invite_id),
    UNIQUE KEY uk_assessment_student_invite_token (token),
    KEY idx_asi_institute (institute_code),
    KEY idx_asi_student_assessment (user_student_id, assessment_id),
    KEY idx_asi_mapping (mapping_id)
);
