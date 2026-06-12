-- ---------------------------------------------------------------------------
-- V20260606008__school_tier_inclusions.sql
--
-- Two-area bridge — give the legacy school tier the same service-inclusion
-- toggles the per-level B2B tier already has (assessment_mapping_tier, added in
-- V20260605002 + V20260606003), so a school registration can grant final
-- report / dashboard / counselling / LMS through the SAME StudentEntitlement
-- contract instead of conferring assessment access only.
--
-- Booleans default FALSE so every existing school tier keeps its current
-- behaviour (no bundled services). The validity/count columns are NULLABLE
-- (null = not configured / unlimited window) — identical semantics to the
-- per-level tier.
-- ---------------------------------------------------------------------------

ALTER TABLE school_assessment_tier
  ADD COLUMN includes_final_report     BOOLEAN DEFAULT FALSE,
  ADD COLUMN includes_dashboard        BOOLEAN DEFAULT FALSE,
  ADD COLUMN dashboard_validity_days   INT NULL,
  ADD COLUMN includes_counselling      BOOLEAN DEFAULT FALSE,
  ADD COLUMN counselling_session_count INT NULL,
  ADD COLUMN includes_lms              BOOLEAN DEFAULT FALSE,
  ADD COLUMN lms_validity_days         INT NULL;
