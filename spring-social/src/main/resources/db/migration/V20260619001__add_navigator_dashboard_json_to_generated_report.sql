-- Precomputed Navigator 360 dashboard payload, stored at report-generation time so
-- the student portal can render the dashboard directly (no recompute on read).
-- The auto report pipeline (ReportService.generate, pager engine) computes a
-- Navigator360Result and serialises it here. LONGTEXT: the payload can be large.
ALTER TABLE generated_report
  ADD COLUMN navigator_dashboard_json LONGTEXT NULL AFTER pdf_status;
