-- ---------------------------------------------------------------------------
-- V20260526004__questionnaire_report_fks.sql
--
-- Attach (report_type, report_subtype) to each questionnaire so dispatch is a
-- DB lookup, not a per-call grade-inference branch in code. Both FKs are
-- nullable for the backfill window — the user manually populates them after
-- this migration runs; ReportService falls back to grade-based inference
-- when these are NULL (deprecation window, see plan Risk #1).
--
-- The DB table is misspelled `Questionire` (preserved verbatim per
-- Questionnaire.java line 23).
-- ---------------------------------------------------------------------------

ALTER TABLE questionire
  ADD COLUMN report_type_id    BIGINT NULL,
  ADD COLUMN report_subtype_id BIGINT NULL,
  ADD CONSTRAINT fk_questionire_report_type
    FOREIGN KEY (report_type_id)    REFERENCES report_type(report_type_id),
  ADD CONSTRAINT fk_questionire_report_subtype
    FOREIGN KEY (report_subtype_id) REFERENCES report_subtype(report_subtype_id);
