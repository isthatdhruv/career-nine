# Auth Remediation Plan — Career-Nine (RBAC + ABAC)

**Branch:** `attribute-based-auth`
**Date:** 2026-05-21
**Source findings:** `AUTH_AUDIT_FINDINGS.md` (core security), `BACKEND_ENDPOINT_ISSUES.md` (94-controller breadth), `AUTH_FUNCTIONALITY_VERIFICATION.md` (does-it-do-what-we-need), `AUTH_ROLE_ATTRIBUTE.md` (how it works).

## Decisions driving this plan
1. **Menu = URL whitelist** (original design). `AsideMenuMain` will be rewritten to derive item visibility from `currentUser.urls[]`, so menu and route guard always agree.
2. **`user_role_scope` is the single source of truth for scoping.** The older `ContactPerson`-derived `AccessScope` path is retired/migrated; the dashboard becomes scope-aware via `user_role_scope`.
3. **Fully sequenced** — every finding (29+) is placed in a dependency-ordered phase below.

## Guiding principle: the enforce flip is the go-live
`auth.enforce-mode` is `log-only` in **all four** profiles, so today every `@auth.allows()` returns `true` and the only real boundary is the (bypassable) frontend. Flipping to `enforce` is the actual go-live of this feature — but flipping *before* the public funnels and data-scope gaps are fixed would (a) 403 legitimate anonymous B2C/counsellor traffic and (b) still leak cross-tenant data through unscoped/unfiltered endpoints. So the flip is deliberately late (Phase 6), after the prerequisites are closed. Bugs that are exploitable **regardless** of enforce-mode (Phase 1) come first.

---

## Phase 0 — Foundations & safety nets (prerequisite for everything)

**Goal:** make the codebase safe to change and safe to eventually enforce; stop the bleeding in CI.

| Task | What | Findings | Files |
|---|---|---|---|
| 0.1 | **Single source of truth for "public" paths.** Define one `PUBLIC_PATHS` constant array and feed BOTH `.ignoringAntMatchers(...)` (CSRF) and `.antMatchers(...).permitAll()`. Eliminates the drift that causes funnel 401/403s. | MED-C (root of HIGH-B) | `config/SecurityConfig.java:244-265` vs `:298-313` |
| 0.2 | **Fix the CI coverage gate.** `ControllerPreAuthorizeCoverageTest` is not catching `DashboardSnapshotController` (no `@PreAuthorize`, not in `EXCLUSIONS`) → the test isn't gating merges or the controller post-dates the baseline. Make the build actually fail on a missing annotation; run it in CI on every PR. | HIGH-2 / CRIT-D context | `src/test/java/.../archtest/ControllerPreAuthorizeCoverageTest.java` |
| 0.3 | **Seed the permissions the plan introduces** so the eventual enforce flip doesn't 403 valid flows: `dashboard.admin.read`, `dashboard.admin.refresh` (write), and any new codes added in later phases. Add to `PermissionCode` + a Flyway seed migration + assign to admin role groups. | HIGH-2 | `security/PermissionCode.java`, `resources/db/migration/` |
| 0.4 | **Permission-seed coverage audit.** Before any enforce, script a check that every `@auth.allows('code', …)` string referenced in controllers exists in the `permission` table and is granted to at least one role group used by legitimate users. Output the gap list. | CRIT-1 prep | `repository/PermissionRepository.java`, migrations |

**Verification:** CI fails on a deliberately-unannotated test controller; `PUBLIC_PATHS` constant is referenced in both Security config lists; seed-gap script returns zero unseeded codes.

---

## Phase 1 — Bugs exploitable TODAY (independent of enforce-mode)

**Goal:** close everything an attacker can use right now. None of these depend on the enforce flip — they are exploitable in `log-only` and most stay exploitable even after `enforce`.

