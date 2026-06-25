-- ---------------------------------------------------------------------------
-- V20260625002__grant_school_admin_dashboard_permissions.sql
--
-- School Admin Phase 2 — dashboard access.
--
-- The school-admin home renders the SAME admin dashboard as /dashboard
-- (DashboardAdminPage at FE route /school/dashboard). Its data endpoints are
-- gated by:
--   GET  /dashboard/admin/snapshot          -> @auth.allows('dashboard.admin.read')
--   POST /dashboard/admin/snapshot/refresh  -> @auth.allows('dashboard.admin.refresh')
-- (see DashboardSnapshotController). Enforce is log-only today, but grant these so
-- SCHOOL_ADMIN stays correct when enforcement is turned on.
--
-- Data is currently scoped to the admin's institute CLIENT-SIDE only
-- (applyScopeToSnapshot in dashboard-admin.tsx) — server-side row-scoping via
-- DashboardDataService is deferred to a later security pass.
--
-- Both permission codes are already seeded (V20260512001 / V20260521001).
-- role_permission PK is (role_id, permission_id) → INSERT IGNORE is idempotent.
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'SCHOOL_ADMIN'
  AND p.code IN ('dashboard.admin.read', 'dashboard.admin.refresh');
