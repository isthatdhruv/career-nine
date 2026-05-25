# Roadmap: Career-Nine

## Milestones

- ✅ **v1.0 Responsive Overhaul** — Phases 1-7 (completed)
- ✅ **v2.0 Redis Assessment Upgrade** — Phases 8-12 (shipped 2026-05-11) — see [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)
- 📋 **v3.0 Hybrid RBAC + ABAC Auth Redesign** — Phases 13+ (planning)

## Phases

<details>
<summary>✅ v1.0 Responsive Overhaul (Phases 1-7) — COMPLETED</summary>

### Phase 7: Dashboard Responsive Overhaul

**Goal:** Every page accessible from the Aside menu renders without horizontal overflow on mobile (375px) and tablet (768px), with MDB tables scrolling horizontally, xl modals going fullscreen, and complex forms stacking vertically

**Plans:** 5 plans (3 waves) — see phase directory for detail.

</details>

<details>
<summary>✅ v2.0 Redis Assessment Upgrade (Phases 8-12) — SHIPPED 2026-05-11</summary>

Full archive: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)

- [x] Phase 8: Redis Infrastructure (2/2 plans) — completed 2026-03-07
- [x] Phase 9: Redis Caching Layer (2/2 plans) — completed 2026-03-07
- [x] Phase 10: Session Management (2/2 plans) — completed 2026-03-07
- [x] Phase 11: Safe Submission Pattern (2/2 plans) — completed 2026-03-07
- [x] Phase 12: Frontend Resilience (2/2 plans) — completed 2026-03-07

**Key outcomes:** Redis 7.2 on `career_shared_net` (1.5GB cap, graceful degradation); RedisCacheManager + cache warming; server-side assessment sessions with `X-Assessment-Session` header validation; idempotent submission via Redis `SET NX`; save-before-delete pattern; assessmentApi axios module with retry + session-token capture; submission state machine.

</details>

---

### 📋 v3.0 Hybrid RBAC + ABAC Auth Redesign (Planning)

**Milestone goal:** Replace the current "URL-pattern authority" model with a hybrid system where **roles grant verbs** (RBAC) and **attributes — `institute`, `session`, `class`, `section` — grant resource scope** (ABAC). Close the critical security gaps documented in [docs/AUTH_REDESIGN_PLAN.md](../docs/AUTH_REDESIGN_PLAN.md) (mass `permitAll`, hardcoded JWT secret across all profiles, no method-level auth, JWT in `localStorage`, no refresh/logout/revocation). Out of scope: OAuth code paths.

Phases (numbering continues from v2.0 — never restarts). Active phase has full detail; future phases are summarised and will be expanded via `/gsd:plan-phase` when reached.

### Phase 13: Critical Security Fixes

**Goal:** Close the audit-blocking auth findings that can ship without any data-model change — externalize and rotate secrets so dev/staging/prod no longer share a JWT signing key; cut the `SecurityConfig.permitAll()` whitelist down to *only* truly public endpoints; enforce Razorpay webhook signature in every profile; tighten `HttpFirewall` and CORS. Outcome: most "admin" endpoints stop being anonymously reachable; the most damaging single-credential blast-radius issues are eliminated. No new tables, no new auth claims, no frontend changes required to ship.

**Depends on:** Nothing (first phase of v3.0 — fully self-contained; runs before any ABAC work).

**Requirements:** SEC-01 (per-environment secrets), SEC-02 (no anonymous admin endpoints), SEC-03 (webhook signature enforced), SEC-04 (HTTP firewall hardened), SEC-05 (CORS tightened).

**Success Criteria** (what must be TRUE):
1. JWT signing secret, MySQL passwords, and Razorpay webhook secret are read from environment variables, not committed values; dev/staging/sandbox/prod each have a distinct secret.
2. `application.yml` contains no plaintext production credentials (placeholder env-var references only) and the rotated production secrets are stored outside the repo.
3. The `SecurityConfig.permitAll()` whitelist contains only `/auth/login`, `/auth/signup`, `/auth/refresh`, `/oauth2/**`, `/payment/webhook/**`, `/campaign/public/**`, `/assessment-mapping/public/**`, `/school-registration/public/**`, `/util/file-get/**`, OPTIONS, and static assets — every other path is `authenticated()`.
4. Razorpay webhook with a missing or invalid signature returns 401 in dev, sandbox, staging, and production (no profile silently accepts unsigned webhooks).
5. `HttpFirewall` rejects requests using semicolons, URL-encoded double slashes, or non-standard HTTP methods.
6. CORS `allowedHeaders` is an explicit list (no `*`); the production profile's allowed origins contain no `localhost` entries.
7. A curl against `GET /student-info/getByInstituteId/9999` without an `Authorization` header returns 401 (was 200 before).

