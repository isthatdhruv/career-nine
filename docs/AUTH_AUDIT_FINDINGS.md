# Authentication & Authorization Security Audit — Career-Nine

**Scope:** RBAC + ABAC subsystem of the Spring Boot backend (`spring-social/`) on branch `attribute-based-auth`, plus relevant frontend gating notes.
**Date:** 2026-05-21
**Method:** Source review of the `security/`, `config/`, controller, service, and migration layers. Each finding was verified against surrounding code. Findings are confirmed unless explicitly marked *Needs review*.
**Important caveat:** This branch ships the entire RBAC/ABAC machinery in **log-only mode** (see CRIT-1). That single configuration value means almost every per-endpoint authorization annotation in the codebase is currently a no-op. Most of the lower-severity findings below become *exploitable today* specifically because of CRIT-1.

---

## Executive Summary

| ID | Severity | Title |
|------|----------|-------|
| CRIT-1 | CRITICAL | ABAC/RBAC enforcement disabled in ALL profiles (`enforce-mode: log-only`) — every `@auth.allows()` returns `true` |
| CRIT-2 | CRITICAL | IDOR: assessment-scoped JWT grants read/write of any student's PII on `/student-info/**` and `/student-demographics/**` |
| HIGH-1 | HIGH | IDOR: `/auth/assessment-session` (permitAll) mints a valid student session for any guessable `userStudentId`+`assessmentId` |
| HIGH-2 | HIGH | `/dashboard/admin/snapshot` admin endpoints have no `@PreAuthorize` — any authenticated principal (incl. students) reads admin analytics |
| HIGH-3 | HIGH | JWT parser does not pin the signing algorithm — accepts any algorithm the key type allows |
| MED-1 | MEDIUM | Hardcoded fallback JWT signing secret committed in `application.yml` |
| MED-2 | MEDIUM | OAuth2 success handler emits a 10-day JWT in a URL query parameter (history/log/referrer leak) |
| MED-3 | MEDIUM | Rate limiting does not cover the anonymous PII/token-minting endpoints (`/auth/assessment-session`, `/entitlement/redeem-token`, `/auth/oauth-exchange`) |
| MED-4 | MEDIUM | Sandbox/production documented as "flipped to enforce" but config value is `log-only` — soak never happened |
| LOW-1 | LOW | Username-enumeration / behavioral differences on `/auth/login` |
| LOW-2 | LOW | CSP shipped report-only in every profile incl. production; `unsafe-inline`+`unsafe-eval` in `script-src` |
| LOW-3 | LOW | jti revocation deny-list is in-process Caffeine only — lost on restart, not shared across instances |
| INFO-1 | INFO | CSRF exemptions on `/campaign/public/**` etc. are appropriate (verified, not over-broad) |
| INFO-2 | INFO | Frontend route/menu gating is not a security boundary (by design) — backend must enforce |

---

## CRITICAL

### CRIT-1 — RBAC/ABAC enforcement is disabled in every profile

**Severity:** CRITICAL. The entire authorization model the branch was built to add is inert in production.

**Location:**
- `spring-social/src/main/java/com/kccitm/api/security/AuthorizationService.java:55` (`@Value("${auth.enforce-mode:log-only}")`) and `:136-151` (`recordAndReturn`)
- `spring-social/src/main/resources/application.yml:184` → `enforce-mode: log-only`
- `application-dev.yml:85`, `application-sandbox.yml:96`, `application-production.yml:103` → all `log-only`

**Problem:**
```java
// AuthorizationService.recordAndReturn (line 150)
return "enforce".equalsIgnoreCase(enforceMode) ? policyDecision : true;
```
Every controller authorization annotation in the app is of the form `@PreAuthorize("@auth.allows('student_info.read.all')")`. `@auth.allows(...)` calls `decide(...)` → `recordAndReturn(...)`. In `log-only` mode (the default and the value in **all four** profile files including `application-production.yml`), the method records a DENY to the audit log and then **returns `true` regardless of the policy decision**.

**Why it's exploitable:** Any authenticated user — a student, a counsellor, a low-privilege staff account — can call any RBAC/ABAC-gated endpoint and receive HTTP 200 with the full payload. This includes role/permission management (`RoleController.updateRolePermissions` → `@auth.allows('permission.grant')` at `RoleController.java:118`), student PII bulk export, entitlement revocation, etc. The ABAC scope checks (`institute/session/course/section`) never narrow anything. The `@PreAuthorize` coverage test (`ControllerPreAuthorizeCoverageTest`) gives a false sense of safety: it only verifies the *annotation is present*, not that it is *enforced*.

