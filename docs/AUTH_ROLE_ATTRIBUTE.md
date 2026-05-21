# Career-Nine — Authentication, Role-Based & Attribute-Based Access Control

> **Scope of this document:** the hybrid **RBAC + ABAC** authorization subsystem as it
> *actually exists in code* on branch `attribute-based-auth`. It covers authentication
> (login / OAuth2 / refresh / assessment-session JWT), the role→permission catalog, the
> 4-dimension attribute (scope) model, every backend enforcement point, and the matching
> frontend gating layer.
>
> The design intent lives in [`docs/AUTH_REDESIGN_PLAN.md`](./AUTH_REDESIGN_PLAN.md). That
> plan was written *before* implementation; where the shipped code diverges from the plan
> (it does, in several important places) this document describes the **code**, not the plan.

---

## 1. Overview & Architecture

Career-Nine uses a **hybrid model**:

- **RBAC (roles → permissions)** decides *what verbs* a caller may use
  (e.g. `student.read`, `report.export`).
- **ABAC (scopes / attributes)** decides *which resources* a caller may touch, across four
  nested dimensions: **institute ⊇ session ⊇ class (course) ⊇ section**.

A check passes only when **both** halves agree: the caller holds the permission verb **and**
the targeted resource falls inside one of the caller's scope grants. A `superAdmin` flag
short-circuits both halves.

The single authorization primitive is the Spring bean `@auth`
(`AuthorizationService`), invoked from `@PreAuthorize` SpEL on **713 controller methods
across 101 controllers**.

```
                          ┌──────────────────────────────────────────────────────────┐
                          │                    Spring Boot API                        │
 Browser / SPA            │                                                           │
 ──────────────           │  SecurityConfig filter chain (SecurityConfig.java):       │
  cn_at  (HttpOnly JWT) ──┼─▶ RateLimitFilter(PER_IP)                                 │
  cn_rt  (HttpOnly,      │     │                                                       │
         /auth/refresh)  │     ▼                                                       │
  cn_csrf(JS-readable) ──┼─▶ TokenAuthenticationFilter                                │
  X-CSRF-Token header    │     │   • cookie-first JWT extraction (cn_at_asmnt|cn_at)   │
                         │     │   • validateToken() signature+expiry                  │
                         │     │   • JtiDenyListService.isRevoked(jti)  → 401 if true  │
                         │     │   • assessment-scope route guard                      │
                         │     │   • parseClaims() → loadUserById() (DB perms)         │
                         │     │   • populates SecurityContext w/ UserPrincipal        │
                         │     ▼                                                       │
                         │   RateLimitFilter(PER_USER)                                 │
                         │     │                                                       │
                         │     ▼                                                       │
                         │   @PreAuthorize("@auth.allows('student.read',#i,#s,#c,#x)") │
                         │     │            (AuthorizationService.decide)              │
                         │     │   RBAC: principal.permissions.contains(perm)          │
                         │     │   ABAC: CurrentScopes.anyMatch(i,s,c,x)               │
                         │     ▼                                                       │
                         │   Controller method                                        │
                         │     │                                                       │
                         │   ScopeFilterInterceptor (HandlerInterceptor)              │
                         │     │   enables Hibernate @Filter "scopeFilter" so          │
                         │     │   StudentInfo queries auto-WHERE by scope             │
                         │     ▼                                                       │
                         │   AuthAuditService.recordDeny(...) on every DENY            │
                         └──────────────────────────────────────────────────────────┘

 Frontend (react-social):
   login → server sets cn_at (HttpOnly) + cn_rt + cn_csrf cookies; body also returns JWT (legacy)
   on load → GET /auth/me → User { roles[], permissions[], scopes[], urls[], superAdmin }
   useAuth().can(perm, scope)  mirrors AuthorizationService.allows() exactly (permissions.ts)
   <Can perm=…>            guards UI elements
   <RequirePermission perm=…> guards routes (perm gate ∩ url whitelist)
   AsideMenuMain            menu items derive from can(…)
   401 → axios interceptor → silent POST /auth/refresh → retry once → else redirect /login
```

### 1.1 Two distinct scope subsystems exist

There are **two independent ABAC implementations** in the codebase. Do not confuse them:

| System | Source of truth | Used by | Files |
|---|---|---|---|
| **Primary (JWT/role-scope)** | `user_role_scope` table → `UserRoleScope` | `@auth.allows(...)` on all controllers; `ScopeFilterInterceptor`; frontend `can()` | `AuthorizationService`, `CurrentScopes`, `UserRoleScope`, `UserRoleScopeRepository` |
| **Secondary (ContactPerson access-level)** | `ContactPerson` + `ContactPersonAccessLevel` rows | only `InstituteDetailController` + `DashboardDataService` for query-result filtering | `security/access/AccessScope`, `AccessScopeService`, `AccessScopeJpqlBuilder` |

The **primary** system is the one the `attribute-based-auth` feature is about and is the focus
of this document. The **secondary** `access/*` package is a parallel, narrower mechanism that
builds a per-user `AccessScope` from `ContactPerson` mappings and is consumed by only two
callers; it is documented in §6.4 for completeness.

---

## 2. Authentication Flows

### 2.1 Local username/password login — `POST /auth/login`

`AuthController.authenticateUser` — `AuthController.java:90-140`.

1. Look up `User` by email + `AuthProvider.local` (`AuthController.java:93`).
2. Reject if user missing or `isActive` is null/false (`AuthController.java:94-101`) — note
   signup creates users inactive (see §9, bug A19).
3. `authenticationManager.authenticate(...)` runs `CustomUserDetailsService.loadUserByUsername`
   + `BCryptPasswordEncoder` (`SecurityConfig.java:166-176`).
4. Mint a **short-lived access JWT** via `tokenProvider.createAccessToken(authentication)`
   (`AuthController.java:126`) — carries the Phase-15 claim shape.
