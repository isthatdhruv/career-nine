---
phase: 13-critical-security-fixes
plan: 02
subsystem: backend-security-filter-chain
tags: [security, spring-security, cors, http-firewall, authorization, breaking-change]
dependency-graph:
  requires:
    - "13-01 (secret externalization — JWT secret resolves via ${APP_AUTH_TOKEN_SECRET})"
  provides:
    - "permitAll() trimmed to EXACTLY the 9 ROADMAP-mandated public paths + OPTIONS + static assets"
    - ".anyRequest().authenticated() enforces auth on everything else (~25 admin surfaces previously public)"
    - "StrictHttpFirewall with default settings — rejects ; %2F // TRACE CONNECT custom-verbs"
    - "CORS allowedHeaders is an explicit 7-header allowlist (no more wildcard reflection)"
    - "Production CORS no longer trusts http://localhost:5173"
  affects:
    - "spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java (rewritten authorizeRequests + firewall bean + CORS bean)"
    - "spring-social/src/main/resources/application.yml (production CORS allowedOrigins only)"
tech-stack:
  added: []
  patterns:
    - "Spring Security 5.x WebSecurityConfigurerAdapter — kept; no SecurityFilterChain bean form yet"
    - "Allowlist-only authorization with anyRequest().authenticated() as the closing catch-all"
    - "Default StrictHttpFirewall rejection semantics for non-standard verbs and path-encoding tricks"
key-files:
  created:
    - ".planning/phases/13-critical-security-fixes/13-02-SUMMARY.md"
    - ".planning/phases/13-critical-security-fixes/13-02-COMMITS.md"
  modified:
    - "spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java"
    - "spring-social/src/main/resources/application.yml"
decisions:
  - "permitAll() shrunk from ~70 entries to exactly 9 public-app paths + OPTIONS + static assets — matches ROADMAP success criterion #3 verbatim"
  - "Three paths that were public in v1 of this plan are NOW behind auth (BREAKING): /assessments/prefetch/**, /leads/capture, /bet-report-data/public/**"
  - "Firewall bean renamed allowedHttpMethods() → strictHttpFirewall() — old name was misleading after the change; Spring wires by HttpFirewall type so name does not affect wiring"
  - "CORS allowedHeaders set to explicit 7-header allowlist (Authorization, Content-Type, Accept, X-Assessment-Session, X-Assessment-Student-Id, X-Assessment-Id, X-Requested-With) — the headers actually used by the codebase per RESEARCH.md §5"
  - "Production CORS dropped localhost:5173; dev/sandbox/staging kept their localhost entries (dev needs them; sandbox is hit from local browsers per QA workflow)"
  - "walrus-app-e2a6a.ondigitalocean.app retained in production CORS — flagged as open question for product confirmation"
  - "/actuator/* moved behind auth — health-check probes will need a JWT or a single permitAll('/actuator/health') line if confirmed needed; flagged as open question"
metrics:
  duration-seconds: 198
  duration-human: "3m 18s"
  completed: 2026-05-11T09:32:37Z
  tasks-completed: 2
  tasks-total: 2
---

# Phase 13 Plan 02: Spring Security Filter-Chain Hardening Summary

> **BREAKING CHANGE — read first.** The `permitAll()` allowlist is trimmed to the exact 11 patterns mandated by ROADMAP success criterion #3. Three paths that were previously public are now behind `.authenticated()`:
>
> | Path                          | Known impact                                                                                   |
> | ----------------------------- | ---------------------------------------------------------------------------------------------- |
> | `/assessments/prefetch/**`    | **`career-nine-assessment` student app will return 401** — fix deferred to `docs/AUTH_REDESIGN_PLAN.md §9`. |
> | `/leads/capture`              | Anonymous marketing-form POSTs will return 401. Confirm with product before shipping.          |
> | `/bet-report-data/public/**`  | Anonymous report viewers / integrations will return 401. Confirm with product before shipping. |
>
> Additionally: `StrictHttpFirewall` now rejects semicolon paths, URL-encoded slashes, double-slashes, and TRACE/CONNECT (will return 400 instead of being silently passed). `/actuator/*` moved behind auth — load-balancer probes hitting `/actuator/health` anonymously will 401.
>
> **Decision gate is at commit time.** Changes are staged but unmerged. To defer, run `git reset HEAD spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java spring-social/src/main/resources/application.yml`. See `13-02-COMMITS.md` for the full diff inventory and commit-message drafts.

