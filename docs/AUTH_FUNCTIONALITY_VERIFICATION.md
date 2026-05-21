# Auth Functionality Verification — Does the code deliver the intended design?

**Branch:** `attribute-based-auth`
**Date:** 2026-05-21
**Method:** Independent source trace (backend `spring-social/`, frontend `react-social/`). Existing docs (`AUTH_ROLE_ATTRIBUTE.md`, `AUTH_AUDIT_FINDINGS.md`, `BACKEND_ENDPOINT_ISSUES.md`, `AUTH_REDESIGN_PLAN.md`) were read for orientation but every claim below was re-verified against code. This is a **functional** verification ("does it do what the team needs?"), not only a security audit.

**One-line bottom line:** The plumbing for both halves is built and mostly wired, but the system does **not** deliver the intended user-visible behavior today, for two independent reasons: (1) the menu was re-implemented as **permission-gated, not URL-gated** (a deliberate divergence from the "menu shows only the role group's allowed URLs" requirement); and (2) **data is not actually scoped** in the places that matter — the only dashboard that ships is an unscoped org-wide blob, the one scope-aware dashboard service is dead code, key list endpoints (`InstituteDetail`, score/answer projection maps) bypass the row filter, and the entire endpoint-level ABAC/RBAC gate is in `log-only` mode in all four profiles so it blocks nothing.

---

## Requirement-by-requirement verdict

### Part 1 — Role-based auth (URLs → role group → user → menu)

