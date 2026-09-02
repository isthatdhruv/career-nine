-- ---------------------------------------------------------------------------
-- V20260831002__seed_report_center_permission.sql
--
-- Permission for the school-facing Report Center page (route /report-center):
-- preview / download / email assessment reports to students. Delivery reuses
-- the unified generate queue (force=false + emailMode=all → existing reports
-- are emailed without regeneration), so the queue endpoints keep their own
-- codes; this code gates only the page.
--
-- Catalog seed only — grants nothing. Allot it per role through the Page
-- Access / Manage Permissions catalog (no role seeding, no expansion).
-- Idempotent via ON DUPLICATE KEY, matching the other permission seeds.
-- ---------------------------------------------------------------------------

INSERT INTO permission (code, description) VALUES
  ('report_center.read', 'View the Report Center (school-facing report preview/download/email)')
ON DUPLICATE KEY UPDATE description = VALUES(description);
