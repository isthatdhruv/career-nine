-- ---------------------------------------------------------------------------
-- V20260618002__drop_questionire_report_template.sql
--
-- Contract step of the questionnaire -> assessment template-mapping refactor.
-- V20260618001 created assessment_report_template and backfilled it from
-- questionire_report_template (fanning each questionnaire mapping out to the
-- assessment(s) that use that questionnaire, carrying is_default). All Java code
-- that read/wrote the questionnaire-anchored table has been removed and template
-- resolution now keys off the assessment, so this table is orphaned -> drop it.
--
-- Note: orphan rows whose questionnaire was used by no assessment were not
-- migrated; they were already unreachable by report generation (which routes
-- assessment -> template), so no live mapping is lost.
--
-- This runs strictly after V20260618001's backfill, so the data has already been
-- copied before the table is removed.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS questionire_report_template;
