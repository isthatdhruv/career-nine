-- ---------------------------------------------------------------------------
-- V20260605002__assessment_mapping_tier_add_service_toggles.sql
--
-- B2B pricing-tier service toggles (parity with the B2C PricingTier flags).
--
-- assessment_mapping_tier previously only described price + cap. The admin now
-- needs to configure, per B2B tier, which services the tier entitles the student
-- to — final report, counselling (with a session budget), and LMS (with a
-- validity window) — exactly like the campaign pricing tiers
-- (PricingTier.includes_final_report / includes_counselling / includes_lms /
-- counselling_session_count / lms_validity_days).
--
-- The booleans default FALSE so every existing tier keeps its current behaviour
-- (no bundled services). The count/validity columns are NULLABLE (null = not
-- configured / unlimited window — same semantics as the B2C tier).
-- ---------------------------------------------------------------------------

ALTER TABLE assessment_mapping_tier
  ADD COLUMN includes_final_report     BOOLEAN DEFAULT FALSE,
  ADD COLUMN includes_counselling      BOOLEAN DEFAULT FALSE,
  ADD COLUMN counselling_session_count INT NULL,
  ADD COLUMN includes_lms              BOOLEAN DEFAULT FALSE,
  ADD COLUMN lms_validity_days         INT NULL;