5. Issue an **opaque refresh token** (UUID v4) via `refreshTokenService.issue(...)`,
   persisted in `refresh_token` (`AuthController.java:130`).
6. Set cookies: `authCookieService.issueAuthCookies(response, accessJwt)` (cn_at + cn_csrf)
   and `setRefreshToken(response, refreshJti)` (cn_rt) — `AuthController.java:136-137`.
7. Body also returns the JWT (`AuthResponse`) for legacy/Bearer callers — `AuthController.java:139`.

### 2.2 OAuth2 login (Google / GitHub / Facebook)

- `SecurityConfig.java:342-354` wires `oauth2Login()`: authorization endpoint `/oauth2/authorize`,
  redirect endpoint `/oauth2/callback/*`, user service `CustomOAuth2UserService`, success/failure
  handlers.
- `CustomOAuth2UserService` resolves provider user info (`security/oauth2/user/*`) and hydrates
  a `UserPrincipal` (same `CustomUserDetailsService.hydrate` path so perms/scopes/superAdmin are
  populated — `CustomUserDetailsService.java:83`).
- The success handler historically returns the JWT in the **redirect URL query string**
  (`/oauth2/redirect?token=<jwt>`) — flagged as bug D1; OAuth code paths were explicitly out of
  scope of the redesign.
- **URL-token → cookie bridge:** `POST /auth/oauth-exchange` (`AuthController.java:382-393`).
  The SPA extracts `?token=` from the URL, POSTs it here; the server re-validates the JWT and
  issues the standard `cn_at` + `cn_csrf` cookies. CSRF-exempt and permitAll (auth established
  by the body token itself).

### 2.3 Token refresh — `POST /auth/refresh`

`AuthController.refresh` — `AuthController.java:192-239`.

- Read `cn_rt` cookie; if absent → clear cookies, 401.
- `refreshTokenService.validate(oldJti)` + `getUserIdForJti(oldJti)`.
- **Rotate-on-use:** `refreshTokenService.rotate(oldJti, ua, ip)` issues a new jti and marks the
  old row `replaced_by`. A `RefreshTokenReuseException` (replay/race) → clear cookies, 401
  (`AuthController.java:217-223`).
- Rebuild a `UserPrincipal`, mint a fresh access JWT, rewrite `cn_at` + `cn_rt`. Returns 204.
- CSRF-exempt + permitAll (`SecurityConfig.java:249,303`).

### 2.4 Logout — `POST /auth/logout`

`AuthController.logout` — `AuthController.java:157-171`. Best-effort, always 204:

1. Revoke the access-token `jti` via `JtiDenyListService.revoke` (in-memory Caffeine deny list).
2. Revoke the refresh-token row via `RefreshTokenService.revoke`.
3. Clear all cookies (`cn_at`, `cn_csrf`, `cn_rt`).

### 2.5 Identity bootstrap — `GET /auth/me`

`AuthController.me` — `AuthController.java:253-307`. Single source of truth for the frontend.
Returns `MeResponse` (`payload/MeResponse.java`): `id, name, email, roles[], permissions[],
scopes[{i,s,c,x}], urls[], superAdmin`. The `urls[]` come from `roleUrlRepository.findPathsForUser`
(`AuthController.java:290`) — the per-role route whitelist used by the FE route guard.

### 2.6 Assessment-session JWT (student assessment app) — `POST /auth/assessment-session`

`AssessmentSessionController` — `AssessmentSessionController.java:150`. Distinct, narrow auth for
the anonymous student assessment SPA:

- `TokenProvider.createAssessmentSessionToken(userStudentId, assessmentId)` mints a 4-hour JWT
  with claims `sub=userStudentId`, `aid=assessmentId`, `scope="assessment"`, `jti`
  (`TokenProvider.java:224-236`).
- Stored as the `cn_at_asmnt` cookie (`AuthCookieService.ASSESSMENT_SESSION_COOKIE` =
  `cn_at_asmnt`, `AuthCookieService.java:60`).
- The endpoint is permitAll + CSRF-exempt (`SecurityConfig.java:253,307`); the gate is body
  params + enrolment + feature-flag DB checks, not Spring auth.
- **Route-vs-scope coupling** (`TokenAuthenticationFilter.java:104-140`): an `assessment`-scoped
  token is REJECTED on any URI not starting with one of `ASSESSMENT_SCOPE_PATHS`
  (`/assessments/`, `/assessment-answer/`, `/student-demographics/`, `/assessment-proctoring/`,
  `/student-info/` — `TokenAuthenticationFilter.java:69-74`). On allow-listed paths it surfaces
  `userStudentId` / `assessmentId` as request attributes and sets a *minimal* `Authentication`
  (no `UserPrincipal`, empty authorities) so `.anyRequest().authenticated()` passes. These flows
  are ABAC-checked at the service layer via `StudentAssessmentMapping`, not via `@auth`.

> **On "magic link login"** (recent commit `1aa6ceeb`): the magic links are B2C entitlement
> links built by `service/b2c/LinkBuilder.java` (e.g. `onePager`, `dashboard`, `assessmentStart`)
> — opaque `?t=<accessToken>&e=<entitlementId>` tokens validated server-side against the
> entitlement record. They are **not** part of the RBAC/ABAC role system; they grant a single
> B2C student access to their own report/dashboard. They are mentioned here only to disambiguate.

---

## 3. JWT Claims & Token Provider

`TokenProvider.java`. Signed **HS512** with `app.auth.tokenSecret` (≥64 bytes enforced at boot —
`TokenProvider.java:79-93`).

### 3.1 Access-token claim shape (`buildJwt`, `TokenProvider.java:148-191`)