| # | Intended behavior | Status | Evidence | Notes |
|---|---|---|---|---|
| 1.1 | Admin defines a set of allowed **frontend URLs** | WORKS | `model/RoleUrl.java:27-44` (`role_url` table: `role_id`,`path`); admin UI `pages/RolesAndPermissions/RoleUrlsModal.tsx`; write endpoint `PUT /role/{id}/urls` | URL strings stored per role; literal/`:param`/`*` patterns supported. |
| 1.2 | Those URLs are **bundled into a role group** | PARTIAL | URLs attach to a **Role** (`role_url.role_id`), and Roles attach to RoleGroups via `role_role_group_mapping` | URLs are bundled at the *role* level, then reach the group transitively. Functionally equivalent, but the literal "bundled into a role group" is one hop removed. |
| 1.3 | Role group attached to a **user** | WORKS | `user_role_group_mapping` (`User.userRoleGroupMappings`, `User.java:119` EAGER); chain documented `RoleUrlRepository.findPathsForUser` join `RoleUrlRepository.java:35-46` | Standard pre-existing chain User→URGM→RoleGroup→RRGM→Role. |
| 1.4 | At login, resolve the user's **allowed URLs** and deliver to FE | WORKS | `GET /auth/me` → `roleUrlRepository.findPathsForUser(principal.getId())` (`AuthController.java:288-296`) → `MeResponse.urls[]`; FE stores via `AuthInit`/`useAuth` | Distinct union of `role_url.path` across all the user's roles. |
| 1.5 | **Aside menu shows ONLY allowed URLs** | **BROKEN / NOT IMPLEMENTED as designed** | `AsideMenuMain.tsx:33-104` gates every item with `can('<permission>')`, **never** consults `currentUser.urls`. `useScope()` is a stub (`useScope.ts`). | The menu is **permission-driven**, not URL-driven. The team's "menu = the role group's URL set" requirement is not what shipped. A user with `student.read` sees the Student-List menu item regardless of whether `/student-list` is in their role's URL whitelist. |
| 1.6 | Route layer also enforces it (can't deep-link to a hidden URL) | WORKS (as an intersection, with caveat) | `RequirePermission.tsx:30-54` = `can(perm)` **AND** `urlAllowed(currentUser.urls, pathname)`; wired on ~227 routes in `PrivateRoutes.tsx` | The *route* guard DOES honor the URL whitelist (intersection with the permission gate). So the URL list is enforced at the route level but ignored by the menu — they can disagree (menu shows an item the route then blocks with `RequestAccessPage`). FE-only; not a server boundary. |
| 1.7 | Empty URL list = deny | WORKS | `urlAllowed` returns `false` for empty/undefined (`permissions.ts:100-106`); super-admin bypasses (`RequirePermission.tsx:35-38`) | Deny-by-default for non-super-admins lacking any whitelisted path. |

### Part 2 — Attribute-based auth (scope by institute/session/class/section)

| # | Intended behavior | Status | Evidence | Notes |
|---|---|---|---|---|
| 2.1 | Scopes stored across institute/session/class/section | WORKS | `model/UserRoleScope.java`; migration `V20260511007`; 4 nullable dims `institute_id/session_id/course_code/section_id` | NULL = wildcard at that dim. |
| 2.2 | Scope attaches to a user (or role assignment) | WORKS | `user_role_scope.user_role_group_mapping_id` FK → scope attaches to the **role-assignment** (one user can be Teacher@A and Counsellor@B with different scopes) | Hydrated as a flattened union per user in `CustomUserDetailsService.hydrate` (`:86-100`) via `UserRoleScopeRepository.findAllByUserId`. |
| 2.3 | Hierarchy institute ⊇ session ⊇ class ⊇ section + wildcards | WORKS (logic), DOC-ONLY (DB constraint) | `CurrentScopes.ScopeRow.matches` null-as-wildcard; `chk_urs_containment` CHECK only enforced on MySQL 8+ (per AUTH_ROLE_ATTRIBUTE §4.1) | Matching predicate mirrored on FE in `permissions.ts:75-79`. |
| 2.4 | **Endpoint-level scope check actually blocks** | **BROKEN (disabled)** | `AuthorizationService.recordAndReturn` returns `true` unless `enforce-mode=enforce` (`AuthorizationService.java:150`); **all four** profiles set `enforce-mode: log-only` (`application.yml:184`, `-dev.yml:85`, `-sandbox.yml:96`, `-production.yml:103`) | Every `@auth.allows(...)` on ~700 methods is a **no-op** today. The check computes + audits a DENY then returns 200. Verified myself in all profile files. |
| 2.5 | **Returned DATA is filtered to scope (row-level)** | **PARTIAL / mostly BROKEN** | Hibernate `scopeFilter` exists and runs **regardless of enforce-mode** (it is gated only by super-admin / full-wildcard, `ScopeFilterInterceptor.java:72-97`), applied to only **5** entities. But coverage gaps make the user-visible data unscoped in the important places — see DATA-SCOPE section. | This is the crux failure. The filter is real and active, but it covers the wrong/too-few surfaces. |
| 2.6 | A **school** sees only its own data | **BROKEN** | Institute list endpoints return all institutes (`InstituteDetail` is NOT filter-annotated, `getallInstituteDetail` = `findAll()`, `InstituteDetailController.java:119-122`); admin dashboard is an unscoped org-wide blob (below) | See walkthrough. |
| 2.7 | A **teacher** sees only their school's slice of a dashboard | **NOT IMPLEMENTED (dead code)** | The only scope-aware dashboard service `service/career9/DashboardDataService.java` (`fetchForCurrentUser`, ContactPerson `AccessScope`) is **injected by no controller** — verified: zero callers of `fetchForCurrentUser` outside the file itself. The dashboard actually served is unscoped (`DashboardSnapshotController`). | The capability was built and then left unwired. |

---

## Part 1 detail — role / URL / menu flow (traced)

**Data model (verified, matches intent with one nuance).** Admin-defined URLs live in `role_url` (`RoleUrl.java`), keyed to a **Role**, not directly to a RoleGroup. The chain to the user is the pre-existing `User → user_role_group_mapping → RoleGroup → role_role_group_mapping → Role`. So "URLs bundled into a role group" is realized as "URLs on roles, roles in groups, groups on users." The intended *outcome* (a user inherits a set of allowed URLs through their group) holds.

**Login → URL delivery (works).** `GET /auth/me` calls `roleUrlRepository.findPathsForUser(userId)` (`AuthController.java:290`), a native join walking `role_url → role → role_role_group_mapping → user_role_group_mapping WHERE urgm.user_id=? AND urgm.display=TRUE` (`RoleUrlRepository.java:35-46`). The distinct path set is returned in `MeResponse.urls[]`. The SPA loads it once on bootstrap.

**Menu gating (the divergence).** The intended design is "the aside menu shows ONLY the role group's allowed URLs." The shipped `AsideMenuMain.tsx` instead computes every section/item visibility from `can('<permission-code>')` (e.g. `showInstitute = can('institute.read') || can('student.read') || ...`, `:33-38`; 27 `can(`/`<Can perm=>` sites). It **never references `currentUser.urls`**. The file's own comments call this out ("Menu derives from permissions, not a URL list"). `useScope()` is a stub returning `undefined` (`useScope.ts`), so menu items do permission-only checks.

Consequence: the menu is governed by the **permission catalog**, not the **URL whitelist** the admin curates per role. The two can disagree — a user can see a menu item (because they hold the permission) yet be bounced to `RequestAccessPage` when they click it (because the path is not in their `urls[]`). This is a real functional mismatch with the stated requirement.

**Route enforcement (works, intersection).** `RequirePermission` (`RequirePermission.tsx:30-54`) renders a route iff `can(perm, scope)` AND `urlAllowed(currentUser.urls, pathname)`, super-admin bypassing both. It is wired on ~227 routes in `PrivateRoutes.tsx`. So the URL whitelist **is** enforced — but only at the route layer, and only on the client. There is no server-side equivalent of the URL whitelist; the backend boundary is `@auth.allows` (permissions/scopes), which is itself disabled (2.4). Frontend gating is presentation-only and trivially bypassable via direct API calls.

---

## Part 2 detail — attribute / data-scope flow (traced)

**Scope storage & hydration (works).** `user_role_scope` rows carry `(institute_id, session_id, course_code, section_id)`, each FK'd to a `user_role_group_mapping`. On each request `CustomUserDetailsService.hydrate` (`:83-100`) loads the user's rows via `findAllByUserId`, converts `section_id` Integer→Long (`:92`), and stores them on `UserPrincipal.getScopes()`. Permissions and the super-admin flag are re-read from the DB every request (not trusted from the JWT) — sound design, verified.

**Two enforcement surfaces exist; both have problems.**

1. **Endpoint gate `@auth.allows(...)`** — computes the correct decision (`AuthorizationService.decide`, `:102-130`: ANONYMOUS / super-admin bypass / PERM_MISSING / no-scope-args / SCOPE_MISMATCH) but `recordAndReturn` (`:136-151`) collapses every DENY to `true` in `log-only`. **All four profiles are log-only** — so this surface blocks nothing today. The `ControllerPreAuthorizeCoverageTest` guarantees the annotation is *present*, not that it is *enforced*, giving a false sense of coverage.

2. **Row-level Hibernate `scopeFilter`** — declared once (`StudentInfo.java:45-55`) and applied via `@Filter` on exactly **5 entities**. Crucially, this filter **runs independent of enforce-mode**: `ScopeFilterInterceptor` enables it whenever the principal is non-super-admin and not full-wildcard (`:72-97`), with MIN_VALUE sentinels for empty dimensions (fail-closed). Registered globally in `WebMvcConfig.java:56-66` (excludes `/auth/**`, public funnels, etc.). So the *idea* — "data narrows even in log-only" — is real. The problem is **coverage**, below.

---

## DATA-SCOPE ENFORCEMENT — which endpoints actually filter, which do NOT (highest-value section)

The Hibernate `scopeFilter` only affects queries against these 5 filter-annotated entities, and even among them the conditions vary:

| Entity | `@Filter` condition | Effective scoping | File |
|---|---|---|---|
| `StudentInfo` | filters on `institute_id`, `session_id`, `course_code`, `school_section_id` (all 4 dims) | **Real, full** | `StudentInfo.java:51-55` |
| `UserStudent` | `institute_id IN (:instituteIds) OR NULL` | Institute-only | `UserStudent.java:26-27` |
| `Campaign` | `institute_code IN (:instituteIds) OR NULL` | Institute-only | `Campaign.java:31-32` |
| `InstituteBranch` | `course_id IN (:courseCodes) OR NULL` | Course-only | `InstituteBranch.java:29-30` |
| `AssessmentTable` | **`condition = "1=1"`** | **NONE — no-op filter** | `AssessmentTable.java:34` |

### Endpoints that DO filter by scope (when querying a filtered entity through Hibernate)
- `GET /student-info/getAll` → `studentInfoRepository.findAll()` (`StudentInfoController.java:113`) — `StudentInfo` is fully filtered, so a scoped user gets only in-scope students. **Works** for the row filter.
- `GET /student-info/getByInstituteId/{id}` → `findByInstituteId` (derived JPA query) — goes through Hibernate, filter applies. Works.
- Repository `findAll()`/derived-query reads of `UserStudent`, `Campaign`, `InstituteBranch` — partially scoped (single dimension each).

### Endpoints where scope filtering is EXPECTED but MISSING

1. **Admin dashboard (the marquee "school/teacher dashboard" surface) — UNSCOPED.**
   - `GET /dashboard/admin/snapshot` + `POST /dashboard/admin/snapshot/refresh` (`DashboardSnapshotController.java:20-32`) have **no `@PreAuthorize` at all** and serve a **precomputed, org-wide cached JSON blob** (`DashboardSnapshotService`, `ADMIN_DASHBOARD_KEY`, 24h TTL). The blob is computed by aggregating eight admin endpoints once and handed identically to every caller — the per-request `scopeFilter` cannot retroactively narrow a cached blob. The FE admin dashboard calls exactly this (`pages/demo-dashboard-v2/dashboard-admin.api.ts:107,112`).
   - Any authenticated principal (incl. low-privilege staff) reads org-wide analytics. No institute/session/class/section narrowing whatsoever.

2. **The one scope-aware dashboard service is DEAD CODE.**
   - `service/career9/DashboardDataService.fetchForCurrentUser()` builds a per-user `AccessScope` (from `ContactPerson` rows) and runs scope-narrowed JPQL for students/institutes/counsellors/appointments/reports/assessments (`:134-397`). This is exactly the "teacher sees only their school's slice" capability. **It is injected by no controller** — verified zero callers of `fetchForCurrentUser`/`refreshForCurrentUser` anywhere outside the file. It cannot be reached by any HTTP route.

3. **Institute list — UNSCOPED.** `InstituteDetail` is **not** filter-annotated. `GET /institute-detail/get` (`findAll()`, `InstituteDetailController.java:119-122`) and `GET /get/list` (`findAllIdAndName`) return **all institutes**. A school-scoped admin sees every institute. The only barrier is the endpoint perm `institute_detail.read.all` (no scope arg) — and that's disabled in log-only anyway.

4. **`AssessmentTable` — filter present but a no-op (`1=1`).** Any list of assessments (`AssessmentTableController.getAll`) returns all assessments cross-institute. The `@Filter` annotation exists but intentionally/accidentally filters nothing.

5. **Projection / native-map endpoints bypass the entity filter.** Endpoints returning `List<Map<String,Object>>` from custom queries are not guaranteed to traverse the filtered entity:
   - `GET /student-info/getStudentAnswersWithDetails` / `POST /getBulkStudentAnswersWithDetails` query `assessmentAnswerRepository` (`AssessmentAnswer` is **not** filtered) by `userStudentId` — no scope narrowing on the answer table.
   - `GET /student-info/getStudentScores`, `exportScoresByInstitute`, `bet-report/{institute}/{assessment}` assemble maps; scope depends on whether the underlying query hits `StudentInfo` as an entity. The endpoint perm carries `#instituteId` as a scope arg, but that gate is disabled (log-only) and the projection itself isn't covered by the row filter.
   - `getAllStudentsWithMapping` (`:461`) is `student_info.read.all` and assembles maps — relies on the row filter reaching `StudentInfo`; needs runtime confirmation that the join path keeps the filter active for the map projection.

6. **Generated reports / report visibility** — `GeneratedReport` is not filter-annotated; `GeneratedReportController` by-id mutations use flat permissions (no scope arg) per `BACKEND_ENDPOINT_ISSUES.md` HIGH-F (independently consistent with my entity-filter inventory).

**Net:** Row-level scope filtering genuinely works for **`StudentInfo` queries** and partially for `UserStudent`/`Campaign`/`InstituteBranch`. It does **not** cover institutes, assessments (no-op), generated reports, assessment answers/scores projections, or — most importantly — the dashboard the product actually shows.

---

## Scenario walkthroughs

### School-scoped user (e.g. `(institute=5, session=*, class=*, section=*)`, holds `institute.read`,`student.read`,`report.read`)

What they'd actually experience **today (log-only)**:
- **Menu:** sees Institute, Student-List, Reports sections — driven purely by their permissions, not by whether `/college`,`/student-list`,`/reports-hub` are in their role's `urls[]`. If the admin curated a narrower URL list, the menu ignores it; clicking a non-whitelisted item lands on `RequestAccessPage` (route guard honors `urls`, menu doesn't).
- **Student list (`/student-info/getAll`):** correctly narrowed to institute 5 — the `StudentInfo` row filter works. This is the one place the intended "see only my data" holds.
- **Institute list (`/institute-detail/get`):** sees **all institutes**, not just institute 5 (entity not filtered). Mismatch with intent.
- **Admin dashboard:** sees the **org-wide** snapshot blob (no scope, no perm gate). Major mismatch.
- **Endpoint gate:** even calls outside institute 5 (e.g. `getByInstituteId/7`) return 200 because log-only never blocks.

