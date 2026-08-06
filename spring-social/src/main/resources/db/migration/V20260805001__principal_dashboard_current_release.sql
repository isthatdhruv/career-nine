-- Which release a school's dashboard is currently showing.
--
-- Before this, the dashboard's entry point took the institute-level row with the newest
-- generated_at. That is not the same question: re-releasing last year's assessment today
-- would silently make last year the school's live dashboard, because it was generated
-- most recently rather than because anyone chose it.
--
-- A release now marks its own assessment current and every other assessment for that
-- institute not current, so "which report is live" is an admin decision instead of a
-- side effect of who pressed regenerate last.
--
-- Defaults to 1 so rows written before this migration stay readable.

ALTER TABLE principal_dashboard_data
    ADD COLUMN is_current TINYINT(1) NOT NULL DEFAULT 1;

-- The dashboard's entry point is (institute, is_current, scope_level = 'INSTITUTE').
CREATE INDEX idx_pdd_current
    ON principal_dashboard_data (institute_code, is_current, scope_level);