```jsonc
{
  "sub":   "42",                       // user id
  "jti":   "uuid",                     // for revocation (JtiDenyListService)
  "roles": ["INSTITUTE_ADMIN"],        // GrantedAuthority strings (role names, NO ROLE_ prefix)
  "scopes":[ {"i":5}, {"i":9,"s":2026,"c":12,"x":4} ],  // ABAC; short keys; missing key = wildcard
  "sa":    false,                      // super-admin flag
  "iat": …, "exp": …
}
```

**Critical implementation note — `perms[]` is intentionally OMITTED from the JWT**
(`TokenProvider.java:171-179`). An admin in many role groups can hold 400+ permission codes,
which would push the JWT past the ~4 KB cookie limit and silently break the session. Therefore:

- **Permissions are hydrated server-side on every request** from the DB
  (`PermissionRepository.findCodesForUser`) inside `CustomUserDetailsService.loadUserById`,
  called by `TokenAuthenticationFilter`.
- **`sa` (super-admin) is also NOT trusted from the JWT** — it is re-read from
  `User.is_super_admin` on each request, so promotions/revocations take effect on the next
  request rather than at token expiry (`TokenAuthenticationFilter.java:150-173`,
  `CustomUserDetailsService.java:124-128`).
- **`scopes[]` and `jti` ARE sourced from the JWT** (small, treated as authoritative).

This is a meaningful divergence from the plan (§3.5 of the plan put `perms` in the token).

### 3.2 Parsing (`parseClaims`, `TokenProvider.java:351-394`)

Returns a typed `TokenClaims` (`userId, roles, perms, scopes, superAdmin, jti, isLegacyShape`).
**Legacy detection:** a pre-Phase-15 token has neither `perms` nor `scopes` claim →
`isLegacyShape=true` → filter keeps DB-loaded perms/scopes/sa and clears `jti`
(`TokenAuthenticationFilter.java:160-166`).

### 3.3 Token TTLs (`AppProperties.Auth`)

| Token | Minter | TTL property |
|---|---|---|
| Access (login/refresh) | `createAccessToken` | `accessTokenExpirationMsec` (default 60 min) |
| Legacy single-token (OAuth) | `createToken` | `tokenExpirationMsec` (10-day legacy) |
| Refresh (opaque UUID) | `RefreshTokenService.issue` | 7 days, server-side `refresh_token` row |
| Assessment-session | `createAssessmentSessionToken` | `assessmentTokenExpirationMsec` (default 4h) |

---

## 4. Data Model

### 4.1 Tables (Flyway migrations under `spring-social/src/main/resources/db/migration/`)

```
V20260511001  create permission, role_permission, user_scope, refresh_token, auth_audit
V20260511002  seed permission (28 foundational codes)
V20260511003  seed role_permission  (later truncated)
V20260511004  add student_info.session_id + course_code (+ FKs, index) for ABAC
V20260511005  backfill student_info scope columns
V20260511006  DROP user_scope; truncate role_permission + student_info_backfill_report
V20260511007  create user_role_scope (replaces user_scope; FK to user_role_group_mapping)
V20260512001  seed_phase15_permissions (large extension — ~265 controller-grained codes)
```

**Key design pivot (post-Phase-14, 2026-05-11):** scope attaches to a **role-assignment**, not
to a user globally. `user_scope` (keyed on `user_id`) was dropped in V…006 and replaced by
`user_role_scope` (keyed on `user_role_group_mapping_id`) in V…007. This lets one user be a
Teacher at School A and a Counsellor at School B with different scopes per role. See
`AUTH_REDESIGN_PLAN.md` §3.6.

#### `permission` (`Permission.java`)
| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `code` | VARCHAR(64) UNIQUE | e.g. `student.read`; mirrors `PermissionCode` enum |
| `description` | VARCHAR(255) | |

#### `role_permission` (RBAC join — no JPA entity; accessed by native SQL)
`(role_id INT, permission_id BIGINT)` PK both; FK→`role(id)`, FK→`permission(id)` ON DELETE CASCADE.

#### `user_role_scope` (`UserRoleScope.java`, migration V…007)
| Column | Type | Meaning |
|---|---|---|
| `id` | BIGINT PK | |
| `user_role_group_mapping_id` | INT FK→`user_role_group_mapping(id)` ON DELETE CASCADE | the role-assignment this scope belongs to |
| `institute_id` | INT NULL | FK→`institute_detail_new.institute_code`; NULL = wildcard |
| `session_id` | INT NULL | FK→`institute_session.session_id`; NULL = wildcard |
| `course_code` | INT NULL | FK→`institute_courses.course_code` ("class"); NULL = wildcard |
| `section_id` | INT NULL | FK→`section.id`; NULL = wildcard |
| `created_at`, `created_by` | | |

**Containment CHECK** (`chk_urs_containment`): section ⇒ class; class ⇒ session OR institute;
session ⇒ institute. Enforced on MySQL 8+, documentation-only on 5.7 (service-layer guard
intended as backstop).

#### `refresh_token` (`RefreshTokenService`)
`jti CHAR(36) PK, user_id, issued_at, expires_at, revoked_at, replaced_by, user_agent, ip`.
Rotation chains via `replaced_by`.

#### `auth_audit` (`AuthAuditService`)
`id, ts, user_id, permission, scope, resource_id, decision ENUM('ALLOW','DENY'), reason,
request_id`. Written on every DENY (and sensitive ALLOWs via the Phase-20 aspect).

#### `student_info` ABAC columns (migration V…004)
Added `session_id` + `course_code` FKs and composite index
`(institute_id, session_id, course_code, school_section_id)`. These four columns are exactly
what the Hibernate `scopeFilter` filters on (§5.4).

### 4.2 The role assignment chain (existing, pre-existing entities)

```
User ──(1:N)── UserRoleGroupMapping ──(N:1)── RoleGroup ──(1:N)── RoleRoleGroupMapping ──(N:1)── Role ──(N:M via role_permission)── Permission
                       │
                       └──(1:N) UserRoleScope   (ABAC scope grants attached to THIS assignment)
```