When `enforce` is eventually flipped: `getByInstituteId/7` would 403 (good), `getAll` stays institute-5-narrowed (good), but the institute-list and dashboard remain unscoped (the perm gate has no scope arg / no gate at all), so the school still sees cross-tenant institutes and the org dashboard.

### Teacher-scoped user (e.g. `(institute=5, session=2026, class=12, section=*)`)

- The intended "teacher sees only their school's slice of a dashboard" is implemented in `DashboardDataService` (ContactPerson `AccessScope` JPQL) but **that service is wired to no endpoint** — so the teacher cannot reach a scoped dashboard at all. They'd hit the same unscoped `/dashboard/admin/snapshot`.
- Student queries on `StudentInfo` would narrow to institute 5 / session 2026 / class 12 (section wildcard) — correct, via the row filter — but only on the handful of endpoints that query `StudentInfo` as an entity.
- Note the two ABAC systems are disjoint: the dead `DashboardDataService` uses `ContactPerson`-derived `AccessScope`, while the live row filter and `@auth` use `user_role_scope`. Configuring a teacher's `user_role_scope` does **not** feed `DashboardDataService`, and vice-versa.

---

## Gap list — what must change to meet the intended design

**Part 1 (menu/URL):**
1. Decide the source of truth for the menu. If the requirement ("menu = role group's allowed URLs") stands, rewrite `AsideMenuMain.tsx` to derive item visibility from `currentUser.urls` (via `urlAllowed`) instead of `can('perm')`, or gate on **both** so menu and route guard agree. Today they can disagree.
2. (Optional model nicety) The "URLs bundled into a role group" is realized at the role level; document or refactor if the team wants group-level URL bundling literally.

