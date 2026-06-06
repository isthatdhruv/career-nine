-- ---------------------------------------------------------------------------
-- V20260606005__school_flow_backfill.sql
--
-- B2B redesign — fold the legacy school-level flow into the unified model.
--
-- Each active school_assessment_config (institute, session, class, assessment)
-- becomes a CLASS-level assessment_institute_mapping with fresh free/paid tokens,
-- a free tier, and clones of its school_assessment_tier rows as paid waves — so
-- the school data shows up in the new unified UI.
--
-- Already-distributed /school-register/{token} links are NOT touched: they keep
-- being served by the legacy SchoolRegistrationController. This migration only
-- mints NEW (undistributed) unified mappings; the school tokens are unrelated.
--
-- Idempotent via migrated_from_school_config_id. Guarded against colliding with
-- any CLASS mapping an admin already created for the same coordinates.
--
-- NOTE on types: school_assessment_tier.institute_code / session_id are BIGINT
-- while assessment_institute_mapping.institute_code / session_id are INT; MySQL
-- compares them numerically, so the join is safe.
-- ---------------------------------------------------------------------------

-- 1) One CLASS-level unified mapping per active school config.
INSERT INTO assessment_institute_mapping
    (assessment_id, institute_code, mapping_level, session_id, class_id, section_id,
     token, paid_token, free_token, paid_active, free_active, amount, is_active,
     migrated_from_school_config_id, created_at)
SELECT c.assessment_id, c.institute_code, 'CLASS', c.session_id, c.class_id, NULL,
       UUID(), UUID(), UUID(), TRUE, TRUE, NULL, TRUE,
       c.config_id, NOW()
FROM school_assessment_config c
WHERE c.is_active = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM assessment_institute_mapping m
      WHERE m.migrated_from_school_config_id = c.config_id
  )
  AND NOT EXISTS (
      SELECT 1 FROM assessment_institute_mapping m2
      WHERE m2.assessment_id = c.assessment_id
        AND m2.institute_code = c.institute_code
        AND m2.session_id = c.session_id
        AND m2.class_id = c.class_id
        AND m2.section_id IS NULL
  );

-- 2) A free tier for each migrated mapping (sort_order -1, inclusions off).
INSERT INTO assessment_mapping_tier
    (mapping_id, name, description, amount, sort_order, current_count, is_active, is_free,
     includes_final_report, includes_dashboard, includes_counselling, includes_lms,
     created_at, updated_at)
SELECT m.mapping_id, 'Free', 'Free registration', 0, -1, 0, TRUE, TRUE,
       FALSE, FALSE, FALSE, FALSE,
       NOW(), NOW()
FROM assessment_institute_mapping m
WHERE m.migrated_from_school_config_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM assessment_mapping_tier t
      WHERE t.mapping_id = m.mapping_id AND t.is_free = TRUE
  );

-- 3) Clone the school's pricing tiers (per institute+session+assessment) as paid
--    waves on each migrated CLASS mapping. Service inclusions default off (school
--    tiers never carried them).
INSERT INTO assessment_mapping_tier
    (mapping_id, name, description, amount, sort_order, max_registrations, current_count,
     is_active, is_free,
     includes_final_report, includes_dashboard, includes_counselling, counselling_session_count,
     includes_lms, lms_validity_days,
     created_at, updated_at)
SELECT m.mapping_id, st.name, st.description, st.amount, st.sort_order, st.max_registrations, 0,
       st.is_active, FALSE,
       FALSE, FALSE, FALSE, NULL,
       FALSE, NULL,
       NOW(), NOW()
FROM assessment_institute_mapping m
JOIN school_assessment_tier st
  ON st.institute_code = m.institute_code
 AND st.session_id     = m.session_id
 AND st.assessment_id  = m.assessment_id
WHERE m.migrated_from_school_config_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM assessment_mapping_tier t
      WHERE t.mapping_id = m.mapping_id AND t.is_free = FALSE AND t.sort_order = st.sort_order
  );
