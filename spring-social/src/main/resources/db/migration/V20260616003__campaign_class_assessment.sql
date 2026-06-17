-- ---------------------------------------------------------------------------
-- V20260616003__campaign_class_assessment.sql
--
-- Class-based registration for B2C campaigns. Mirrors the B2B "select class →
-- assessment auto-selected with price" flow, but as a thin ROUTING layer on top
-- of the existing campaign_assessment_mapping (so all paid/trial/payment flows,
-- and the tier-based pricing, stay untouched).
--
--   * campaign_class_assessment routes (campaign_id, class_id) → assessment_id.
--   * assessment_id must be an assessment already attached to the campaign via
--     campaign_assessment_mapping; the class picker simply auto-selects it (and
--     thus its default tier / price) at registration time.
--   * UNIQUE(campaign_id, class_id): a class maps to exactly one assessment per
--     campaign, so the student's class selection resolves to a single mapping.
--   * session_id records which SchoolSession the class belongs to (classes are
--     session-scoped in SchoolClasses) — used for grouping + import.
--
-- Idempotent: the table is created only if absent. campaign_class_assessment is
-- an entity-mapped table; Flyway runs before Hibernate ddl-auto, so if this is
-- skipped, ddl-auto creates the table from the JPA entity instead.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS campaign_class_assessment (
    id            BIGINT    NOT NULL AUTO_INCREMENT,
    campaign_id   BIGINT    NOT NULL,
    class_id      INT       NOT NULL,
    session_id    INT       NULL,
    assessment_id BIGINT    NOT NULL,
    sort_order    INT       NOT NULL DEFAULT 0,
    is_active     BIT(1)    NOT NULL DEFAULT b'1',
    is_deleted    BIT(1)    NOT NULL DEFAULT b'0',
    created_at    DATETIME  NULL,
    updated_at    DATETIME  NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cca_campaign_class (campaign_id, class_id),
    KEY idx_cca_campaign (campaign_id),
    KEY idx_cca_assessment (assessment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
