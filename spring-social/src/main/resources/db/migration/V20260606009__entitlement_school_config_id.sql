-- ---------------------------------------------------------------------------
-- V20260606009__entitlement_school_config_id.sql
--
-- Two-area bridge — the legacy-school source on the entitlement.
--
-- B2C entitlements carry campaign_id; per-level B2B entitlements carry
-- mapping_id (V20260606004). A school registration now also mints an
-- entitlement, sourced from a school_assessment_config — recorded here so the
-- three B2B/B2C sources form a clean 3-way discriminator (exactly one of
-- campaign_id / mapping_id / school_config_id is set). Nullable: the other two
-- flows leave it null, mirroring the payment_transaction discriminator pattern.
--
-- The access gates read only (user_student_id, assessment_id) + the boolean
-- service flags, never the scope/source id — so school entitlements pass them
-- exactly like per-level B2B and B2C entitlements.
-- ---------------------------------------------------------------------------

ALTER TABLE student_entitlements
    ADD COLUMN school_config_id BIGINT NULL;