- `User.getRole()` (`User.java:306-313`) walks `userRoleGroupMappings → roleGroup →
  roleRoleGroupMappings → role` and returns `List<GrantedAuthority>` of
  `new SimpleGrantedAuthority(role.getName())` — **role names with NO `ROLE_` prefix**. This is
  why `SecurityConfig.java:338` uses `hasAnyAuthority("SUPER_ADMIN", ...)` not `hasAnyRole`.
- `User.userRoleGroupMappings` is `FetchType.EAGER` (`User.java:119`).
- `User.is_super_admin` boolean column (`User.java:55-56`) drives the bypass flag, seeded by a
  `SuperAdminBootstrapper` from `app.bootstrap.*` config.
- **Mapping inconsistencies (intentionally tolerated):** `UserRoleGroupMapping.user` is a `Long`
  column with a read-only `@ManyToOne User userRef` shadow on the same column
  (`UserRoleGroupMapping.java`); `RoleRoleGroupMapping.roleGroup` is a `Long` with a read-only
  `roleGroupRef` shadow using `ConstraintMode.NO_CONSTRAINT` to suppress a column-type FK mismatch
  (`RoleRoleGroupMapping.java`). These are the partial fixes for plan bugs B3/B4.

---

## 5. Backend Enforcement

### 5.1 Spring Security configuration — `SecurityConfig.java`

- `@EnableGlobalMethodSecurity(securedEnabled=true, jsr250Enabled=true, prePostEnabled=true)`
  (`SecurityConfig.java:43`) — enables `@PreAuthorize`.
- Stateless sessions (`SecurityConfig.java:236-237`).
- `StrictHttpFirewall` with all defaults (rejects `;`, `//`, `%2F`, backslash, non-standard
  methods) — `SecurityConfig.java:140-152`.
- **CSRF** double-submit cookie `cn_csrf` / header `X-CSRF-Token`
  (`csrfTokenRepository`, `SecurityConfig.java:131-138`). Exempt routes
  (`SecurityConfig.java:244-265`): `/auth/login|signup|logout|oauth-exchange|refresh|
  assessment-session`, `/oauth2/**`, `/payment/webhook/**`, and B2C public funnels.
- **permitAll allow-list** (`SecurityConfig.java:298-314`): the public endpoints only — the
  rest fall to `.anyRequest().authenticated()` (`SecurityConfig.java:339-340`). This is the
  hardened post-redesign list (plan bug A1 fixed).
- `/actuator/health` permitAll; all other `/actuator/**` require
  `hasAnyAuthority("SUPER_ADMIN","INFRA_ADMIN")` (`SecurityConfig.java:324-338`). `INFRA_ADMIN`
  is not yet seeded.
- 403 handler returns JSON (`SecurityConfig.java:273-277`); 401 via `RestAuthenticationEntryPoint`.
- OWASP headers + CSP-Report-Only (`SecurityConfig.java:226-235`, `buildCspHeaderWriter`).
- **Filter chain order** (`SecurityConfig.java:356-377`):
  `RateLimitFilter(PER_IP)` → `TokenAuthenticationFilter` → `UsernamePasswordAuthenticationFilter`
  → `RateLimitFilter(PER_USER)`.

### 5.2 `TokenAuthenticationFilter` — request authentication

`TokenAuthenticationFilter.java:76-196`. Per request:

1. `getJwtFromRequest` (`:198-247`) — **cookie-first**. On assessment-scope paths prefers
   `cn_at_asmnt`; otherwise `cn_at`; final fallback `Authorization: Bearer`.
2. `validateToken` (signature + expiry).
3. `JtiDenyListService.isRevoked(jti)` — if revoked, skip auth → falls through → 401 (`:90-95`).
4. Assessment-scope guard (`:104-140`, see §2.6).
5. `parseClaims` + `customUserDetailsService.loadUserById(userId)` to build the `UserPrincipal`
   with DB-loaded permissions + super-admin, JWT-loaded scopes + jti (`:142-174`).
6. Set the `SecurityContext` Authentication.
7. **Note:** the outer `catch (Exception)` logs at ERROR and continues
   (`TokenAuthenticationFilter.java:191-193`) — a parse failure degrades to anonymous (plan bug A10).

### 5.3 `AuthorizationService` (`@auth`) — the decision primitive

`AuthorizationService.java`. Bean name **`auth`** (`@Service("auth")`, `:50`). SpEL overloads by
arity (`:66-100`):

- `allows(perm)` — no scope.
- `allows(perm, instituteId)` — institute-scoped (~26 annotations).
- `allows(perm, instituteId, sessionId)` — institute+session (~10 annotations).
- `allows(perm, instituteId, sessionId, courseCode, sectionId)` — full 4-dim.

**`decide(...)` logic** (`AuthorizationService.java:102-130`):

```
if principal == null               → DENY reason=ANONYMOUS
if principal.isSuperAdmin()        → ALLOW (no audit row)
if !permissions.contains(perm)     → DENY reason=PERM_MISSING
if i==s==c==x all null             → ALLOW (permission alone sufficient)
if !CurrentScopes.anyMatch(i,s,c,x)→ DENY reason=SCOPE_MISMATCH
else                               → ALLOW
```

**Enforce vs log-only mode** (`AuthorizationService.java:55-56,136-151`): controlled by property
`auth.enforce-mode` (default `log-only`). In **log-only** every computed DENY is *recorded* to
`auth_audit` then the method **returns `true` anyway** (`recordAndReturn` collapses to `true`
unless `enforceMode == "enforce"`). Set `AUTH_ENFORCE_MODE=enforce` to actually block. This means
endpoint authorization is wired everywhere but is *advisory* until that flag is flipped — verify
the deployed value per environment.

### 5.4 Scope matching — `CurrentScopes`

`CurrentScopes.java`. A `ScopeRow` carries nullable `i/s/c/x` (institute Integer, session Integer,
course Integer, **section Long**). `ScopeRow.matches(ti,ts,tc,tx)` (`:66-71`):

