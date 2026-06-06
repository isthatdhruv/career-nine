-- ---------------------------------------------------------------------------
-- V20260606003__assessment_mapping_tier_free_and_dashboard.sql
--
-- B2B redesign — free tier + dashboard inclusion on the tier (Layer 3).
--
--   is_free                  — designates THE free tier for a mapping (exactly
--                              one, amount 0). Backs the free link's inclusions
--                              + cap. Paid waves are is_free=FALSE.
--   includes_dashboard /     — dashboard service grant (parity with the B2C
--   dashboard_validity_days    PricingTier; the only two toggles B2B was missing).
--
-- Then: create a free tier for every EXISTING mapping so each free_token works.
-- Free tiers use a reserved sort_order = -1 so they never collide with the wave
-- ordering (uk_mapping_tier_sort = mapping_id + sort_order).
-- ---------------------------------------------------------------------------

ALTER TABLE assessment_mapping_tier
    ADD COLUMN is_free                 BOOLEAN DEFAULT FALSE,
    ADD COLUMN includes_dashboard      BOOLEAN DEFAULT FALSE,
    ADD COLUMN dashboard_validity_days INT     NULL;

-- One free tier per existing mapping that doesn't already have one. Inclusions
-- default FALSE (admin enables what the free link should grant).
INSERT INTO assessment_mapping_tier
    (mapping_id, name, description, amount, sort_order, current_count, is_active, is_free,
     includes_final_report, includes_dashboard, includes_counselling, includes_lms,
     created_at, updated_at)
SELECT m.mapping_id, 'Free', 'Free registration', 0, -1, 0, TRUE, TRUE,
       FALSE, FALSE, FALSE, FALSE,
       NOW(), NOW()
FROM assessment_institute_mapping m
WHERE NOT EXISTS (
    SELECT 1 FROM assessment_mapping_tier t
    WHERE t.mapping_id = m.mapping_id AND t.is_free = TRUE
);
