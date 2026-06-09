# Career9 B2B Flow — Functional Issues (Audit)

> **Status:** Partially fixed — see the **Update log (2026-06-03)** below. Remaining work is in "Recommended fix order".
> **Date:** 2026-06-02 (audit) · 2026-06-03 (migration + first fix batch) · **Branch:** `dhruv-from-palak`
> **Scope:** B2B self-registration — Flow A (paid assessment-mapping link), Flow B (school registration), and the shared payment/webhook pipeline. Frontend (react-social admin + career-nine-assessment SPA) and Spring backend.
> **How produced:** 8 parallel finders → dedup/triage → each candidate bug re-read by **two independent skeptics** against current source (one builds a repro, one tries to refute; default-to-refuted on doubt). 56 raw → 37 deduped → **33 survived**. The three headline HIGHs (P2, W3/W4, D1) were additionally hand-verified by grep against source.
> **Tag legend:** `[CONFIRMED]` = both verifiers agreed real · `[LIKELY]` = one verifier confirmed, one had a documented doubt (noted inline — sanity-check before acting).

---

## TL;DR

Defects cluster in **capacity accounting** and **transaction boundaries**, and most are reachable on **anonymous, token-gated public endpoints** (several are trivially griefable). Worst offenders:

- **P2** — paid school webhook increments the *wrong tier table*, so school caps are never enforced for paying students.
- **W3 / W4 / W5** — the payment-status *reconcile* path bypasses both its `@Transactional` (self-invocation) and its pessimistic row lock → non-atomic provisioning, double-provision races, and a terminal `paid_provisioning_failed` dead-end.
- **D1** — free-path B2B students never get a membership-history row → they vanish from the institute roster and 404 on membership management.
- **B4** — "unmapping" a class via Save All silently leaves it active and registrable.
- **A1 / A2** — promo `currentUses` is burned before any redemption and counted non-atomically.
- **PAY1** — Razorpay link is created live *inside* the register transaction → a commit failure orphans a payable link with no DB row (money taken, no record).

### Count table (area × severity)

| Area | High | Medium | Low |
|---|---|---|---|
| Flow A registration | 1 | – | – |
| Flow B / school registration | 1 | 4 | – |
| Webhook & provisioning | 2 | 4 | – |
| Payment / Razorpay | – | 1 | 2 |
| Pricing & caps | 1 | 4 | 2 |
| Frontend | 1 | 1 | 2 |
| Data integrity | 1 | – | – |

---

## Update log (2026-06-03)

### Context change — school registration migrated to the assessment app
The school (Flow B) registration page was moved off the dashboard app onto the assessment SPA so all B2B registration links live on the same host. **No backend endpoints changed**, so the flow is unchanged.
- **New (assessment app):** `career-nine-assessment/src/pages/SchoolAssessmentRegisterPage.tsx` (ported, behaviour-identical) + `career-nine-assessment/src/api-clients/schoolRegistrationAPI.ts` (same `/school-registration/public/**` endpoints via the shared `http` instance) + route `/school-register/:token` in `career-nine-assessment/src/App.tsx`.
- **Admin link** (`SchoolAssessmentMappingPanel.tsx`) now builds `REACT_APP_ASSESSMENT_APP_URL/school-register/{token}` (with a `https://assessment.career-9.com` fallback).
- **Already-sent dashboard links keep working:** `react-social/.../AppRoutes.tsx` `/school-register/:token` is now a `SchoolRegisterRedirect` that forwards to the assessment app, preserving the query string. The old `react-social/.../SchoolRegistration/SchoolAssessmentRegisterPage.tsx` is now dead (orphaned) but left in place; its sibling `SchoolRegistration_APIs.ts` stays (admin panel still uses its admin endpoints).
- **Issue file paths that moved:** FE3/FE4/FE5 now refer to `career-nine-assessment/src/pages/{SchoolAssessmentRegisterPage,AssessmentRegisterPage}.tsx`, not the react-social copies.