```java
(i==null || i.equals(ti)) && (s==null || s.equals(ts))
&& (c==null || c.equals(tc)) && (x==null || x.equals(tx))
```

A null **row** dim = wildcard (matches anything). `CurrentScopes.anyMatch` is true iff ≥1 row
matches. The principal's scope list is the **flattened union** of `user_role_scope` rows across
all the user's role-assignments (hydrated in `CustomUserDetailsService.hydrate`,
`CustomUserDetailsService.java:86-100`, via `UserRoleScopeRepository.findAllByUserId`).

### 5.5 Hibernate row-level filter — `ScopeFilterInterceptor` + `@FilterDef scopeFilter`

A second, defense-in-depth ABAC layer that filters **query results** (not just endpoint access):

- `@FilterDef(name="scopeFilter")` + `@Filter` declared on `StudentInfo`
  (`model/career9/StudentInfo.java:45-55`) with condition
  `(institute_id IN (:instituteIds) OR institute_id IS NULL) AND (session_id …) AND
  (course_code …) AND (school_section_id IN (:sectionIds) OR … IS NULL)`. The `@FilterDef` is
  also referenced by `InstituteBranch`, `UserStudent`, `AssessmentTable`, `Campaign`.
- `ScopeFilterInterceptor` (`security/ScopeFilterInterceptor.java`, a `HandlerInterceptor`
  registered in `WebMvcConfig.java:56`): in `preHandle` it reads `UserPrincipal.getScopes()`,
  aggregates per-dimension id sets, and:
  - **skips** the filter for super-admins (`:72-75`) or when every dimension has a wildcard row
    (`:94-97`);
  - otherwise enables `scopeFilter` on the Hibernate `Session`, binding the four parameter lists,
    using sentinels `Integer.MIN_VALUE` / `Long.MIN_VALUE` for empty dimensions so
    `setParameterList` doesn't throw and nothing spurious matches (`:99-117`);
  - in `afterCompletion` disables the filter so the pooled persistence context is clean (`:120-132`).

### 5.6 Token revocation — `JtiDenyListService`

`security/JtiDenyListService.java`. In-memory **Caffeine** `Cache<String,Boolean>`
(qualifier `jtiDenyList`, TTL ≈ access-token lifetime). `revoke(jti)` adds; `isRevoked(jti)`
returns false for null/empty (so legacy tokens without `jti` pass to natural expiry). Consulted
by the auth filter and written by logout.

### 5.7 Audit — `AuthAuditService`

Interface `service/AuthAuditService.java` with `recordDeny(...)` (and a sensitive-ALLOW path).
Implementations: `AuthAuditServiceImpl`, `AuthAuditServiceJdbcDefault`. `AuthorizationService`
calls `recordDeny` on every DENY (`AuthorizationService.java:140-141`); if no bean is present it
WARN-logs `AUTH-DENY (no auditor)`. The Phase-20 `security/audit/SensitiveOpAspect` +
`@SensitiveOp` annotation audit sensitive operations (e.g. role assignment) including super-admin
ALLOWs.

### 5.8 Build-time coverage guard — ArchUnit

`spring-social/src/test/java/com/kccitm/api/archtest/ControllerPreAuthorizeCoverageTest.java`
fails the build if any controller method annotated with a mapping
(`@GetMapping`/`@PostMapping`/`@PutMapping`/`@DeleteMapping`/`@PatchMapping`/`@RequestMapping`)
lacks `@PreAuthorize`, unless explicitly listed in an `EXCLUSIONS` set (the anonymous-by-design
endpoints: login, signup, refresh, logout, oauth-exchange, assessment-session, public B2C). This
is what keeps the 713-annotation coverage from regressing.

### 5.9 Rate limiting

`security/ratelimit/RateLimitFilter` (Bucket4j) in two modes: `PER_IP` (before auth, protects
brute-force on `/auth/login|refresh|signup`) and `PER_USER` (after auth, keyed off the
`UserPrincipal`). Config in `RateLimitConfig`; buckets in `BucketRegistry`.

---

## 6. Role-Based Access Control (RBAC) detail

### 6.1 Permission catalog — `PermissionCode` enum

`security/PermissionCode.java` is the single source of truth for permission strings, seeded into
the `permission` table by migrations V…002 (28 foundational) + V…012001 (~265 controller-grained).
Convention: `resource.verb[.qualifier]`, case-sensitive. **306 distinct permission codes are
actually referenced** in `@auth.allows('…')` annotations across controllers. Examples:
`institute.read/write/delete`, `student.read/write/import_bulk`, `assessment.read/create/publish/
delete/update/start/submit/prefetch`, `report.read/export`, `user.read/write/toggle_active/me/
delete`, `role.read/update/delete/assign`, `permission.grant`, `payment.refund`,
`institute_course.read/update/delete`, `student_info.read/create/update`,
`generated_report.read/delete`, etc.

### 6.2 How a user's permissions are computed

`PermissionRepository.findCodesForUser(userId)` (`repository/PermissionRepository.java`) — native
SQL walking:
```
permission ⋈ role_permission ⋈ role ⋈ role_role_group_mapping ⋈ user_role_group_mapping
WHERE urgm.user_id = :userId AND urgm.display = TRUE
  AND (rrgm.display IS NULL OR TRUE) AND (r.display IS NULL OR TRUE)
```
returning the DISTINCT set of permission codes. Called by `CustomUserDetailsService.hydrate`
(`:113`) → stored on `UserPrincipal.permissions` → checked by `AuthorizationService` and returned
by `/auth/me`.

### 6.3 Role / permission management endpoints

