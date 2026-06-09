-- ---------------------------------------------------------------------------
-- V20260606004__student_entitlement_mapping_id.sql
--
-- B2B redesign — the B2B source mapping on the entitlement (Layer 4).
--
-- B2C entitlements carry campaign_id; B2B entitlements carry mapping_id (the
-- assessment_institute_mapping they were granted from) so the free->paid upgrade
-- can resolve that mapping's current active paid wave. Nullable: campaign rows
-- leave it null, mirroring the payment_transaction discriminator pattern.
--
-- The existing access gates (InsightAccessService + the token-redeem endpoints)
-- read only (user_student_id, assessment_id) + the boolean flags, never the
-- scope id — so B2B entitlements pass them unchanged.
-- ---------------------------------------------------------------------------

ALTER TABLE student_entitlements
    ADD COLUMN mapping_id BIGINT NULL;