**Part 2 (data scope) — in priority order:**
3. **Flip enforcement.** `auth.enforce-mode` is `log-only` in all profiles, so no endpoint check blocks. Soak in sandbox, fix seed gaps, then set `enforce` in production. Until then RBAC/ABAC at the endpoint layer is advisory only.
4. **Scope the dashboard the product actually serves.** Either (a) make `DashboardSnapshotController` scope-aware (cannot be a single shared cached blob — needs per-scope keys or on-the-fly narrowing) and add a `@PreAuthorize`, or (b) wire the existing `DashboardDataService.fetchForCurrentUser` to a controller endpoint and point the FE at it. Right now the scoped dashboard is dead code and the live one is unscoped + ungated.
5. **Reconcile the two ABAC systems.** `DashboardDataService` uses `ContactPerson`/`AccessScope`; everything else uses `user_role_scope`. A scope an admin sets in the new model won't affect the dashboard service. Pick one source of truth.
6. **Fix the `AssessmentTable` filter** (`condition="1=1"` → real `institute_id IN (:instituteIds) OR NULL`) or remove the annotation and scope assessments explicitly.
7. **Add row-level scoping (or explicit scope args) to `InstituteDetail`** list endpoints — a scoped user should not see all institutes.
8. **Cover projection/native-query endpoints** (`getStudentScores`, `getStudentAnswersWithDetails`, score exports, generated-report lists). The Hibernate filter only helps when the query traverses a filtered entity; map/native projections need explicit scope predicates.
9. **Add scope args to by-id mutations** (`GeneratedReport` toggle/delete, etc.) so even with `enforce` on, a permission holder can't act cross-tenant.

**Verified-good (no change needed for intent):** scope storage model (`user_role_scope`, role-assignment-scoped, wildcards); `/auth/me` URL delivery; FE/BE predicate parity (`permissions.ts` mirrors `AuthorizationService`); route-guard intersection honoring `urls[]`; `StudentInfo` 4-dim row filter; per-request DB re-hydration of perms/super-admin; the row filter running independent of enforce-mode.