| Task | Finding | Sev | Fix | Files |
|---|---|---|---|---|
| 1.1 | **CRIT-B** Unauth GCS file read | CRIT | Remove `/util/file-get/**` from `permitAll`; require authenticated principal + ABAC scope OR issue short-lived signed per-object URLs; validate `{name}` against an owner/prefix allow-list. | `controller/UtilController.java:47-57`, `config/SecurityConfig.java:313` |
| 1.2 | **CRIT-C / MED-H** Assessment-token PII + proctoring IDOR | CRIT | Add a single interceptor over `ASSESSMENT_SCOPE_PATHS` that, when an assessment-scoped token is present, requires the path/body `userStudentId` to equal `request.getAttribute("assessmentUserStudentId")` (mirror `AssessmentAnswerController.submit:258-275`). Then audit each handler. | `controller/career9/StudentDemographicResponseController.java:77-129`, `controller/StudentInfoController.java:678-714`, `controller/career9/HeartbeatController.java`, `LiveTrackingController.java`, `AssessmentProctoringController.java`, `security/TokenAuthenticationFilter.java:69-74` |
| 1.3 | **HIGH-C** Session-cookie minting on guessable link id | HIGH | Stop minting `cn_at_asmnt` from `GET /payment/webhook/status/{razorpayLinkId}` / `/info/{transactionId}`. Require the unguessable access token (or a one-time code) before issuing the cookie. | `controller/career9/PaymentWebhookController.java:165-244` |
| 1.4 | **HIGH-1** `/auth/assessment-session` mints session from two enumerable ids | HIGH | Require proof of identity before minting (redemption token like the B2C `redeem-token` flow, or DOB/OTP matching the student record). Add to rate-limit set (Task 1.7). | `controller/AssessmentSessionController.java:99-162` |
| 1.5 | **CRIT-D / HIGH-2** Admin dashboard unguarded | CRIT | Add `@PreAuthorize("@auth.allows('dashboard.admin.read')")` to `GET /admin/snapshot` and a write perm to the refresh POST. (Scope-awareness is Phase 4; this just stops anonymous-of-the-console access.) | `controller/career9/DashboardSnapshotController.java:20-32` |
| 1.6 | **HIGH-D** Mass-assignment upsert | HIGH | Replace `POST /student-info/update` entity-binding+blind-save with a DTO (explicit field allow-list), load existing entity by id, scope-check against the **persisted** `instituteId`, copy permitted fields only. | `controller/StudentInfoController.java:663-667` |
| 1.7 | **MED-3 / MED-E** Rate-limit gaps | MED | Add `/auth/assessment-session`, `/entitlement/redeem-token`, `/auth/oauth-exchange`, `/leads/capture`, and the assessment-scope PII GETs to the per-IP (and per-student where applicable) buckets. | `security/ratelimit/RateLimitFilter.java:58-64` |
| 1.8 | **MED-I** Duplicate-email enumeration | MED | Return a generic "could not register, contact support" without echoing existing-account/institute details. | `controller/career9/b2c/CampaignPublicController.java:311-319` |

**Verification:** anonymous `GET /util/file-get/...` → 401; an assessment token for student A → 403 on student B's `/contact-info`; webhook status no longer sets `Set-Cookie: cn_at_asmnt`; rate-limit returns 429 after threshold on the newly-covered paths; integration test for the DTO merge confirms omitted fields are preserved and `id`/`instituteId` cannot be overridden cross-tenant.

---

## Phase 2 — Pre-enforce correctness (so the flip protects without breaking)

**Goal:** make every endpoint's gate *correct* — public endpoints reachable anonymously, by-id mutations scope-bound — so that when `enforce` is flipped (Phase 6) nothing legitimate breaks and nothing illegitimate gets through.

| Task | Finding | Fix | Files |
|---|---|---|---|
| 2.1 | **HIGH-B** `@PreAuthorize` on genuinely-anonymous endpoints | Add each to `PUBLIC_PATHS` (Task 0.1) and **remove** the `@PreAuthorize` (rely on in-controller token/signature/promo gates). Fix the `/promo-code/validate` → `/promo-codes/public/validate` path typo. | `PromoCodeController.java:151`, `ReportPreparationController.java:39`, `BetReportDataController.java:110`, `EntitlementController.java:173`, `LeadController.java:50`, `AssessmentInstituteMappingController.java:184,249`, `SecurityConfig.java:263` |
| 2.2 | **HIGH-A** Counsellor auth | Migrate to BCrypt (use shared `passwordEncoder`); issue a real scoped JWT/cookie on `/login`; move `/self-register`+`/login` to `PUBLIC_PATHS` and drop their `@PreAuthorize`. | `controller/career9/counselling/CounsellorController.java:52-184` |
| 2.3 | **HIGH-E** IDOR-by-id on management endpoints | For each by-id mutation, load the entity and verify its institute/owner against the principal's scopes (add the scope arg to `@auth.allows`). For B2C/counsellor entities with no institute dimension, gate on an explicit admin permission + `@SensitiveOp` audit. | `CounsellorController.java:192-267`, `EntitlementController.java:222-276`, `UserController.java:343,552`, `GeneratedReportController.java:60` |
| 2.4 | **HIGH-F** Report visibility/delete without scope | Bind student/institute scope to `PUT /toggle-visibility` and `DELETE /delete/{id}` and verify. (Reports are the paid B2C deliverable.) | `GeneratedReportController.java:60-61,128-129` |
| 2.5 | **HIGH-G** Destructive cross-institute bulk ops | Scope-bind the destructive firebase/navigator operations to institute/assessment and require an elevated permission + confirmation/audit. | `FirebaseDataMappingController.java:432,456,216`, `NavigatorReportDataController.java:328` |

