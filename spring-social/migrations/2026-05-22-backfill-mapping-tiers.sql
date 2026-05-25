-- Backfill a single unlimited "Standard" tier for every existing mapping that has
-- a non-null amount. Unlimited cap => pricing is unchanged. Mappings with no amount
-- stay free (no tier; the controller falls back to mapping.amount / free).
-- Hibernate ddl-auto:update creates the assessment_mapping_tier table on boot;
-- run this AFTER the app has started once against the target DB.
INSERT INTO assessment_mapping_tier
    (mapping_id, name, amount, sort_order, max_registrations, current_count, is_active, created_at, updated_at)
SELECT m.mapping_id, 'Standard', m.amount, 1, NULL, 0, TRUE, NOW(), NOW()
FROM assessment_institute_mapping m
WHERE m.amount IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM assessment_mapping_tier t WHERE t.mapping_id = m.mapping_id
  );
