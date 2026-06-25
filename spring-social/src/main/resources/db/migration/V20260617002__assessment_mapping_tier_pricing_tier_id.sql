-- ---------------------------------------------------------------------------
-- V20260617002__assessment_mapping_tier_pricing_tier_id.sql
--
-- Per-student invites select a reusable B2C pricing tier (pricing_tiers) rather
-- than a hand-built per-mapping tier. Because the invite + payment + entitlement
-- pipeline keys off assessment_mapping_tier, the chosen B2C tier is materialised
-- onto the mapping as an assessment_mapping_tier row; pricing_tier_id records its
-- source so the same (mapping, pricing tier) reuses one row (find-or-create).
-- ---------------------------------------------------------------------------

ALTER TABLE assessment_mapping_tier
    ADD COLUMN pricing_tier_id BIGINT NULL;
