# Backend REST Endpoint Access/Authorization Audit — Career-Nine

**Scope:** All Spring Boot controllers under `spring-social/src/main/java/com/kccitm/api/controller/` (root + `career9/`, `career9/b2c/`, `career9/counselling/`, `career9/Questionaire/`, `dashboard/`, `principal/`, `teacher/`). Branch `attribute-based-auth`.
**Date:** 2026-05-21
**Method:** Full mapping/annotation inventory (94 controllers / ~430 endpoints) cross-referenced against `config/SecurityConfig.java` and `security/TokenAuthenticationFilter.java`, then method-body verification of representative endpoints in each risk class. Findings are CONFIRMED unless marked *Needs review*.
**Focus:** The access/authorization/correctness surface of *every* controller — deliberately broad. The prior audit (`docs/AUTH_AUDIT_FINDINGS.md`) already covered the core security package (JWT alg pinning, magic-link, the `/student-info` + `/student-demographics` IDOR, the `log-only` enforce switch). Those root-cause items are referenced here, not re-derived; the body below concentrates on the **breadth** of the other controllers.

> **Overarching caveat (inherited from prior audit CRIT-1):** `auth.enforce-mode` is `log-only` in **all four** profile files (`application.yml:184`, `application-dev.yml:85`, `application-sandbox.yml:96`, `application-production.yml:103`). `AuthorizationService.recordAndReturn` (`AuthorizationService.java:150`) therefore returns `true` for every `@auth.allows(...)` call regardless of the policy decision. **Every `@PreAuthorize` annotation listed below is currently a no-op.** Each finding is written for BOTH worlds: what is exploitable today (log-only), and what remains broken even after the flip to `enforce`.

---

## Executive Summary

| Severity | Count | Most affected areas |
|----------|-------|---------------------|
| CRITICAL | 4 | Global enforce switch; unauth GCS file read; assessment-token PII IDOR; admin dashboard snapshot |
| HIGH | 7 | Anonymous public-funnel endpoints mis-gated; counsellor auth (unsalted SHA-256, no token, unreachable); mass-assignment on `/student-info/update`; cookie-minting on guessable ids |
| MEDIUM | 9 | State-changing GET + CSRF bypass (≈18 endpoints); IDOR-by-id on management endpoints; unpaginated `getAll`; public-path config mismatches |
| LOW | 6 | `findAll()` heavy reads; raw exception leakage; `Optional.get()`/`valueOf` NPEs; dead controllers |
| INFO | 3 | Webhook HMAC verified-correct; super-admin toggle guarded-correct; CSRF exemptions appropriate |

### Severity legend for the at-a-glance table (end of doc)
Findings are grouped by controller/feature area below, then consolidated into a single sorted table.

---

## CRITICAL

### CRIT-A — RBAC/ABAC enforcement disabled in every profile (inherited)
Same root cause as prior `AUTH_AUDIT_FINDINGS.md` CRIT-1. `auth.enforce-mode: log-only` in all profiles. Listed here because it is the multiplier that turns ~every MEDIUM/HIGH `@PreAuthorize`-gated finding below into "exploitable by any authenticated principal today."
- `security/AuthorizationService.java:55,150`; `application-production.yml:103`.
- **Remediation:** flip to `enforce` in production after a soak — but FIRST fix the public-endpoint mis-gating (HIGH-B/HIGH-C below), or the flip will 403 legitimate anonymous B2C/counsellor traffic.

### CRIT-B — Unauthenticated arbitrary file read from Google Cloud Storage
- **Location:** `controller/UtilController.java:47-57` (`GET /util/file-get/getbyname/{name}`); `config/SecurityConfig.java:313` (`"/util/file-get/**"` → `permitAll()`).
- **Problem:** The path is `permitAll()` in the security chain, so the `@PreAuthorize("@auth.allows('util.read')")` on the method never runs (the filter chain admits the request before method security is reached, and even if reached it is a no-op in log-only). The handler passes the attacker-supplied `{name}` straight to `googleCloudApi.getFileFromCloud(data)` with **no ownership check, no prefix restriction, and no path/key validation**, and streams the bytes back as an attachment.
- **Why exploitable:** Any anonymous caller can fetch any object in the bucket by guessing/enumerating names. Uploaded artifacts include student webcam photos, generated ID-card PDFs, and report assets (`util/file-upload`, `student/generate_id_card`, report ZIP uploads). This is a direct PII/document disclosure.
- **Remediation:** Remove `/util/file-get/**` from `permitAll`; require an authenticated principal + ABAC scope, or sign short-lived per-object URLs. Validate `{name}` against an allow-list/owner mapping.