| Endpoint | Method | `@PreAuthorize` | File |
|---|---|---|---|
| `/role/get` | GET | `role.read.all` | `RoleController.java:44` |
| `/role/getbyid/{id}` | GET | `role.read` | `RoleController.java:51` |
| `/role/update` | PUT | `role.update` | `RoleController.java:58` |
| `/role/delete/{id}` | DELETE | `role.delete` | `RoleController.java:76` |
| `/role/{id}/permissions` | GET | `role.read` | `RoleController.java:101` |
| `/role/{id}/permissions` | PUT | `permission.grant` | `RoleController.java:118` |
| `/role/{id}/urls` | GET | `role.read` | `RoleController.java:147` |
| `/role/{id}/urls` | PUT | `role.url.update` | `RoleController.java:164` |
| `/permission/getAll` | GET | `role.read` | `PermissionController.java:27` |
| `/userrolegroupmapping/get` | GET | `user_role_group_mapping.read.all` | `UserRoleGroupMappingController.java:45` |
| `/userrolegroupmapping/update` | POST | `user_role_group_mapping.update` | `UserRoleGroupMappingController.java:65` |
| `/userrolegroupmapping/delete/{id}` | GET | `user_role_group_mapping.delete` | `UserRoleGroupMappingController.java:90` |
| `/userrole/get/{email}` | GET | `user_role_group_mapping.read` | `UserRoleGroupMappingController.java:99` |
| `/userrole/update/{email}` | POST | `user_role_group_mapping.update` | `UserRoleGroupMappingController.java:122` |

Setting role permissions (`PUT /role/{id}/permissions`) calls
`PermissionRepository.deleteAllByRoleId` then `insertRolePermissionByCode` (idempotent
`INSERT IGNORE`) per code. Also `RoleGroupController`, `RoleRoleGroupMappingController`,
`PermissionRefreshController` round out the admin surface.

### 6.4 Secondary access-scope system (`security/access/*`)

`AccessScopeService.buildForCurrentUser(...)` constructs an `AccessScope` from a user's
`ContactPerson` rows and their `ContactPersonAccessLevel`s. Returns `Optional.empty()` for
super-admins (bypass). `AccessScope.allows(i,s,c,x)` mirrors the primary predicate's wildcard
semantics. `AccessScopeJpqlBuilder` turns an `AccessScope` into JPQL WHERE fragments. **Only**
consumed by `InstituteDetailController` and `career9/DashboardDataService`. This is a separate,
ContactPerson-driven mechanism — not fed by `user_role_scope` and not used by `@auth`.

---

## 7. Attribute-Based Access Control (ABAC) detail

### 7.1 The four dimensions

| Dim | JWT key | Entity / table | PK | Type |
|---|---|---|---|---|
| institute | `i` | `InstituteDetail` / `institute_detail_new` | `institute_code` | Integer |
| session | `s` | `InstituteSession` / `institute_session` | `session_id` | Integer |
| class (course) | `c` | `InstituteCourse` / `institute_courses` | `course_code` | Integer |
| section | `x` | `Section` / `section` | `id` | **Long** |

Strict containment: `institute ⊇ session ⊇ class ⊇ section`. NULL at any level = wildcard
("all within the parent"). One user → many scope rows (e.g. a multi-institute director has one
row per institute).

### 7.2 Assignment

Scope grants are rows in `user_role_scope`, **each FK'd to a `user_role_group_mapping`**
(a role-assignment). Created/edited by an admin. Removing the role assignment cascades the scope
grants. New staff get **no scope at creation** (fail-closed, least-privilege).

### 7.3 Evaluation (two enforcement surfaces)

1. **Endpoint level** — `@PreAuthorize("@auth.allows('perm', #i, #s, #c, #x)")`. The controller
   binds the target resource's dims from path/body params (e.g. `#instituteCode`,
   `#studentInfo.instituteId`). `AuthorizationService` → `CurrentScopes.anyMatch`.
2. **Row level** — `ScopeFilterInterceptor` + Hibernate `scopeFilter` auto-appends the scope
   WHERE clause to queries on `StudentInfo` (and the other filtered entities), so even an
   unscoped `findAll` returns only in-scope rows. Fail-closed via the MIN_VALUE sentinel.

### 7.4 Worked example

A user assigned **Teacher** with `user_role_scope = (institute=5, session=2026, course=12,
section=NULL)`:
- Holds scope row `{i:5, s:2026, c:12, x:null}` (x is wildcard = all sections of class 12).
- `@auth.allows('student.read', 5, 2026, 12, 4)` → row matches (x null wildcards section 4) → ALLOW.
- `@auth.allows('student.read', 7, …)` → no row has `i==7` → SCOPE_MISMATCH (DENY in enforce mode).
- A `StudentInfo` query returns only rows where `institute_id IN (5) ∧ session_id IN (2026) ∧
  course_code IN (12)` (section unconstrained).

---

## 8. Frontend Enforcement (`react-social`)

### 8.1 User model & context

- `modules/auth/core/_models.ts` — `User { id, name, email, roles[], permissions[],
  scopes: Scope[], urls?[], superAdmin }`; `Scope = { i?, s?, c?, x? }` (short keys mirror JWT).
- `modules/auth/core/Auth.tsx` — `AuthProvider` / `useAuth()`. `AuthInit` calls
  `getCurrentUser()` (`GET /auth/me`) once on load (`Auth.tsx:81-101`); the `cn_at` cookie is
  auto-attached via `withCredentials`. `logout()` best-effort POSTs `/auth/logout` then clears
  local state (`Auth.tsx:41-53`).
- `can(perm, scope?)` (`Auth.tsx:56-65`) delegates to `allows(...)`.

### 8.2 The `allows()` predicate — mirrors the backend

`modules/auth/core/permissions.ts:25-79`. Order matches `AuthorizationService.decide` **exactly**:
super-admin full bypass FIRST (`:42`), then RBAC `perms.includes(perm)` (`:45`), then if no scope
arg → allow (`:49`), else `scopeRows.some(scopeMatches)`. `dimMatches` treats null on **either**
side as a match (`:75-79`). The file header explicitly warns it must stay in lock-step with the
Java implementation.

