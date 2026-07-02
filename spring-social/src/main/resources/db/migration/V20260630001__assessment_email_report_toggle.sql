-- Phase 4: per-assessment toggle to email the report to non-whitelabel students too.
-- When ON, the report pipeline mails the report to this assessment's students even if
-- their institute is not whitelabel (whitelabel students are always mailed regardless).

ALTER TABLE assessment_table
    ADD COLUMN email_report_enabled TINYINT(1) NOT NULL DEFAULT 0;
