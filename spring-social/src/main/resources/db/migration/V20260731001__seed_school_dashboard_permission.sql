-- ---------------------------------------------------------------------------
-- V20260731001__seed_school_dashboard_permission.sql
--
-- Dedicated permission for the School Dashboard page (aside menu → Reports →
-- School Dashboard, route /school-dashboard, endpoint
-- GET /general-assessment/school-dashboard/{instituteCode}).
--
-- It previously reused 'dashboard.school.insights.read', which belongs to the
-- separate Cohort Insights feature. Sharing one code meant granting either page
-- silently granted the other, and it made the School Dashboard undiscoverable
-- in the Roles & Permissions picker as a thing you could allot on its own.
--
-- Seeding is what makes a permission ALLOTTABLE: the picker is populated from
-- GET /permission/getAll, i.e. `SELECT * FROM permission`, grouped by the text
-- before the first dot — so this lands in the "dashboard" group. A code that
-- exists only in the PermissionCode enum never appears there until either a
-- migration like this inserts it or an admin runs POST /permission/refresh.
--
-- Idempotent via ON DUPLICATE KEY, matching the other permission seeds.
-- Seeding the catalog grants nothing on its own — the code still has to be
-- attached to a role before any user holds it.
-- ---------------------------------------------------------------------------

INSERT INTO permission (code, description) VALUES
  ('dashboard.school.read', 'View the School Dashboard (Navigator360 school insights)')
ON DUPLICATE KEY UPDATE description = VALUES(description);
