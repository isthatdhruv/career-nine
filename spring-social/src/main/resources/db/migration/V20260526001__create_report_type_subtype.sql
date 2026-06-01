-- ---------------------------------------------------------------------------
-- V20260526001__create_report_type_subtype.sql
--
-- Create the report_type / report_subtype catalog tables. These drive
-- ReportService dispatch (replacing per-grade inference) and hold the Spaces
-- URL of each subtype's HTML template (decoupling template authoring from
-- code releases).
--
-- See plan: /home/babayaga/.claude/plans/1-b-2-indexed-valley.md (Phase 1).
-- ---------------------------------------------------------------------------

CREATE TABLE report_type (
  report_type_id  BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(50)  NOT NULL,
  display_name    VARCHAR(255) NOT NULL,
  CONSTRAINT uk_report_type_code UNIQUE (code)
);

CREATE TABLE report_subtype (
  report_subtype_id    BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  report_type_id       BIGINT       NOT NULL,
  code                 VARCHAR(50)  NOT NULL,
  display_name         VARCHAR(255) NOT NULL,
  template_spaces_url  VARCHAR(2048)    NULL,
  template_spaces_key  VARCHAR(512)     NULL,
  template_uploaded_at DATETIME         NULL,
  spaces_render_folder VARCHAR(255) NOT NULL,
  CONSTRAINT uk_report_subtype_type_code UNIQUE (report_type_id, code),
  CONSTRAINT fk_report_subtype_type FOREIGN KEY (report_type_id)
    REFERENCES report_type(report_type_id)
);
