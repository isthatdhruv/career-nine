-- ---------------------------------------------------------------------------
-- V20260804002__seed_dashboard_release_permission.sql
--
-- Permission for the "Release Dashboard" action on the institute detail page
-- (POST /dashboard/principal/release/{instituteCode}).
--
-- Deliberately separate from 'dashboard.school.read'. Reading a released
-- dashboard is an everyday act for a principal or teacher; releasing one
-- recomputes every scope on the filter lattice and spends money on ~25 OpenAI
-- calls, overwriting content a school may already have circulated. Those are
-- not the same authority and must be allottable independently.
--
-- Seeding the catalog is what makes a permission appear in the Roles &
-- Permissions picker (populated from SELECT * FROM permission, grouped on the
-- text before the first dot — so this lands in the "dashboard" group). It
-- grants nothing on its own; the code still has to be attached to a role.
--
-- Idempotent via ON DUPLICATE KEY, matching the other permission seeds.
-- ---------------------------------------------------------------------------

INSERT INTO permission (code, description) VALUES
  ('dashboard.school.release', 'Release (generate) the school dashboard for an institute')
ON DUPLICATE KEY UPDATE description = VALUES(description);