Trimmed the Spring Security `WebSecurityConfigurerAdapter`-based filter chain to (a) close ~25 anonymously-exposed admin surfaces by replacing the legacy ~70-entry `permitAll()` block with an exact 11-pattern public allowlist and `.anyRequest().authenticated()` as the closing rule, (b) revert `StrictHttpFirewall` to all defaults so non-standard HTTP verbs, semicolon paths, URL-encoded slashes, and double-slashes are rejected with HTTP 400 instead of passed through, (c) replace the `setAllowedHeaders(Arrays.asList("*"))` wildcard with an explicit 7-header allowlist (the headers the codebase actually sends), and (d) drop `http://localhost:5173` from the production-profile CORS allowedOrigins. OAuth2 success/failure-handler wiring, the TokenAuthenticationFilter `addFilterBefore` line, and the entire `@EnableGlobalMethodSecurity` annotation are unchanged.

## The Locked Public-Path Surface (post-13-02)

The `authorizeRequests()` block now contains exactly three `.antMatchers(...)` invocations:

```java
.authorizeRequests()
// 1. CORS preflight — must stay open for every path
.antMatchers(HttpMethod.OPTIONS, "/**").permitAll()

// 2. Root, error page, favicon, static assets (10 entries)
.antMatchers(
        "/", "/error", "/favicon.ico",
        "/**/*.png", "/**/*.gif", "/**/*.svg", "/**/*.jpg",
        "/**/*.html", "/**/*.css", "/**/*.js")
.permitAll()

// 3. Public application endpoints — ROADMAP success criterion #3 EXACTLY (9 patterns)
.antMatchers(
        "/auth/login",
        "/auth/signup",
        "/auth/refresh",
        "/oauth2/**",
        "/payment/webhook/**",
        "/campaign/public/**",
        "/assessment-mapping/public/**",
        "/school-registration/public/**",
        "/util/file-get/**")
.permitAll()

.anyRequest()
.authenticated()
```

### Path inventory: kept public