### CRIT-C — Assessment-scoped token can read/write any student's PII (inherited, breadth-confirmed)
Same class as prior CRIT-2. The assessment-scope path allow-list in `security/TokenAuthenticationFilter.java:69-74` includes `/student-info/` and `/student-demographics/`, and the assessment principal has empty authorities and is not a `UserPrincipal`. Confirmed the read/write endpoints do **not** cross-check the path id against the token's `assessmentUserStudentId`:
- `controller/career9/StudentDemographicResponseController.java:77-89` (`GET /contact-info/{userStudentId}` → any student's email+phone) and `:93-129` (`POST /contact-info/{userStudentId}` → overwrite any student's email+phone).
- `controller/StudentInfoController.java:678-714` (`GET /getDemographics/{userStudentId}` → any student's name/gender/class/board/username).
- **Remediation:** In these handlers, compare `{userStudentId}` to `request.getAttribute("assessmentUserStudentId")` and 403 on mismatch (as `AssessmentAnswerController.submit` already does, `AssessmentAnswerController.java:258-275`).

### CRIT-D — Admin dashboard snapshot reachable by any authenticated principal (inherited, breadth-confirmed)
- **Location:** `controller/career9/DashboardSnapshotController.java:20-32` — `GET /dashboard/admin/snapshot` and `POST /dashboard/admin/snapshot/refresh` have **no `@PreAuthorize` at all**.
- **Problem:** `/dashboard/**` is not in any permitAll list, so it falls under `.anyRequest().authenticated()`. Any authenticated principal — including a low-privilege staff user — gets the full admin analytics blob, and can force an expensive recompute via the refresh POST. (Note: a pure assessment-scope token is rejected here because `/dashboard/` is not in `ASSESSMENT_SCOPE_PATHS`, so this is "any logged-in admin-console user," not "any student.")
- **Remediation:** Add `@PreAuthorize("@auth.allows('dashboard.admin.read')")` to both; the refresh should require a stronger write permission.

---

## HIGH

### HIGH-A — Counsellor authentication: unsalted SHA-256, no session token, and unreachable when enforced
- **Location:** `controller/career9/counselling/CounsellorController.java:52-184`.
- **Problems (three distinct):**
  1. **Unsalted SHA-256 password hashing** (`:79-84` register, `:140-145` login). No salt, no work factor, fast hash — trivially rainbow-tableable if `counsellor.password_hash` leaks. The rest of the app uses BCrypt (`SecurityConfig.passwordEncoder`); counsellors bypass it.
  2. **`/login` returns no JWT/cookie** (`:176-183`) — it returns the counsellor record and relies entirely on client-side trust. There is no server-side session for counsellors; any subsequent "counsellor" call is just an authenticated admin/other principal.
  3. **Mis-gated for anonymous use.** `/self-register` and `/login` are documented "Public endpoint" but carry `@PreAuthorize("@auth.allows('counsellor.create'/'counsellor.read')")` AND `/api/counsellor/**` is **not** in `SecurityConfig` permitAll → `.anyRequest().authenticated()` blocks anonymous callers with 401 *today* (this is filter-chain, not method-security, so log-only does not save it). The endpoints are effectively unreachable by the unauthenticated users they target.
- **Remediation:** Switch to BCrypt; issue a proper scoped JWT/cookie on login; add `/api/counsellor/self-register` + `/login` to permitAll and drop their `@PreAuthorize` (or split into a public sub-path like the campaign funnel).

### HIGH-B — Public B2C/anonymous endpoints carry `@PreAuthorize` and are NOT permitAll → break under enforce (several also broken today)
- **Locations & exact mismatch:**
  - `controller/career9/PromoCodeController.java:151-152` exposes `POST /promo-codes/public/validate`, but `SecurityConfig.java:263` CSRF-exempts the wrong path `"/promo-code/validate"` (singular, no `/public`). The real endpoint is **neither permitAll nor CSRF-exempt** → anonymous promo validation fails today (401 + CSRF block) and the security config line is dead.
  - `controller/career9/b2c/ReportPreparationController.java:39-40` (`POST /bet-report-data/public/prepare`) and `controller/career9/BetReportDataController.java:110-111` (`GET /bet-report-data/public/final`) carry `@PreAuthorize` and `/bet-report-data/public/**` is CSRF-exempt (`:264`) but **absent from the authorizeRequests permitAll list (`:298-313`)** → `.anyRequest().authenticated()` → 401 for the anonymous report viewers they serve.
  - `controller/career9/b2c/EntitlementController.java:173-174` (`POST /entitlement/redeem-token`) — CSRF-exempt (`:262`) but **not** in authorizeRequests permitAll; also carries `@PreAuthorize("entitlement.read")`. Anonymous SPA redeem → 401 under any non-log-only world, and 403 once enforced.
  - `controller/career9/LeadController.java:50-52` (`POST /leads/capture`) — documented public landing-page capture, `@PreAuthorize("lead.create")`, `/leads/**` not permitAll → 401 for external pages.
  - `controller/career9/AssessmentInstituteMappingController.java:184,249` (`/assessment-mapping/public/**`) is permitAll (`:311`) but the methods still carry `@PreAuthorize("assessment.prefetch")` → will 403 anonymous under enforce.
- **Why it matters:** This is the funnel that brings in paying B2C users and school registrations. The `@PreAuthorize`-on-public-endpoint pattern is a latent outage: the day someone flips `enforce`, every anonymous funnel call starts returning 403. Two of them (promo-validate, and the `/bet-report-data/public/**` pair, and redeem-token) are arguably broken for anonymous callers *today* because they are not in the authenticated-permitAll list.
- **Remediation:** Establish a single source of truth for "public" paths; ensure each is in BOTH the CSRF-ignore list and the authorizeRequests permitAll list with matching patterns, and remove `@PreAuthorize` from genuinely-anonymous handlers (rely on the in-controller token/signature/promo-lookup gates).

### HIGH-C — `POST /payment/webhook/status/{razorpayLinkId}` and `/info/{transactionId}` are anonymous + mint an assessment session cookie on guessable ids
- **Location:** `controller/career9/PaymentWebhookController.java:165-244` (`GET /status/{razorpayLinkId}`), `:266-...` (`GET /info/{transactionId}`); `/payment/webhook/**` is permitAll + CSRF-exempt (`SecurityConfig.java:264/309`).
- **Problem:** `getPaymentStatus` is anonymous-reachable (the `@PreAuthorize` is a no-op under permitAll/log-only). On a `paid` transaction it **mints and sets the `cn_at_asmnt` assessment session cookie** for `txn.getUserStudentId()` (`:235-240`) and returns `studentSessionService.buildSessionPayload(...)` (the student's allotted-assessment payload). `razorpayLinkId` / `transactionId` are not unguessable secrets bound to the caller. An attacker who learns/guesses a paid link id obtains a valid assessment session for that student and their session payload — an IDOR session-takeover on the assessment scope. Same minting also happens in `EntitlementController.redeemToken` and `CampaignPublicController` free-provision, but those are gated by an unguessable `accessToken` (`EntitlementService.redeemAccessToken:179-188` validates token+id+status+expiry — that one is sound). The webhook-status path is the weak link because it keys on a link id, not a secret token.
- **Remediation:** Do not mint a session cookie from a polling/status endpoint keyed on a link id. Require the unguessable access token (or a freshly-issued one-time code) before issuing `cn_at_asmnt`.

### HIGH-D — Mass-assignment / blind upsert on `POST /student-info/update`
- **Location:** `controller/StudentInfoController.java:663-667`.
  ```java
  @PreAuthorize("@auth.allows('student_info.update', #studentInfo.instituteId, null, null, null)")
  @PostMapping("/update")
  public StudentInfo updateStudentInfo(@RequestBody StudentInfo studentInfo) {
      return studentInfoRepository.save(studentInfo);
  }
  ```
- **Problem:** The entire `StudentInfo` JPA entity is bound from the request body and saved directly. The caller controls **every** column including the primary `id` (so `save` overwrites or creates an arbitrary row) and `instituteId` — which is also the ABAC scope argument, so an attacker chooses the institute their own request is scope-checked against. No existence check, no field allow-list, no merge against the persisted row. `updateStudentInfo` will silently null any field the client omits.
- **Remediation:** Bind a DTO with an explicit field allow-list; load the existing entity by id, verify scope against the *persisted* `instituteId`, then copy permitted fields.

### HIGH-E — IDOR-by-id across management endpoints (no ownership check; only the no-op ABAC gate)
A broad class: endpoints take an `{id}`/`{userId}`/`{counsellorId}`/`{studentId}` and act on it with only a flat `@auth.allows('...')` permission (no scope arg, or a scope arg the caller controls). Even after `enforce`, any holder of the permission acts on *any* resource. Representative confirmed instances:
- `controller/career9/counselling/CounsellorController.java:192-216` (`upload-photo/{id}`), `:259-264` (`update/{id}`), `:267-` (`toggle-active/{id}`) — any `counsellor.update` holder edits any counsellor.
- `controller/career9/b2c/EntitlementController.java:222-276` — `getById`, `extend`, `revoke`, `resend` by id with flat `entitlement.*` perms; revoke/extend mutate any entitlement.
- `controller/career9/GeneratedReportController.java:72-115` — `by-student/{userStudentId}` etc. take the student id as the ABAC arg, but list-by-student returns one student's reports with only `generated_report.read` (scope arg present here is good; the `delete/{id}` at `:60-61` has no scope arg → any holder deletes any report row).
- `controller/UserController.java:552-...` (`PUT user/update-details/{id}`) and `:343-344` (`GET user/delete/{id}`) — flat `user.update`/`user.delete`, no ownership/last-admin guard on delete.
- **Remediation:** Add resource-ownership/scope verification (load entity, check its institute/owner against the principal's scopes) on every by-id mutation; for B2C/counsellor entities that have no institute dimension, gate on an explicit admin permission and audit.

### HIGH-F — `GeneratedReportController.toggleVisibility` and report download by id lack scope on the mutating path
- **Location:** `controller/career9/GeneratedReportController.java:128-129` (`PUT /toggle-visibility`, flat `generated_report.update`), `:60-61` (`DELETE /delete/{id}`, flat `generated_report.delete`).
- **Problem:** Report visibility (whether a student/parent can see a report) is toggled with no scope binding; a holder of the permission flips visibility for any student's report. Reports are the paid deliverable in the B2C flow, so this is a billing/entitlement-adjacent control.
- **Remediation:** Bind the student/institute scope and verify.

### HIGH-G — Destructive cross-institute bulk operations gated by flat permissions
- **Location:** `controller/career9/FirebaseDataMappingController.java:705-706` (`DELETE /delete-firebase-students/{instituteCode}` — has a scope arg, good), but `:432-433` (`DELETE /delete/{id}`), `:456-457` (`deleteByFirebaseNameAndType`), and the `import-*` POSTs (`:216,1176,1404,1500`) are flat-permission, no scope, and perform large mutations across institutes. `controller/career9/NavigatorReportDataController.java:328-329` (`DELETE /reset/assessment/{assessmentId}`) wipes all report data for an assessment with flat `navigator_report_data.delete`.
- **Remediation:** Scope-bind destructive operations to institute/assessment and require an elevated permission; add confirmation/audit.

---

## MEDIUM

### MED-A — State-changing operations exposed over HTTP GET (CSRF bypass + cacheable/prefetchable)
- **Locations (~18 confirmed real mutations via `@GetMapping`):**
  `UserController.java:344` (`user/delete/{id}`), `RoleController` delete (commented out, but `RoleGroupController.java:61`, `RoleRoleGroupMappingController.java:102`, `UserRoleGroupMappingController.java:91` are live), `GroupController.java:40`, `InstituteBatchController.java:70`, `InstituteBranchController.java:83`, `InstituteBranchBatchMappingController.java:80`, `InstituteCourseController.java:70`, `InstituteSessionController.java:57`, `SectionController.java:43`, `TemporaryStudentController.java:48`, `career9/InstituteDetailController.java:187` (`/delete/{id}`) and `:204` (`/restore/{id}`), `career9/StudentController.java:308/350/378` (category/branch/board delete), `UtilController.java:60/69` (`file-delete/*`), `GoogleAdminController.java:176` (group-member delete), `:184` (group delete), `:201` (member add).
- **Problem:** GET is, by spec, safe/idempotent. These mutate state, which means: (1) **CSRF protection does not apply** — Spring's CSRF filter only guards POST/PUT/PATCH/DELETE, so the `cn_csrf` double-submit check (`SecurityConfig.java:131-138`) is entirely bypassed for these deletes; a cross-site `<img src=".../user/delete/5">` or link prefetch triggers them with the victim's cookies. (2) Browsers/proxies may prefetch or cache them. (3) Server access logs leak the mutated ids.
- **Remediation:** Convert to `@DeleteMapping`/`@PostMapping`. This is mechanical but touches ~18 endpoints across the legacy admin controllers.

### MED-B — `getAll` / `findAll()` list endpoints have no pagination
- **Locations (representative):** `LeadController.java:130-133` (`leadRepository.findAll()`), `career9/AssessmentQuestionController.java:86` (`getAll`, cached but unbounded), `StudentInfoController.java:110-111` (`student_info.read.all` getAll), `career9/CampaignController.java:47`, `career9/b2c/PricingTierController.java:31`, `UserController.java:90-91` (`user/get` all users), every `*/getAll` across the CRUD controllers, and `AssessmentTableController.java:158` (`/getAll`).
- **Problem:** Each returns the entire table as a JSON array. On production-sized student/lead/answer tables this is a memory/latency/DoS hazard and serializes full entity graphs (lazy relations → N+1).
- **Remediation:** Introduce `Pageable` + projections for the high-cardinality lists (students, leads, assessment answers, generated reports, payment transactions).

### MED-C — Public-path config split between two lists (CSRF-ignore vs authorizeRequests permitAll)
- **Location:** `config/SecurityConfig.java:244-265` (CSRF ignore list) vs `:298-313` (authorizeRequests permitAll). They are **different sets**: redeem-token, promo-code/validate, bet-report-data/public, navigator-report-data/public appear only in the CSRF list; assessment-mapping/public, school-registration/public, util/file-get appear only in the permitAll list.
- **Problem:** Drift between the two lists is the root cause of HIGH-B. An endpoint can be CSRF-exempt yet still require authentication (or vice-versa), producing confusing 401/403s for anonymous funnels.
- **Remediation:** Define the public-path set once (constant array) and feed both `.ignoringAntMatchers(...)` and `.antMatchers(...).permitAll()`.

### MED-D — Unchecked `Optional.get()` / `Long.valueOf(...toString())` on request input → 500 + stack context
- **Locations (representative):**
  - `career9/StudentDemographicResponseController.java:64-65` — `Long.valueOf(request.get("userStudentId").toString())` with no null/format check → `NullPointerException`/`NumberFormatException` (500) on missing/garbage body.
  - `StudentInfoController.java:720` — same pattern in `updateDemographics`.
  - `career9/b2c/EntitlementController.java:178-179` — `Long.valueOf(body.get("entitlementId").toString())` unguarded.
  - Numerous `repository.findById(id).get()`-style flows; `findById(...).orElseThrow(ResourceNotFoundException)` is the better pattern used elsewhere (e.g. `StudentInfoController.java:680`).
- **Problem:** Anonymous/low-priv callers can trip 500s; depending on the global exception handler this may leak class names/messages. Confirmed at least one controller prints stack traces to stdout (`StudentInfoController.java:657-658`, `e.printStackTrace()`).
- **Remediation:** Validate presence/format and return 400; never `printStackTrace`; ensure a `@ControllerAdvice` returns sanitized error bodies.

### MED-E — `LeadController.captureLead` is an unauthenticated-by-intent write with no rate limiting and unbounded body→`extras` JSON
- **Location:** `career9/LeadController.java:50-126`.
- **Problem:** Beyond the mis-gating in HIGH-B, the handler copies the entire request body into an `extras` JSON column (`:85-98`) and synchronously calls `odooLeadService.syncLeadToOdoo` (`:117`) inline on the request thread. No size cap on the body, no per-IP rate limit on this anonymous write (the rate-limit filter targets `/auth/*` per prior MED-3). An attacker can flood leads / inflate the `extras` blob / hammer Odoo.
- **Remediation:** Cap and allow-list `extras`; move Odoo sync async; add this path to the rate-limit set.

### MED-F — `PromoCode` validate/increment race + the dead config line
- **Location:** `career9/PromoCodeController.java:151-152` (`/public/validate`) and `career9/b2c/CampaignPublicController.java:292-299` (max-uses check then `setCurrentUses(...+1)` save).
- **Problem:** The max-uses guard (`currentUses >= maxUses`) and the increment are not atomic / not row-locked, so concurrent registrations can over-redeem a limited promo. Combined with MED-C the validate endpoint is also currently mis-routed.
- **Remediation:** Use an atomic conditional UPDATE (`UPDATE ... SET current_uses=current_uses+1 WHERE id=? AND current_uses<max_uses`) and check the affected-row count.

### MED-G — Counsellor `upload-photo` and `four-pager-template/upload` accept base64/file with weak validation
- **Location:** `career9/counselling/CounsellorController.java:194-216` (only checks `startsWith("data:image")`), `career9/FourPagerTemplateController.java:43-44`, `career9/QuestionMediaController.java:31`, `career9/ReportZipController.java:30`, `career9/ReportTemplateController.java:81`.
- **Problem:** Content-type is taken from the client-supplied data-URL prefix; no real MIME sniff, no size limit visible at the controller, no extension allow-list before pushing to GCS/Spaces. Enables content-type spoofing and large-upload abuse.
- **Remediation:** Server-side validate magic bytes + size cap; randomize stored object names (already partly done) and never trust the client MIME.

### MED-H — Heartbeat / live-tracking / proctoring on assessment scope without per-student binding
- **Location:** `career9/HeartbeatController.java:28-29` (`POST /assessments/heartbeat`, `heartbeat.ping`), `career9/LiveTrackingController.java:51-52,107-108`, `career9/AssessmentProctoringController.java:71-117`.
- **Problem:** These are on the `ASSESSMENT_SCOPE_PATHS` allow-list (`/assessments/`, `/assessment-proctoring/`), so an assessment-scope token reaches them, but several read by `{assessmentId}`/`{studentId}` without cross-checking the token's `assessmentUserStudentId` (e.g. `getByStudent/{studentId}`, `getByAssessment/{assessmentId}`). Proctoring data (a webcam/anti-cheat surface) for other students is readable with one student's session — same IDOR class as CRIT-C, lower data sensitivity.
- **Remediation:** Cross-check the path id against the assessment token attributes on these read endpoints.

### MED-I — `CampaignPublicController.register` duplicate-email check leaks existence/details
- **Location:** `career9/b2c/CampaignPublicController.java:311-319` — on email match with mismatched DOB it returns `DuplicateEmailResponse.build(existing, instituteDetailRepository)`.
- **Problem:** An anonymous caller can probe arbitrary emails and learn whether an account exists plus institute details in the duplicate response — account/PII enumeration on an anonymous endpoint.
- **Remediation:** Return a generic "could not register, contact support" without echoing existing-account details.

---

## LOW

### LOW-A — Dead/incomplete controllers
- `controller/ListController.java:1-9` — class with an unused `ListRepository` field, **no `@RestController`/`@RequestMapping`/mappings**. Dead code; remove. (`controller/TopicController.java:52` has a commented-out delete; `OptionScoreController.java:129-145` has several commented endpoints.)

### LOW-B — `e.printStackTrace()` / stdout logging in request paths
- `StudentInfoController.java:657-658` (`System.out.println` + `printStackTrace`) and similar scattered `System.out` debug. Leaks internals to logs; bypasses structured logging.

### LOW-C — `redeemToken` / status endpoints widen response with full session payload before terminal state
- `career9/b2c/EntitlementController.java:194-218`, `PaymentWebhookController.java:225-241` — return `buildSessionPayload` (allotted assessments etc.) tied to a student. Lower-impact given HIGH-C covers the cookie; the payload itself is moderate PII over a weakly-keyed endpoint.

### LOW-D — Inconsistent not-found semantics (200 with error body vs 404 vs thrown exception)
- e.g. `StudentDemographicResponseController` returns 404 JSON; `StudentInfoController.getDemographics` throws `ResourceNotFoundException`; some `getById` return `notFound().build()`. Inconsistent contract complicates clients and can mask authz vs existence.

### LOW-E — `GoogleAdminController` exposes Workspace mutations (password reset, group add/delete) over GET with directory-name path params
- `controller/GoogleAdminController.java:138-217` — `password-reset/update` is POST (good) but `group-member-delete`, `group-delete`, `member-add` are GET (see MED-A) and operate on Google Workspace directory by name. High blast radius if CSRF'd; rated LOW only because `google_admin.*` is admin-restricted (but log-only negates that today).

### LOW-F — No explicit `@Valid`/bean-validation anywhere; all validation is hand-rolled and partial
- Across controllers, request bodies are `Map<String,Object>` or raw entities with ad-hoc null checks. Inconsistent coverage (e.g. `register` validates phone+dob but `registerTrial` and `draft-save` validate less).

---

## INFO (verified-correct, not issues)

- **INFO-1 — Razorpay webhook HMAC is verified correctly.** `PaymentWebhookController.java:96-108` reads raw `byte[]`, verifies `X-Razorpay-Signature` via `razorpayService.verifyWebhookSignature(payloadBytes, signature)` before processing, returns 401 on failure, 500 on error to trigger retry. CSRF-exempt is appropriate. Good.
- **INFO-2 — `UserController.toggleSuperAdmin` is well-guarded.** `UserController.java:515-550` blocks self-demotion and last-super-admin demotion. Sound.
- **INFO-3 — `EntitlementService.redeemAccessToken` validates token+id+status+expiry.** `EntitlementService.java:179-188`. The token-bound redeem path is sound (contrast HIGH-C's link-id path).

---

## Consolidated findings table (sorted by severity)

| ID | Sev | Area | Endpoint(s) | Issue | File:line |
|----|-----|------|-------------|-------|-----------|
| CRIT-A | CRITICAL | Global | all `@PreAuthorize` | enforce-mode log-only → all authz no-op | AuthorizationService.java:150; application-production.yml:103 |
| CRIT-B | CRITICAL | Util/files | `GET /util/file-get/getbyname/{name}` | permitAll + arbitrary GCS object read, no ownership/path check | UtilController.java:47-57; SecurityConfig.java:313 |
| CRIT-C | CRITICAL | Student PII | `/student-info/getDemographics/{id}`, `/student-demographics/contact-info/{id}` GET+POST | assessment-token IDOR, no token-vs-path id check | StudentInfoController.java:678; StudentDemographicResponseController.java:77,93 |
| CRIT-D | CRITICAL | Dashboard | `GET/POST /dashboard/admin/snapshot[/refresh]` | no `@PreAuthorize`; any authed principal reads admin analytics | DashboardSnapshotController.java:20-32 |
| HIGH-A | HIGH | Counselling | `/api/counsellor/self-register`,`/login`,`/update/{id}`,`/upload-photo/{id}` | unsalted SHA-256, no session token, anonymous-but-not-permitAll | CounsellorController.java:52,121,192,259 |
| HIGH-B | HIGH | B2C funnel | `/promo-codes/public/validate`,`/bet-report-data/public/*`,`/entitlement/redeem-token`,`/leads/capture`,`/assessment-mapping/public/*` | `@PreAuthorize` on anonymous endpoints + permitAll/CSRF list drift | PromoCodeController.java:152; ReportPreparationController.java:40; EntitlementController.java:174; LeadController.java:52; SecurityConfig.java:244-313 |
| HIGH-C | HIGH | Payments | `GET /payment/webhook/status/{razorpayLinkId}`,`/info/{transactionId}` | anonymous; mints `cn_at_asmnt` session cookie on guessable link id | PaymentWebhookController.java:165-244 |
| HIGH-D | HIGH | Student | `POST /student-info/update` | mass-assignment of full entity incl. id + scope arg; blind save | StudentInfoController.java:663-667 |
| HIGH-E | HIGH | Multiple | by-id mutations (counsellor/entitlement/user/report) | IDOR — flat perm, no ownership/scope verification | CounsellorController.java:259; EntitlementController.java:222-276; UserController.java:343,552 |
| HIGH-F | HIGH | Reports | `PUT /generated-reports/toggle-visibility`,`DELETE /delete/{id}` | report visibility/delete with no scope binding | GeneratedReportController.java:60,128 |
| HIGH-G | HIGH | Imports | firebase-mapping `delete/{id}`, `import-*`; navigator `reset/assessment/{id}` | destructive cross-institute ops, flat perms | FirebaseDataMappingController.java:432,216; NavigatorReportDataController.java:328 |
| MED-A | MEDIUM | Legacy admin | ~18 `@GetMapping` deletes/mutations | state-change over GET → CSRF bypass, prefetchable | UserController.java:344; UtilController.java:60,69; GoogleAdminController.java:176,184,201; +others |
| MED-B | MEDIUM | Multiple | all `getAll`/`findAll()` | no pagination, full-table serialization | LeadController.java:131; StudentInfoController.java:110; UserController.java:90; AssessmentTableController.java:158 |
| MED-C | MEDIUM | Config | SecurityConfig public-path lists | CSRF-ignore vs permitAll sets diverge | SecurityConfig.java:244-265 vs 298-313 |
| MED-D | MEDIUM | Multiple | body-id parsing | unchecked `Long.valueOf(...toString())` / `Optional.get()` → 500 | StudentDemographicResponseController.java:64; StudentInfoController.java:720; EntitlementController.java:178 |
| MED-E | MEDIUM | Leads | `POST /leads/capture` | anonymous write, no rate limit, unbounded extras, inline Odoo sync | LeadController.java:50-126 |
| MED-F | MEDIUM | Promo | validate + increment | non-atomic max-uses race; dead config route | PromoCodeController.java:152; CampaignPublicController.java:292-299 |
| MED-G | MEDIUM | Uploads | counsellor photo, templates, media, zip | client-trusted MIME, no magic-byte/size check | CounsellorController.java:194; FourPagerTemplateController.java:43; ReportZipController.java:30 |
| MED-H | MEDIUM | Assessment | heartbeat/live-tracking/proctoring by id | assessment scope, no per-student id cross-check | HeartbeatController.java:28; AssessmentProctoringController.java:91-108 |
| MED-I | MEDIUM | B2C funnel | `POST /campaign/public/register/...` | duplicate-email response leaks account existence/details | CampaignPublicController.java:311-319 |
| LOW-A | LOW | Dead code | — | `ListController` no mappings; commented endpoints | ListController.java:1-9 |
| LOW-B | LOW | Logging | — | `printStackTrace`/`System.out` in request path | StudentInfoController.java:657 |
| LOW-C | LOW | B2C | redeem/status responses | full session payload over weakly-keyed endpoints | EntitlementController.java:194; PaymentWebhookController.java:225 |
| LOW-D | LOW | Multiple | not-found handling | inconsistent 200/404/throw semantics | (cross-cutting) |
| LOW-E | LOW | Google admin | group add/delete via GET | Workspace mutation over GET | GoogleAdminController.java:176-217 |
| LOW-F | LOW | Multiple | request bodies | no bean-validation; partial hand-rolled checks | (cross-cutting) |
| INFO-1 | INFO | Payments | webhook HMAC | verified correct | PaymentWebhookController.java:96-108 |
| INFO-2 | INFO | Users | toggle-super-admin | guarded correctly | UserController.java:515-550 |
| INFO-3 | INFO | B2C | redeemAccessToken | token validation sound | EntitlementService.java:179-188 |

---

## Top priorities (recommended order)

1. **CRIT-B** — remove `/util/file-get/**` from permitAll and add ownership/path validation (unauth file disclosure is the most directly exploitable single bug).
2. **CRIT-C / MED-H** — add token-vs-path id cross-checks on every assessment-scope read/write endpoint (student PII + proctoring).
3. **CRIT-D** — add `@PreAuthorize` to `DashboardSnapshotController`.
4. **HIGH-B + MED-C** — unify the public-path config so the eventual `enforce` flip (CRIT-A) does not 403 the B2C/counsellor funnels; fix the `/promo-code/validate` path typo.
5. **HIGH-C** — stop minting `cn_at_asmnt` from the link-id-keyed webhook status endpoint.
6. **HIGH-D** — replace entity-binding upsert on `/student-info/update` with a DTO + load-then-merge.
7. **HIGH-A** — migrate counsellor auth to BCrypt + a real scoped session.
8. **MED-A** — convert the ~18 GET-based mutations to POST/DELETE so CSRF protection actually applies.
