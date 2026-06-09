-- ---------------------------------------------------------------------------
-- V20260606002__assessment_mapping_dual_links.sql
--
-- B2B redesign — dual registration links per mapping (Layer 2).
--
-- Every mapping now exposes TWO links: a PAID link (priced via the wave tiers)
-- and an always-FREE link (backed by the is_free tier added in V20260606003).
-- Each link has its own token and its own active toggle.
--
--   paid_token  — canonical paid link going forward (backfilled = legacy token,
--                 so already-distributed pre-redesign links keep resolving).
--   free_token  — fresh per-row UUID for the always-free link.
--
-- migrated_from_school_config_id is the idempotency marker for the one-time
-- school-flow backfill (V20260606005).
--
-- Unique indexes on paid_token/free_token are left to Hibernate (the entity
-- declares unique=true), matching how the legacy `token` unique was created.
-- ---------------------------------------------------------------------------

ALTER TABLE assessment_institute_mapping
    ADD COLUMN paid_token                     VARCHAR(36) NULL,
    ADD COLUMN free_token                     VARCHAR(36) NULL,
    ADD COLUMN paid_active                    BOOLEAN     DEFAULT TRUE,
    ADD COLUMN free_active                    BOOLEAN     DEFAULT TRUE,
    ADD COLUMN migrated_from_school_config_id BIGINT      NULL;

-- Existing rows: the legacy single token becomes the paid token (preserves any
-- distributed links), and each row gets a fresh free token (UUID() is evaluated
-- per row, so the values are distinct and satisfy the unique index).
UPDATE assessment_institute_mapping SET paid_token = token     WHERE paid_token IS NULL;
UPDATE assessment_institute_mapping SET free_token = UUID()    WHERE free_token IS NULL;
