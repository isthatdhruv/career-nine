-- ---------------------------------------------------------------------------
-- V20260601008__drop_legacy_report_type_subtype.sql
--
-- Phase 4 cleanup: the dual report_type / report_subtype taxonomy is fully
-- retired — the system now runs on report_template + questionire_report_template.
-- The ReportType / ReportSubtype JPA entities have been deleted, so ddl-auto
-- will not recreate these tables after this migration drops them.
--
-- Drop order: FK-holding columns on questionire first, then the child table
-- (report_subtype) before its parent (report_type). calculated_report_data and
-- generated_report were already re-pointed to report_template in V005/V006.
-- ---------------------------------------------------------------------------

-- 1. Drop the now-unused single-FK columns on the questionnaire table.
ALTER TABLE questionire
  DROP FOREIGN KEY fk_questionire_report_type;
ALTER TABLE questionire
  DROP FOREIGN KEY fk_questionire_report_subtype;
ALTER TABLE questionire
  DROP COLUMN report_type_id,
  DROP COLUMN report_subtype_id;

-- 2. Drop the catalog tables (child first).
DROP TABLE IF EXISTS report_subtype;
DROP TABLE IF EXISTS report_type;

-- 3. Remove the obsolete permission codes + their role grants. Harmless if the
--    rows were never seeded in this environment.
DELETE FROM role_permission
WHERE permission_id IN (
  SELECT id FROM permission WHERE code IN (
    'report_type.read','report_type.create','report_type.update','report_type.delete',
    'report_subtype.read','report_subtype.create','report_subtype.update',
    'report_subtype.upload_template','report_subtype.delete'
  )
);
DELETE FROM permission WHERE code IN (
  'report_type.read','report_type.create','report_type.update','report_type.delete',
  'report_subtype.read','report_subtype.create','report_subtype.update',
  'report_subtype.upload_template','report_subtype.delete'
);