**Verification:** anonymous calls to each public funnel endpoint succeed (no 401/403) on a build with `enforce` temporarily on in a test profile; a permission-holder scoped to institute 5 gets 403 acting on an institute-7 resource by id; counsellor login returns a cookie/JWT and a protected counsellor call works off it.

---

## Phase 3 — Data-scope coverage (row-level filtering actually covers the data)

**Goal:** make the Hibernate `scopeFilter` (and explicit scope predicates where the filter can't reach) cover the surfaces that matter, so a scoped user genuinely sees only their data. Note the row filter runs **independent of enforce-mode**, so these fixes deliver value even before the flip.

| Task | Finding | Fix | Files |
|---|---|---|---|
| 3.1 | **2.4 / AssessmentTable no-op** | Replace the `@Filter` `condition = "1=1"` with a real `institute_id IN (:instituteIds) OR institute_id IS NULL` (or remove the annotation and scope assessments explicitly in the queries). | `model/career9/AssessmentTable.java:34` |
| 3.2 | **2.6 / InstituteDetail unscoped** | Add `@Filter` scoping (or explicit scope predicates) to `InstituteDetail` so `GET /institute-detail/get` and `/get/list` return only in-scope institutes; super-admin/full-wildcard bypass as today. | `model/.../InstituteDetail.java`, `controller/career9/InstituteDetailController.java:119-122` |
| 3.3 | **Projection/native-map endpoints bypass the entity filter** | Add explicit scope predicates to map/native queries that don't traverse a filtered entity: `getStudentScores`, `getStudentAnswersWithDetails`, `getBulkStudentAnswersWithDetails`, `exportScoresByInstitute`, `bet-report/{institute}/{assessment}`. Confirm `getAllStudentsWithMapping` keeps the filter active through its join. | `controller/StudentInfoController.java` (score/answer endpoints), repos for `AssessmentAnswer` |
| 3.4 | **GeneratedReport not filtered** | Annotate `GeneratedReport` with the scope filter (or add explicit predicates to its list endpoints) so report lists narrow by scope; combine with Task 2.4. | `model/.../GeneratedReport.java`, `controller/career9/GeneratedReportController.java` |
| 3.5 | **Widen single-dimension filters where appropriate** | `UserStudent`/`Campaign` (institute-only) and `InstituteBranch` (course-only) filters are partial by design — confirm each matches intent; widen to additional dimensions where the entity carries them. | `UserStudent.java:26-27`, `Campaign.java:31-32`, `InstituteBranch.java:29-30` |

**Verification:** as a user scoped to institute 5, `GET /institute-detail/get` returns only institute 5; assessment lists, score/answer projections, and report lists all narrow to scope; super-admin still sees everything; an integration test asserts row counts per scope.

---

## Phase 4 — Scope-aware dashboard (the marquee "school / teacher dashboard")

**Goal:** deliver the actual product requirement — a school sees only its data and a teacher sees only their slice — using **`user_role_scope`** as the single scope model (per decision 2).

| Task | Finding | Fix | Files |
|---|---|---|---|
| 4.1 | **2.7 dead scope-aware service + two-model split** | Re-implement dashboard scoping against `user_role_scope` (the principal's `getScopes()`), not `ContactPerson`/`AccessScope`. Either refactor `DashboardDataService.fetchForCurrentUser` to read `UserPrincipal.getScopes()` or build a new scope-aware aggregation that reuses the `CurrentScopes` predicate. | `service/career9/DashboardDataService.java`, `security/CurrentScopes.java` |
| 4.2 | **2.6 unscoped cached blob** | The org-wide single cached blob (`ADMIN_DASHBOARD_KEY`, 24h) cannot be retroactively narrowed. Replace with either (a) per-scope cache keys derived from the principal's scope signature, or (b) on-the-fly scoped aggregation for non-super-admins (keep the shared blob only for super-admin). | `service/.../DashboardSnapshotService.java`, `controller/career9/DashboardSnapshotController.java` |
| 4.3 | **Wire the endpoint + FE** | Expose the scope-aware dashboard at a controller endpoint with `@PreAuthorize("@auth.allows('dashboard.admin.read')")` (Phase 1 added the gate; this makes the payload scoped) and point the FE admin dashboard at it. | `controller/career9/DashboardSnapshotController.java`, `pages/demo-dashboard-v2/dashboard-admin.api.ts:107,112` |
| 4.4 | **Retire `ContactPerson` AccessScope path** | Once the dashboard uses `user_role_scope`, deprecate/remove `security/access/AccessScope*` usage in `InstituteDetailController` and `DashboardDataService`, or migrate its one remaining caller. Document the single model. | `security/access/AccessScope*.java`, `controller/career9/InstituteDetailController.java` |

**Verification:** a school-scoped admin's dashboard totals equal the sum of only their institute's data; a teacher-scoped user sees only class/section figures; two users with different scopes get different snapshots (cache keys differ); super-admin sees org-wide.

---

## Phase 5 — Frontend menu = URL whitelist (original design)

**Goal:** make the aside menu show only the role group's allowed URLs, so menu and route guard agree (per decision 1).

| Task | Finding | Fix | Files |
|---|---|---|---|
| 5.1 | **1.5 menu permission-driven** | Rewrite `AsideMenuMain` to derive each item/section's visibility from `urlAllowed(currentUser.urls, itemPath)` instead of `can('perm')`. Keep super-admin bypass. | `_metronic/layout/components/aside/AsideMenuMain.tsx:33-104`, `modules/auth/core/permissions.ts:100-123` |
| 5.2 | **Consistency** | Confirm every menu item's `to=` path matches a `RequirePermission`-guarded route so the menu and the route guard now agree; remove the now-redundant `can()` gating or keep as a defensive secondary check per item. | `routing/PrivateRoutes.tsx`, `AsideMenuMain.tsx` |
| 5.3 | **(Optional) model nicety** | "URLs bundled into a role group" is realized at the *role* level today. Decide whether to leave as-is (functionally equivalent) or add literal group-level URL bundling; document the chosen model in `AUTH_ROLE_ATTRIBUTE.md`. | `model/RoleUrl.java`, docs |

**Verification:** a user whose role URL list excludes `/student-list` no longer sees that menu item (previously visible via `student.read`); clicking any visible menu item never lands on `RequestAccessPage`; super-admin sees all.

---

## Phase 6 — Enforce-mode soak & flip (the go-live)

**Goal:** turn on real endpoint enforcement, after Phases 0–3 have removed the reasons it would break or under-protect.

| Task | Finding | Fix |
|---|---|---|
| 6.1 | **MED-4** | Actually flip **sandbox** to `enforce-mode: enforce`. Reconcile the misleading comments in `application-sandbox.yml`/`application-production.yml` with reality. |
| 6.2 | **CRIT-1** | Soak in sandbox with realistic role/scope data. Collect every `auth_audit` DENY for legitimate flows; fix the underlying missing-seed/scope-arg gaps (loop with Phase 0.4 script). |
| 6.3 | **CRIT-1** | Flip **production** to `enforce` only after the sandbox soak is clean. Treat this as the feature go-live; have a one-line rollback (env var back to `log-only`). |
| 6.4 | — | Add an integration test suite that runs the controller matrix under `enforce` and asserts expected 200/403 per role/scope, so the mode can't silently regress. |

**Verification:** in `enforce`, a low-privilege user gets 403 on role/permission management and cross-scope reads; all anonymous funnels and the legitimate scoped flows still return 200; `auth_audit` shows DENYs are now actually blocking.

---

## Phase 7 — Defense-in-depth hardening

**Goal:** close the remaining medium/low items now that the core model is correct and enforced.

| Task | Finding | Sev | Fix | Files |
|---|---|---|---|---|
| 7.1 | **HIGH-3** | HIGH | Pin the JWT algorithm to HS512 on parse (reject `none`/mismatched alg); add unit tests for both. Confirm the jjwt version in `pom.xml`. | `security/TokenProvider.java:194-356`, `pom.xml` |
| 7.2 | **MED-1** | MED | Remove the committed fallback `tokenSecret` default so a missing `APP_AUTH_TOKEN_SECRET` fails fast at boot; rotate the exposed secret out of any env that used it; consider purging from git history. | `resources/application.yml:134`, `security/TokenProvider.java:79-93` |
| 7.3 | **MED-2** | MED | OAuth success handler: mint `createAccessToken` (60-min) not the 10-day `createToken`; set the cookie server-side at callback, or use a one-time short-TTL exchange code instead of putting a JWT in the redirect URL. | `security/oauth2/OAuth2AuthenticationSuccessHandler.java:104-108` |
| 7.4 | **MED-A** | MED | Convert the ~18 state-changing `@GetMapping` deletes/mutations to `@DeleteMapping`/`@PostMapping` so CSRF protection applies; update FE callers. | `UserController.java:344`, `UtilController.java:60,69`, `GoogleAdminController.java:176,184,201`, `RoleGroupController.java:61`, `UserRoleGroupMappingController.java:91`, +others (see BACKEND_ENDPOINT_ISSUES MED-A) |
| 7.5 | **MED-B** | MED | Add `Pageable` + projections to high-cardinality `getAll` lists (students, leads, answers, reports, transactions). | `StudentInfoController.java:110`, `LeadController.java:131`, `UserController.java:90`, `AssessmentTableController.java:158` |
| 7.6 | **MED-D / LOW-B** | MED/LOW | Guard `Long.valueOf(...toString())`/`Optional.get()` body parsing → 400 on bad input; remove `printStackTrace`/`System.out`; ensure `@ControllerAdvice` returns sanitized errors. | `StudentDemographicResponseController.java:64`, `StudentInfoController.java:657,720`, `EntitlementController.java:178` |
| 7.7 | **MED-F** | MED | Make promo max-uses atomic: `UPDATE ... SET current_uses=current_uses+1 WHERE id=? AND current_uses<max_uses` and check affected rows. | `PromoCodeController.java`, `CampaignPublicController.java:292-299` |
| 7.8 | **MED-G** | MED | Server-side validate upload magic bytes + size cap; never trust client MIME; randomize stored object names. | `CounsellorController.java:194`, `FourPagerTemplateController.java:43`, `QuestionMediaController.java:31`, `ReportZipController.java:30`, `ReportTemplateController.java:81` |
| 7.9 | **LOW-1** | LOW | Single generic login-failure message + dummy bcrypt on unknown-email path to kill enumeration/timing. | `controller/AuthController.java:93-101` |
| 7.10 | **LOW-2** | LOW | Flip CSP from report-only to enforcing in production; move toward nonce-based `script-src`, dropping `unsafe-inline`/`unsafe-eval`. | `config/SecurityConfig.java:418-452` |
| 7.11 | **LOW-3** | LOW | Move the jti deny-list to a shared store (Redis) before horizontal scaling; keep access-token TTL short until then. | `security/JtiDenyListService.java:35-73` |
| 7.12 | **LOW-A/F** | LOW | Remove dead `ListController` + commented endpoints; introduce `@Valid`/bean-validation on request DTOs. | `controller/ListController.java`, cross-cutting |

---

## Dependency map (why this order)

```
Phase 0 (foundations, CI, public-path SoT, seed perms)
   │
   ├─► Phase 1 (exploitable-today bugs — no enforce dependency)
   │
   ├─► Phase 2 (gate correctness) ──┐
   │                                 │ both required before the flip
   └─► Phase 3 (row-filter coverage)─┤   so it neither breaks funnels
                                     │   nor under-protects data
   Phase 4 (scoped dashboard) ───────┤
   Phase 5 (URL-driven menu) ────────┘
                                     │
                                     ▼
                              Phase 6 (soak → enforce flip = go-live)
                                     │
                                     ▼
                              Phase 7 (defense-in-depth hardening)
```

Phases 1, 3, 4, 5 deliver value **before** the flip (the bugs they fix and the row filter / dashboard scoping / menu all work in `log-only`). Phases 2 + 0 are the hard prerequisites for Phase 6. Phase 7 is independent hardening that can proceed in parallel once Phase 1 is done.

## Suggested sequencing for execution
- **Sprint 1:** Phase 0 + Phase 1 (stop active exploitation; make CI trustworthy).
- **Sprint 2:** Phase 2 + Phase 3 (gate correctness + data coverage).
- **Sprint 3:** Phase 4 + Phase 5 (scoped dashboard + URL menu).
- **Sprint 4:** Phase 6 (sandbox soak → production enforce), then Phase 7 hardening rolling in parallel.

## Cross-cutting verification gates
- The `ControllerPreAuthorizeCoverageTest` passes and runs in CI (Phase 0.2).
- A new integration suite asserts 200/403 per role+scope under `enforce` (Phase 6.4).
- Per-phase verification rows above are converted to automated tests where practical.
- No code change in this plan touches `npm run build`/`tsc` (per repo convention) — frontend changes are reviewed by reading, built by the team's normal pipeline.
</content>
</invoke>