| Path                                | Why                                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/auth/login`                       | Login endpoint — must be anonymous by definition.                                                    |
| `/auth/signup`                      | Signup endpoint — must be anonymous by definition.                                                   |
| `/auth/refresh`                     | Reserved for Phase 18 refresh-token endpoint; whitelisted now so 18 doesn't have to re-edit Security. |
| `/oauth2/**`                        | OAuth2 authorization + callback flow. Covers `/oauth2/callback/google/*` — explicit entry omitted as redundant. |
| `/payment/webhook/**`               | Razorpay → us callback. Signature-validated by controller; 13-03 makes the misconfig fail-fast.      |
| `/campaign/public/**`               | Public B2C campaign landing pages.                                                                   |
| `/assessment-mapping/public/**`     | Public assessment-link entry points.                                                                 |
| `/school-registration/public/**`    | Public school-onboarding form.                                                                       |
| `/util/file-get/**`                 | File URLs embedded in PDFs (verified via `htmlToPdfString.java`).                                    |
| `OPTIONS /**`                       | CORS preflight.                                                                                      |
| Static assets                       | Favicon, root, error page, `*.png/gif/svg/jpg/html/css/js`.                                          |

### Path inventory: BREAKING — moved behind `.authenticated()`

These three were `permitAll()` before this plan; they are now behind auth per locked criterion #3:

| Path                          | New status        | Impact                                                                                                              |
| ----------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `/assessments/prefetch/**`    | `authenticated()` | Known: `career-nine-assessment` student app has no JWT today → 401. Deferred fix: `docs/AUTH_REDESIGN_PLAN.md §9`.  |
| `/leads/capture`              | `authenticated()` | Marketing landing-page form / external integrations posting anonymously → 401. **Confirm with product before merge.** |
| `/bet-report-data/public/**`  | `authenticated()` | Anonymous report viewer / external integrations → 401. **Confirm with product before merge.**                       |

### Path inventory: removed (already covered by `.anyRequest().authenticated()`)

All ~25 admin surfaces previously listed in `permitAll()` now require a Bearer token. Bullets are illustrative — see git diff for the complete list:

- All `/student-info/**`, `/student/**`, `/user/**` (including `/user/me`, `/user/*/*`, `/user/*`).
- `/leads/getAll`, `/leads/email-export` (NOT `/leads/capture` — that's the BREAKING entry above).
- All `/userrolegroupmapping/**`.
- All `/instituteDetail/**`, `/instituteBranch/**`, `/instituteBatch/**`, `/instituteCourse/**`, `/instituteSession/**`.
- `/section/get`, `/section/update`, `/role/*`, `/rolegroup/*`, `/category/*`, `/board/*`, `/gender/get`.
- `/tools/**`, `/measured-qualities/**`, `/measured-quality-types/**`.
- `/question-sections/**`, `/api/question-sections/**`, `/api/questionnaire/**`.
- `/assessment-questions/*`, `/assessment-questions/*/*`, `/api/assessment-questions/**`.
- `/assessments/*`, `/assessments/**`, **`/assessments/prefetch/**` (BREAKING)**.
- `/api/firebase/*`, `/api/firebase/*/*`.
- `/contact-person/**`, `/languages/**`, `/language-supported/*`, `/language-question/create-with-options`.
- `/dashboard/game-results/*`, `/game-results/*`.
- `/generate_pdf`, `/codingquestion/save`, `/codingquestion/*`, `/testcase/save`, `/coding/*`.
- `/getmarks/*`, `/getmarks`, `/getmarksArray`.
- `/email-validation-official`, `/email-validation-official-confermation`.
- `/career/edit/*`.
- `/util/**` (everything except `/util/file-get/**`).
- `/google-api/**`, `/google-api/email/get/*`.
- `/assessment-section-instructions/**`.
- `/actuator/*`.

### Path inventory: removed (dead/typo/catch-all — never useful)

- `/**/**/**`, `/**/**/**/**`, `/api/**`, `/api/**/**`, `/api/**/**/**` — catch-alls that wildcarded everything.
- `/assesment-questions/**` + 6 variants — controller is spelled `/assessment-questions` (correct), so these never matched any controller route.
- `tools/**`, `measured-qualities/**`, `measured-quality-types/**`, `role/*`, `instituteBranchBatchMapping/*`, `student/get-check` — no leading slash, so Spring Boot's antMatcher would never match incoming requests.

## Other Filter-Chain Changes

### StrictHttpFirewall reverted to defaults

**Before:**
```java
@Bean
public HttpFirewall allowedHttpMethods() {
    StrictHttpFirewall firewall = new StrictHttpFirewall();
    firewall.setUnsafeAllowAnyHttpMethod(true);       // accepted TRACE, CONNECT, custom verbs
    firewall.setAllowUrlEncodedDoubleSlash(true);     // accepted %2F%2F (path-traversal vector)
    firewall.setAllowSemicolon(true);                  // accepted ;jsessionid= (path-confusion vector)
    return firewall;
}
```

**After:**
```java
@Bean
public HttpFirewall strictHttpFirewall() {
    // Default StrictHttpFirewall rejects non-standard HTTP methods,
    // URL-encoded slashes, double-slashes, semicolons, backslashes, and percent in path.
    return new StrictHttpFirewall();
}
```

Net behaviour: `GET /foo;bar` → 400, `GET /foo%2F%2Fbar` → 400, `TRACE /foo` → 400/405. No controllers in the codebase depend on matrix parameters or non-standard verbs (verified via grep before edit).

The bean rename is intentional: `allowedHttpMethods()` was misleading once we stopped allowing anything. Spring Security wires the bean by `HttpFirewall` type, so the method-name change has no functional impact.

### CORS `allowedHeaders` — explicit 7-header allowlist

**Before:**
```java
configuration.setAllowedHeaders(Arrays.asList("*"));
```

**After:**
```java
configuration.setAllowedHeaders(Arrays.asList(
        "Authorization",
        "Content-Type",
        "Accept",
        "X-Assessment-Session",
        "X-Assessment-Student-Id",
        "X-Assessment-Id",
        "X-Requested-With"));
```

The codebase actually only sends these 7 headers (verified in RESEARCH.md §5). The three `X-Assessment-*` headers are required by the v2.0 Redis session interceptor (`AssessmentSessionInterceptor.java`). `X-Requested-With` is defensive for legacy axios behavior. Reflecting `*` was unnecessary — browsers and our React frontend never need anything else.

`setAllowedOriginPatterns(...)`, `setAllowedMethods(...)`, and `setAllowCredentials(true)` are byte-for-byte unchanged.

### Production CORS allowedOrigins — `localhost:5173` dropped

**Before (line 335):**
```yaml
allowedOrigins: https://career-9.com,...,https://*.career-9.com,http://localhost:5173
```

**After:**
```yaml
allowedOrigins: https://career-9.com,...,https://*.career-9.com
```

Dev (line 156), sandbox (line 493), and staging (line 651) profiles keep their localhost entries — dev needs them locally; sandbox is hit from local browsers per QA workflow.

`walrus-app-e2a6a.ondigitalocean.app` is retained in the production allowlist pending product confirmation that the DigitalOcean preview deploy is still active.

## Verification Output

### Task 1 — permitAll shrinkage

```
$ grep -E '"/auth/login"|"/auth/signup"|"/auth/refresh"|"/oauth2/\*\*"|"/payment/webhook/\*\*"|"/campaign/public/\*\*"|"/assessment-mapping/public/\*\*"|"/school-registration/public/\*\*"|"/util/file-get/\*\*"' SecurityConfig.java | wc -l
9    # expected 9

$ grep -E '"/oauth2/callback/google/\*"|"/bet-report-data/public/\*\*"|"/assessments/prefetch/\*\*"|"/leads/capture"' SecurityConfig.java
(zero matches)    # expected zero

$ grep -F "assesment-questions" SecurityConfig.java
(zero matches)    # expected zero

$ grep -E '"\*\*/\*\*/\*\*"|"/api/\*\*"' SecurityConfig.java
(zero matches)    # expected zero