### 8.3 Declarative gates

- `<Can perm scope? fallback?>` — `modules/auth/components/Can.tsx`. Renders children iff
  `can(perm, scope)`.
- `useCan()` — `modules/auth/core/useCan.ts`. Returns the `can` function.
- `useScope()` — `modules/auth/core/useScope.ts`. **Stub returning `undefined`** (the
  active-institute picker / `ScopeContext` is deferred); call sites therefore do permission-only
  checks today. The server remains the only authority.

### 8.4 Route guard — `RequirePermission`

`modules/auth/components/RequirePermission.tsx`. **Intersection semantics**: a route renders iff
`can(perm, scope)` (permission/scope gate) **AND** `urlAllowed(currentUser.urls, pathname)`
(the per-role URL whitelist from `/auth/me`). Super-admin bypasses both (`:35-38`). On failure it
renders `<RequestAccessPage>` indicating which gate failed (permission vs url). `urlAllowed`
(`permissions.ts:100-123`) supports literal, `:param`, and `*` wildcard patterns.

Wired in `routing/PrivateRoutes.tsx` — most `<Route>` elements wrap their element in
`<RequirePermission perm="…">` (e.g. `:281` institute.read, `:291`/`:334` student.read, `:311`
assessment.read, `:348` group.read, `:355` group.write). Routes intended to be always-allowed
simply omit the wrapper (`PrivateRoutes.tsx:85-108`). This replaced the old `authorityUrls`
URL-pattern guard.

### 8.5 Menu gating — `AsideMenuMain`

`_metronic/layout/components/aside/AsideMenuMain.tsx` imports `useCan, Can, useAuth` (`:4`) and
gates menu sections/items with `can('institute.read')`, `can('student.read')`,
`can('assessment.read')`, etc. (`:34-47`, **27 `can(` call sites**). Menu derives from
permissions, not a URL list.

### 8.6 Cookie / CSRF axios layer

`modules/auth/core/AuthHelpers.ts`. Sets `axios.defaults.withCredentials = true` (`:78`). A
**request interceptor** copies the `cn_csrf` cookie into the `X-CSRF-Token` header on
state-changing methods (`:81-102`, constants `:15-16`). A **response interceptor** (`:104+`) on
401 performs a single silent `POST /auth/refresh` (withCredentials) then retries the original
request once; a second 401 redirects to login. Tokens are no longer read from/written to
`localStorage` for the admin flow (the old `kt-auth-react-v` key was removed).

### 8.7 Admin UI for roles/permissions/urls

`pages/RolesAndPermissions/` — `RolesAndPermissionsPage.tsx`, `RolesPanel.tsx`,
`RoleGroupsPanel.tsx`, `RolePermissionsModal.tsx` (assign permission codes to a role),
`RoleUrlsModal.tsx` (assign whitelisted route paths to a role). `PermissionDeniedPage.tsx` /
`RequestAccessPage.tsx` are the deny surfaces.

---

## 9. Known Gaps & Caveats (from code, not speculation)

- **Log-only by default.** Endpoint `@auth.allows` checks DENY-record then return `true` unless
  `auth.enforce-mode=enforce` (`AuthorizationService.java:150`). Confirm the env value before
  assuming endpoints are blocking.
- **`perms` not in JWT** → a DB round-trip (`loadUserById` → `findCodesForUser`) happens on every
  authenticated request. `sa` likewise re-read from DB each request (intentional, for
  promotion/revocation latency).
- **Auth filter swallows exceptions** → a malformed token degrades to anonymous rather than 401
  (`TokenAuthenticationFilter.java:191-193`).
- **Two ABAC systems** coexist (§1.1 / §6.4); only `user_role_scope` feeds `@auth`.
- **OAuth still returns token in URL** (`/oauth2/redirect?token=`), bridged to cookies via
  `/auth/oauth-exchange` (plan bug D1, OAuth out of scope).
- **`section_id` is Long on the row but Integer in `user_role_scope`** — converted in
  `CustomUserDetailsService.java:92` (`urs.getSectionId().longValue()`).
- **`INFRA_ADMIN` role not seeded** — only `SUPER_ADMIN` can reach non-health `/actuator/**`.
- Containment CHECK constraints are only enforced on MySQL 8+ (no-op on 5.7).

---

## 10. Key File Index