### Fixed this batch (compiles clean: `mvn -o compile` ✓, assessment-app `tsc` ✓)
| ID | Sev | Fix | File(s) |
|---|---|---|---|
| **P2** | HIGH | Webhook now routes school txns to `schoolAssessmentTierRepository.tryIncrementCount` (dispatch on `schoolConfigId`) — school caps enforced for paid students | `PaymentWebhookController.java` (`tryIncrementMappingTier` + new autowire) |
| **D1** | HIGH | Free paths now call `membershipService.setPrimaryInstitute(...)` after `provision()` — free students appear in the roster / are manageable | `SchoolRegistrationController.java` (2 sites), `AssessmentInstituteMappingController.java` (2 sites), + autowires |
| **W2** | MED | Existing-student paid webhook increments the cap inside the new-`StudentAssessmentMapping` block (counts 2nd assessments; retries don't double-count) | `PaymentWebhookController.java` (`handleExistingStudentPayment`) |
| **B2** | MED | `parseClassNumber` null-guards `className` and returns `null` instead of the PK | `PaymentWebhookController.java` + `SchoolRegistrationController.java` |
| **B3** | MED | `register` rejects a deactivated class config (409) | `SchoolRegistrationController.java` |
| **B5** | MED | Price-change link cancel scoped to the edited tier (`mappingTierId == saved.tierId`) | `SchoolRegistrationController.java` (`updateSchoolTier`) |
| **P1** | LOW(money) | Promo amount clamped to ≥1 unless a true 100% discount (no accidental free) | both register controllers |
| **PAY2** | LOW | `reference_id` gets a UUID suffix (no 1-ms collisions) | `PaymentController.java` (×2), both register controllers |
| **FE3** | MED | Promo price display uses `Math.floor` to match the backend charge | assessment-app `SchoolAssessmentRegisterPage.tsx` + `AssessmentRegisterPage.tsx` |
| **FE1** | HIGH | Added `REACT_APP_ASSESSMENT_APP_URL` fallback to the last builders missing it (Flow-A panel + school link + redirect bridge) | `AssessmentMappingPanel.tsx`, `SchoolAssessmentMappingPanel.tsx`, `AppRoutes.tsx` |

### Deferred (why) — pick these up next
- **W3 / W4 / W5 (HIGH) — reconcile transaction + lock + recovery.** Needs the reconcile path routed through the Spring proxy (`@Lazy self` / extract a `@Service`), the pessimistic `findByRazorpayLinkIdForUpdate` lock inside a real transaction, and `paid_provisioning_failed` made retry-safe + idempotent. Touches money-provisioning atomicity → wants a dedicated change with tests (ideally run the app). **W6/W7 are subsumed** by this fix (they only manifest on the unlocked reconcile path).
- **PAY1 (HIGH-ish) — link created inside the register tx.** Reorder to commit a `pending` txn before the irreversible Razorpay call + add a webhook fallback that reconciles an unknown paid link via `reference_id`/`notes`. Transaction-ordering refactor; do alongside W3/W4.
- **A1 / A2 (MED) — promo consumed early + non-atomic.** Move consumption to realized redemption (webhook/free-commit) via an atomic guarded `UPDATE ... WHERE current_uses < max_uses`. Needs a new `@Modifying` repo method + a redemption hook → small but cross-cutting.
- **A4 (MED) — Flow A doesn't cancel prior `created` links** (double-charge on resubmit). Needs `findByStudentEmailAndAssessmentId` + a cancel pass mirroring the school flow.
- **B4 (HIGH) — `batch-save` doesn't deactivate omitted configs.** Make batch-save authoritative for `(institute, session)` + stop the FE dropping cleared classes. Needs a deactivate-by-session repo method + FE change.
- **B1 (MED) — verify/register identity-key mismatch** (phone vs email). Add a phone dedup branch to `registerStudent`. Narrow trigger.
- **P3 / P4 (MED/LOW) — free-path recount drift + advisory cap.** Make free increments recount-able (or recount from `StudentAssessmentMapping`), and gate provisioning on the guarded increment.
- **W1 (MED) — over-sell on `rows==0`** and **FE5 (MED) — DOB auto-login**: **product/policy decisions**, not changed unilaterally (no refund path exists; DOB-as-password may be intended). Decide before touching.
- **FE4 (MED) — verify fail-open** and **FE2 (LOW) — duplicate Free/Paid columns**: likely intended / cosmetic per the verifiers; left as-is.
- **TM1–TM4** — admin tier-modal edge cases; low urgency.

### Fixed this batch (2026-06-05) — shared with the B2C work (compile ✓, app context boots+serves ✓)
| ID | Sev | Fix | File(s) |
|---|---|---|---|
| **W3 / W4** | HIGH | Reconcile path (`/status/{linkId}?reconcile=1` **and** the admin Tracker check-status) now routes through a proxied `@Transactional` method that takes the `findByRazorpayLinkIdForUpdate` pessimistic lock (`@Lazy self`) — no more proxy-bypass non-atomicity or double-provision race; webhook + poll + admin all serialise on one row | `PaymentWebhookController` (`reconcilePaidAndProvision`/`reconcileTerminalStatus` + `@Lazy self`), `TrackerController` |
| **W5** | HIGH | Reconcile redrives `paid_provisioning_failed`; provisioning is idempotent (reuses an already-stamped `userStudentId` via `ensureAssessmentMapping`) so a crashed provision self-heals without duplicating the account/cap | `PaymentWebhookController` |
| **PAY1** | HIGH | New `PaymentTransactionWriter` (`REQUIRES_NEW`) commits a `created` txn **before** the irreversible Razorpay link call; `transactionId` in `reference_id`/notes + a webhook fallback (`parseTransactionIdFromNotes`) recovers a row whose link-id update was lost | `PaymentTransactionWriter` (new), `AssessmentInstituteMappingController.createPaymentAndRedirect`, `PaymentWebhookController.handlePaymentLinkPaid` |
| **A1 / A2** | MED | Promo `currentUses` no longer consumed at registration; deferred to realized redemption via the atomic guarded `PromoCodeRepository.tryConsume` (paid: `markPaidAndProvision` success; free: free-commit). Applied to **both** `AssessmentInstituteMappingController` and `SchoolRegistrationController` | `PromoCodeRepository` (new), `AssessmentInstituteMappingController`, `SchoolRegistrationController`, `PaymentWebhookController` |

### Fixed (2026-06-05, batch 2) — B2B Tier-2 functional + authz
| ID | Sev | Fix | File(s) |
|---|---|---|---|
| **A4** | HIGH | Public register now cancels prior `created` links for the same student+assessment (commit-in-own-tx) before returning — no multiple simultaneously-payable links | `AssessmentInstituteMappingController.cancelPriorOutstandingLinks` |
| **B4** | HIGH | `batch-save` is authoritative for `(institute, session)` — deactivates every config whose class is absent from / cleared in the batch, so "unmapping" a class actually stops it being registrable | `SchoolRegistrationController.batchSaveConfigs` |
| **B2** | MED | `parseClassNumber` null-guards `className` and returns `null` (never the PK) on a non-numeric class | `AssessmentInstituteMappingController.parseClassNumber` |
| **PAY1 (school)** | HIGH | School `createPaymentAndRedirect` reordered to commit the txn before the Razorpay link (+ `transactionId` in notes) | `SchoolRegistrationController` |
| **AUTH2 (partial)** | MED | The 6 tier-admin endpoints now carry `@PreAuthorize('assessment_institute_mapping.*')` (codes already seeded) → `ControllerPreAuthorizeCoverageTest` is green; the public funnel + login endpoints added to the test EXCLUSIONS with justification | `AssessmentInstituteMappingController`, `ControllerPreAuthorizeCoverageTest` |

**Still deferred:** B1 (phone/email verify-vs-register key mismatch), P3/P4 (free-path recount drift / advisory cap), and the `auth.enforce-mode` flip itself (held — see B2C doc). Note `PermissionCatalogSeedCoverageTest` is **pre-existing red** on this branch (12 unseeded `reminders.*`/`report_template.*`/etc. enum codes — unrelated to this work; they need seed migrations). Also surfaced during verification: `ControllerPreAuthorizeCoverageTest` is red on this branch — the 6 tier-admin endpoints here (`createTier`/`updateTier`/`deleteTier`/`toggleTier`/`listTiers`/`recountTier`) have **no `@PreAuthorize`** (fold into the authz/enforce-mode rollout).

---

## Recommended fix order

1. **Correctness/money/roster (do first):** `P2`, `W3`+`W4`, `D1`, `B4`
2. **Abuse + money risk:** `A1`, `A2`, `PAY1`
3. **Recovery & dedup:** `W5`, `W2`, `B1`, `B3`, `B2`, `B5`
4. **Pricing edges:** `P3`, `P1`, `P4`, `PAY2`
5. **Frontend/UX:** `FE3`, `FE1` (fallback), `FE4`; then `FE2`, `FE5` (likely cosmetic)
6. **Policy decisions (not necessarily bugs):** `W1` (over-sell vs refund), `FE5` (DOB-as-password model)

Several share a root cause — fix the source once:
- `W3`/`W4`/`W6`/`W7` all stem from the reconcile path lacking a real transaction + lock. Fix the reconcile boundary once.
- `A1`/`A2` both want one atomic guarded `UPDATE ... WHERE current_uses < max_uses`, moved to realized-redemption time.
- `P3`/`P4` both want free-path increments to be authoritative + recount-able.

---

## Compact flow context (for a cold start)

Two B2B sub-flows share one payment/webhook engine. **The admin UI never creates students** — students + `StudentAssessmentMapping` rows are created only at the public `/public/register/{token}` endpoint (when price resolves to 0) or in the Razorpay webhook (when paid). Free-vs-paid is decided **server-side** by the resolved tier amount, not by which link is shared.

| | **Flow A — Assessment Mapping (paid)** | **Flow B — School registration** |
|---|---|---|
| Controller | `AssessmentInstituteMappingController` `/assessment-mapping` | `SchoolRegistrationController` `/school-registration` |
| Config entity | `AssessmentInstituteMapping` (token on the row) | `SchoolAssessmentConfig` (per class) + `SchoolRegistrationLink` (one token per institute+session) |
| Tier entity | `AssessmentMappingTier` | `SchoolAssessmentTier` |
| Public link | `REACT_APP_ASSESSMENT_APP_URL/assessment-register/{token}` (assessment SPA) | `REACT_APP_URL/school-register/{token}` (react-social) |
| Free reg auto-login? | Yes (`cn_at_asmnt` cookie) | No |

Shared: pricing tiers (lowest-`sortOrder` active tier under cap = LIVE price), `PaymentTransaction` ledger (discriminator = exactly one of `mappingId` / `schoolConfigId` / `campaignId`), `RazorpayService.createPaymentLink` (`amount = amountInr * 100L` paise; 48h expiry), and the webhook `markPaidAndProvision → createStudentAndAllotAssessment`.

Key files:
- `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentInstituteMappingController.java`
- `.../controller/career9/SchoolRegistrationController.java`, `.../SchoolSessionController.java`
- `.../controller/career9/PaymentController.java`, `.../PaymentWebhookController.java`
- `.../service/RazorpayService.java`, `.../service/career9/AssessmentMappingTierService.java`
- `.../service/b2c/StudentInstituteMembershipService.java`, `.../service/StudentProvisioningService.java`
- `react-social/src/app/pages/AssessmentMapping/AssessmentMappingPage.tsx`, `.../College/components/{AssessmentMappingPanel,TierManagementModal,SchoolAssessmentMappingPanel,SchoolTierManagementModal}.tsx`
- `react-social/src/app/pages/SchoolRegistration/SchoolAssessmentRegisterPage.tsx`
- `career-nine-assessment/src/pages/AssessmentRegisterPage.tsx`

---

## Flow A — assessment-mapping registration

### [CONFIRMED] A4 · HIGH — Public register never cancels prior `created` links → multiple simultaneously-payable, stale-price links
- **Where:** `AssessmentInstituteMappingController.java:632-689` (`createPaymentAndRedirect`); contrast `SchoolRegistrationController.java:847-855`.
- **Breaks:** Submitting the register form twice (price changed, or promo on the 2nd) leaves two+ live immutable Razorpay links at different prices, both payable → double-charge.
- **Why:** Flow A creates a new link + `created` txn on every submit but never calls `findByStudentEmailAndAssessmentId` + `cancelOutstandingLinks`. No `StudentInfo` exists pre-payment, so both dedup checks miss on resubmit.
- **Fix:** Mirror the school flow — after `save(txn)`, load prior txns and `cancelOutstandingLinks(prior)` (try/catch each cancel; copy helper from `SchoolRegistrationController:782-794`).
- **Severity split:** repro=High (claims downstream double-provision), refute=Medium (2nd payment routes to `handleExistingStudentPayment` where the SAM unique constraint + `userStudents.isEmpty()` gate prevent a duplicate mapping/double-increment). **Double-charge itself is undisputed.**

---

## Flow B — school registration

### [CONFIRMED] B4 · HIGH — `batch-save` never deactivates configs absent from the batch → "unmapping" a class silently leaves it active and registrable
- **Where:** `SchoolAssessmentMappingPanel.tsx:148-156` (FE filter); `SchoolRegistrationController.java:134-157` (`batchSaveConfigs`).
- **Breaks:** Setting a class to "-- No assessment --" drops it from the payload; backend only upserts received rows (force `isActive=true`) and never deactivates omitted ones. Reload query has no `isActive` filter, so the green "Saved" badge re-renders while students keep registering/paying for the "removed" assessment.
- **Why:** `handleSaveAll` filters to truthy `assessmentId`; `batchSaveConfigs` iterates only the submitted list (`existing.setIsActive(true)`), no deactivate-by-session pass. `getConfigs` has no `isActive` filter.
- **Fix:** Make batch-save authoritative for `(instituteCode, sessionId)` — deactivate every existing config whose `classId` is absent (or null-assessment); send cleared classes with null `assessmentId`; enforce `isActive` at register time (see B3).

### [CONFIRMED] B1 · MED — `verify-details` matches by phone OR email but `register` dedups by email-then-(DOB+class+name)
- **Where:** `SchoolRegistrationController.java:497-535` (`verifyDetails`) vs `:655` / `:668-669` (`registerStudent` dedup).
- **Breaks:** A returning student entering the same phone but a typo'd/different email passes verify as `already_registered`, but `register`'s email lookup misses and — if name/class don't line up exactly — the DOB branch misses too → a brand-new account is created + tier double-counted.
- **Why:** The two endpoints use different identity keys; `register` never uses `findByPhoneNumberAndInstituteId`.
- **Fix:** Add a phone dedup branch to `registerStudent` (pick candidate via `pickWithMatchingDob`), or factor one shared resolver both endpoints call. *(Narrow: needs different email AND name/class mismatch.)*

### [CONFIRMED] B3 · MED — `register` resolves config by `classId` without checking `isActive` → a deactivated class is still registrable
- **Where:** `SchoolRegistrationController.java:605-606` (`findByInstituteCodeAndSessionIdAndClassId`); contrast display query `:412` (`...AndIsActiveTrue`).
- **Breaks:** A client posting the `classId` directly (or a stale tab) passes config resolution for a class the admin disabled and proceeds to tier/payment. `getSchoolInfo` hides it, but the register action doesn't enforce the flag. The active-tier resolver keys on `(institute, session, assessment)` independent of config state.
- **Fix:** Reject `!Boolean.TRUE.equals(config.getIsActive())` after resolving config (`:611`), or add `...AndIsActiveTrue` finder at `:605-606`.

### [CONFIRMED] B2 · MED — `parseClassNumber` NPEs on null `className` and falls back to the raw PK as the class number
- **Where:** `SchoolRegistrationController.java:954-966` (`parseClassNumber`), used at `:626` / dedup `:669`.
- **Breaks:** (a) null `className` → `className.replaceAll(...)` NPE the `catch (NumberFormatException)` doesn't handle → unhandled 500 on register (null-`className` classes are creatable). (b) non-numeric names ("Nursery","LKG") → `parseInt("")` throws; the catch returns the raw DB **primary key** as the student's class number, persisted as `studentClass` (pollutes reports; a PK equal to a real grade conflates classes).
- **Fix:** `if (className == null) return null; String d = className.replaceAll("[^0-9]",""); return d.isEmpty() ? null : Integer.parseInt(d);`.
- **Note:** Both verifiers confirm the NPE + PK-leak; only the headline "dedup bypass" sub-claim was refuted (fallback is deterministic, so same-class re-registration still dedups). Treat NPE + PK-corruption as confirmed.

### [CONFIRMED] B5 · MED — Price-change link cancellation scoped only by institute, ignoring session/tier
- **Where:** `SchoolRegistrationController.java:333-341` (`updateSchoolTier` price-change branch) + `cancelOutstandingLinks`.
- **Breaks:** Editing one session's tier loads `findByAssessmentIdOrderByCreatedAtDesc(assessmentId)` and keeps rows only by `schoolConfigId != null` + matching `instituteCode` — `sessionId`/tier never compared. If the same `assessmentId` is configured across multiple sessions of one institute, **every** outstanding `created` link for that institute+assessment is cancelled, forcing unrelated mid-payment students to restart.
- **Fix:** `outstanding.removeIf(t -> t.getMappingTierId() == null || !t.getMappingTierId().equals(saved.getTierId()))` before `cancelOutstandingLinks` (each school txn stamps `mappingTierId` at `:692`/`:825`). *(Only manifests in multi-session-same-assessment configs on an admin price edit.)*

---

## Webhook & provisioning

### [CONFIRMED] W3 · HIGH — Reconcile path bypasses `@Transactional` via self-invocation → non-atomic provisioning, orphan rows
- **Where:** `PaymentWebhookController.java:171` (`getPaymentStatus`, no `@Transactional`) → `:193` `this.markPaidAndProvision(...)` (proxy bypassed); `@Transactional` at `:388` is inert on a self-call.
- **Breaks:** On `/payment/webhook/status/{linkId}?reconcile=1`, `txn.setStatus("paid")` + User/StudentInfo/UserStudent + cap increments + SAM each auto-commit independently. A mid-pipeline throw (roll-number collision, `provision()` failure, SAM insert) leaves the earlier rows + cap increments committed; txn flips to `paid_provisioning_failed` separately → orphaned student rows.
- **Why:** Spring proxy-mode `@Transactional` doesn't engage on a self-call. The webhook entry `handleRazorpayWebhook` (`:99`) *is* `@Transactional`, so the primary path is atomic — only reconcile lacks a boundary.
- **Fix:** Route through the proxy (`@Autowired @Lazy private PaymentWebhookController self;` → `self.markPaidAndProvision(...)`, or extract to a `@Service`). Let provisioning failures propagate (rollback); persist `paid_provisioning_failed` in a `REQUIRES_NEW` tx.

### [CONFIRMED] W4 · HIGH — Reconcile uses non-locking `findByRazorpayLinkId`, racing the webhook → double-provision
- **Where:** `PaymentWebhookController.java:174` (`findByRazorpayLinkId`, no lock) vs `:363` (`findByRazorpayLinkIdForUpdate`, `PESSIMISTIC_WRITE`).
- **Breaks:** A reconcile call + webhook delivery (or two reconcile polls) don't serialize: both read `status=='created'`, both pass the `status=='paid'` early-return (`:392`) before either commits, both run full provisioning → two Users/StudentInfos/UserStudents for one payment **and** `tryIncrement*` fires twice (double cap consumption).
- **Why:** A plain SELECT doesn't block on another tx's `SELECT ... FOR UPDATE`; the pessimistic lock only protects webhook-vs-webhook. No `@Version` on `PaymentTransaction`, no unique constraint on `StudentInfo(email,institute)`.
- **Fix:** Acquire the same lock inside a real transaction (call `findByRazorpayLinkIdForUpdate` from a `@Transactional` external-bean method) before re-checking status + provisioning. Defense-in-depth: UNIQUE on `student_info(email, institute_id)`.

### [CONFIRMED] W5 · HIGH — `paid_provisioning_failed` is a terminal write-only state → paid student stranded, or re-provisioned as a duplicate on retry
- **Where:** `PaymentWebhookController.java:187` (reconcile gates on `created` only); `:392` (guard catches only `paid`); `:688`/`:506` (sets `paid_provisioning_failed`).
- **Breaks:** (1) The reconcile safety net only runs for `created`, so a `paid_provisioning_failed` txn is never auto-retried — a paid student is silently stuck with no account (manual admin recovery only). (2) On Razorpay re-delivery the `paid`-only guard lets a `paid_provisioning_failed` txn re-run **full** provisioning; for a failure before `StudentInfo` was committed (e.g. `parseClassNumber` NPE at `:655`), the `findByEmailAndInstituteId` dedup at `:629` misses → a second account + double cap + leaked orphan User.
- **Fix:** (A) Widen reconcile to also redrive `paid_provisioning_failed`. (B) Make re-provisioning idempotent: route on existing `txn.getUserStudentId()`, commit `StudentInfo` before any non-persistence throw (null-guard `parseClassNumber`, move it after the `StudentInfo` save), gate cap increments with a `capsIncremented` flag.
- **Severity split:** **stranding half fully confirmed.** The duplicate-student + double-cap half may be guarded by rollback-only behavior + post-`StudentInfo` increment ordering (leaving only an orphan User on retry) — see Watch list.

### [CONFIRMED] W2 · MED — Existing-student paid webhook skips cap increment when a `UserStudent` already exists → undercount
- **Where:** `PaymentWebhookController.java:711-712` (`tryIncrementSchoolLink`/`tryIncrementMappingTier` inside `if (userStudents.isEmpty())` only) in `handleExistingStudentPayment`.
- **Breaks:** A matched `StudentInfo` with an existing `UserStudent` (2nd paid assessment / re-pay) gets the assessment assigned + marked paid **without** incrementing the tier/link count → real seat + real payment not reflected in `currentCount`, link over-accepts.
- **Fix:** Move the increments to run for every paid registration, gated on a new `StudentAssessmentMapping` actually being created (inside `!existingMapping.isPresent()`), so genuine new assessments count but retries don't double-count.

### [LIKELY] W6 · MED — B2C provisioning dedups by global email with no lock → duplicate accounts + duplicate welcome emails on reconcile race
- **Where:** `PaymentWebhookController.java:457` (`findByEmail`, no lock, no per-txn idempotency key); `:498` (`activateOnPayment`).
- **Breaks:** On the unlocked reconcile path (W3/W4), two concurrent calls both read "no existing student", both create User+StudentInfo+UserStudent and both call `activateOnPayment` → two welcome emails. `student_info.email` has no unique constraint; `student_entitlements.payment_transaction_id` is non-unique.
- **Fix:** Close the race at source (W4) + UNIQUE on `student_entitlements.payment_transaction_id`; gate the B2C create+activate on `txn.getUserStudentId()` already set.
- **Doubt:** Both verifiers agree it's real, but it's wholly dependent on the W3/W4 reconcile window being reachable — confirm before prioritizing.

### [LIKELY] W7 · MED — Paid-webhook `StudentInfo` saved with null `institute_id` then back-filled → cross-institute scope window + broken dedup (reconcile path only)
- **Where:** `PaymentWebhookController.java:648-658` (`StudentInfo` saved without `setInstituteId`), `:660` (`UserStudent` null institute), `:664` (`setPrimaryInstitute` back-fills); dedup `:629`.
- **Breaks:** On **reconcile only** (non-atomic), a `StudentInfo` with `institute_id = NULL` is committed; the scope carve-out (`institute_id IN (...) OR IS NULL`) makes it durably visible to **every** institute's scoped reads until back-fill, and a concurrent paid registration's `findByEmailAndInstituteId` misses the NULL-institute row → duplicate account.
- **Fix:** Set `institute_id` (and pass institute into the `UserStudent` constructor) **before** the save at `:658`; make the reconcile chain transactional (W3 fix).
- **Doubt:** The **primary webhook path is safe** (`:99` is `@Transactional`, save→back-fill atomic, no NULL row ever committed). Reconcile-only.

---

## Payment / Razorpay

### [CONFIRMED] PAY1 · MED (treat HIGH) — Razorpay link created live inside the `@Transactional` register tx → commit failure orphans a payable link with no DB row
- **Where:** `AssessmentInstituteMappingController.java:400` / `SchoolRegistrationController.java:567` (`@Transactional`); `createPaymentAndRedirect` calls `razorpayService.createPaymentLink` (irreversible HTTP POST) before `save(txn)` (`AIM:675` / `SR:845`); school also runs `cancelOutstandingLinks` at `:855`; webhook miss at `PaymentWebhookController.java:364-366`.
- **Breaks:** If `save(txn)` / commit fails (constraint, `razorpay_link_id` collision, conn drop), the tx rolls back and the `PaymentTransaction` row is never persisted, but the Razorpay link is already **live and chargeable**. A customer who pays hits `findByRazorpayLinkIdForUpdate → empty → "Payment link not found in DB"` — money taken, no assessment, no record. In the school flow a rollback also reverts prior links' local `cancelled` status while they're permanently dead at Razorpay.
- **Fix:** Persist a pending txn and **commit before** creating the link; create the link outside any tx; update the row in a short 2nd tx; add a webhook fallback that reconciles an unknown paid link via `reference_id`/`notes` instead of only logging; defer school `cancelOutstandingLinks` to `afterCommit`.
- **Note:** Both verifiers rated High in reasoning; counted under Payment-Medium per JSON top-level. **Treat as high-priority.**

### [CONFIRMED] PAY2 · LOW — `reference_id` derived only from `System.currentTimeMillis()` can collide → 500
- **Where:** `PaymentController.java:107`/`:209`; `SchoolRegistrationController.java:806`; `AssessmentInstituteMappingController.java:640`; sent at `RazorpayService.java:141`.
- **Breaks:** Two link creations for the same id within one ms produce an identical `reference_id`; Razorpay rejects → `restTemplate` throws → 500 "Failed to generate payment link". Low-probability under concurrent admin/bulk bursts.
- **Fix:** Append `UUID.randomUUID()` (or DB `transactionId`) to every `reference_id`; optionally retry once on a Razorpay duplicate-reference error.

### [CONFIRMED] P1 · LOW — Integer-truncation in promo math turns a low-priced paid registration free
- **Where:** `AssessmentInstituteMappingController.java:499` / `SchoolRegistrationController.java:648` (`finalAmount = mappingAmount * (100 - pct) / 100`, Long division); guards at `:519`/`:542` and `:657`/`:682`.
- **Breaks:** Long division floors: amount=1 @ 50% → 0, amount=3 @ 90% → 0. The `finalAmount > 0` guards fall through to the **free** provisioning path → full access, no charge.
- **Fix:** `finalAmount = Math.round(mappingAmount * (100.0 - pct) / 100.0)`, then clamp `Math.max(finalAmount, 1L)` when discount < 100%.

---

## Pricing & caps

### [CONFIRMED] P2 · HIGH — Paid school registration increments the WRONG tier table → school tier cap never enforced for the paid flow
- **Where:** `SchoolRegistrationController.java:825` (`txn.setMappingTierId(SchoolAssessmentTier.tierId)`); `PaymentWebhookController.java:771-779` `tryIncrementMappingTier → assessmentMappingTierRepository.tryIncrementCount`.
- **Breaks:** A school txn's `mappingTierId` is a `SchoolAssessmentTier` id, but on payment the webhook increments the **Flow A** `assessment_mapping_tier` table — a no-op (no such row) or corruption of an unrelated Flow-A tier. `SchoolAssessmentTier.currentCount` is never bumped for **paid** registrations, so a tier with `maxRegistrations=N` can be paid past N indefinitely (resolver filters `currentCount < maxRegistrations`). Only the free path + admin recount touch the right table.
- **Why:** `PaymentTransaction` has a single generic `mappingTierId` overloaded for two physically distinct tables; the webhook always routes to the Flow-A repository.
- **Fix:** In `tryIncrementMappingTier`, dispatch on `txn.getSchoolConfigId() != null` → `schoolAssessmentTierRepository.tryIncrementCount(...)`, else the Flow-A repo. (Cleaner long-term: a dedicated `schoolTierId` discriminator, as campaign txns already have `campaignAssessmentTierId`.)
- **Hand-verified:** `tryIncrementMappingTier` at `PaymentWebhookController.java:773` calls `assessmentMappingTierRepository.tryIncrementCount` with no school branch; `SchoolRegistrationController` autowires a separate `schoolTierRepository` (`:68`).

### [CONFIRMED] A1 · MED — Promo `currentUses` consumed before payment/dedupe outcome and never refunded → `maxUses` exhausted with zero redemptions
- **Where:** `AssessmentInstituteMappingController.java:502-503` / `SchoolRegistrationController.java:650-651` (`setCurrentUses(+1)` + `save`), before dedupe and `createPaymentAndRedirect`; Razorpay catch at `AIM:684-688` / `SR:865-868`.
- **Breaks:** Increment commits in no-redemption paths: (1) Razorpay down → 500 but promo burned; (2) already-registered student returns `already_registered` with no charge; (3) abandoned paid link (expire/cancel never decrement). A `maxUses=N` promo is exhausted by N people who merely *start* — griefable on the anonymous endpoint.
- **Fix:** Don't consume at registration — keep the validity check, but increment only on realized redemption (webhook `payment_link.paid` reading `txn.getPromoCode()`; free/zero-amount paths after the student is committed). Use a capacity-guarded atomic UPDATE (also fixes A2).

### [CONFIRMED] A2 · MED — Promo `currentUses` increment is a non-atomic read-modify-write → lost update lets `maxUses` be exceeded
- **Where:** `AssessmentInstituteMappingController.java:495` (check) / `:502-503` (write); same `SchoolRegistrationController.java:644` / `:650-651`.
- **Breaks:** Two concurrent registrations on `maxUses=1, currentUses=0` both read 0, both pass the guard, both `save(1)` — cap exceeded.
- **Fix:** Guarded atomic UPDATE mirroring `tryIncrementCount`: `tryConsume(id)` = `UPDATE PromoCode SET currentUses = COALESCE(currentUses,0)+1 WHERE id=:id AND (maxUses IS NULL OR COALESCE(currentUses,0) < maxUses)`; reject when rows==0.

### [CONFIRMED] P3 · MED — Free-path tier increments write no recount-able transaction → admin recount drops free registrations and re-opens a capped tier
- **Where:** `AssessmentMappingTierService.java:59-64` / `:96-100` (recount counts only paid txns with `mappingId`/`schoolConfigId` not null); `SchoolRegistrationController.java:688-705` (txn-write guarded on `promoCodeStr != null`) + `:737`/`:915`; `AssessmentInstituteMappingController` `handleExistingStudent` free txn (no `setMappingId`).
- **Breaks:** Three free paths bump the counter but leave no recount-matching row: (b) school pure-free tier (amount=0, no promo); (c) school existing-student free path; (a) institute existing-student free path (writes a txn but never `setMappingId`). After any admin recount, `currentCount` is rebuilt downward, dropping these and re-opening a legitimately-full tier.
- **Fix:** Always write a zero-amount paid txn with `setSchoolConfigId`/`setMappingTierId` (drop the `promoCodeStr != null` precondition) and add `setMappingId` in institute `handleExistingStudent`; or recount from `StudentAssessmentMapping` instead of `PaymentTransaction`.
- **Note:** The Flow A *new*-free path was **refuted** (it does `setMappingId` at `:556`). The other three stand.

### [CONFIRMED] P4 · MED (verifiers say LOW) — Free-path cap is advisory → concurrent free registrations over-admit past `maxRegistrations`
- **Where:** `AssessmentMappingTierService.java:38-44` / `:75-82` (filter `cur < max` from stale in-memory count, no lock); `SchoolRegistrationController.java:708-737` (provision then increment); `AssessmentInstituteMappingController.java:551-552`.
- **Breaks:** Student is fully provisioned **before** the guarded increment, whose `rows==0` (when full) is only logged. With `maxRegistrations=N` and N+k concurrent free registrations for the last slot, all N+k are created; `currentCount` caps at N while k extra SAM rows exist beyond the cap.
- **Fix:** Call `tryIncrementCount` **before** provisioning; on `rows==0` throw 409 so the `@Transactional` method rolls back. No extra lock needed.
- **Note:** Both verifiers rate **low** (counter never overshoots; bounded by concurrency window).

### [LIKELY] W1 · MED — Paid webhook over-sells: cap increment runs AFTER student creation and only warns on `rows==0`
- **Where:** `PaymentWebhookController.java:636-671` (create + allot) before `:666-667` (`tryIncrement*`); `:755-759`/`:776-779` (`logger.warn(... allowing this paid registration through.)`).
- **Breaks:** When cap=N and an (N+1)th payment lands, the guarded UPDATEs return `rows==0`, the handler logs and continues — no reject/rollback/refund. Student provisioned anyway; institute over-sold.
- **Fix (per repro):** Run the increment first; on `rows==0`, don't provision — mark for refund/over-cap and return.
- **Doubt:** Refuter (high confidence) argues this is **intended compensated behavior** — caps are enforced at link-creation (resolver returns null → 409, no new link once full), the codebase has **no refund capability** (explicit TODO), so honoring an already-captured payment is deliberate (stranding a payer is worse), and `recountTier` reconciles the display. **Decide business policy before "fixing."**

---

## Frontend

### [LIKELY] FE1 · HIGH — Production build may emit `undefined/assessment-register/<token>` links
- **Where:** `AssessmentMappingPanel.tsx:146-147` (`${process.env.REACT_APP_ASSESSMENT_APP_URL}/assessment-register/${token}`, no fallback); `react-social/.env.production` (var absent); also `AppRoutes.tsx:41`.
- **Breaks:** If a build reads `.env.production` (var absent), CRA inlines the literal `"undefined"` → every generated link / Copy button / QR encodes `undefined/assessment-register/<token>`. Three other consumers use a `|| "https://assessment.career-9.com"` fallback and are unaffected — only this panel and `AppRoutes` lack it.
- **Fix:** Add `REACT_APP_ASSESSMENT_APP_URL` to `.env.production`, and add the `|| "https://assessment.career-9.com"` fallback to `AssessmentMappingPanel.tsx:146-147` and `AppRoutes.tsx:41/53/69`.
- **Doubt:** Refuter (high confidence) shows the real deploy uses `npm run build:production` (`env-cmd -f production.env`, `.do/app.yaml` BUILD_TIME env) where the var resolves — so it's **latent** unless CI ever runs a bare `react-scripts build`. **Verify the actual CI/CD build command.** Add the fallback regardless.

### [CONFIRMED] FE3 · MED — FE promo discount uses JS float; server floors with integer math → displayed price disagrees with the charge
- **Where:** `AssessmentRegisterPage.tsx:58-60`/`378`/`659`; `SchoolAssessmentRegisterPage.tsx:101-103`/`376`/`519`; backend `AssessmentInstituteMappingController.java:499` / `SchoolRegistrationController.java:648`.
- **Breaks:** FE computes `amount*(100-pct)/100` in JS float with no round/floor: 999 @ 10% → renders "INR 899.1" / "Register & Pay INR 899.1", but the Razorpay link charges **899**. Display/UX only — the charge is correct (FE only submits `promoCode`).
- **Fix:** `Math.floor(amount * (100 - pct) / 100)` on both pages, or display the backend's `finalAmount`.

### [LIKELY] FE4 · MED — School verify "network error → treat as verified" fallback unblocks submit during a transient failure
- **Where:** `SchoolAssessmentRegisterPage.tsx:76-82` (`.catch(() => setVerifyStatus("verified"))`); submit gate `:499`.
- **Breaks:** Any verify error (blip / 500 / timeout / a 403 from `@PreAuthorize` on `/public/verify-details`) flips status to "verified" (green badge, enabled Register), leading a duplicate/partial-match student past the "log in instead" guidance.
- **Fix (per repro):** Fail closed — add an `"error"` verify state, keep submit disabled, show a retry prompt.
- **Doubt:** Refuter (high confidence) argues no functional harm for the matching email+DOB case — `registerStudent` re-runs the same email dedup, reuses the account (free, no double-charge), returns existing username + DOB-password + "log in" message. Only cost is a momentary misleading badge. The genuinely harmful duplicate path is **B1**, not this fallback.

### [LIKELY] FE2 · LOW — "Free Link" and "Paid Link" columns render byte-identical URLs
- **Where:** `AssessmentMappingPanel.tsx:146-147` (both getters return identical `${...}/assessment-register/${token}`); two columns with green/blue styling, separate Copy + QR.
- **Breaks:** The distinct presentation is false — the server decides free-vs-paid by tier amount regardless of which URL is shared. An admin trusting the labels is misled.
- **Fix:** Collapse into one "Registration Link" column; remove `getPaidRegistrationUrl`.
- **Doubt:** Cosmetic/UX redundancy — system behaves correctly whichever link is copied.

### [LIKELY] FE5 · MED — Flow A free-path duplicate (matching DOB) silently auto-logs the submitter into an existing student's session
- **Where:** `career-nine-assessment/src/pages/AssessmentRegisterPage.tsx:159-168`; backend `AssessmentInstituteMappingController.java:507-524`.
- **Breaks:** Typing a known student's email + correct DOB on the public register page auto-logs into that student's session (FE unconditionally `localStorage.clear()`s, stores returned `userStudentId`/assessments, navigates to `/allotted-assessment`). `DuplicateEmailDialog` only fires on DOB *mismatch*.
- **Fix:** Don't return a session payload/cookie for pre-existing students — return `already_registered` (credentials card, no session); reserve the session for freshly created students (`newlyCreated:true`). For returning-student auto-login, require OTP/magic-link.
- **Doubt:** Refuter (high confidence) argues this is **auth as designed** — DOB *is* the password (login = username+DOB; the success card labels DOB "Password (Date of Birth)"), and `DuplicateEmailResponse` masks email/phone and never leaks DOB, so an attacker with only the email can't reach it. **Sanity-check the DOB-as-password model** before treating as a defect; if intended, only the missing "already registered" interstitial is a UX nit.

---

## Data integrity

### [CONFIRMED] D1 · HIGH — Free-path B2B students never get a `UserStudentInstituteHistory` row → invisible in the roster, unmanageable via membership API
- **Where:** `SchoolRegistrationController.java:707-741` (Flow B free) / `AssessmentInstituteMappingController.java:588-610` (Flow A free) — `UserStudent` created with institute set but no `membershipService.setPrimaryInstitute`; contrast paid path `PaymentWebhookController.java:664`; roster `StudentInstituteMembershipController.java:159-161`; throws `StudentInstituteMembershipService.java:151-153`/`181-183`.
- **Breaks:** On the free path (amount=0 or 100% promo) no `UserStudentInstituteHistory` row is written. The roster endpoint reads **exclusively** from `historyRepository.findByInstituteCodeAndIsDroppedFalse`, so a school using a free link registers N students yet the admin roster shows **zero**. Worse, `setPrimary`/`dropMembership` `orElseThrow("Membership not found")` → 404 for these students.
- **Why:** Only the paid webhook calls `setPrimaryInstitute`/`upsertMembership`; `provision()` writes only role/scope rows; the entity has no cascade/listener for history.
- **Fix:** In both free paths, after `provision()`, call `membershipService.setPrimaryInstitute(userStudent, instituteCode, null, "<free-provision>")`, mirroring the paid path. Add a regression test (0-amount registration appears in roster; set-primary/drop don't 404). Ideally extract a shared create+provision+membership helper used by all three paths.
- **Hand-verified:** `setPrimaryInstitute` is called in exactly one place across controllers — `PaymentWebhookController.java:664`. Flow B free path (`:733-735`) and existing-student path (`:912-914`) do `provision()` only.

---

## Watch list — [LIKELY] / low-confidence (sanity-check, may be intended)

- **W1** (over-sell on `rows==0`) — possibly intended; no refund path exists, caps enforced at link-creation, recount reconciles. Policy decision.
- **W5** (duplicate half) — *stranding* confirmed; *duplicate student* may be guarded by rollback ordering (only an orphan `User` on retry). Verify the pre-`StudentInfo` failure path.
- **W6 / W7** — reconcile-path-dependent; confirm reconcile concurrency is exercised in your deploy.
- **FE1** (`undefined` link) — verify the real CI build command; latent if it's `npm run build:production`. Add the fallback anyway.
- **FE4** (verify fail-open) — likely cosmetic badge only given backend idempotency. Confirm acceptability.
- **FE2** (duplicate Free/Paid columns) — cosmetic redundancy. UX cleanup.
- **FE5** (DOB auto-login) — hinges on whether DOB-as-password is the intended credential model.
- **P4** (advisory free-path cap) — verifiers rate over-admission low. Cheap fix, low urgency.
- **TM1** (duplicate `sortOrder` → 500) — admin-only, recoverable; add `existsByMappingIdAndSortOrder` 400/409 + client check.
- **TM2** (force-overwrite `maxRegistrations`) — UI re-sends the real cap, no silent wipe; latent only for a future non-UI/partial-update caller.
- **TM3** (orphan tiers for unsaved selections) — inert dead data; gate "Manage Tiers" on a committed `configId` if desired.
- **TM4** (amount=0 = free) — likely intended ("0 = Free" UI label). Only add a positive-amount guard if you introduce an explicit paid/free flag.

---

## Appendix — verification method & confidence

- Each candidate bug was independently re-read against current source by two agents: one constructing a concrete repro, one attempting to refute (default to "not a bug" on uncertainty). Only findings where ≥1 verifier confirmed survived; `[CONFIRMED]` = both agreed, `[LIKELY]` = split (doubt noted).
- The three headline HIGHs were additionally hand-verified by direct grep (P2: `PaymentWebhookController.java:773`; W3/W4: `:175`/`:193`/`:363`/`:388`; D1: single `setPrimaryInstitute` call site).
- Line numbers reflect source as of 2026-06-02 on branch `dhruv-from-palak` and may drift after edits — re-grep the cited symbol if a line looks off.