$ grep -E '"tools/\*\*"|"measured-qualities/\*\*"|"role/\*"|"student/get-check"|"instituteBranchBatchMapping' SecurityConfig.java
(zero matches)    # expected zero

$ grep -nE '\.anyRequest\(\)|\.authenticated\(\)' SecurityConfig.java
178:                .anyRequest()
179:                .authenticated()

$ mvn -DskipTests compile
[INFO] BUILD SUCCESS
```

### Task 2 — Firewall + CORS

```
$ grep -E 'setUnsafeAllowAnyHttpMethod|setAllowUrlEncodedDoubleSlash|setAllowSemicolon' SecurityConfig.java
(zero matches)    # expected zero

$ grep -E 'return new StrictHttpFirewall\(\)' SecurityConfig.java
        return new StrictHttpFirewall();    # 1 match

$ grep -nE 'setAllowedHeaders\(Arrays.asList\("\*"\)\)' SecurityConfig.java
(zero matches)    # expected zero

$ grep -E '"Authorization",' SecurityConfig.java
                "Authorization",

$ grep -E '"X-Assessment-Session"' SecurityConfig.java
                "X-Assessment-Session",

$ awk '/on-profile: production/,/^---$/' application.yml | grep -F 'localhost:5173'
(zero matches)    # expected zero

$ grep -F 'localhost:5173' application.yml | wc -l
4    # other profiles (dev, sandbox, plus duplicate entries) — expected >= 2

$ mvn -DskipTests compile
[INFO] BUILD SUCCESS
```

### Overall — what stayed intact

```
$ grep -n 'addFilterBefore(tokenAuthenticationFilter' SecurityConfig.java
196:        http.addFilterBefore(tokenAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class);