**Out of scope for Phase 13:**
- OAuth code paths (handler, redirect URI validator, OAuth-token storage) — deferred per project scope.
- Method-level `@PreAuthorize` (Phase 15).
- Frontend changes (cookies, CSRF, drop `localStorage`) — Phase 16.
- New permission/scope tables — Phase 14.

**Critical files in play:** [SecurityConfig.java](../spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java) (filter chain, permitAll list, CORS, HttpFirewall), [application.yml](../spring-social/src/main/resources/application.yml) (secrets and per-profile config), [RazorpayService.java](../spring-social/src/main/java/com/kccitm/api/service/RazorpayService.java) + [PaymentWebhookController.java](../spring-social/src/main/java/com/kccitm/api/controller/PaymentWebhookController.java) (webhook signature path), [docker-compose.yml](../docker-compose.yml) (env-var passthrough).

### Phase 14: ABAC Data Foundation

**Goal:** Create the persistent data substrate the rest of v3.0 builds on. New tables (`permission`, `role_permission`, `user_scope`, `refresh_token`, `auth_audit`); schema additions on `student_info` so 4-dimension ABAC enforcement is actually possible (`session_id`, `course_code` FKs); seed the permission catalog from a Java enum so backend code can reference permissions symbolically; backfill existing users with `user_scope` rows derived from their current institute mapping and existing students with `session_id` set to the institute's currently-active session (fail-closed on unresolved rows). No authorization enforcement yet — that's Phase 15.

