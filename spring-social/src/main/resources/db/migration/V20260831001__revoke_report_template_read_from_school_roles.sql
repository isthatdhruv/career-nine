-- ---------------------------------------------------------------------------
-- V20260831001__revoke_report_template_read_from_school_roles.sql
--
-- V20260601007 seeded 'report_template.read' onto School Admin and Counsellor
-- ("read-only on the catalog"). Combined with the URL auto-derivation in the
-- roles UI (deriveUrlsForPerms: perm → manifest routes), that legacy grant
-- silently put /admin/report-templates into those roles' URL whitelists — the
-- "Report Templates page auto-assigned to school_admin" report.
--
-- The template catalog is an internal admin/ops surface. Roles that genuinely
-- need it get it explicitly through the Page Access catalog (Roles &
-- Permissions → Page Access), which grants the URL + permission together per
-- page, with no seeding and no expansion.
--
-- Idempotent: deleting an absent row is a no-op.
-- ---------------------------------------------------------------------------

DELETE rp FROM role_permission rp
JOIN role r ON r.id = rp.role_id
JOIN permission p ON p.id = rp.permission_id
WHERE r.name IN ('School Admin', 'Counsellor')
  AND p.code = 'report_template.read';