**Remediation:** Set `AUTH_ENFORCE_MODE=enforce` (or change the profile YAML) for production after a real soak. Before flipping, run an integration pass to confirm seeded `role_permission` rows cover all legitimate flows, because flipping will start returning 403s. Treat the flip as the actual go-live of this feature.

---

### CRIT-2 — IDOR: assessment-scoped token can read/write any student's PII

**Severity:** CRITICAL. Cross-tenant PII disclosure and tampering, exploitable by any student with a normal assessment session, independent of CRIT-1.

**Location:**
- `spring-social/src/main/java/com/kccitm/api/security/TokenAuthenticationFilter.java:69-74` (`ASSESSMENT_SCOPE_PATHS` includes `/student-info/` and `/student-demographics/`) and `:104-140` (assessment-token principal has **empty authorities** and is **not** a `UserPrincipal`)
- `spring-social/src/main/java/com/kccitm/api/controller/StudentInfoController.java:677-714` (`GET /student-info/getDemographics/{userStudentId}`)
- `spring-social/src/main/java/com/kccitm/api/controller/career9/StudentDemographicResponseController.java:77-89` (`GET /student-demographics/contact-info/{userStudentId}`) and `:93-114` (`POST /student-demographics/contact-info/{userStudentId}`)

**Problem:** When the filter sees a `scope=assessment` JWT on an assessment-scope path it sets a minimal authentication whose principal is the `userStudentId` *string* with **no authorities** (`TokenAuthenticationFilter.java:131-137`). It deliberately stashes the verified identity as request attributes (`assessmentUserStudentId`, `assessmentAssessmentId`). The contract is that controllers cross-check the path/body id against the token id.