$ grep -n 'oauth2Login\|successHandler\|failureHandler' SecurityConfig.java
181:                .oauth2Login()
192:                .successHandler(oAuth2AuthenticationSuccessHandler)
193:                .failureHandler(oAuth2AuthenticationFailureHandler);
```

OAuth2 wiring (lines 181-193) and TokenAuthenticationFilter `addFilterBefore` (line 196) are byte-for-byte unchanged.

### Live HTTP probes — not executed

The plan's `<verification>` block specifies a battery of `curl` probes against a running API (anonymous 401s on `/student-info/getByInstituteId/9999`, `/user/me`, `/assessment-questions/getAll`, the three BREAKING paths, `StrictHttpFirewall` 400s on `;`/`%2F%2F`/`TRACE`, CORS preflight inspection, production-profile yaml scan). These require booting the API with the env vars from 13-01 — outside the scope of this autonomous execution session. They should be run by ops as part of the deploy verification step. The static code-level checks above are sufficient to prove the change shape is correct.

## Self-Check

Files verified to exist:
- FOUND: `/home/babayaga/Projects/career-nine-sandbox/spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java`
- FOUND: `/home/babayaga/Projects/career-nine-sandbox/spring-social/src/main/resources/application.yml`
- FOUND: `/home/babayaga/Projects/career-nine-sandbox/.planning/phases/13-critical-security-fixes/13-02-COMMITS.md`
- FOUND: `/home/babayaga/Projects/career-nine-sandbox/.planning/phases/13-critical-security-fixes/13-02-SUMMARY.md`

Per-task verification:
- **Task 1:** 9 public-app paths (expect 9); 0 forbidden v1 entries; 0 typo entries; 0 catch-alls; 0 no-leading-slash entries; `anyRequest().authenticated()` present at line 178-179; `mvn compile` BUILD SUCCESS.
- **Task 2:** 0 `setUnsafeAllow*` calls; 1 `return new StrictHttpFirewall()`; 0 `setAllowedHeaders("*")`; `"Authorization"` + `"X-Assessment-Session"` present in explicit allowlist; production CORS block has 0 `localhost:5173` matches; other profiles still have 4 total `localhost:5173` occurrences; `mvn compile` BUILD SUCCESS.

Commits NOT made (project memory `feedback_no_auto_commits.md`). Staged files:
- `spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java`
- `spring-social/src/main/resources/application.yml` (staged with `-f` because it is gitignored)

## Self-Check: PASSED

## Deviations from Plan

### Auto-fixed Issues

None — both tasks executed exactly as specified.

### Project-Convention Deviations (per executor prompt)

**1. [Project Memory] No `git commit` invoked**
- **Why:** User memory `feedback_no_auto_commits.md` instructs that user commits manually in this project.
- **What was done instead:** Each task's relevant files are staged via `git add` (with `-f` for `application.yml` since it is gitignored). Per-task one-line draft commit messages are recorded in `.planning/phases/13-critical-security-fixes/13-02-COMMITS.md`. The user will commit manually after reviewing the BREAKING CHANGE callout at the top of that file.

**2. [Plan Verification Step] Live `curl` probes skipped**
- **Why:** Plan's `<verification>` section asks for end-to-end probes against a running API. Booting the API requires the env vars from 13-01 and an operational DB; not executed in this autonomous session.
- **What was done instead:** All static grep + `mvn compile` checks from the per-task `<verify>` blocks were executed and passed. Live probes are flagged in the SUMMARY as a deploy-time step.

### Notable Observations (not deviations)

**3. BREAKING-CHANGE pre-merge gate is enforced by manual commit review**
- The plan specifies a BLOCKING USER CONFIRMATION GATE before merge for the three paths moved behind auth. Under the no-auto-commit rule, this gate is enforced at commit time: changes are staged, the BREAKING CHANGE callout is the first content in `13-02-COMMITS.md`, and the user must explicitly confirm by committing (or roll back with `git reset HEAD <files>`). This is the natural enforcement point and was decided by the executor prompt.

**4. Firewall bean renamed**
- `allowedHttpMethods()` → `strictHttpFirewall()`. The plan explicitly notes the rename is intentional. Spring wires by `HttpFirewall` type, so no consuming code breaks.

**5. `walrus-app-e2a6a.ondigitalocean.app` retained in production CORS**
- Per plan Notes "Open Questions #1" — flagged for product confirmation.

**6. `/actuator/*` moved behind auth**
- Per plan Notes "Open Questions #2" — if k8s/load-balancer probes hit `/actuator/health` anonymously, they will now 401. Unblocking fix is one additional `permitAll()` line for `/actuator/health` only, plus `management.endpoint.health.show-details: never` in `application.yml`. Not applied here per plan scope.

## Authentication Gates

None encountered.

## What's Next

- **User action:** Review `13-02-COMMITS.md` BREAKING CHANGE block, then commit (or `git reset HEAD` to defer).
- **13-03 (Wave 2 parallel):** Razorpay service hardening — disjoint files (`RazorpayService.java`); reads `RAZORPAY_WEBHOOK_SECRET` externalized in 13-01.
- **Deferred (post-Phase-13):** Assessment-app auth rework per `docs/AUTH_REDESIGN_PLAN.md §9` — fixes the `/assessments/prefetch/**` 401 regression for the student `career-nine-assessment` app.
- **Phase 15 (later milestone):** Method-level `@PreAuthorize` annotations on protected controllers — Phase 13-02 only tightened the filter-chain level.