**Depends on:** Phase 13 (Phase 13's `permitAll` prune happens before any auth-data changes; no functional coupling).

**Requirements:** DATA-01 (permission catalog), DATA-02 (role↔permission mapping), DATA-03 (user_scope table), DATA-04 (refresh-token store), DATA-05 (auth-audit table), DATA-06 (student_info FKs for session/class).

**Success Criteria:**
1. New tables exist on the dev database after Phase 14 ships: `permission`, `role_permission`, `user_scope`, `refresh_token`, `auth_audit` with the column types and FKs specified in [docs/AUTH_REDESIGN_PLAN.md §4](../docs/AUTH_REDESIGN_PLAN.md).
2. `permission` is seeded from a `PermissionCode` Java enum (single source of truth) covering at minimum: `institute.read/write/delete`, `session.read/write`, `class.read/write`, `section.read/write`, `student.read/write/import_bulk`, `assessment.read/create/publish/delete`, `campaign.read/write/publish`, `report.read/export`, `user.read/write/toggle_active`, `payment.refund`, `payment.webhook.handle`, `role.assign`, `permission.grant`.
3. `student_info` has new columns `session_id` (FK to `institute_session.session_id`) and `course_code` (FK to `institute_courses.course_code`), plus a composite index on `(institute_id, session_id, course_code, school_section_id)`.
4. Backfill migration sets `student_info.session_id` to each row's institute's currently-active `InstituteSession` where resolvable; rows that cannot be resolved (no institute, no active session) remain NULL and are flagged in a one-time report.
5. Seed `role_permission` rows mapping each existing `Role.name` to a sensible permission bundle (product-reviewed list before merge).
6. `Hibernate ddl-auto` setting changes from `update` to `validate` in staging/production profiles after Phase 14 migrations land.
7. `auth_audit` is writable but not yet written to (instrumentation lands in Phase 15).
8. Inconsistent ORM mappings fixed: `UserRoleGroupMapping.user` becomes `@ManyToOne User`; `RoleRoleGroupMapping.roleGroup` becomes `@ManyToOne RoleGroup`.

**Out of scope:**
- Any `@PreAuthorize`, JWT-claim change, AuthorizationService — Phase 15.
- Frontend — Phases 16/17.
- Backfilling per-staff `user_scope` rows for institute-admin/teacher staff (no clean upstream source today — product/ops provides this list before Phase 15 enforces).

**Critical files:**
- New: `model/Permission.java`, `model/UserScope.java`, `model/RefreshToken.java`, `model/AuthAudit.java`, `security/PermissionCode.java` (enum), plus repositories for each.
- Existing: [StudentInfo.java](../spring-social/src/main/java/com/kccitm/api/model/career9/StudentInfo.java) (add `sessionId`, `courseCode`); [UserRoleGroupMapping.java](../spring-social/src/main/java/com/kccitm/api/model/UserRoleGroupMapping.java) (fix `user` mapping); [RoleRoleGroupMapping.java](../spring-social/src/main/java/com/kccitm/api/model/RoleRoleGroupMapping.java) (fix `roleGroup` mapping); `application.yml` (`ddl-auto` change).
- New migration files (Flyway/Liquibase adoption recommended — `ddl-auto: update` is too risky for FK additions).

### Phase 15: Backend Authorization Layer

**Goal:** Activate hybrid RBAC + ABAC enforcement on the backend. Centralized `AuthorizationService` evaluates "role grants the verb AND target resource is within the caller's scope". JWT claims redesigned to carry `roles`, `perms`, `scopes`, `sa` (super-admin flag), `jti` (for future revocation). Every `@*Mapping`-annotated controller method gets a `@PreAuthorize` checking `@auth.allows(permission, instituteId, sessionId, courseCode, sectionId)`. A build-time check (ArchUnit or Checkstyle) fails CI if any endpoint is missing the annotation. Hibernate `@Filter` named `scopeFilter` auto-injects `WHERE` clauses on scope-aware entities. **Ships in log-only mode** — the evaluator records DENY decisions to `auth_audit` and returns true; we flip to enforcing in Phase 17 after frontend changes land.

**Depends on:** Phase 14 (tables, claims, scope columns).

**Requirements:** AUTH-01 (centralized evaluator), AUTH-02 (claim redesign), AUTH-03 (annotated controllers), AUTH-04 (lint gate), AUTH-05 (scope-aware Hibernate filter), AUTH-06 (log-only mode + audit writes).

**Success Criteria:**
1. `AuthorizationService` exposes `@auth.allows(permission, instituteId, sessionId, courseCode, sectionId)` as a Spring SpEL bean callable from `@PreAuthorize`.
2. `TokenProvider` emits the new claim shape (`roles[]`, `perms[]`, `scopes[]` with shortened keys `i/s/c/x`, `sa` bool, `jti`); `TokenAuthenticationFilter` populates `UserPrincipal` with the parsed claims.
3. Every `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@RequestMapping` method (controllers in `controller/`) carries a `@PreAuthorize` annotation.
4. A build-time ArchUnit test fails if any controller method is missing `@PreAuthorize`.
5. A Hibernate `@Filter` named `scopeFilter` is defined on `StudentInfo`, `UserStudent`, `AssessmentTable`, `Campaign`, `InstituteBranch`, `Section`, and is enabled via a `@PostAuthenticate` hook so every JPA query auto-filters by the caller's scope.
6. The evaluator runs in **log-only mode**: every DENY decision writes a row to `auth_audit` with `(user_id, permission, scope, resource_id, request_id, reason)`; the actual return is `true` so traffic continues. A profile flag `auth.enforce-mode: log-only|enforce` controls this.
7. `auth_audit` is collecting writes within 24h of deploy with no false-positive DENYs against legitimate admin traffic (validated by reviewing the audit stream).
8. Eager-fetch on `User.userRoleGroupMappings` is changed to `FetchType.LAZY` to keep the new permission-resolution path performant.

**Out of scope:**
- Flipping log-only → enforce (Phase 17 — after frontend is permission-aware).
- Rate limiting, audit reads, sensitive-op-specific writes (Phase 20).

**Critical files:**
- New: `security/AuthorizationService.java`, `security/UserScopeRepository.java`, `security/AuthAuditService.java`, `security/CurrentScopes.java` (annotation); ArchUnit test class.
- Modified: [TokenProvider.java](../spring-social/src/main/java/com/kccitm/api/security/TokenProvider.java) (claim shape), [TokenAuthenticationFilter.java](../spring-social/src/main/java/com/kccitm/api/security/TokenAuthenticationFilter.java) (parse new claims), every file in `controller/` (add `@PreAuthorize`), [User.java](../spring-social/src/main/java/com/kccitm/api/model/User.java) (`FetchType.LAZY`), entity files where `@Filter` lands.

### Phase 16: Cookie-Based Session (Frontend)

**Goal:** Replace the `localStorage` JWT model with HttpOnly cookies + a CSRF token. Backend sets `cn_at` (access token, `HttpOnly; Secure; SameSite=Strict; Path=/`) and `cn_csrf` (CSRF token, non-HttpOnly, read by JS) on `/auth/login`. The admin React app stops touching tokens; the global axios interceptor only copies `cn_csrf` into `X-CSRF-Token` header on state-changing requests. `AuthHelpers.ts` localStorage code path deleted. Backend continues to accept the legacy `Authorization: Bearer` header for the v2.0 assessment-app and any external scripts — backwards-compatible until Phase 19's persona unification.

**Depends on:** Phase 13 (CORS already tightened so credentials cross-origin works correctly).

**Requirements:** SESS-FE-01 (cookies issued on login), SESS-FE-02 (CSRF token + header), SESS-FE-03 (localStorage JWT removed from frontend), SESS-FE-04 (Bearer header backwards-compat retained).

**Success Criteria:**
1. `POST /auth/login` response sets `cn_at` cookie with `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600` and `cn_csrf` cookie with `Secure; SameSite=Strict; Path=/` (NOT HttpOnly — JS reads it).
2. Backend filter accepts either the `cn_at` cookie OR the `Authorization: Bearer` header as the source of the JWT, preferring cookie. (Backwards-compat for assessment app + external scripts.)
3. CSRF filter validates `X-CSRF-Token` header against `cn_csrf` cookie on all non-GET/non-HEAD/non-OPTIONS state-changing requests; mismatched returns 403.
4. `react-social` global axios interceptor in [AuthHelpers.ts:50-100](../react-social/src/app/modules/auth/core/AuthHelpers.ts#L50-L100) no longer reads `localStorage["kt-auth-react-v"]`; only copies CSRF cookie → header.
5. `localStorage["kt-auth-react-v"]` is never written by `react-social` after Phase 16 ships. (Smoke: log in, check DevTools → Application → Local Storage shows no kt-auth-react-v key.)
6. `Auth.tsx`'s `AuthInit` calls `GET /auth/me` (cookie sent automatically) to bootstrap user state; no manual token extraction.
7. Logout calls `POST /auth/logout` (preview — full endpoint lands in Phase 18) and the server clears both cookies (`Max-Age=0`).

**Out of scope:**
- Refresh-token logic — Phase 18.
- Permission-driven UI components (`<Can>`, `useAuth().can()`) — Phase 17.
- Student-portal / counsellor-portal / assessment-app unification — Phase 19.
- Backend `@auth.allows` flipping from log-only to enforce — Phase 17.

**Critical files:**
- Backend: [SecurityConfig.java](../spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java) (add `CookieCsrfTokenRepository.withHttpOnlyFalse()`), [AuthController.java](../spring-social/src/main/java/com/kccitm/api/controller/AuthController.java) (set cookies on login response), [TokenAuthenticationFilter.java](../spring-social/src/main/java/com/kccitm/api/security/TokenAuthenticationFilter.java) (read cookie first, fallback to header).
- Frontend: [AuthHelpers.ts](../react-social/src/app/modules/auth/core/AuthHelpers.ts) (interceptor simplification), [Auth.tsx](../react-social/src/app/modules/auth/core/Auth.tsx) (drop saveAuth/getAuth from localStorage path), [authRedirectPage.tsx](../react-social/src/app/modules/auth/authRedirectPage.tsx) (no token in URL — OAuth changes deferred but cookie path needs to coexist).

### Phase 17: Permission-Aware UI + Backend Flip-to-Enforce

**Goal:** Add a permission/scope model on the React client and switch the backend authorization layer from log-only to enforcing. Frontend exposes `useAuth().can(perm, scope?)`, `<Can perm="…" scope={…}>` wrapper, `<RequirePermission perm="…">` route guard. `AsideMenuMain.tsx` menu items become permission-driven. After 1-2 days of monitoring the `auth_audit` table with zero false-positive DENYs against legitimate admin traffic, flip `auth.enforce-mode: enforce` and remove the log-only short-circuit.

**Depends on:** Phase 15 (backend log-only enforcer) + Phase 16 (cookie session — drives the new `/auth/me` response shape).

**Requirements:** PERM-UI-01 (can() hook), PERM-UI-02 (<Can> + <RequirePermission>), PERM-UI-03 (menu driven by permissions), PERM-UI-04 (backend enforce-mode flipped).

**Success Criteria:**
1. `User` type on frontend has `roles: string[]`, `permissions: string[]`, `scopes: Array<{i?: number; s?: number; c?: number; x?: number}>`, `superAdmin: boolean` — replaces `authorityUrls: string[]`.
2. `useAuth().can(permission, scope?)` predicate exists and mirrors the backend `AuthorizationService.allows()` logic exactly (same wildcard rule, same super-admin bypass).
3. `<Can perm="…" scope={…}>` component renders children iff `can()` returns true.
4. `<RequirePermission perm="…">` route wrapper replaces the URL-pattern-based guard in [PrivateRoutes.tsx:78-127](../react-social/src/app/routing/PrivateRoutes.tsx#L78-L127).
5. [AsideMenuMain.tsx](../react-social/src/_metronic/layout/components/aside/AsideMenuMain.tsx) menu items are wrapped in `<Can perm="…">`; the `allowed("/path")` helper is removed.
6. `auth.enforce-mode: enforce` is set in production; backend authorization layer now returns 403 (instead of logging + allowing) on DENY decisions.
7. After enforce flip, the `auth_audit` DENY stream is monitored for 1 week; any legitimate-user DENYs that surface within that window are root-caused (typically a missing scope grant for a real teacher) and the role/scope tables corrected — not the code.
8. `<RequirePermission>` shows a "Request access" message with a `mailto:` or in-app form when denied, not a bare 401 page.

**Out of scope:**
- Refresh tokens / silent refresh — Phase 18.
- Other personas (student, counsellor, assessment) — Phase 19.

**Critical files:**
- Frontend: [Auth.tsx](../react-social/src/app/modules/auth/core/Auth.tsx) (`can()`, new context shape), [_models.ts](../react-social/src/app/modules/auth/core/_models.ts) (User type), [PrivateRoutes.tsx](../react-social/src/app/routing/PrivateRoutes.tsx), [AsideMenuMain.tsx](../react-social/src/_metronic/layout/components/aside/AsideMenuMain.tsx); new components `<Can>`, `<RequirePermission>`, `useScope()`.
- Backend: `application.yml` (`auth.enforce-mode` flip), [AuthorizationService](../spring-social/src/main/java/com/kccitm/api/security/AuthorizationService.java) (remove log-only short-circuit).

### Phase 18: Token Lifecycle

**Goal:** Replace the 10-day single-token model with a 60-minute access token + 7-day refresh token, both server-revocable. Add `/auth/refresh`, `/auth/logout`, `/auth/me`. Implement `jti`-based deny list (Caffeine cache, 1h TTL = access-token lifetime) for emergency revocation without the per-request DB-hit penalty of fully stateful tokens. Refresh-token rotation on every use (chained `replaced_by` link) for stricter compromise detection.

**Depends on:** Phase 14 (`refresh_token` table) + Phase 16 (cookie session).

**Requirements:** LIFE-01 (60min access TTL), LIFE-02 (refresh token + table + rotation), LIFE-03 (auth/refresh + auth/logout endpoints), LIFE-04 (auth/me endpoint), LIFE-05 (jti deny list), LIFE-06 (silent refresh on FE).

**Success Criteria:**
1. Access token TTL is 60 minutes; refresh token TTL is 7 days. Both configurable per profile.
2. `POST /auth/refresh` accepts the `cn_rt` cookie, returns new `cn_at` + `cn_rt` cookies, rotates the refresh token (the old `refresh_token` row gets `replaced_by` set to the new `jti`).
3. `POST /auth/logout` revokes the current refresh token chain (sets `revoked_at`) and clears both cookies; subsequent `/auth/refresh` with the revoked token returns 401.
4. `GET /auth/me` returns `{id, name, email, roles, permissions, scopes, superAdmin}` derived from the active JWT.
5. `jti` deny list (Caffeine cache, 1h TTL) holds revoked-but-not-yet-expired access tokens; the `TokenAuthenticationFilter` consults it on every request; cache miss is the common path (no DB hit).
6. Frontend axios response interceptor: on 401, calls `/auth/refresh` silently → retries the original request once → if still 401, redirects to login.
7. Concurrent-refresh-from-same-tab race is handled (only one outstanding refresh request, others await its result).

**Out of scope:**
- Mobile/native refresh flows (browser web only for now).
- Per-device session list / "log out from all devices" UI (Phase 20 or later).

**Critical files:**
- Backend: [TokenProvider.java](../spring-social/src/main/java/com/kccitm/api/security/TokenProvider.java) (access vs refresh), new `RefreshTokenService.java`, [AuthController.java](../spring-social/src/main/java/com/kccitm/api/controller/AuthController.java) (3 new endpoints), `TokenAuthenticationFilter.java` (deny-list lookup).
- Frontend: [AuthHelpers.ts](../react-social/src/app/modules/auth/core/AuthHelpers.ts) response interceptor (silent refresh + retry-once), [Auth.tsx](../react-social/src/app/modules/auth/core/Auth.tsx) (`/auth/me` bootstrap, logout call).

### Phase 19: Persona Unification + UX

**Goal:** Collapse the four parallel auth flows (admin, student portal, counsellor portal, assessment app) onto the same cookie-session model. Each persona becomes a normal user with role(s) and scope(s) — no more `localStorage["studentPortalLoggedIn"]` booleans, no more `localStorage["counsellorPortalUser"]` JSON, no more `sessionStorage["assessmentSessionToken"]` with `X-Assessment-*` custom headers. The assessment app still gets a short-lived assessment-bound JWT (per the deferred §9 plan from [docs/AUTH_REDESIGN_PLAN.md](../docs/AUTH_REDESIGN_PLAN.md)) but it's now part of the unified `/auth/*` flow. UX polish: silent-refresh-and-retry on 401, permission-denied page with a "Request access" CTA, no more bare error toasts.

**Depends on:** Phase 16 (cookies), Phase 17 (permission UI), Phase 18 (refresh tokens).

**Requirements:** UNIFY-01 (student portal on cookie session), UNIFY-02 (counsellor portal on cookie session), UNIFY-03 (assessment-app session strategy from §9 spec), UNIFY-04 (UX polish for 401/403).

**Success Criteria:**
1. `localStorage["studentPortalLoggedIn"]` is no longer written anywhere in `react-social`. Student portal authentication is a normal cookie session with role `STUDENT` (or `B2C_STUDENT`).
2. `localStorage["counsellorPortalUser"]` is removed. Counsellor portal authentication is a normal cookie session with role `COUNSELLOR`.
3. The `career-nine-assessment` app receives a short-lived (4h TTL) assessment-bound JWT in HttpOnly cookie scoped to `/assessments/**`, `/assessment-answer/**`, `/student-demographics/**`. The `X-Assessment-Session`/`X-Assessment-Student-Id`/`X-Assessment-Id` header model from v2.0 is replaced (backend remains backwards-compatible for one release).
4. All four personas share the same `AuthHelpers.ts` axios setup; no more `assessmentApi.ts`-style separate axios instances.
5. Silent-refresh-and-retry-once works for all four personas.
6. The permission-denied page (from Phase 17) renders for all four personas with a persona-appropriate "Request access" CTA.

**Out of scope:**
- Brand-new auth UX (sign-in modal, forgot-password redesign) — only the existing flows are migrated.

**Critical files:**
- Frontend: [StudentRoutes.tsx](../react-social/src/app/routing/StudentRoutes.tsx), [CounsellorRoutes.tsx](../react-social/src/app/routing/CounsellorRoutes.tsx), [assessmentApi.ts](../react-social/src/app/pages/StudentLogin/API/assessmentApi.ts), `career-nine-assessment/src/lib/http.ts`.
- Backend: New endpoint `/auth/assessment-session` (issues short-lived assessment-bound JWT); `TokenAuthenticationFilter` accepts the assessment-scoped cookie alongside the admin cookie; `AssessmentSessionInterceptor` (the v2.0 Redis session interceptor) treats the JWT as the source of identity, validates against the Redis assessment session.

### Phase 20: Hardening

**Goal:** Final defense-in-depth pass. Rate limiting on `/auth/login`, `/auth/refresh`, `/auth/signup`, `/student/save-csv`, `/user/getbyid/*`. Audit-log writes on sensitive operations (`role.assign`, `user.write`, `payment.refund`, `permission.grant`) — not just DENYs. Security response headers: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff. CORS allowed-origins pruned in production (drop dev/staging leftovers). Spring Actuator endpoints locked down to `ADMIN`-only.

**Depends on:** Phase 15 (audit infra), Phase 18 (auth lifecycle endpoints exist as targets).

**Requirements:** HARDEN-01 (rate limit auth endpoints), HARDEN-02 (rate limit bulk endpoints), HARDEN-03 (audit on sensitive ops), HARDEN-04 (security headers), HARDEN-05 (Actuator authenticated).

**Success Criteria:**
1. 11th `POST /auth/login` from the same IP within 60 seconds returns 429.
2. 11th `POST /auth/refresh` from the same IP within 60 seconds returns 429.
3. Bulk endpoints (`/student/save-csv`, `/user/getbyid/*`, `/student-info/getStudentsWithMappingByInstituteId/*`) rate-limited per user (50/min).
4. `auth_audit` has rows for every sensitive operation (ALLOW + DENY); the operation list is enumerated in code, not hardcoded scattered.
5. Response headers on every authenticated response include `Content-Security-Policy`, `Strict-Transport-Security` (production only), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
6. Production CORS allowed-origins contain only `https://career-9.com`, `https://www.career-9.com`, `https://dashboard.career-9.com`, `https://assessment.career-9.com`, `https://*.career-9.com`. All localhost, dev-preview, and `walrus-app-e2a6a.ondigitalocean.app` entries removed.
7. Spring Actuator endpoints require `SUPER_ADMIN` or `INFRA_ADMIN` role.

**Out of scope:**
- Spring Boot framework upgrade (separate effort).
- Web application firewall / Cloudflare config.
- Penetration test remediation (separate effort post-v3.0).

**Critical files:**
- Backend: `security/RateLimitFilter.java` (new), `security/SensitiveOpAuditAspect.java` (new — AOP on sensitive service methods), [SecurityConfig.java](../spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java) (security headers, Actuator lockdown), `application.yml` (production CORS prune).
- Tech: Bucket4j for rate limiting (in-process, no Redis needed for current scale).

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 8. Redis Infrastructure | v2.0 | 2/2 | ✓ Complete | 2026-03-07 |
| 9. Redis Caching Layer | v2.0 | 2/2 | ✓ Complete | 2026-03-07 |
| 10. Session Management | v2.0 | 2/2 | ✓ Complete | 2026-03-07 |
| 11. Safe Submission Pattern | v2.0 | 2/2 | ✓ Complete | 2026-03-07 |
| 12. Frontend Resilience | v2.0 | 2/2 | ✓ Complete | 2026-03-07 |
| 13. Critical Security Fixes | v3.0 | 3/3 | ✓ Executed (pending user commit) | 2026-05-11 |
| 14. ABAC Data Foundation | v3.0 | 4/4 | ✓ Executed (pending user commit + data reconciliation) | 2026-05-11 |
| 15. Backend Authorization Layer | v3.0 | 6/6 | ✓ Executed (log-only; ArchUnit gate active) | 2026-05-11 |
| 16. Cookie-Based Session (FE) | v3.0 | 4/4 | ✓ Executed (cookie auth live end-to-end) | 2026-05-11 |
| 17. Permission-Aware UI | v3.0 | 4/4 | ✓ Executed (staging=enforce; prod=log-only awaiting user) | 2026-05-11 |
| 18. Token Lifecycle | v3.0 | 4/4 | ✓ Executed (60m access + 7d refresh + jti deny list + silent refresh) | 2026-05-11 |
| 19. Persona Unification + UX | v3.0 | 5/5 | ✓ Executed (4 personas on cookie session; permission-denied UX) | 2026-05-11 |
| 20. Hardening | v3.0 | 4/4 | ✓ Executed (rate-limit, audit, security headers, CORS prune, Actuator lockdown) | 2026-05-11 |

---

*Last updated: 2026-05-11 — v2.0 archived, v3.0 Auth Redesign opened*