### Backend — `spring-social/src/main/java/com/kccitm/api/`
| File | Purpose |
|---|---|
| `config/SecurityConfig.java` | Filter chain, permitAll, CORS, CSRF, headers, method-security enable |
| `security/TokenProvider.java` | JWT mint/parse (access, assessment-session); claim shape |
| `security/TokenAuthenticationFilter.java` | Per-request auth; cookie-first; deny-list; scope guard; principal hydration |
| `security/AuthorizationService.java` | `@auth` bean; `allows()`/`decide()`; log-only vs enforce |
| `security/CurrentScopes.java` | `ScopeRow`, `matches`, `anyMatch` — ABAC predicate |
| `security/UserPrincipal.java` | Principal carrying permissions, scopes, superAdmin, jti |
| `security/CustomUserDetailsService.java` | `hydrate()` — DB perms + scopes + superAdmin |
| `security/AuthCookieService.java` | Cookie names (`cn_at`,`cn_rt`,`cn_csrf`,`cn_at_asmnt`) + issue/clear |
| `security/RefreshTokenService.java` | Opaque refresh token issue/validate/rotate/revoke |
| `security/JtiDenyListService.java` | Caffeine in-memory access-token revocation |
| `security/ScopeFilterInterceptor.java` | Enables Hibernate `scopeFilter` per request |
| `security/PermissionCode.java` | Canonical permission enum (single source of truth) |
| `security/PermissionCodeValidator.java` | Validates annotation codes against the enum |
| `security/access/AccessScope*.java` | Secondary ContactPerson-driven scope system |
| `security/audit/SensitiveOp*.java` | `@SensitiveOp` aspect for sensitive-op auditing |
| `security/ratelimit/*` | Bucket4j per-IP / per-user rate limiting |
| `controller/AuthController.java` | `/auth/login,logout,refresh,me,oauth-exchange,signup` |
| `controller/AssessmentSessionController.java` | `/auth/assessment-session` minting |
| `controller/RoleController.java` | Role + role-permission + role-url admin |
| `controller/PermissionController.java`, `RoleGroupController.java`, `RoleRoleGroupMappingController.java`, `UserRoleGroupMappingController.java`, `PermissionRefreshController.java` | RBAC admin surface |
| `model/Permission.java`, `Role.java`, `RoleGroup.java`, `RoleRoleGroupMapping.java`, `UserRoleGroupMapping.java`, `UserRoleScope.java`, `User.java` | RBAC/ABAC entities |
| `repository/PermissionRepository.java` | `findCodesForUser`, role-permission CRUD (native SQL) |
| `repository/UserRoleScopeRepository.java` | `findAllByUserId` (scope union) |
| `payload/MeResponse.java` | `/auth/me` response shape |
| `service/AuthAuditService*.java` | Deny/allow audit writers |
| `resources/db/migration/V20260511001..V20260512001*.sql` | Auth schema + seeds |
| `src/test/java/.../archtest/ControllerPreAuthorizeCoverageTest.java` | Build-time `@PreAuthorize` coverage guard |

### Frontend — `react-social/src/app/`
| File | Purpose |
|---|---|
| `modules/auth/core/Auth.tsx` | `AuthProvider`, `useAuth`, `can()`, `AuthInit` (/auth/me bootstrap) |
| `modules/auth/core/permissions.ts` | `allows()` (backend mirror) + `urlAllowed()` |
| `modules/auth/core/_models.ts` | `User`, `Scope` types |
| `modules/auth/core/_requests.ts` | `getCurrentUser`, `logout`, login requests |
| `modules/auth/core/AuthHelpers.ts` | withCredentials, CSRF interceptor, 401→refresh retry |
| `modules/auth/core/useCan.ts`, `useScope.ts` | hooks (useScope is a stub) |
| `modules/auth/components/Can.tsx` | `<Can perm scope?>` element gate |
| `modules/auth/components/RequirePermission.tsx` | route guard (perm ∩ url) |
| `modules/auth/components/RequestAccessPage.tsx` | deny surface |
| `routing/PrivateRoutes.tsx` | route table with `<RequirePermission>` wrappers |
| `_metronic/layout/components/aside/AsideMenuMain.tsx` | menu gated by `can()` |
| `pages/RolesAndPermissions/**` | role / permission / url admin UI |

---

## 11. Sequence Walkthroughs

### 11.1 Admin login → authenticated request → authorization

```
1. POST /auth/login {email,password}
   → AuthController.authenticateUser
   → authenticationManager.authenticate (CustomUserDetailsService + BCrypt)
   → tokenProvider.createAccessToken  (roles/scopes/sa/jti; perms OMITTED)
   → refreshTokenService.issue        (row in refresh_token)
   → Set-Cookie: cn_at (HttpOnly), cn_rt (HttpOnly,/auth/refresh), cn_csrf (JS-readable)

2. SPA load → GET /auth/me  (cn_at auto-sent)
   → TokenAuthenticationFilter: validate → not revoked → parseClaims → loadUserById
       → CustomUserDetailsService.hydrate: scopes from user_role_scope, perms from
         findCodesForUser, superAdmin from User.is_super_admin
   → AuthController.me → MeResponse {roles, permissions, scopes, urls, superAdmin}
   → AuthProvider stores currentUser; can() now usable

3. GET /student-info/getByInstituteId/5  (cn_at auto-sent, X-CSRF-Token on writes)
   → TokenAuthenticationFilter populates UserPrincipal
   → @PreAuthorize("@auth.allows('student_info.read', #instituteId, null,null,null)")
       → decide: superAdmin? perm present? scopes.anyMatch(i=5)?
       → log-only: records DENY if mismatch but returns true; enforce: 403 + JSON
   → ScopeFilterInterceptor.preHandle enables scopeFilter (institute_id IN (5) OR NULL)
   → controller query returns only in-scope StudentInfo rows
   → afterCompletion disables scopeFilter
```

### 11.2 Silent refresh on 401

```
GET /something → 401 (cn_at expired)
→ axios response interceptor (AuthHelpers.ts): POST /auth/refresh (cn_rt, withCredentials)
   → AuthController.refresh: validate+rotate cn_rt → new cn_at + cn_rt (204)
→ retry original request ONCE → success
(second 401 → redirect /login)
```

### 11.3 Assessment-session token

```
POST /auth/assessment-session {userStudentId, assessmentId}  (permitAll, body-gated)
→ tokenProvider.createAssessmentSessionToken (scope="assessment", aid, 4h)
→ Set-Cookie cn_at_asmnt (HttpOnly)
GET /assessments/...  (cn_at_asmnt preferred on assessment paths)
→ TokenAuthenticationFilter: scope=="assessment" AND path∈ASSESSMENT_SCOPE_PATHS
   → set request attrs (assessmentUserStudentId/AssessmentId), minimal Authentication
GET /user/...  with cn_at_asmnt
→ scope=="assessment" but path NOT in allow-list → skip auth → 401
```

### 11.4 Logout / revocation

```
POST /auth/logout
→ JtiDenyListService.revoke(access jti)      (Caffeine, blocks remaining 60-min TTL)
→ RefreshTokenService.revoke(cn_rt value)    (refresh_token.revoked_at)
→ clear cn_at + cn_csrf + cn_rt → 204
Subsequent request with the old cn_at → filter: isRevoked(jti)==true → skip auth → 401
```
