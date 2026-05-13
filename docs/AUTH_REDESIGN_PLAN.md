# Hybrid RBAC + ABAC Auth Redesign — Career-Nine

> **Scope:** Spring Boot backend + `react-social` admin app. Assessment app deferred (separate phase at end).
> **Goal:** Lock down the system with a single, coherent authorization model. Roles say *what verbs you can use*, attributes (`institute`, `session`, `class`, `section`) say *which resources you can touch*.
> **Status:** Plan. Implementation not started.

---

## 1. Context — Why this is being done

The current auth stack works at the "are you logged in" level but is leaky and inconsistent at the "what are you allowed to do" level. Concretely:

**Backend ([spring-social/](../spring-social/))**
- `@EnableGlobalMethodSecurity` is on, but **zero `@PreAuthorize` annotations are active** — the three that exist are commented out ([UserController.java:60](../spring-social/src/main/java/com/kccitm/api/controller/UserController.java#L60), `RoleController`, `UniversityMarkController`).
- `SecurityConfig.permitAll()` opens up `/user/**`, `/student/**`, `/student-info/**`, `/instituteBranch/**`, etc. — most "private" admin endpoints are reachable anonymously ([SecurityConfig.java:139-184](../spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java#L139-L184)).
- `GET /student-info/getByInstituteId/{instituteId}` trusts the path param — any caller can enumerate any institute's students.
- OAuth handler **puts the JWT in the URL query string** ([OAuth2AuthenticationSuccessHandler.java:104-108](../spring-social/src/main/java/com/kccitm/api/security/oauth2/OAuth2AuthenticationSuccessHandler.java#L104-L108)).
- JWT secret is the same hardcoded string in `application.yml` across dev/sandbox/staging/production.
- OAuth provider access tokens are persisted raw in `User.googleAuthString`.
- No refresh token, no revocation, no logout — a stolen token is valid for 10 days.
- HttpFirewall is overly permissive (semicolons, double slashes, any HTTP method).

**Admin frontend ([react-social/](../react-social/))**
- JWT lives in `localStorage["kt-auth-react-v"]` ([AuthHelpers.ts:3](../react-social/src/app/modules/auth/core/AuthHelpers.ts#L3)) — XSS reads it instantly.
- Authorization is driven by `authorityUrls: string[]` (URL patterns) — there is no role concept on the client and no scope (institute/session/class/section) concept anywhere.
- Institute is chosen client-side via dropdown/query param and trusted by the server.
- Four parallel auth flows (admin, student portal, counsellor portal, assessment portal) with **different storage strategies** and **different header conventions**.
- `refreshToken` field exists in the type but is never used.

**Assessment frontend ([career-nine-assessment/](../career-nine-assessment/))**
- No JWT at all — identity is `userStudentId` in `localStorage`, trivially editable.
- All "auth" happens via request-body parameters that the server doesn't verify.
- Deferred to **Phase 6** below.

The target is a **hybrid model**:
- **RBAC** (role-based) for verbs: `SUPER_ADMIN`, `INSTITUTE_ADMIN`, `PRINCIPAL`, `TEACHER`, `COUNSELLOR`, `STUDENT`, …
- **ABAC** (attribute-based) for resource scope: `institute_id`, `session_id`, `class_id`, `section_id`.

A permission check is *both*: "does this role grant the action AND is the target resource within the user's scope?"

---

## 2. Target architecture (one-page summary)

```
                   ┌─────────────────────────────────────────────┐
                   │           Spring Boot API                    │
                   │                                              │
   request ──→ ┌───┴──────────────┐                              │
               │ TokenAuthFilter   │  validates short-lived JWT  │
               └───┬──────────────┘  populates SecurityContext   │
                   │                  with UserPrincipal +        │
                   │                  GrantedAuthorities (perms) │
                   ↓                  + ScopeClaims (inst/sess/   │
               ┌──────────────────┐                cls/sec)       │
               │ @PreAuthorize    │  evaluates SpEL:              │
               │  on every        │   hasPermission('assess.read')│
               │  controller      │   && @scope.allows(           │
               │  method          │      #instituteId,#sessionId, │
               └───┬──────────────┘      #classId,#sectionId)    │
                   ↓                                              │
               ┌──────────────────┐                              │
               │ Service layer     │  resolves request-scope        │
               │  + ScopeFilter    │  → repositories auto-filter    │
               │  Hibernate filter │  WHERE institute_id IN (…)    │
               └───┬──────────────┘                              │
                   ↓                                              │
               ┌──────────────────┐                              │
               │ AuditLog writer   │  writes (user, perm, scope,   │
               │  (async)          │  resource, decision)         │
               └──────────────────┘                              │
                   │                                              │
                   └──────────────────────────────────────────────┘

   Client (react-social):
     ── login → server sets HttpOnly + Secure + SameSite=Strict cookie (JWT)
                returns user profile { id, roles[], permissions[], scopes{} }
                NO TOKEN IN JS-ACCESSIBLE STORAGE
     ── every request: cookie auto-sent + X-CSRF-Token header from meta
     ── 401 → silent /auth/refresh → retry once → otherwise redirect /login
     ── <Can perm="x" scope={…}>  guards UI elements
     ── <RouteGuard perm="x">     guards routes
     ── menu derives from permissions, not URL list
```

---

## 3. Authorization model — concepts

### 3.1 Roles
Replace the loose `Role.name` string with an enum-backed catalog. Keep the existing 5-table mapping chain (`User → UserRoleGroupMapping → RoleGroup → RoleRoleGroupMapping → Role`) — it's already there — but treat `RoleGroup` as the **assignable bundle** and `Role` as the **permission grant**.

Initial role catalog (extend as needed):

| Role | Intent |
|---|---|
| `SUPER_ADMIN` | Career-Nine staff, no scope restrictions |
| `INSTITUTE_ADMIN` | Full control of one or more institutes |
| `PRINCIPAL` | Single-institute admin |
| `TEACHER` | Read students, run assessments, view reports — scoped to assigned classes/sections |
| `COUNSELLOR` | Read student reports, communicate with students — scoped to assigned cohorts |
| `STUDENT` | Take own assessments, read own reports |
| `B2C_STUDENT` | Same as STUDENT but provisioned via campaign payment |
| `WEBHOOK` | Reserved for system-to-system (Razorpay) — not assigned to humans |

### 3.2 Permissions
Fine-grained verbs, namespaced by resource. Stored in a new `permission` table, mapped to `Role` many-to-many via `role_permission`. Examples:

```
institute.read, institute.write, institute.delete
session.read,   session.write
class.read,     class.write
section.read,   section.write
student.read,   student.write,    student.import_bulk
assessment.read, assessment.create, assessment.publish, assessment.delete
campaign.read,  campaign.write,   campaign.publish
report.read,    report.export
user.read,      user.write,       user.toggle_active
payment.refund, payment.webhook.handle
role.assign,    permission.grant
```

Roles → permissions is the RBAC half. Don't put scope into the permission string — keep scope orthogonal.

### 3.3 Scope attributes (ABAC) — reusing existing entities

Four nested dimensions in strict containment order, **each mapped to an existing entity** in the codebase:

| Dimension | Entity | Table | PK column |
|---|---|---|---|
| `institute` | [InstituteDetail](../spring-social/src/main/java/com/kccitm/api/model/career9/school/InstituteDetail.java) | `institute_details` | `institute_code` |
| `session` | [InstituteSession](../spring-social/src/main/java/com/kccitm/api/model/InstituteSession.java) | `institute_session` | `session_id` |
| `class` | [InstituteCourse](../spring-social/src/main/java/com/kccitm/api/model/InstituteCourse.java) | `institute_courses` | `course_code` |
| `section` | [Section](../spring-social/src/main/java/com/kccitm/api/model/Section.java) | `section` | `id` |

```
institute ⊇ session ⊇ class ⊇ section
```

**A class can have multiple sections** (10-A, 10-B, …). Each section can be assigned to a different teacher *or* one teacher can be assigned at the class level and inherit all its sections — handled naturally by the NULL-wildcard rule below, no special-casing needed.

**An `INSTITUTE_ADMIN` can span multiple institutes** (e.g. a director of a multi-branch school chain). Modeled by issuing multiple `user_scope` rows for the same user — no schema change.

A user can have one or many scope grants. Each grant is a row in `user_scope`:

```
user_id | institute_id | session_id | course_code | section_id   meaning
   42   |      5       |    NULL    |    NULL     |    NULL     ← all of institute 5
   42   |      7       |    NULL    |    NULL     |    NULL     ← AND all of institute 7  (multi-institute admin)
   55   |      5       |    2026    |    NULL     |    NULL     ← 2026 session of institute 5
   77   |      5       |    2026    |     12      |    NULL     ← Class 10 (course_code=12), all sections — teacher across 10-A/10-B/10-C
   88   |      5       |    2026    |     12      |     4       ← only 10-A (section_id=4) — single-section teacher
```

**Rule:** `NULL` at a level = "all of them" within the parent. Wildcards-by-omission. Containment is enforced — you cannot grant `section` without `class`, cannot grant `class` without either `session` or just `institute` (a single-institute admin can omit session+class+section).

A request targeting `(institute=5, session=2026, class=12, section=4)` is allowed iff there exists at least one `user_scope` row for the caller where every non-null column matches and every null column is treated as `*`.

`SUPER_ADMIN` bypass is handled by a boolean flag on the principal (cleaner than a sentinel row).

**⚠ Data-model gap that blocks full 4-dim enforcement** — see §13 bug #B1. Today `student_info` has `institute_id` and `school_section_id`, but **no FK to `institute_session` and only a free `studentClass` integer (not a FK to `institute_courses`)**. Until we add `session_id` and `course_code` columns to `student_info`, scope checks at the session/class level are not enforceable for student-targeted endpoints. Phase 1 includes that migration.

### 3.4 Permission check function

```java
boolean allowed(UserPrincipal user, String permission,
                Integer instituteId, Integer sessionId,
                Integer courseCode, Integer sectionId) {
    if (!user.hasPermission(permission)) return false;            // RBAC
    if (user.isSuperAdmin()) return true;                          // bypass
    return user.getScopes().anyMatch(s ->
           matches(s.instituteId, instituteId)
        && matches(s.sessionId,   sessionId)
        && matches(s.courseCode,  courseCode)
        && matches(s.sectionId,   sectionId));
}
// matches(null, x) = true   matches(a, b) = a.equals(b)
```

Types are `Integer` to match the existing entity PKs (`institute_code`, `session_id`, `course_code`, `section.id` are all `int` in the JPA models — see §3.3 table). Don't widen them.

Exposed two ways:
- **SpEL:** `@PreAuthorize("@auth.allows('student.read', #instituteId, #sessionId, #courseCode, #sectionId)")`
- **Programmatic:** `authService.require("report.export", instituteId, sessionId, courseCode, sectionId)` in service methods that take loose params.

### 3.5 JWT claims
Short-lived (60 min) access token, signed HS512 (rotate the secret — see §5.1):

```jsonc
{
  "sub": "user:42",
  "name": "Asha Verma",
  "email": "asha@kccitm.edu.in",
  "roles": ["INSTITUTE_ADMIN"],
  "perms": ["student.read","student.write","report.read","report.export", …],
  "scopes": [
    {"i": 5},                                    // all of institute 5
    {"i": 7},                                    // AND all of institute 7  (multi-institute director)
    {"i": 9, "s": 2026, "c": 12, "x": 4}         // institute 9, 2026 session, class course_code 12, section 4
  ],
  "sa": false,                                   // super-admin bypass flag
  "iat": …, "exp": …, "jti": "..."              // jti is needed for revocation
}
```

Keys are shortened (`i`/`s`/`c`/`x`) to keep the cookie small — a multi-institute admin with 30 institutes is ~300 bytes of scope claim, well under the 4KB cookie limit even with everything else.

Cap the claim size — if `perms` would exceed ~6KB, drop to `roles` only and resolve permissions server-side from a cache. Realistic role count keeps this within budget.

Refresh token (7 days, opaque, server-side `refresh_token` table, rotated on use, revocable). Stored as a separate HttpOnly cookie, scoped to `/auth/refresh`.

---

## 3.6 ⚡ Post-Phase-14 design update (2026-05-11)

After Phase 14 shipped, a clarification landed: **scope attributes attach to each role-assignment, not to the user globally.** The data model and §3.3 wording above describe a single `user_scope` table keyed on `user_id`. That was superseded by `user_role_scope` keyed on `user_role_group_mapping_id` (the FK to the role assignment).

**Why:** a single user can hold multiple roles with different scopes per role — a director who is both "Teacher of Section 10-A at School 5" and "Counsellor of Class 12 at School 7" gets two `user_role_scope` rows, each FK'd to a different `user_role_group_mapping` row. The previous `user_scope` design forced all of a user's roles to share one scope, which doesn't match how schools actually assign staff.

**What changed (read these substitutions into §3.3, §3.4, §3.5, §4 below):**

| Old (Phase 14 as-shipped) | New (post-Phase-14) |
|---|---|
| `user_scope` table | `user_role_scope` table |
| `user_id BIGINT NOT NULL` column | `user_role_group_mapping_id INT NOT NULL` column (FK to `user_role_group_mapping.id`, ON DELETE CASCADE) |
| `UserScope.java` JPA entity | `UserRoleScope.java` (links `@ManyToOne` to `UserRoleGroupMapping`, not `User`) |
| `UserScopeRepository.findByUser_Id(userId)` | `UserRoleScopeRepository.findAllByUserId(userId)` (JPQL walks through `user_role_group_mapping`) |
| `is_active` column on `user_scope` | Removed — admin deletes the row OR removes the underlying role assignment (cascades) |

**Migrations shipped 2026-05-11:**
- `V20260511006__supersede_user_scope_undo_seeds.sql` — drops `user_scope`, truncates `role_permission` (auto-seed only matched 1 of 8 roles) and `student_info_backfill_report` (auto-backfill resolved 0 of 1588 rows). Admin UI in Phase 15+ owns these assignments going forward.
- `V20260511007__create_user_role_scope.sql` — creates `user_role_scope` with FK to `user_role_group_mapping`, composite index `(institute_id, session_id, course_code, section_id)`, and containment CHECK.

**Wildcard semantics, containment rule, super-admin bypass, ABAC dimension types — all UNCHANGED.** Only the keying-column moves.

A multi-institute admin still gets multiple rows; now they live across multiple role assignments rather than multiple `user_scope` rows for one user.

---

## 4. Data model changes

New tables:

```sql
CREATE TABLE permission (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  code         VARCHAR(64) NOT NULL UNIQUE,        -- 'student.read'
  description  VARCHAR(255)
);

CREATE TABLE role_permission (
  role_id       INT NOT NULL,
  permission_id BIGINT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id)       REFERENCES role(id),
  FOREIGN KEY (permission_id) REFERENCES permission(id)
);

CREATE TABLE user_scope (
  id            BIGINT  PRIMARY KEY AUTO_INCREMENT,
  user_id       BIGINT  NOT NULL,
  institute_id  INT     NULL,        -- FK -> institute_details.institute_code
  session_id    INT     NULL,        -- FK -> institute_session.session_id
  course_code   INT     NULL,        -- FK -> institute_courses.course_code  ("class")
  section_id    INT     NULL,        -- FK -> section.id
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    BIGINT,
  INDEX idx_user (user_id),
  INDEX idx_inst (institute_id, session_id, course_code, section_id),
  FOREIGN KEY (user_id)      REFERENCES user(id),
  FOREIGN KEY (institute_id) REFERENCES institute_details(institute_code),
  FOREIGN KEY (session_id)   REFERENCES institute_session(session_id),
  FOREIGN KEY (course_code)  REFERENCES institute_courses(course_code),
  FOREIGN KEY (section_id)   REFERENCES section(id),

  -- Containment constraint: cannot grant a child level without its parent.
  -- (MySQL 8 CHECK constraints; ignored on 5.7 — enforce in service layer if 5.7)
  CONSTRAINT chk_scope_containment CHECK (
       (section_id IS NULL OR course_code IS NOT NULL)
    AND (course_code IS NULL OR session_id IS NOT NULL OR institute_id IS NOT NULL)
    AND (session_id IS NULL OR institute_id IS NOT NULL)
  )
);

-- Schema additions on student_info to enable session/class scope enforcement.
-- Today student_info has institute_id and school_section_id, but no session_id
-- and only a free studentClass integer (see §13 bug B1).
ALTER TABLE student_info
  ADD COLUMN session_id  INT NULL,
  ADD COLUMN course_code INT NULL,
  ADD INDEX idx_scope (institute_id, session_id, course_code, school_section_id),
  ADD CONSTRAINT fk_si_session FOREIGN KEY (session_id)  REFERENCES institute_session(session_id),
  ADD CONSTRAINT fk_si_course  FOREIGN KEY (course_code) REFERENCES institute_courses(course_code);
-- Backfill: derive from existing studentClass int + institute mapping where possible;
-- rows we can't resolve get NULL and a flag for product to reconcile.

CREATE TABLE refresh_token (
  jti           CHAR(36) PRIMARY KEY,             -- UUID
  user_id       BIGINT NOT NULL,
  issued_at     DATETIME NOT NULL,
  expires_at    DATETIME NOT NULL,
  revoked_at    DATETIME NULL,
  replaced_by   CHAR(36) NULL,                    -- chain on rotation
  user_agent    VARCHAR(255),
  ip            VARCHAR(45),
  INDEX idx_user (user_id),
  INDEX idx_exp  (expires_at)
);

CREATE TABLE auth_audit (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  ts            DATETIME(3) NOT NULL,
  user_id       BIGINT,
  permission    VARCHAR(64),
  scope         VARCHAR(128),                     -- "i=5,s=2026"
  resource_id   VARCHAR(64),
  decision      ENUM('ALLOW','DENY') NOT NULL,
  reason        VARCHAR(255),
  request_id    CHAR(36),
  INDEX idx_user_ts (user_id, ts),
  INDEX idx_deny   (decision, ts)
);
```

Existing tables touched (no rename — keep ORM happy):
- `role` — already exists, used as-is for the new `role_permission` join.
- `role_group`, `role_role_group_mapping`, `user_role_group_mapping` — kept. Treat `role_group` as an assignable role-bundle (e.g. "School Principal Bundle").
- `user.is_active` — keep; used for soft-disable.
- Existing institute/session/class/section tables — no schema change; we just reference them from `user_scope`.

Fix the inconsistent `Long`-vs-`@ManyToOne` mapping on [UserRoleGroupMapping.user](../spring-social/src/main/java/com/kccitm/api/model/UserRoleGroupMapping.java) and [RoleRoleGroupMapping.roleGroup](../spring-social/src/main/java/com/kccitm/api/model/RoleRoleGroupMapping.java) — both should be `@ManyToOne`. Cheap cleanup while we're touching this code.

---

## 5. Backend implementation

### 5.1 Phase 0 — Critical security fixes (ship in week 1, no model changes)
These are blocking issues that should not wait for the full redesign.

> **OAuth code paths are explicitly out of scope** for this plan per the user's instruction. Items that touch `OAuth2AuthenticationSuccessHandler`, `CustomOAuth2UserService`, or the provider configuration are tracked in §13 (bugs list) for a later cycle, not Phase 0.

| # | Fix | File |
|---|---|---|
| 0.1 | Externalize all secrets to env vars (DB password, Razorpay webhook secret, JWT signing secret). Rotate them — current values are in git history. OAuth client secrets stay deferred per scope. | [application.yml](../spring-social/src/main/resources/application.yml) |
| 0.2 | Rotate the JWT signing secret and emit per-environment secrets (dev ≠ staging ≠ prod). | application.yml |
| 0.3 | Enforce Razorpay webhook signature check in all profiles — currently dev/staging skip it. | [RazorpayService.java](../spring-social/src/main/java/com/kccitm/api/service/RazorpayService.java), [PaymentWebhookController.java:87](../spring-social/src/main/java/com/kccitm/api/controller/PaymentWebhookController.java#L87) |
| 0.4 | Tighten `HttpFirewall` — disable semicolon, double-slash, unsafe HTTP methods. | [SecurityConfig.java:65-71](../spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java#L65-L71) |
| 0.5 | Shrink `permitAll()` whitelist to **only** truly public endpoints: `/auth/login`, `/auth/signup`, `/auth/refresh`, `/oauth2/**` (untouched), `/payment/webhook/**`, `/campaign/public/**`, `/assessment-mapping/public/**`, `/school-registration/public/**`, `/util/file-get/**`. Everything currently behind `/user/**`, `/student/**`, `/student-info/**`, `/instituteBranch/**`, `/instituteCourse/**`, `/section/**`, `/measured-qualities/**`, `/coding/**`, `/getmarks/**`, `/actuator/*` moves behind authentication. | [SecurityConfig.java:139-184](../spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java#L139-L184) |
| 0.6 | Remove the catch-all `/**`, `/**/**`, `/**/**/**` patterns that mask everything else in the permitAll block. | SecurityConfig.java |
| 0.7 | Tighten CORS `allowedHeaders` — replace `*` with an explicit list (`Content-Type`, `Authorization`, `X-CSRF-Token`, `X-Requested-With`). Strip localhost origins from the **production** profile. | SecurityConfig.java:104-114, application.yml |

### 5.2 Phase 1 — Data + claim foundations
- Liquibase/Flyway migration for the four new tables in §4 (Hibernate `ddl-auto: update` is in use, but for tables with FKs we want explicit migrations — `ddl-auto` should move to `validate` in staging/prod, see bug B6).
- **Schema fix on `student_info`** (§4): add `session_id` and `course_code` columns + FKs, plus an index on `(institute_id, session_id, course_code, school_section_id)`. This is what unlocks 4-dimension ABAC enforcement on student endpoints.
- **Backfill `student_info.session_id` and `course_code`**: write a one-off migration that infers values from the existing `studentClass` integer + the institute's active `institute_session`. Rows we can't resolve get NULL + a `needs_review` flag — those students return 403 on scoped endpoints until product fills them in. **Fail closed.**
- Seed `permission` rows from an enum (`PermissionCode`) — single source of truth in Java.
- Seed `role_permission` rows by mapping each existing role-name to the new permission codes (do this with stakeholders — it's a product decision).
- Backfill `user_scope`:
  - For every existing user, derive scope from `UserStudent.institute` / staff-institute mappings.
  - Multi-institute admins (directors) need scope rows generated per institute they manage — there's no single source for this today; product/ops will provide the list.
  - For users with no clear institute, mark them `is_active=false` and require an admin to re-scope them — fail closed.

### 5.3 Phase 2 — Authorization plumbing
- `AuthorizationService` — central evaluator implementing §3.4. Exposed as `@auth` SpEL bean.
- `JwtClaims` value object + new `TokenProvider.createToken(...)` overload that takes `(userId, roles, perms, scopes, superAdmin)` and emits the §3.5 claim shape.
- `TokenAuthenticationFilter` — populate `UserPrincipal.scopes` from the JWT, not from a DB hit. Keep the DB hit as a fallback only if `perms` claim was dropped due to size.
- Method-level annotations:
  ```java
  @PreAuthorize("@auth.allows('student.read', #instituteId, #sessionId, #classId, #sectionId)")
  @GetMapping("/by-institute/{instituteId}")
  List<StudentDto> list(@PathVariable Long instituteId, ...) { … }
  ```
- A `@CurrentScopes` parameter-injection annotation for service-layer code that needs the caller's scope list to filter queries.
- Hibernate `@Filter` named `scopeFilter` on `StudentInfo`, `UserStudent`, `AssessmentTable`, `Campaign`, `InstituteBranch`, `Section`, … enabled in a `@PostAuthenticate` hook so every JPA query auto-filters by scope. (Filter is a single-line `WHERE` clause; the heavy work is enumerating which entities need it.)
- Add a static analysis check (Checkstyle rule or a custom ArchUnit test) that **fails the build if a `@*Mapping` method lacks `@PreAuthorize`** — closes the door on accidentally-public endpoints.

### 5.4 Phase 3 — Token lifecycle
- Shorten access-token TTL to 60 min.
- Add `POST /auth/refresh` — opaque refresh-token cookie in, new access-token cookie out, refresh-token rotated, old `refresh_token` row marked `replaced_by`.
- Add `POST /auth/logout` — revokes refresh token, clears cookies.
- Add `jti` claim + a small in-memory **deny list** (Caffeine, 1-hour TTL = access-token lifetime) for emergency revocation. Don't try to revoke every access token via DB on every request — that defeats stateless JWT.
- Add `GET /auth/me` — single source of truth for the frontend's user/permissions/scopes (replaces the heterogeneous `getUserByToken` flow).

### 5.5 Phase 4 — Defense in depth
- Per-IP + per-user rate limit on `/auth/login`, `/auth/refresh`, `/auth/signup`, `/student/save-csv`, `/user/getbyid/*`. Bucket4j + Redis if a Redis is already deployed; otherwise an in-process limiter is acceptable since the app runs single-instance per the current docker-compose.
- Add `auth_audit` writes for every DENY and for sensitive ALLOWs (`role.assign`, `user.write`, `payment.refund`).
- CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` via a `WebSecurityCustomizer`.
- Lock CORS down per profile — strip the noisy localhost list from production.

---

## 6. Admin frontend implementation

### 6.1 Phase A — Cookie-based session (kills XSS token risk)
- Backend sets two cookies on login: `cn_at` (access JWT, `HttpOnly; Secure; SameSite=Strict; Path=/`) and `cn_rt` (refresh, scoped to `/auth/refresh`).
- Frontend stops reading/writing tokens. Remove [AuthHelpers.ts:50-100](../react-social/src/app/modules/auth/core/AuthHelpers.ts#L50-L100) interceptor that injects `Authorization` — cookie is auto-sent.
- Add a CSRF guard: server emits a `cn_csrf` non-HttpOnly cookie; axios interceptor reads it and copies into `X-CSRF-Token` header on state-changing requests. Spring Security `CookieCsrfTokenRepository.withHttpOnlyFalse()` does this for us.
- Replace `AuthInit`'s "validate token, then proceed" flow with a single `GET /auth/me` on app load.

### 6.2 Phase B — Permission + scope model on the client
- Replace `authorityUrls: string[]` with a richer user object:
  ```ts
  type User = {
    id: number; name: string; email: string;
    roles: string[];
    permissions: string[];
    scopes: Array<{ i?: number; s?: number; c?: number; x?: number }>;
    superAdmin: boolean;
  }
  ```
- `useAuth()` exposes `can(perm, scope?)` — same predicate as the backend. UI uses it:
  ```tsx
  const { can } = useAuth();
  {can('report.export', { i: instituteId }) && <ExportButton />}
  ```
- `<Can perm="…" scope={…}>` wrapper component for declarative gating.
- `<RequirePermission perm="…">` route guard — replaces the URL-pattern guard in [PrivateRoutes.tsx:99-124](../react-social/src/app/routing/PrivateRoutes.tsx#L99-L124).
- [AsideMenuMain.tsx](../react-social/src/_metronic/layout/components/aside/AsideMenuMain.tsx) — replace `allowed("/path")` with `can("perm.code")`.
- The active-institute dropdown writes to a `ScopeContext` that **is sent to the server only as a hint**. The server still enforces from the JWT.

### 6.3 Phase C — Auth flow unification
The four parallel flows (admin, student portal, counsellor portal, assessment portal) all collapse to:
- One login endpoint per persona.
- Same cookie-based session, same `/auth/me` contract.
- Persona differentiation is *roles + scopes*, not separate localStorage keys.

Remove `localStorage.studentPortalLoggedIn`, `localStorage.counsellorPortalUser`, `sessionStorage.assessmentSessionToken`. Each becomes a normal user with the relevant role(s) and scope(s).

### 6.4 Phase D — UX details
- 401 from server while user is active → silent `/auth/refresh` → retry once → if still 401, redirect to login.
- Logout button calls `POST /auth/logout` and clears local React state.
- Permission errors show a *what* and *how to request access* message, not a bare toast.

---

## 7. Cross-cutting work

| Item | Detail |
|---|---|
| Type sharing | Generate TS types for `Permission` enum from the Java enum (Spring Doc / openapi-generator), so the frontend's `can('student.read')` strings are typed and any rename is caught at compile time. |
| Test strategy | (a) Spring `@WebMvcTest` per controller with `@WithMockUser(authorities=…)` + a `WithMockScopes` extension covering every annotated endpoint; (b) RTL tests for `<Can>` / `useAuth().can`; (c) one Cypress flow per role for the golden path. |
| Migration safety | Don't strip `permitAll` and seed scopes in the same release. Order: ① ship Phase 0 + auth foundation, ② run *both* old and new authorization in parallel for one release with logs-only mode, ③ enforce. |
| Telemetry | Every `DENY` decision is logged with `(user, perm, scope, resource, requestId)` to spot misconfigured roles before users hit a 403 wall. |
| Docs | One-page operator runbook: "how to grant Teacher X access to Section Y". Targeted at the institute-admin role. |

---

## 8. Phased rollout (recommended order)

1. **Week 1 — Phase 0:** §5.1 critical fixes. Rotate secrets, kill token-in-URL, enforce webhook signatures, tighten firewall, prune `permitAll`. No model changes. Ship.
2. **Week 2–3 — Phase 1 + 2 (logs-only):** Data model in §4. `@PreAuthorize` on every controller, but `@auth.allows(…)` evaluator runs in **log-only** mode (logs deny decisions, returns true). Frontend untouched.
3. **Week 4 — Phase A:** Cookie-based session on frontend + backend. Stop using `localStorage` for tokens. Still log-only authorization.
4. **Week 5 — Phase B + flip the switch:** Frontend uses `permissions` + `scopes`. Backend enforcer flips from log-only to enforcing. Watch `auth_audit` for one week.
5. **Week 6 — Phase 3 + C + D:** Refresh tokens, `/auth/me`, persona unification, UX polish.
6. **Week 7 — Phase 4:** Rate limits, audit, headers, CORS cleanup.
7. **Phase 6 (later) — Assessment app:** §9 below.

The log-only stage in step 2–3 is critical: it lets us discover the inevitable wrongly-mapped permission *before* a real user hits a 403.

---

## 9. Assessment app — sketch (Phase 6, full plan deferred)

The assessment app currently has *no* auth — `userStudentId` from `localStorage` is the entire identity. The redesign:

- At entry (campaign link, tokenized link, or student login), backend issues a **short-lived assessment session token** scoped to *exactly one* `(userStudentId, assessmentId)` pair. Signed JWT, 4-hour TTL, single audience.
- Stored in HttpOnly cookie *and* echoed once for the SPA's in-memory copy (since the assessment app is on a different subdomain it can choose either — cookie if subdomain set up, in-memory + auto-refresh otherwise).
- Every `/assessments/**`, `/assessment-answer/**`, `/student-demographics/**` endpoint validates the token AND that the requested `userStudentId`/`assessmentId` matches the token's claims. The body params become hints, not authority.
- `/assessments/getby/{id}`, `/assessments/getById/{id}`, `/assessments/prefetch/{userStudentId}` move from `permitAll` to "requires assessment-session token".
- Heartbeat endpoint authenticated by the same token.

That work is a separate planning doc once the admin + backend side is stable.

---

## 10. Critical files to be modified

**Backend (most touched)**
- [SecurityConfig.java](../spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java) — filter chain, permitAll prune, CORS, headers, firewall
- [TokenProvider.java](../spring-social/src/main/java/com/kccitm/api/security/TokenProvider.java) — new claim shape, jti, separate refresh provider
- [TokenAuthenticationFilter.java](../spring-social/src/main/java/com/kccitm/api/security/TokenAuthenticationFilter.java) — read perms+scopes from claims, deny-list lookup
- [OAuth2AuthenticationSuccessHandler.java](../spring-social/src/main/java/com/kccitm/api/security/oauth2/OAuth2AuthenticationSuccessHandler.java) — stop URL token, set cookies
- [AuthController.java](../spring-social/src/main/java/com/kccitm/api/controller/AuthController.java) — `/auth/refresh`, `/auth/logout`, `/auth/me`
- [User.java](../spring-social/src/main/java/com/kccitm/api/model/User.java) — drop `googleAuthString`, fix mapping inconsistencies on related entities
- New: `Permission.java`, `UserScope.java`, `RefreshToken.java`, `AuthAudit.java`, `AuthorizationService.java`, `PermissionCode.java` (enum), `ScopeFilter.java` (Hibernate filter)
- Every controller in `controller/` — add `@PreAuthorize` with explicit scope parameters

**Frontend (most touched)**
- [AuthHelpers.ts](../react-social/src/app/modules/auth/core/AuthHelpers.ts) — delete the localStorage layer, simplify interceptor to CSRF only
- [Auth.tsx](../react-social/src/app/modules/auth/core/Auth.tsx) — context shape (`permissions`, `scopes`, `can()`)
- [PrivateRoutes.tsx](../react-social/src/app/routing/PrivateRoutes.tsx) — replace URL-pattern guard with permission guard
- [AsideMenuMain.tsx](../react-social/src/_metronic/layout/components/aside/AsideMenuMain.tsx) — drive from `can()` not `authorityUrls`
- [authRedirectPage.tsx](../react-social/src/app/modules/auth/authRedirectPage.tsx) — no token in URL anymore
- [_models.ts](../react-social/src/app/modules/auth/core/_models.ts) — replace `authorityUrls` with `permissions`, `scopes`, `superAdmin`
- New: `<Can>`, `<RequirePermission>`, `useScope()`, `ScopeContext`
- Delete: `studentPortalLoggedIn`, `counsellorPortalUser`, `sessionStorage.assessmentSessionToken` patterns

---

## 11. Verification

Each phase has an explicit check before moving on:

**Phase 0**
- `grep -r 'token=' application.yml` returns nothing committed.
- OAuth login no longer puts `?token=` in the redirect URL — verify in browser DevTools network tab.
- Razorpay webhook with bad signature returns 401 in every profile.
- `/student-info/getByInstituteId/99999` as an anonymous caller now returns 401 (was 200).

**Phase 1 + 2 (log-only)**
- Migration ran, `permission`, `role_permission`, `user_scope` rows present.
- ArchUnit test fails if any `@*Mapping` method is missing `@PreAuthorize`.
- `auth_audit` table is collecting DENY-with-context entries; product reviews the deny stream and confirms each one is a legitimate block (i.e. the role/scope mapping is correct).

**Phase A (cookie session)**
- Frontend has no `localStorage.kt-auth-react-v` after login.
- Cookies are `HttpOnly; Secure; SameSite=Strict` (verify via DevTools).
- XSS smoke test: paste `<img src=x onerror="fetch('/auth/me').then(r=>r.text()).then(alert)">` into any rich-text input → cookie is sent (proves session works) → and the response is auditable. Pasting `alert(document.cookie)` returns empty (proves token is not JS-readable).

**Phase B (enforce)**
- A user with role `TEACHER` scoped to `(institute=5, section=B)` cannot `GET /student-info/getByInstituteId/7` (403, logged).
- The same user CAN `GET /student-info/getByInstituteId/5?sectionId=B`.
- `<Can perm="report.export">` hides the button for a user without the permission AND the backend independently 403s if they POST to the export endpoint directly.

**Phase 3**
- Access token TTL is 1 hour; idle user past 1 hour gets silent refresh from cookie; expired refresh forces re-login.
- `POST /auth/logout` revokes the refresh token; subsequent `/auth/refresh` returns 401.

**Phase 4**
- 11th login attempt within 1 minute is rate-limited.
- `auth_audit` has zero gaps for the last 24h of traffic.

End-to-end, a Cypress run per role (super-admin, institute-admin, principal, teacher, counsellor, student) covers the golden path + one negative-scope assertion each.

---

## 12. Decisions & open questions

Resolved by user direction:
- ~~Class vs section terminology~~ — class = `InstituteCourse.course_code`, section = `Section.id`. One class has many sections; teachers can be assigned at class level (wildcard section) or per-section.
- ~~Multi-institute admins~~ — yes, `INSTITUTE_ADMIN` can span multiple institutes via multiple `user_scope` rows.
- ~~OAuth changes~~ — out of scope for this redesign.
- ~~Session backfill strategy~~ — **map each student to their institute's currently-active `InstituteSession`** at backfill time. Unresolved rows (no active session / no institute) remain NULL and fail closed under ABAC. (Decision 2026-05-08.)
- ~~Default scope for new staff users~~ — **no scope at creation; admin must explicitly grant**. Fail closed, principle of least privilege. (Decision 2026-05-08.)
- ~~Teacher rostering data model~~ — **`user_scope` is the single source of truth**; the scope grant *is* the assignment. No separate `teacher_assignment` table for now. Per-assignment metadata (subject, class-teacher flag) can be added as columns on `user_scope` later if product needs it. (Decision 2026-05-08.)
- ~~Workflow~~ — **GSD plugin** (`/gsd:plan-phase` → `/gsd:execute-phase` per phase, atomic commits, checkpoints, resumable). (Decision 2026-05-08.)

Still open:
1. **Sub-institute hierarchy.** Above institute we have `InstituteBranch`. Does the multi-institute director also need branch-level scope, or is "institute" enough granularity? Currently the plan stops at institute. Revisit if/when a director user reports they need to limit access to one branch.
2. **Refresh token rotation on every use** vs **sliding refresh**. Recommend rotation-on-use (default) — stricter revocation. Defer final call to Phase 3 planning.

---

## 13. Known bugs & issues (collected during audit — to fix as part of, or alongside, this plan)

Each item is tagged with severity (**CRIT** / **HIGH** / **MED** / **LOW**), the phase that should fix it, and a file/line citation. Items the user has scoped *out* (OAuth) are kept here for visibility but not assigned a phase.

### A. Security — authentication / authorization
| ID | Sev | Issue | Where | Fix in |
|---|---|---|---|---|
| A1 | **CRIT** | Most "admin" endpoints are reachable anonymously because `permitAll()` covers `/user/**`, `/student/**`, `/student-info/**`, `/instituteBranch/**`, `/section/**`, `/coding/**`, `/getmarks/**`, `/actuator/*` and catch-all `/**` patterns | [SecurityConfig.java:139-184](../spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java#L139-L184) | Phase 0 |
| A2 | **CRIT** | JWT signing secret is the **same hardcoded value** in dev, sandbox, staging, production profiles, all in committed `application.yml`. A staging token forges a prod token. | application.yml lines 153, 332, 490, 648 | Phase 0 |
| A3 | **CRIT** | `GET /student-info/getByInstituteId/{instituteId}` and `getStudentsWithMappingByInstituteId/{instituteId}` trust the path param without checking the caller belongs to that institute. Enumerable today. | [StudentInfoController](../spring-social/src/main/java/com/kccitm/api/controller/career9/StudentInfoController.java) | Phase 2 (`@PreAuthorize`) |
| A4 | **CRIT** | JWT stored in `localStorage["kt-auth-react-v"]` — full token + `authorityUrls` JSON. XSS reads it in one line. | [AuthHelpers.ts:3](../react-social/src/app/modules/auth/core/AuthHelpers.ts#L3) | Phase A |
| A5 | **HIGH** | Database passwords for prod/staging committed in `application.yml`. Rotate. | application.yml | Phase 0 |
| A6 | **HIGH** | Razorpay webhook secret is empty in dev/sandbox/staging profiles, so `RazorpayService.verifyWebhookSignature` returns true unconditionally → anonymous callers can forge payment events in those envs. | [RazorpayService.java](../spring-social/src/main/java/com/kccitm/api/service/RazorpayService.java), application.yml | Phase 0 |
| A7 | **HIGH** | `POST /user/toggle-active/{id}`, `GET /user/delete/{id}`, `POST /user/update` have **no role check, no ownership check** and were in the permitAll block. | [UserController.java](../spring-social/src/main/java/com/kccitm/api/controller/UserController.java) | Phase 0 (permitAll) + Phase 2 (`@PreAuthorize`) |
| A8 | **HIGH** | `POST /student/save-csv` accepts bulk student upload anonymously. Anyone can inject students into any institute. | [StudentController.java](../spring-social/src/main/java/com/kccitm/api/controller/StudentController.java) | Phase 0 + Phase 2 |
| A9 | **HIGH** | No refresh token / no logout / no revocation — a stolen access token is valid for 10 days. | [TokenProvider.java](../spring-social/src/main/java/com/kccitm/api/security/TokenProvider.java), application.yml | Phase 3 |
| A10 | **HIGH** | `TokenAuthenticationFilter` silently swallows all exceptions — auth failures look like anonymous requests and continue down the chain. Loud-fail or at least log at WARN. | [TokenAuthenticationFilter.java](../spring-social/src/main/java/com/kccitm/api/security/TokenAuthenticationFilter.java) | Phase 2 |
| A11 | **HIGH** | `HttpFirewall` allows `setUnsafeAllowAnyHttpMethod(true)`, `setAllowUrlEncodedDoubleSlash(true)`, `setAllowSemicolon(true)` — opens classic path-confusion bypasses. | [SecurityConfig.java:65-71](../spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java#L65-L71) | Phase 0 |
| A12 | **HIGH** | `@PreAuthorize` is enabled globally but every annotation in the codebase is commented out. Method-level auth is effectively dead code. | [UserController.java:60](../spring-social/src/main/java/com/kccitm/api/controller/UserController.java#L60), `RoleController`, `UniversityMarkController` | Phase 2 |
| A13 | **HIGH** | Counsellor portal stores a user object in `localStorage["counsellorPortalUser"]` with **no obvious token** — unclear how subsequent calls are auth'd. Either there's no auth, or it's piggybacking on another flow. | [CounsellorLoginPanel.tsx:33](../react-social/src/app/pages/CounsellorLogin/components/CounsellorLoginPanel.tsx#L33) | Phase C (persona unification) |
| A14 | **HIGH** | Student-portal route guard checks `localStorage["studentPortalLoggedIn"]` — a boolean. Setting that flag in DevTools = "logged in". | [StudentRoutes.tsx:46-52](../react-social/src/app/routing/StudentRoutes.tsx#L46-L52) | Phase C |
| A15 | **MED** | CORS `allowedHeaders: "*"` and credentials enabled. Acceptable but should be tightened to an explicit list. | [SecurityConfig.java:104-114](../spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java#L104-L114) | Phase 0 |
| A16 | **MED** | Production CORS allows `http://localhost:5173` — leftover from dev. | application.yml prod profile | Phase 0 |
| A17 | **MED** | No rate limiting on `/auth/login`, `/auth/signup`, `/user/getbyid/*` — supports brute force and user enumeration. | global | Phase 4 |
| A18 | **MED** | No CSP header, no HSTS, no `X-Frame-Options`. | SecurityConfig.java | Phase 4 |
| A19 | **MED** | Signup creates users with `isActive=false` by default, but there's no email-verification or admin-approval flow that flips it on cleanly. Users can register and then can't log in. | [User.java:52-53](../spring-social/src/main/java/com/kccitm/api/model/User.java#L52-L53), [AuthController signup](../spring-social/src/main/java/com/kccitm/api/controller/AuthController.java) | Phase 3 |
| A20 | **MED** | No password complexity validation on signup. | AuthController.java signup | Phase 3 |
| A21 | **MED** | Frontend has an unused `refreshToken` field on `AuthModel` — type misleads readers; either implement or remove. | [_models.ts](../react-social/src/app/modules/auth/core/_models.ts) | Phase 3 |
| A22 | **MED** | `console.error` of auth-related state in production builds — leaks structure. | [AuthHelpers.ts:21,34,46](../react-social/src/app/modules/auth/core/AuthHelpers.ts), [Auth.tsx:81](../react-social/src/app/modules/auth/core/Auth.tsx#L81) | Phase D |
| A23 | LOW | Menu visibility lives entirely on the client (`AsideMenuMain` `allowed()`). User who knows a URL can navigate directly — currently caught only because backend lets them through. Becomes a real backstop once Phase 2 lands; until then, defense-in-depth is missing. | [AsideMenuMain.tsx](../react-social/src/_metronic/layout/components/aside/AsideMenuMain.tsx) | Phase B |

### B. Data model — blocks ABAC accuracy
| ID | Sev | Issue | Where | Fix in |
|---|---|---|---|---|
| B1 | **CRIT** | `student_info` has `institute_id` and `school_section_id` but **no `session_id` and no `course_code` FK** — only a free `studentClass` integer. Without these, we cannot enforce session-level or class-level scope on student-targeted endpoints (the whole point of the ABAC redesign). | [StudentInfo.java:52-58](../spring-social/src/main/java/com/kccitm/api/model/career9/StudentInfo.java#L52-L58) | Phase 1 schema migration |
| B2 | **HIGH** | `Section` table is **global** (just `id`, `name`, `display`) — "Section A" is shared across every institute. Today the (course, section) tuple disambiguates, but it's brittle. Decide whether to normalize (`section` becomes child of `institute_course`) or document the convention. | [Section.java](../spring-social/src/main/java/com/kccitm/api/model/Section.java) | Tech debt — track but don't block Phase 1 |
| B3 | **MED** | `UserRoleGroupMapping.user` is stored as `Long` instead of `@ManyToOne User`. Inconsistent with other join entities and forces manual joins. | [UserRoleGroupMapping.java:36](../spring-social/src/main/java/com/kccitm/api/model/UserRoleGroupMapping.java#L36) | Phase 1 (we're touching role tables) |
| B4 | **MED** | `RoleRoleGroupMapping.roleGroup` is stored as `Long` while `role` is `@ManyToOne` — same inconsistency. | [RoleRoleGroupMapping.java:37](../spring-social/src/main/java/com/kccitm/api/model/RoleRoleGroupMapping.java#L37) | Phase 1 |
| B5 | **MED** | `User.userRoleGroupMappings` is `FetchType.EAGER` — every User load drags the whole role tree. Becomes a perf issue once roles → permissions adds another hop. | [User.java:108-109](../spring-social/src/main/java/com/kccitm/api/model/User.java#L108-L109) | Phase 2 |
| B6 | **MED** | `spring.jpa.hibernate.ddl-auto: update` is on in every profile, including production. Risky for column renames, drops, charset changes. Should be `validate` in staging/prod with explicit migrations. | application.yml | Phase 1 (migration tooling adoption) |
| B7 | LOW | `User.googleAuthString` stores raw OAuth access tokens in plaintext DB. **Deferred per scope** (OAuth out of bounds), but flagging — if the DB leaks, every linked Google account does too. | [User.java:101-102](../spring-social/src/main/java/com/kccitm/api/model/User.java#L101-L102) | Deferred (OAuth) |

### C. Code / config hygiene
| ID | Sev | Issue | Where | Fix in |
|---|---|---|---|---|
| C1 | **HIGH** | Spring Boot 2.5.5 is end-of-life and carries several published CVEs. Upgrade plan needed (2.7.x → 3.x is a Jakarta-package break). | [pom.xml](../spring-social/pom.xml) | Separate upgrade phase (recommend immediately after Phase 4) |
| C2 | **MED** | Database name inconsistency: dev profile uses `kareer-9`, docker/staging uses `career-9`. Easy to lose work pointing at the wrong DB. | application.yml | Phase 0 (rename one or document loudly) |
| C3 | **MED** | Server port inconsistency: dev `8091`, docker `8080`. The `career-nine-assessment` `.env.development` I just added points at `:8080` — confirms the dev profile is intended to be docker'd. Document or unify. | application.yml, docker-compose.yml | Phase 0 (docs) |
| C4 | **MED** | Path typo in permitAll: `/assesment-questions/**` (missing the second `s`). Either a real endpoint with a typo or a dead rule. | [SecurityConfig.java:139-184](../spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java#L139-L184) | Phase 0 (during permitAll prune) |
| C5 | **MED** | Catch-all `/**`, `/**/**`, `/**/**/**` patterns in permitAll — extremely hard to audit and almost certainly masking unintended exposure. | SecurityConfig.java | Phase 0 |
| C6 | LOW | `/actuator/*` exposed in permitAll — leaks build info, health, env in some configurations. | SecurityConfig.java | Phase 0 |
| C7 | LOW | A `Dump20260130 (1).sql` is referenced from CLAUDE.md / lives near the repo — if checked in, schema dump in git. Should be in `.gitignore`. | repo root | Phase 0 |
| C8 | LOW | Four parallel axios setups (global, assessment-api custom instance, plus per-page direct calls). Easy to forget auth on a new one. | [assessmentApi.ts](../react-social/src/app/pages/StudentLogin/API/assessmentApi.ts) etc. | Phase C (unification) |
| C9 | LOW | OAuth token-in-URL-query smell ([OAuth2AuthenticationSuccessHandler:104-108](../spring-social/src/main/java/com/kccitm/api/security/oauth2/OAuth2AuthenticationSuccessHandler.java#L104-L108)) — **deferred per scope**, but the token-in-URL gets logged in nginx access logs / browser history / referer headers. | listed | Deferred (OAuth) |
| C10 | LOW | `OAuth2AuthenticationSuccessHandler` redirect-URI validator only matches host+port, ignoring path/scheme of the whitelist entries — looser than intended. **Deferred per scope.** | OAuth2AuthenticationSuccessHandler:116-131 | Deferred (OAuth) |

### D. Items the user explicitly deferred (OAuth)
Captured here so they're not lost. None move forward in this plan.

- **D1** — JWT emitted as URL query parameter on OAuth success. Fix later by setting an HttpOnly cookie before the redirect.
- **D2** — Raw OAuth access tokens persisted to `User.googleAuthString`.
- **D3** — Loose OAuth redirect-URI validation (host/port only).
- **D4** — OAuth provider-mismatch behaviour: if a user signed up with Google they can't later sign in via Facebook with the same email. UX, not security.

---
