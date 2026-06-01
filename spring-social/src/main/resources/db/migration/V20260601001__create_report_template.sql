-- ---------------------------------------------------------------------------
-- V20260601001__create_report_template.sql
--
-- Unify the report-template feature onto ONE table. `report_template` already
-- exists (created by Hibernate ddl-auto from model.career9.ReportTemplate for
-- the generic preview/PDF feature), so we:
--   1. CREATE IF NOT EXISTS the original shape (fresh DBs only — a no-op where
--      Hibernate already made it), then
--   2. ALTER it to add the engine-backed pipeline columns and relax the legacy
--      NOT NULLs (assessment_id / template_url) so engine templates that map to
--      questionnaires instead of a single assessment are valid.
--
-- NOTE: assumes the table has NOT yet been migrated to include the engine
-- columns. The app has never started successfully with those entity fields, so
-- ddl-auto has not added them yet; Flyway runs before Hibernate on each boot.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS report_template (
  report_template_id BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  template_name      VARCHAR(255) NOT NULL,
  assessment_id      BIGINT       NOT NULL,
  template_url       VARCHAR(1024) NOT NULL,
  field_mappings     TEXT             NULL,
  created_at         VARCHAR(255)     NULL,
  updated_at         VARCHAR(255)     NULL
);

ALTER TABLE report_template
  ADD COLUMN code                 VARCHAR(50)  NULL,
  ADD COLUMN engine_code          VARCHAR(50)  NULL,
  ADD COLUMN spaces_render_folder VARCHAR(255) NULL,
  ADD COLUMN template_spaces_key  VARCHAR(512) NULL,
  ADD COLUMN template_uploaded_at DATETIME     NULL,
  MODIFY COLUMN assessment_id BIGINT      NULL,
  MODIFY COLUMN template_url  VARCHAR(2048) NULL,
  ADD CONSTRAINT uk_report_template_code UNIQUE (code);
