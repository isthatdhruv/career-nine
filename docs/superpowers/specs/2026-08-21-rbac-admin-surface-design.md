# RBAC/ABAC Admin Surface — Design (implemented 2026-08-21)

User request: (1) a structured way to create a role group with roles and ABAC
scopes and allot it to users; (2) fix missing routes/permissions; (3) make page
routing follow the permission model for all pages.

Decisions (confirmed with user):
- ABAC scope is chosen **at allotment time**, per user↔role-group assignment
  (matches the existing `user_role_scope` schema; no migration).
- Page gating moves to **resource-grained** codes from the existing Phase-15
  catalog (each page uses its resource's code, matching its backend APIs).
- The four legacy `/roles/*` pages are gone (they were already redirect stubs).
- A role's URL whitelist is **auto-derived from its permissions** via the
  build-time perm→routes manifest; hand-added custom/wildcard paths survive.
- UI: guided **Group Builder wizard** (Group → Roles → Permissions → Review →
  Allot with scope rows) on Roles & Permissions; the same ScopeRowsEditor is
  embedded in User Management's assignment tab.

## Backend (spring-social)

- `UserRoleGroupMappingController`:
  - `GET /userrolegroupmapping/user/{userId}` → assignments + scopes.
  - `GET /userrolegroupmapping/{mappingId}/scopes`.
  - `PUT /userrolegroupmapping/{mappingId}/scopes` — replace-set; containment
    validation (session/class need institute, section needs class, group must
    belong to the row's institute); enforce-independent hard check
    (superAdmin || role.assign) because `@PreAuthorize` is log-only;
    `@SensitiveOp("role.assign")` audit.
  - `updateUserRoleGroup` now **delta-merges** instead of delete-all+recreate —
    the old behavior cascade-deleted every scope row on each role edit.
- `UserRoleScopeRepository.deleteAllByUserRoleGroupMapping_Id`.
- Migrations:
  - `V20260821001__option_group.sql` — renamed from V20260820001 to resolve a
    duplicate-version collision with the counsellor-alert migration.
  - `V20260821002__seed_missing_permission_codes.sql` — 12 enum codes
    (reminders.*, intermediary_scores.read, calculated_report_data.read,
    report_template.upload_template/map) that no seed migration ever inserted,
    making them impossible to allot.
  - `V20260821003__expand_page_permission_grants.sql` — for each role holding
    one of the 19 old coarse page-gating codes, grants the resource-grained
    codes now gating the same pages (INSERT IGNORE; coarse codes not revoked).
    Runs after the seed so newly seeded codes participate.
- `ControllerPreAuthorizeCoverageTest`: 11 anonymous `/public/**` funnel
  endpoints added to EXCLUSIONS per the test's own convention.
- New `UserRoleGroupMappingScopeTest` (hard check, containment rules, save).

## Admin frontend (react-social)

- `PrivateRoutes.tsx`: 88 routes re-mapped to resource-grained codes (all codes
  pre-exist in the catalog; zero FE orphans — verified by script). `/game-list`
  wrapped (`game_table.read`); `/admin/jwt-tokens` behind new
  `RequireSuperAdmin`. Orphan code `counselling.read` replaced.
- `deriveUrls.ts` (+tests): `nextUrlsAfterPermissionChange` — derived routes
  from perms ∪ stored custom paths. `RolePermissionsModal` saves permissions
  then auto-syncs `PUT /role/{id}/urls`.
- `ScopeRowsEditor.tsx`: cascading Institute → Session/Class/Group, Class →
  Section selects; wildcard = blank; lookups cached module-level; sources:
  `/instituteDetail/get`, `/instituteSession/get`,
  `/instituteCourse/getbyCollegeId/{i}`, `/section/get`,
  `/student-groups?instituteCode=`.
- `GroupBuilderWizard.tsx`: 5-step flow; persists the group leaving step 2;
  reuses RolePermissionsModal per role; allot step merges the group into each
  user's set then PUTs scope rows to the new mapping.
- `RoleAssignmentsTab`: expandable per-user panel with per-assignment scope
  editing; fixed delete bug (user id was passed where a mapping id belongs).
- `tsconfig.typecheck.json` + `npm run typecheck`: CLI checking config —
  the main tsconfig pins `ignoreDeprecations: "6.0"` for the IDE's TS 6, which
  is invalid for CLI TS 5.x and silently aborted all checking (TS5103).

## Known behavior / limits

- Scope changes take effect on the subject's next token refresh (≤60 min) —
  scopes ride in the JWT.
- Backend stays `log-only`; page gates and the FE `can()` are live either way.
  The grant-expansion migration is what keeps existing roles working when the
  FE re-map ships.
- Wizard applies the same scope rows to every selected user (replacing
  existing scopes on that group's assignment); per-user tweaks live in User
  Management.