`AssessmentAnswerController.submit` honors that contract (`AssessmentAnswerController.java:258-275`: it compares `tokenStudentId` to body `userStudentId` and returns 403 on mismatch). But the read/update endpoints on the same scoped paths do **not**:
```java
// StudentDemographicResponseController.java:77
@GetMapping("/contact-info/{userStudentId}")
public ResponseEntity<?> getContactInfo(@PathVariable Long userStudentId) {
    UserStudent userStudent = userStudentRepository.findById(userStudentId)...
    result.put("email", info.getEmail());
    result.put("phoneNumber", info.getPhoneNumber());   // any student's email + phone
```
`getDemographics` (name, gender, class, board, username) and `updateContactInfo` (overwrite another student's email/phone) are the same.

These endpoints carry `@PreAuthorize("@auth.allows('student_info.read')")`, but that gate cannot help here: the assessment principal is not a `UserPrincipal`, so `AuthorizationService.currentPrincipal()` returns `null` → records `ANONYMOUS` and (because of CRIT-1) returns `true`. Even with CRIT-1 fixed, the gate would 403 *all* assessment-token traffic on these routes, breaking the legitimate single-student flow — so the correct fix is an identity cross-check, not RBAC.

**Why it's exploitable:** A student obtains a normal `cn_at_asmnt` cookie for their own `(userStudentId, assessmentId)` via the documented flow, then iterates `userStudentId` in the path of `GET /student-demographics/contact-info/{id}` to harvest every student's email + phone, and uses the `POST` variant to corrupt other students' contact details.

**Remediation:** On every assessment-scope controller method that takes a `userStudentId`, require `userStudentId == request.getAttribute("assessmentUserStudentId")` when an assessment-scoped token is present (mirror the `submit` check). Centralize this in an interceptor over `ASSESSMENT_SCOPE_PATHS` so new endpoints inherit it. Audit all `/student-info/**` and `/student-demographics/**` handlers that accept an id.

---

## HIGH

### HIGH-1 — IDOR / horizontal escalation on `/auth/assessment-session`

**Severity:** HIGH. Anonymous endpoint mints a real student session from attacker-supplied ids.

**Location:** `spring-social/src/main/java/com/kccitm/api/controller/AssessmentSessionController.java:99-162`; permitAll + CSRF-exempt in `SecurityConfig.java:253` and `:307`.

**Problem:** The endpoint is `permitAll`. Its only "gate" is: (1) institute feature flag enabled, and (2) a `StudentAssessmentMapping` row exists for the `(userStudentId, assessmentId)` pair in the request body (`:140-147`). It never verifies the *caller* is that student — there is no shared secret, OTP, DOB, or signed token in the request. On success it issues a 4h `cn_at_asmnt` cookie bound to that student.
```java
Optional<StudentAssessmentMapping> mapping = mappingRepo
    .findFirstByUserStudentUserStudentIdAndAssessmentId(req.userStudentId, req.assessmentId);
if (!mapping.isPresent()) { return 403; }
// ... mints token for ANY caller who guessed an enrolled pair
String token = tokenProvider.createAssessmentSessionToken(req.userStudentId, req.assessmentId);
```
`userStudentId` and `assessmentId` are sequential numeric DB ids. An attacker for whom an institute has the cookie-auth flag enabled can brute-force pairs and mint a valid session for any enrolled student — then (combined with CRIT-2) read/alter that student's PII and submit assessment answers on their behalf.

**Remediation:** Require proof of identity before minting: a redemption token (the same `SecureRandom` access token already used by the B2C `redeem-token` path is a good model), or DOB/OTP verification matching the student record. Do not mint a session purely from two enumerable ids. Add rate limiting (see MED-3).

---

### HIGH-2 — Admin dashboard endpoints missing authorization

**Severity:** HIGH. Sensitive aggregate data exposed to any logged-in account.

**Location:** `spring-social/src/main/java/com/kccitm/api/controller/career9/DashboardSnapshotController.java:20-32`.

**Problem:** Both methods are admin analytics endpoints with no `@PreAuthorize`/`@Secured`:
```java
@GetMapping(value = "/admin/snapshot", ...)            // line 20
@PostMapping(value = "/admin/snapshot/refresh", ...)   // line 27
```
They fall through to the global `.anyRequest().authenticated()` rule (`SecurityConfig.java:339`), so *any* authenticated principal — a student, a counsellor, a pending/low-privilege staff user — can read the org-wide admin dashboard snapshot and force expensive recomputation. The method names imply admin-only data (`ADMIN_DASHBOARD_KEY`).

Note: this controller is **not** in `ControllerPreAuthorizeCoverageTest.EXCLUSIONS`, so the arch test should be flagging it — indicating the test is either not gating merges or the controller post-dates the baseline. Worth fixing the CI gate too.

**Remediation:** Add `@PreAuthorize("@auth.allows('dashboard.admin.read')")` (and a write/refresh permission for the POST), seed the permission, and assign it only to admin role groups. Fix CI so the coverage test blocks merges.

---

### HIGH-3 — JWT parser does not pin the signing algorithm

**Severity:** HIGH (defense-in-depth; severity depends on jjwt version behavior — verify).

**Location:** `spring-social/src/main/java/com/kccitm/api/security/TokenProvider.java:194-197, 247-256, 299-306, 309-325, 352-356` — every parse uses `Jwts.parser().setSigningKey(signingKey).parseClaimsJws(token)` with no `require`/algorithm restriction.

**Problem:** Tokens are minted with HS512 (`:189`) but verification never asserts the header `alg` is HS512. The parser trusts the token header to pick the verification algorithm. Historically this is the class of bug behind JWT algorithm-confusion (`alg: none`, or downgrading HS512→HS256 to weaken brute-force). Modern jjwt (0.11+ with `hmacShaKeyFor`) rejects `none` and mismatched key types, which mitigates the worst case — but the code does not *explicitly* enforce the expected algorithm, so the protection is implicit and version-dependent.

**Remediation:** Pin the algorithm explicitly, e.g. build a parser that only accepts HS512 (jjwt: `parserBuilder().require(...)` / verify via `SigningKeyResolver` that rejects non-HS512, or upgrade and use `Jwts.parserBuilder().setSigningKey(key).build()` which enforces key/alg consistency). Confirm the jjwt version in `pom.xml` and add a unit test that a token with `alg: none` and a token signed with a different alg are both rejected. *Needs review:* exact jjwt version to confirm residual exposure.

---

## MEDIUM

### MED-1 — Hardcoded fallback JWT secret committed to source

**Severity:** MEDIUM. The real deployments override it via gitignored `.env`, so this is a fallback/misconfiguration risk rather than an active leak.

**Location:** `spring-social/src/main/resources/application.yml:134`:
```yaml
tokenSecret: "${APP_AUTH_TOKEN_SECRET:1PG4GePk3fxNKAAgI45mGa+YzrgVidfeau5o+Y5T+IUzyr/Ab3+O2C/QaG7s+XujsJdPlBgqsBc4tEKLenVI1A==}"
```
**Verified:** the root `.env` (confirmed gitignored) sets `APP_AUTH_TOKEN_SECRET`, so production uses a real secret. The danger is any environment that forgets to set the env var silently boots with a **publicly known** signing key committed to git history — anyone could forge admin JWTs there. `TokenProvider.initSigningKey` only checks length (`:87`), not that it differs from the baked-in default.

**Remediation:** Remove the default value so a missing `APP_AUTH_TOKEN_SECRET` fails fast at boot (the `initSigningKey` null/length check already supports this). Rotate the committed secret out of any environment that may have used it, and consider purging it from git history.

---

### MED-2 — OAuth2 success handler returns a 10-day JWT in a URL query parameter

**Severity:** MEDIUM. Token leakage via browser history, proxy/server logs, and `Referer`.

**Location:** `spring-social/src/main/java/com/kccitm/api/security/oauth2/OAuth2AuthenticationSuccessHandler.java:104-108`.

**Problem:**
```java
String token = tokenProvider.createToken(authentication);   // legacy 10-DAY TTL, not the 60-min access token
return UriComponentsBuilder.fromUriString(targetUrl)
        .queryParam("token", token).build().toUriString();   // ?token=<jwt> in the redirect URL
```
Two issues: (1) it uses `createToken` (10-day `tokenExpirationMsec`, `TokenProvider.java:106-109`) instead of the Phase-18 short-lived `createAccessToken` (60-min); (2) it places that long-lived JWT in a URL query string. URLs leak into browser history, server/access logs, and cross-origin `Referer` headers. The `/auth/oauth-exchange` bridge then converts it to a cookie, but the long-lived token has already been exposed in the URL and remains valid for 10 days even after exchange.

**Remediation:** Mint `createAccessToken` (short TTL) here, and prefer setting the cookie server-side at the callback rather than handing the JWT through the URL. If the URL hop must remain, use a one-time, short-TTL exchange code rather than the JWT itself.

---

### MED-3 — Rate limiting omits the anonymous token-minting/PII endpoints

**Severity:** MEDIUM. Enables the brute-force in HIGH-1 and PII harvesting in CRIT-2 to run unthrottled.

**Location:** `spring-social/src/main/java/com/kccitm/api/security/ratelimit/RateLimitFilter.java:58-64` — `PER_IP_PATHS` is exactly `{/auth/login, /auth/refresh, /auth/signup}`.

**Problem:** The per-IP limiter (the only limiter that runs before authentication) covers only the three classic auth endpoints. It does **not** cover `/auth/assessment-session` (HIGH-1's enumeration target), `/entitlement/redeem-token`, or `/auth/oauth-exchange`, all of which are `permitAll` and accept attacker-controlled identifiers/tokens. There is no throttle on enumerating `userStudentId`/`assessmentId` pairs or on the IDOR PII reads in CRIT-2.

**Remediation:** Add `/auth/assessment-session`, `/entitlement/redeem-token`, and the assessment-scope PII GET endpoints to the per-IP (and where applicable per-student) limiter buckets.

---

### MED-4 — Enforce-mode soak documented as done but never applied

**Severity:** MEDIUM. Process/correctness gap that conceals CRIT-1.

**Location:** `application-sandbox.yml:94` comment ("Phase 17-04 (2026-05-12): sandbox flipped to `enforce` for pre-prod soak") vs `:96` actual value `enforce-mode: log-only`. Same contradiction in `application-production.yml:93` comment vs `:103` value.

**Problem:** The comments assert sandbox was flipped to `enforce` to soak the new semantics before production. The actual configured value in sandbox (and production) is `log-only`. So the soak that was supposed to validate enforcement never ran; the team may believe ABAC is being exercised when it is not. This is the operational reason CRIT-1 persists.

**Remediation:** Actually flip sandbox to `enforce`, soak, fix the resulting 403s (missing seeded permissions), then flip production. Reconcile the comments with reality.

---

## LOW

### LOW-1 — Login user-enumeration surface

**Severity:** LOW.

**Location:** `spring-social/src/main/java/com/kccitm/api/controller/AuthController.java:93-101`.

**Problem:** `/auth/login` returns distinct messages/branches: unknown email → "Invalid email or password.", inactive user → "Your registration is under Process", and only then runs `authenticationManager.authenticate`. The distinct "under Process" branch and the early return for unknown emails (before any password hashing) let an attacker enumerate which emails are registered and which are pending vs active, and create a timing oracle (no bcrypt comparison on the unknown-email path).

**Remediation:** Return a single generic failure message for all credential failures and run a dummy bcrypt comparison on the unknown-email path to equalize timing.

### LOW-2 — CSP report-only everywhere; `unsafe-inline`/`unsafe-eval` in `script-src`

**Severity:** LOW (documented as an accepted phase defect).

**Location:** `spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java:418-452` (header is always `Content-Security-Policy-Report-Only`, even in production; `script-src` includes `'unsafe-inline' 'unsafe-eval'`).

**Problem:** CSP never blocks anything (report-only in every profile), and the script policy permits inline/eval, so it provides little XSS mitigation. Acknowledged in the code comments as deferred. Lowers the residual protection that would otherwise backstop a token-in-DOM/XSS issue.

**Remediation:** Complete the deferred flip to enforcing CSP in production and move toward nonce-based script-src to drop `unsafe-inline`/`unsafe-eval`.

### LOW-3 — jti revocation deny-list is in-process only

**Severity:** LOW.

**Location:** `spring-social/src/main/java/com/kccitm/api/security/JtiDenyListService.java:35-73` (Caffeine cache, documented as in-process, dropped on restart).

**Problem:** Logout/emergency-revoke adds the access-token `jti` to a local Caffeine cache. On JVM restart the deny-list is lost, so a revoked-but-unexpired access token (up to 60 min) becomes usable again; and in any multi-instance deployment a token revoked on one node is still accepted on others. Documented as acceptable for single-instance + 60-min TTL, which is reasonable today but brittle.

**Remediation:** Move the deny-list to a shared store (Redis) before horizontal scaling; until then, keep access-token TTL short.

---

## INFO / Verified-OK

### INFO-1 — CSRF exemptions are scoped, not over-broad
The CSRF `ignoringAntMatchers` list (`SecurityConfig.java:244-265`) exempts auth bootstrap endpoints, OAuth callbacks, the Razorpay webhook, and the anonymous B2C public funnels (`/campaign/public/**`, `/entitlement/redeem-token`, `/promo-code/validate`, `/bet-report-data/public/**`, `/navigator-report-data/public/**`). These are either cookieless flows with no prior `cn_csrf` to validate, or are protected by their own signature/token gates. The Razorpay webhook is verified by constant-time HMAC-SHA256 (`RazorpayService.java:196-219`). CSRF was **not** disabled globally. This is appropriate.

### INFO-2 — Frontend gating is not a security boundary (expected)
`/auth/me` (`AuthController.java:253-307`) returns `permissions`, `scopes`, `urls`, and `superAdmin` so the React `RequirePermission` guard and menu can render conditionally. This is presentation-layer only; the backend `@auth.allows()` checks are the real boundary. Given CRIT-1, the *only* effective gate today is the frontend, which is trivially bypassable with direct API calls — reinforcing the urgency of CRIT-1.

### Verified-OK details worth noting
- B2C entitlement access tokens are 30 bytes of `SecureRandom`, URL-base64, 30-day TTL (`EntitlementService.java:43,517-521`) — not guessable; `redeemAccessToken` checks token + optional entitlementId + status + expiry (`:179-188`). Good.
- `TokenProvider` deliberately omits `perms[]` from the JWT and re-hydrates permissions and the `sa` flag from the DB on every request (`TokenProvider.java:171-179`, `TokenAuthenticationFilter.java:148-174`), so mid-session promote/revoke takes effect next request. Good design.
- Refresh tokens are opaque UUIDs persisted server-side with rotation + reuse detection (`AuthController.refresh` `:192-239`). Good.
- `signingKey` length is validated (≥64 bytes for HS512) at boot (`TokenProvider.java:79-93`).

---

## Recommended remediation order
1. **CRIT-2 + HIGH-1** — close the assessment-token IDOR and the session-minting enumeration *before* enforcing, because they are exploitable today and independent of enforce-mode.
2. **HIGH-2** — add authorization to the admin dashboard endpoints and fix the CI coverage gate.
3. **CRIT-1 + MED-4** — soak `enforce` in sandbox, fix the permission seed gaps it surfaces, then flip production.
4. **HIGH-3, MED-1, MED-2, MED-3** — algorithm pinning, remove committed secret default, fix OAuth URL token, extend rate limiting.
5. **LOW-1/2/3** — enumeration message, CSP enforce, shared revocation store.
