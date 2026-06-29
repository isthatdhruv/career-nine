# Career9 B2C Flow — Functional & Security Issues (Audit)

> **Status:** Audit complete · **first fix batches applied 2026-06-05** (see Update log). Remaining work in "Recommended fix order".
> **Date:** 2026-06-04 (audit) · 2026-06-05 (fixes) · **Branch:** `dhruv-from-palak`

## Update log (2026-06-05) — fixes applied (compile ✓, app context boots+serves ✓)

| ID | Sev | Fix | File(s) |
|---|---|---|---|
| **ID1** | HIGH | Paid-path provisioning binds to an existing account **only on a DOB match** (scans for the matching row, not `get(0)`); a mismatch creates a fresh student — closes the account-takeover/impersonation bypass | `PaymentWebhookController.provisionB2CStudentAndEntitlement` + new `sameDay` |
| **TOK1** | HIGH | Persisted `service_delivery_log.linkUrl` now masks the `t=<token>` param (`redactToken`) — tracker `communications` + DB no longer leak working access tokens; real email link unaffected | `NotificationDispatcher` |
| **PUB3** | HIGH | `resendServiceLink` delivers **only to the entitlement's own student email**; client `recipient` ignored — stops report/token exfiltration | `EntitlementService` + `EntitlementController.resend` |
| **PUB2** | HIGH | Counselling `slots`/`book` now require `entitlementId` so the token↔entitlement match in `redeemAccessToken` is enforced | `CampaignPublicController` |
| **REC1** | HIGH | Reconcile (public poll + admin Tracker check-status) routed through a proxied `@Transactional` + `findByRazorpayLinkIdForUpdate` lock (`@Lazy self`) — no more proxy-bypass non-atomicity / double-provision race | `PaymentWebhookController`, `TrackerController` |
| **REC2/W5** | HIGH/MED | Reconcile redrives `paid_provisioning_failed`; provisioning idempotent (reuses an already-stamped student) so a crashed provision self-heals, no duplicate account | `PaymentWebhookController` |
| **PAY1** | MED(→HIGH) | New `PaymentTransactionWriter` (`REQUIRES_NEW`) commits a `created` txn **before** the irreversible Razorpay link call at all 4 sites; `transactionId` stamped in notes + webhook fallback recovers a row whose link-id update was lost | `PaymentTransactionWriter` (new), `CampaignPublicController` (×2), `StudentCheckoutController`, `AssessmentInstituteMappingController`, `PaymentWebhookController.handlePaymentLinkPaid` |
| **PROMO1** | HIGH | Promo `currentUses` no longer consumed at link creation; deferred to **realized redemption** — paid: once in `markPaidAndProvision` on provisioning success (covers every paid flow); free: at free-commit. Abandoned/expired/failed attempts no longer burn a use | `PaymentWebhookController`, `CampaignPublicController`, `AssessmentInstituteMappingController`, `SchoolRegistrationController` |
| **PROMO2** | MED | Consumption is an atomic guarded `PromoCodeRepository.tryConsume` (`UPDATE … WHERE current_uses < max_uses`) — no lost-update over-redemption | `PromoCodeRepository` (new method) + all 4 consume sites |
| **PROMO3** | LOW | `discountPercent` validated to `[0,100]` at apply (reject 400) — a misconfigured >100% no longer clamps a paid tier into free provisioning | `CampaignPublicController` (×2), `AssessmentInstituteMappingController`, `SchoolRegistrationController` |
| **EXP1** | HIGH | New hourly `expireEntitlements` sweep (`findExpired` had zero callers): turns off lapsed dashboard/LMS flags, converges `expiresAt`, flips status→`expired` only when nothing usable remains (the permanent report stays redeemable) | `EntitlementSchedulerService` |
| **EXP2** | HIGH | Dashboard SSO gate now rejects when `dashboardExpiresAt` has passed (immediate enforcement, independent of the sweep's lag) — paid windows actually end now | `EntitlementController.redeemDashboardToken` |
| **STATE1** | MED | `activateOnPayment`/`extendExpiry` refuse to resurrect a revoked/refunded entitlement; `revoke` idempotent; `extend` requires active + pushes `accessTokenExpiresAt` to the new window | `EntitlementService` |
| **WEL1 / ENT-ACT** | MED | `activateOnPayment` short-circuits when already active for this txn (no re-snapshot); welcome email gated on `countSent(... ,"assessment_invite")==0` — no duplicate activation/email on webhook retry or reconcile race | `EntitlementService` |
| **REDEEM-PENDING** | MED | `/bet-report-data/public/prepare` now requires `status=="active"` — a pending entitlement (e.g. after a payment reset) can no longer trigger report generation it hasn't paid for | `ReportPreparationController` |
| **CRUD1** | MED | `attachAssessment` revives a soft-deleted mapping instead of inserting a duplicate that 500s on the UNIQUE(campaign_id, assessment_id) constraint | `CampaignController` + repo `findByCampaignIdAndAssessmentId` |
| **CRUD2** | MED | Campaign soft-delete cascades `isActive=false` to child mappings + tiers (paid entitlements left intact) — a deleted campaign is no longer registrable/resolvable | `CampaignController.softDelete` (now `@Transactional`) |
| **CRUD3/4/5/6, PRICE-CRUD** | LOW | `validTo≥validFrom` validation; `attachTier` `@Transactional` (single-default race) + reject negative `priceOverrideInr`; tolerant `toBool` coercion (no 500 on string isActive); clamp negative `page` offset | `CampaignController`, `TrackerController` |
| **AUTH2 (partial)** | HIGH(latent) | The 6 tier-admin endpoints get `@PreAuthorize` + 5 anonymous funnel/login endpoints added to test EXCLUSIONS → `ControllerPreAuthorizeCoverageTest` green (makes the eventual enforce flip safe for these) | `AssessmentInstituteMappingController`, `ControllerPreAuthorizeCoverageTest` |
| **PRICE-FE1** | HIGH(UX) | `PayForReportPage` uses `Math.floor` (was `Math.round`) — displayed price now == charged amount | `PayForReportPage.tsx` |
| **FE-SLUG** | HIGH | Admin `slugify` mirrors the backend exactly (no collapse/trim) — copied registration links stop 404-ing | `CampaignEditPage.tsx` |
| **TOK2** | LOW | Assessment SPA no longer logs `document.cookie` (cn_csrf); debug logs gated behind `import.meta.env.DEV` | `http.ts` |

**Deferred within Batch D:** ID3 (UNIQUE on `student_info.email`) — needs a Flyway migration **and** dedup of any pre-existing duplicate emails first (a blind unique index would fail the migration); TTL1 (30-day token TTL for write ops) — policy decision.

**Deferred / next:** PUB1 (upgrade-info token+PII leak) — the SPA `ThankYouPage` bootstraps its access token *from* this endpoint, so the fix is to **session-bind** it (validate the `cn_at_asmnt` cookie owns the entitlement); a contract change on the revenue funnel that wants an app-run test. Then Batch D (entitlement lifecycle: EXP1/EXP2/STATE1/WEL1/ENT-ACT/ID3/TTL1/REDEEM-PENDING), CRUD/frontend, and AUTH2 (scope-binding to make the `enforce-mode` flip safe — incl. the 6 unprotected tier endpoints + counselling/`redeemDashboardToken` EXCLUSIONS). Also: `SchoolRegistrationController.createPaymentAndRedirect` still has the PAY1 link-before-save ordering (Flow B) — fold into Batch E. **Not flipping `enforce-mode`** (intentional hold).

> **Branch:** `dhruv-from-palak`
> **Scope:** B2C campaign flow — admin campaign/tier CRUD, the public funnel (Path A pay-first, Path B try-first + pay-for-report, counselling), the shared payment/webhook/provisioning engine as it hits the B2C branch, the `StudentEntitlement` subsystem (tokens, expiry, lifecycle), the admin Tracker, and the frontends (`career-nine-assessment` SPA + `react-social` B2C admin).
> **How produced:** 6 parallel finders (public-register controller · entitlement service/tokens · webhook+checkout · admin tracker/CRUD · frontend) each self-refuting, → dedup/triage → headline findings hand-verified by grep against source. Companion to `B2B_FLOW_FUNCTIONAL_ISSUES.md`.
> **Tag legend:** `[CONFIRMED]` = a verifier could not refute it · `[LIKELY]` = real but with a documented doubt or a precondition (noted inline).

---

## TL;DR

The B2C flow is functionally richer than B2B (entitlements, time-bound services, try-first, upgrades) and the new surface area brings new defects. They cluster in **access control**, **token handling**, **promo/payment atomicity**, and **entitlement lifecycle**.

Worst offenders:
- **AUTH1** — authorization runs in `log-only` mode in **every** profile, so every `@PreAuthorize` is decorative; any authenticated user can drive every admin endpoint. *(Flagged in config as an intentional hold — flipping it is a rollout decision, see below.)*
- **PUB1** — `GET /campaign/public/upgrade-info/{entitlementId}` returns the entitlement's **raw access token + student PII** keyed on a guessable sequential id, on a fully public endpoint. Token-theft by enumeration.
- **ID1** — paid-path **impersonation bypass**: the email+DOB guard is only on the free path; the webhook binds the payment to an existing account by email with **no DOB check**.
- **TOK1** — access tokens are embedded in URLs and **persisted to `service_delivery_log.linkUrl`**, then echoed back by the admin tracker `communications` payload.
- **REC1** — the reconcile path (`status/{linkId}?reconcile=1`) bypasses `@Transactional` (self-invocation) and the row lock → non-atomic provisioning, duplicate entitlement/account/welcome-email. (Same root cause as B2B W3/W4; confirmed to hit the B2C branch.)
- **EXP1/EXP2** — no expiry scheduler exists (`findExpired` is dead code) and gates check only boolean flags, never the per-service expiry dates → paid dashboard/LMS/counselling windows **never end**.
- **PROMO1** — promo `currentUses` is consumed at link-creation, never refunded on abandonment → quota exhaustion / griefing.

### Count table (area × severity)

| Area | High | Medium | Low |
|---|---|---|---|
| Access control / authz | 3 | 1 | – |
| Identity / impersonation | 2 | 3 | – |
| Token leakage | 1 | – | 1 |
| Webhook & provisioning | 1 | 3 | – |
| Promo & pricing | 2 | 1 | 2 |
| Entitlement lifecycle | 2 | 3 | – |
| Funnel / path logic | – | 1 | 1 |
| Admin CRUD correctness | – | 2 | 4 |
| Data exposure | – | 1 | – |
| Frontend | 2 | 1 | 3 |

---

## Compact flow context (for a cold start)

The campaign flow has two purchase paths decided **server-side** by the resolved tier amount + promo, not by which link is shared:
- **Path A — pay-first:** `POST /campaign/public/register/{slug}/{assessmentId}/{tierMappingId}` → free path provisions inline; paid path creates a Razorpay link, webhook provisions.
- **Path B — try-first:** `POST /campaign/public/register-trial/{slug}/{assessmentId}` creates a **pending** `StudentEntitlement`; student takes the assessment free; later `POST /campaign/public/pay-for-report` upgrades via payment.

`StudentEntitlement` is the B2C service contract: it snapshots the `PricingTier` feature flags + validity at activation, mints a 30-day `accessToken`, and gates assessment/report/dashboard/counselling/LMS. Shared with B2B: `RazorpayService`, `PaymentTransaction` (discriminator = exactly one of `mappingId`/`schoolConfigId`/`campaignId`), and the webhook `markPaidAndProvision` (branches B2C vs school at `PaymentWebhookController.java:434`).

Key files:
- `controller/career9/b2c/CampaignPublicController.java`, `CampaignController.java`, `StudentCheckoutController.java`, `TrackerController.java`, `EntitlementController.java`, `PricingTierController.java`, `ReportPreparationController.java`
- `service/b2c/EntitlementService.java`, `EntitlementSchedulerService.java`, `CampaignResolutionService.java`, `LinkBuilder.java`, `NotificationDispatcher.java`
- `controller/career9/PaymentWebhookController.java` (B2C branch), `service/RazorpayService.java`, `security/AuthorizationService.java`
- `career-nine-assessment/src/pages/{CampaignRegisterPage,PayForReportPage,PaymentStatusPage,AssessmentStartPage}.tsx`
- `react-social/src/app/pages/B2C/{Campaign,Tracker}/**`

---

## Access control / authorization

### [CONFIRMED] AUTH1 · HIGH — Authorization is `log-only` in every profile → all `@PreAuthorize` decorative
- **Where:** `security/AuthorizationService.java:55` (`@Value("${auth.enforce-mode:log-only}")`), `:172` (`return "enforce".equalsIgnoreCase(enforceMode) ? policyDecision : true`); `application.yml:214/320/429/545` (all four profiles = `log-only`).
- **Breaks:** Every denial collapses to `return true`. Any authenticated principal (e.g. a logged-in student) passes every admin permission check — tracker reads (payments/PII), payment reset, entitlement revoke/extend/resend, campaign/tier CRUD. The filter chain still requires a valid JWT (`anyRequest().authenticated()`), so it is not internet-anonymous, but it is broken access control for any authenticated user.
- **Why:** Phase-15 ships log-only; the flip to `enforce` was deliberately deferred. Config comments say sandbox was flipped, but the value is still `log-only` (stale comment); production is `log-only` per a "user-directed safety hold".
- **Fix / DECISION:** Set `auth.enforce-mode=enforce` per environment **after** verifying every B2C permission code is seeded on the right roles (else legitimate flows 403). This is a rollout decision, not a unilateral code change. The per-endpoint authz findings below (AUTH2, PUB3) only bite once this flips — but they should be fixed so the flip is safe.

### [CONFIRMED] AUTH2 · HIGH — Entitlement endpoints have no ownership/scope binding (IDOR, latent until enforce)
- **Where:** `EntitlementController.java` revoke/extend/read/by-student/resend; root cause `AuthorizationService.java:142-144` ("permission alone is sufficient").
- **Breaks:** Even in `enforce` mode, any caller holding the coarse `entitlement.*` permission can act on **any** student's entitlement by changing the path `{id}` — no institute/student scope is bound.
- **Fix:** Bind a scope arg (e.g. `@auth.allows('entitlement.update', @auth.instituteOfEntitlement(#id))`) + add the resolver; or filter by the caller's scope in the body.

### [CONFIRMED] PUB3 · HIGH — `resendServiceLink` emails any student's tokenized link to an attacker-supplied recipient
- **Where:** `EntitlementController.java:361-373` → `EntitlementService.java:227-285`.
- **Breaks:** The `recipient` is taken verbatim from the request body; the service emails the live access-token deep-link (final report / dashboard SSO / etc.) for entitlement `{id}` to that address → exfiltrates another student's report + a working token. Reachable by any authenticated user today (AUTH1).
- **Fix:** Ignore client `recipient`; always resolve from the entitlement's stored student email.

---

## Public-endpoint IDOR / PII (exploitable now, independent of enforce-mode)

### [CONFIRMED] PUB1 · HIGH — `/campaign/public/upgrade-info/{entitlementId}` leaks access token + PII by sequential id
- **Where:** `CampaignPublicController.java:476-569` (token at `:555`, name/email/phone at `:499-501`); endpoint is `permitAll`.
- **Breaks:** Public, keyed only on a sequential `entitlementId`. Enumerate ids → every student's name/email/phone, report/dashboard URLs, and the raw `accessToken` (which is the credential for booking/dashboard/report).
- **Fix:** Require the access token (body/header) to view; **never** return `accessToken` for a record fetched by plain id. At minimum stop returning the token + PII without token proof.

### [CONFIRMED] PUB2 · HIGH — Counselling slots/book are token-only bearer ops; `entitlementId` check is a no-op
- **Where:** `CampaignPublicController.java:968-1090`; `EntitlementService.redeemAccessToken:179-188` (the `entitlementId` comparison is skipped when null, and the endpoints never require it).
- **Breaks:** Any leaked/echoed token (see PUB1, TOK1) fully controls booking + seat decrement for that entitlement; `entitlementId` is decorative.
- **Fix:** Require `entitlementId` non-null and reject mismatch; treat the token as a short-lived bearer secret (see TTL1) and stop echoing it (PUB1, TOK1).

---

## Identity / impersonation

### [CONFIRMED] ID1 · HIGH — Paid-path impersonation bypass: webhook binds by email with no DOB check
- **Where:** controller guard at `CampaignPublicController.java:313-322` (free path only); bypass in `PaymentWebhookController.java:457-463` (`findByEmail(email).get(0)`, no DOB compare).
- **Breaks:** The DOB-match impersonation guard only blocks the free path. On the paid path the controller returns a Razorpay link without provisioning; after payment, `provisionB2CStudentAndEntitlement` re-looks-up by email and attaches the new SAM + entitlement + token to the **victim's** existing `UserStudent`, and the welcome/credentials email goes out.
- **Fix:** Re-run the email+DOB `sameDay` check in `provisionB2CStudentAndEntitlement` before reusing an existing `UserStudent`; create a fresh student if DOB differs. (Better: stamp the matched `userStudentId` on the txn at register time and trust only that.)

### [CONFIRMED] ID3 · HIGH — B2C provisioning uses unlocked global `findByEmail`, no unique constraint → duplicate identities
- **Where:** `PaymentWebhookController.java:457-484`; `StudentInfo.email` has no unique constraint (`findByEmail` returns a `List`).
- **Breaks:** Two deliveries (or two purchases sharing an email) racing find-or-create each create a fresh User+StudentInfo+UserStudent → split identity, fractured entitlements. Distinct from REC1: bites even on the correctly-locked webhook path when two different txns share an email.
- **Fix:** Unique index on `student_info(email)` (or normalized email) + catch-and-refetch, or serialize on a normalized-email advisory lock.

### [LIKELY] ID4 · MED — DOB-less accounts can be hijacked via client-trusted localStorage id + DOB-skipping session mint
- **Where:** frontend trusts `userStudentId`/`entitlementId` in localStorage (`CampaignRegisterPage.tsx:226-244`, `AssessmentStartPage.tsx:41-59`) and forwards it to the mint; backend `AssessmentSessionController` mints the `cn_at_asmnt` cookie **without** DOB proof when `storedDob == null`.
- **Breaks:** Editing localStorage `userStudentId` to a DOB-less account mints a real session for it. Normal accounts are protected by the `sameDay(storedDob, suppliedDob)` check; only DOB-less accounts are exposed.
- **Fix:** Backend: reject mint when `storedDob == null`. Frontend: rely on the server-derived cookie identity, not an editable localStorage id.

### [CONFIRMED] ID2 · MED — `findByEmail(email).get(0)` arbitrarily picks one of several rows
- **Where:** `CampaignPublicController.java:314-315`/`391-392`; webhook `:458-462`. Email is non-unique globally (uniqueness is per-institute).
- **Breaks:** The impersonation DOB check and the webhook binding both use `get(0)`, which may not be the DOB-matching row → both false rejects and binding to the wrong account.
- **Fix:** Match on email AND DOB in the query, or scan all rows for a DOB match.

### [LIKELY] ID5 · MED — `start-free-trial` account/PII takeover via email-only lookup
- **Where:** `EntitlementController.java:117-141` (find-or-create student by email only; no verification).
- **Breaks:** Knowing a victim's email lets an attacker create a "free trial" that reuses the victim's `UserStudent`; the token/redeem flow can then surface the victim's session/assessments. (Reachable by anyone today via AUTH1.)
- **Fix:** Require verified email (OTP/magic-link) before attaching a trial to a pre-existing account.

---

## Token leakage

### [CONFIRMED] TOK1 · HIGH — Access tokens ride in URLs and are persisted to `service_delivery_log`, then echoed by the tracker
- **Where:** `LinkBuilder.java:30-81` (every deep link is `...?t=<accessToken>&e=<id>`); `NotificationDispatcher.java:40` persists `linkUrl` to `service_delivery_log`; `TrackerController.java:290-291` returns the full `ServiceDeliveryLog` (incl. `linkUrl`) in the allotment-detail `communications` payload; `EntitlementController.java:354-356` `/{id}/communications` returns the same.
- **Breaks:** A working magic-link/token for any student is readable from the admin tracker (any authenticated user, AUTH1) and from DB/log access, and leaks via referrer/proxy logs. Token grants assessment/dashboard/report.
- **Fix:** Strip/mask the `t=` param when storing/returning `linkUrl`; prefer short-lived single-use tokens; consider POST-body tokens over query strings.

### [CONFIRMED] TOK2 · LOW — Assessment SPA logs `document.cookie` (incl. `cn_csrf`) on every request error
- **Where:** `career-nine-assessment/src/api/http.ts:54,150-156,191-198,201` (`[ASSESS-SESSION-DEBUG]`).
- **Breaks:** Console logs the JS-readable `cn_csrf` token + URLs on shared/kiosk devices. (`cn_at_asmnt` is HttpOnly and not exposed — good.)
- **Fix:** Gate behind a dev-only flag; never log `document.cookie`.

---

## Webhook & provisioning

### [CONFIRMED] REC1 · HIGH — Reconcile path bypasses `@Transactional` + row lock → non-atomic B2C provisioning, duplicates
- **Where:** `PaymentWebhookController.java:170-206` — `getPaymentStatus` is not `@Transactional`, uses non-locking `findByRazorpayLinkId` (`:176`), and self-invokes `markPaidAndProvision` (`:194`) so the proxy `@Transactional` (`:389`) never engages. Hits B2C via `:434 → provisionB2CStudentAndEntitlement`.
- **Breaks:** Two `?reconcile=1` polls (or a poll racing the webhook) both pass the `status=="paid"` early-return before either commits → duplicate User/StudentInfo/UserStudent + duplicate entitlement + duplicate welcome email; a mid-pipeline throw leaves committed orphan rows. **Same root cause as B2B W3/W4** — fix once.
- **Fix:** Route reconcile through a real transactional, locked external bean: `findByRazorpayLinkIdForUpdate` inside a `@Transactional` `@Service` method (or `@Lazy self`), then re-check status + provision. Let provisioning failures propagate (rollback); persist `paid_provisioning_failed` in `REQUIRES_NEW`.

### [CONFIRMED] REC2 · MED — `paid_provisioning_failed` is terminal; manual redrive re-runs full provisioning unsafely
- **Where:** `PaymentWebhookController.java:505-510` (B2C catch) / `687-692` (school catch); recovery only via Tracker `checkPaymentStatus`. The catch **swallows** the exception, so even the @Transactional webhook path commits the partial rows.
- **Breaks:** A paid student whose entitlement activation throws (e.g. `entitlementService` bean absent — it's `@Autowired(required=false)`) is left with a paid txn and no entitlement, no auto-retry. Manual redrive re-enters with status `paid_provisioning_failed` (not `paid`), so it passes the early-return and re-runs everything → re-triggers ID3/WEL1. (= B2B W5.)
- **Fix:** Make provisioning steps idempotent (route on `txn.getUserStudentId()`/existing entitlement); widen the redrive guard to also re-drive `paid_provisioning_failed`; add a scheduled redrive; stop swallowing (propagate to roll back, record terminal state in `REQUIRES_NEW`).

### [CONFIRMED] WEL1 · MED — Welcome email re-sent on every re-provision / race
- **Where:** `EntitlementService.activateOnPayment:88-115` calls `sendWelcomeAssessmentLink` unconditionally at `:113`; `NotificationDispatcher` has `countSent` but never consults it; `PaymentTransaction.welcomeEmailSent` exists but is never set/checked on the B2C path.
- **Breaks:** Admin redrive or a reconcile/webhook race sends a second welcome email (+ a second `ServiceDeliveryLog`, possibly a rotated link).
- **Fix:** Gate the send on `countSent(entitlementId, "assessment_invite") == 0`, or set/check a `welcomeSent` flag; skip activation side-effects when the entitlement is already `active`.

### [CONFIRMED] ENT-ACT · MED — `activateOnPayment` find-or-create has no lock / no unique on `payment_transaction_id`
- **Where:** `EntitlementService.java:101-114`, `findOrCreateForUpgrade:287-305`.
- **Breaks:** Two concurrent deliveries for one `paymentTransactionId` both miss `findByPaymentTransactionId`, both create + activate + email → two active rows for one payment.
- **Fix:** UNIQUE on `student_entitlement.payment_transaction_id`; short-circuit when already `active`.

---

## Promo & pricing

### [CONFIRMED] PROMO1 · HIGH — Promo `currentUses` consumed before payment, never refunded
- **Where:** `CampaignPublicController.java:300-301` (register) and `:643-644` (pay-for-report); webhook/failure paths never decrement.
- **Breaks:** Every paid attempt burns a use at link-creation; abandonment/expiry/failure never refunds it. A `maxUses=N` code is exhausted by N people who merely start — griefable on the anonymous endpoint.
- **Fix:** Move the increment to realized redemption (webhook paid branch reading `txn.getPromoCode()`, and free/zero-amount paths after the student commits), via an atomic guarded UPDATE (also fixes PROMO2). Mirror B2B A1.

### [CONFIRMED] PROMO2 · MED — Promo `currentUses` is a non-atomic read-modify-write
- **Where:** `CampaignPublicController.java:295-301`/`638-644`; `PromoCode` has no `@Version`/lock.
- **Breaks:** Concurrent redemptions both read N, both write N+1 → `maxUses` exceeded. (= B2B A2.)
- **Fix:** Conditional atomic `UPDATE PromoCode SET current_uses = current_uses+1 WHERE id=? AND (max_uses IS NULL OR current_uses < max_uses)`; reject on `rows==0`.

### [CONFIRMED] PROMO3 · LOW — No `0 ≤ discountPercent ≤ 100` validation; >100% → negative → clamp-to-0 → free provisioning
- **Where:** `CampaignPublicController.java:299`/`642` (integer truncation, favors customer); clamp at `:308`.
- **Breaks:** A misconfigured `discountPercent > 100` yields a negative price clamped to 0 → a paid tier silently provisioned free with full features.
- **Fix:** Validate `discountPercent ∈ [0,100]` on apply (and at promo create); reject a computed `finalInr <= 0` for a tier whose base price > 0.

### [CONFIRMED] PAY1 · MED (treat HIGH) — Razorpay link created before the txn row is saved (orphan payable link)
- **Where:** `CampaignPublicController.java` `createPaymentAndRedirect` (link before `save(txn)`) and `payForReport` (`:678-701`), both inside `@Transactional`; `StudentCheckoutController.java:201-217`. (Same pattern as B2B PAY1.)
- **Breaks:** If `save`/commit fails, a live payable link exists with no DB row; the payer hits webhook `findByRazorpayLinkId → empty` → charged, never provisioned, unrecoverable (no notes/email fallback).
- **Fix:** Persist a `pending`/`created` txn and **commit before** the irreversible link call; create the link outside the tx; update the row in a short 2nd tx; add a webhook fallback reconciling an unknown paid link via `reference_id`/`notes`.

### [CONFIRMED] PRICE-CRUD · LOW — `attachTier` accepts negative `priceOverrideInr`
- **Where:** `CampaignController.java:232` (no sign check, unlike `PricingTierController` base-price validation).
- **Fix:** Reject `priceOverrideInr < 0`.

---

## Entitlement lifecycle / expiry

### [CONFIRMED] EXP1 · HIGH — No expiry scheduler; `findExpired` is dead code → entitlements never transition to `expired`
- **Where:** `EntitlementSchedulerService.java:45-86` (only a nudge job); `StudentEntitlementRepository.findExpired` has zero callers.
- **Breaks:** An entitlement past `expiresAt` stays `status='active'`.
- **Fix:** A `@Scheduled` sweep flipping `findExpired(now)` rows to `expired`.

### [CONFIRMED] EXP2 · HIGH — Gates check only the boolean service flags, not the per-service expiry dates
- **Where:** `EntitlementService.redeemAccessToken:178-188` (checks token TTL + overall status only); gates at `BetReportDataController.java:133`, `EntitlementController.java:265`, `CampaignPublicController.java:980,1059`.
- **Breaks:** `dashboardExpiresAt`/`lmsExpiresAt`/`expiresAt` are written at activation but enforced nowhere; combined with EXP1, paid dashboard/LMS/counselling windows never end (within the 30-day token TTL, and the token is re-issued on interaction).
- **Fix:** In each gate, also reject when the relevant `*ExpiresAt` is in the past. Normalize null/0 validity semantics (null = infinite vs default) explicitly.

### [CONFIRMED] STATE1 · MED — Illegal state transitions (revoked/refunded/expired → active; re-revoke; extend on revoked)
- **Where:** `EntitlementService.java:105,129` (activate/upgrade set `active` unconditionally), `:200-213` (revoke), `:215-224` (extend, no status guard, doesn't touch `accessTokenExpiresAt`).
- **Breaks:** A revoked/refunded entitlement re-run through activate/upgrade flips back to `active`; extend silently writes future dates on a revoked row.
- **Fix:** Validate allowed transitions; refuse activation when status ∈ {revoked, refunded}; refuse extend unless `active` (and push `accessTokenExpiresAt` forward with it).

### [CONFIRMED] TTL1 · MED — 30-day access token is a reusable bearer credential for write ops
- **Where:** `EntitlementService.java:44` (`DEFAULT_TOKEN_TTL_DAYS=30`); gates writes at `CampaignPublicController.java:1054-1087` (counselling book/seat-spend).
- **Breaks:** A single long-lived token (emailed, and echoed by PUB1/TOK1) authorizes booking + seat decrement for 30 days, no revoke-on-use.
- **Fix:** Shorten TTL for action endpoints or require a second factor for writes; stop echoing the token (PUB1/TOK1).

### [LIKELY] REDEEM-PENDING · MED — `redeemAccessToken` accepts `pending` → reports can be generated before activation/payment
- **Where:** `EntitlementService.java:185` (allows `pending`); `ReportPreparationController.java:51` (`/bet-report-data/public/prepare` checks only token + `finalReportActive` + assessment match, not `status=="active"`).
- **Breaks:** A pending entitlement whose `finalReportActive` is true (e.g. via reset/manual inconsistency) can trigger full report generation it hasn't paid to activate.
- **Fix:** Require `status=="active"` in `prepare` before dispatching generation.

---

## Funnel / path logic

### [LIKELY] PATH1 · MED — Paid `/register` doesn't validate `purchasePath` → a Path-B-only assessment can be force-charged pay-first
- **Where:** `CampaignPublicController.java:217-335` (no purchasePath gate; contrast `registerTrial` at `:369`).
- **Breaks:** A try-first ("B") assessment can be driven straight to a paid charge via `/register/...`, skipping the trial funnel + trial-entitlement dedup; a paid entitlement can then coexist with a pending trial entitlement for the same (student, assessment) → double entitlement.
- **Fix:** Resolve purchasePath in `/register` and reject (or branch) when it's "B".

### [LIKELY] DUP-SAM · LOW — Duplicate `StudentAssessmentMapping`/entitlement under concurrent registration
- **Where:** SAM `findFirst…`-then-`save` at `:444-448`/`:813-818`; pending-entitlement dedup `EntitlementService.createPending:64-72`. No unique constraint on `(user_student_id, assessment_id)` / pending entitlement.
- **Fix:** Add unique constraints; insert-or-ignore.

---

## Admin CRUD correctness

### [CONFIRMED] CRUD1 · MED — Re-attaching a soft-deleted assessment hits the unique constraint → 500
- **Where:** `CampaignController.java:173-185` (dup check filters `isDeletedFalse`) vs `CampaignAssessmentMapping.java:23` (`UNIQUE(campaign_id, assessment_id)`); detach soft-deletes at `:204-211`.
- **Fix:** On attach, look up including soft-deleted rows and revive/reactivate instead of inserting.

### [CONFIRMED] CRUD2 · MED — Campaign soft-delete orphans mappings, tiers, and active entitlements
- **Where:** `CampaignController.java:143-153`.
- **Breaks:** Children + live `StudentEntitlement` rows stay active, pointing at a "deleted" campaign with no admin surface.
- **Fix:** Cascade `isActive=false`/`isDeleted=true` to children (or block delete when active paid entitlements exist) and handle live entitlements explicitly.

### [CONFIRMED] CRUD3 · LOW — No `validTo ≥ validFrom` validation; `validFrom` not enforced at registration
- **Where:** `CampaignController.java:122-123` (update) + create (no date handling); all public entry points check only `validTo`, never `validFrom`.
- **Fix:** Validate the window on save (reject unparseable / inverted dates); add a `validFrom.after(now)` guard to the public entry points.

### [CONFIRMED] CRUD4 · LOW — `attachTier` single-default enforcement is non-atomic
- **Where:** `CampaignController.java:237-246` (read-clear-save, no tx/lock).
- **Fix:** `@Transactional` + partial unique index on `(mapping_id, is_default=true)` (or `SELECT … FOR UPDATE`).

### [CONFIRMED] CRUD5 · LOW — Unchecked casts in update handlers → 500 on wrong-typed JSON
- **Where:** `CampaignController.java:138,198`; `PricingTierController.java:79-87` (`(Boolean) req.get(...)`).
- **Fix:** Safe-coerce helper (`toBool`) + field validation; return 400 not 500.

### [CONFIRMED] CRUD6 · LOW — Negative `page` param → 500 in tracker list endpoints
- **Where:** `TrackerController.java:124/233/343/469` (`setFirstResult(page*size)`); `clampPageSize` never clamps `page`.
- **Fix:** `page = Math.max(0, page)`.

---

## Data exposure

### [CONFIRMED] EXPOSE1 · MED — Tracker returns the full `PaymentTransaction` entity; no tenant scoping
- **Where:** `TrackerController.java:285-288` (returns the whole entity: razorpay ids, DOB, phone, email, failure notes); no institute/campaign filter on any tracker query.
- **Breaks:** Over-exposure + missing tenant isolation — any admin sees every tenant's payment rows. (Razorpay key_secret/webhook_secret are not on the entity — over-exposure, not secret leak.)
- **Fix:** Return a whitelisted DTO; add caller-scoped `WHERE` clauses to all tracker queries.

---

## Frontend

### [CONFIRMED] PRICE-FE1 · HIGH — Pay-for-report price display ≠ amount charged (`Math.round` vs backend floor)
- **Where:** `career-nine-assessment/src/pages/PayForReportPage.tsx:74` (`Math.round`) vs backend integer truncation (`CampaignPublicController.java:642`); the sibling `CampaignRegisterPage.tsx:138` correctly uses `Math.floor`.
- **Breaks:** e.g. 995 @ 33% shows 667 but charges 666. Display/UX (the charge is correct).
- **Fix:** Use `Math.floor` to mirror the backend.

### [CONFIRMED] FE-SLUG · HIGH — Admin slugify diverges from backend → copied registration links 404 until reload
- **Where:** `CampaignEditPage.tsx:35` (collapses runs + trims edge dashes) vs `CampaignController.java:91,112` (`replaceAll("[^a-z0-9-]","-")`, no collapse/trim); `handleSaveBasics` never sets state from the save response, so `RegistrationLinks.tsx` builds from the divergent local slug.
- **Breaks:** Names with spaces/special runs (e.g. `Summer 2026!!`) → UI shows `…/c/summer-2026`, backend stored `summer-2026--`; copied link 404s until reload.
- **Fix:** Make the two slugify functions identical, or `setCampaign(res.data)` on save so links use the canonical slug.

### [LIKELY] FE-PAYSTATUS · MED — Payment-status page fails open to "paid" on a spoofable URL param
- **Where:** `PaymentStatusPage.tsx:89,116-135,217-237` (`urlSaysPaid` from `razorpay_payment_link_status=paid`).
- **Breaks:** Appending `?...&razorpay_payment_link_status=paid&upgrade=1&eid=<theirs>` shows "Payment Successful!" / navigates to the completed page without a real payment. Provisioning is server-side, so this is a trust-display + premature-navigation defect, not a free entitlement.
- **Fix:** Treat as paid only when `/payment/webhook/status?reconcile=1` returns `status==="paid"`; never trust the URL status.

### [LIKELY] FE-RETRY · LOW — Report-error retry shows a success toast on a non-`resolved` 2xx
- **Where:** `Tracker/components/ReportErrorsTab.tsx:45-54`, `EntitlementDrawer.tsx:83-94`.
- **Fix:** Branch on the real response status; warn on non-`resolved`.

### [LIKELY] FE-DOB · LOW — `AssessmentStartPage` omits `studentDob` → session re-mint fails after cookie expiry
- **Where:** `AssessmentStartPage.tsx:41-60` (vs `CampaignRegisterPage.tsx:232` / `PaymentStatusPage.tsx:183` which store it).
- **Fix:** Persist `studentDob` from redeem-token, or prompt for DOB on re-mint.

---

## Watch list — sanity-check before acting
- **AUTH1 enforce-mode flip** — intentional hold; flip per environment only after confirming permission seeding (else legitimate flows 403). Decision, not a code fix.
- **TTL1 / PUB1 token model** — shortening the token TTL or removing it from `upgrade-info`/`communications` will change existing magic-link UX; coordinate with the email/SSO flows.
- **ID4 DOB-less mint** — depends on whether DOB-less student accounts legitimately exist; confirm before hard-rejecting the mint.
- **PATH1** — could be intended (pay-first always allowed); if so, dedup the trial-vs-paid entitlement instead of rejecting.
- **REDEEM-PENDING** — relies on a `pending + finalReportActive` inconsistency that is normally unreachable; cheap gate regardless.

## Refuted (no action — checked and cleared)
- Webhook signature forgery/replay: HMAC verified on raw bytes before parse, constant-time compare, fail-fast on empty secret. (Residual: no replay nonce — bounded by idempotency on the locked path.)
- StudentCheckout IDOR: identity from `@AuthenticationPrincipal`, tier ownership validated, dashboard-inclusion enforced.
- Notes tampering: campaignId/tierId/amount read from the DB txn, never from Razorpay notes.
- Payment reset → double-provision: reset nulls `paymentTransactionId` + reverts to pending; redrive reuses the pending row.
- SQL injection in tracker lists: bound JPQL params, hardcoded sort.
- B2C registration-link env fallback: present (`RegistrationLinks.tsx:15-16`) — the B2B `undefined/...` bug is NOT in B2C.
- XSS via campaign name/description/brandLogoUrl: React text nodes / `<img src>`, no `dangerouslySetInnerHTML`.
- Report-prep DoS: generators short-circuit on an already-generated report.

---

## Recommended fix order

1. **Exploitable now (public surface, money, identity):** PUB1, ID1, TOK1, PUB2/PUB3, PROMO1/PROMO2, PAY1, REC1.
2. **Provisioning integrity:** REC2, ID3, WEL1, ENT-ACT.
3. **Entitlement lifecycle:** EXP1+EXP2 (one change), STATE1, TTL1, REDEEM-PENDING.
4. **Authz rollout:** AUTH2 scope binding + permission-seed verification → then the AUTH1 `enforce` flip (decision).
5. **CRUD + data exposure:** CRUD1, CRUD2, EXPOSE1, then CRUD3–6, PROMO3, PRICE-CRUD.
6. **Frontend:** PRICE-FE1, FE-SLUG, FE-PAYSTATUS, then FE-RETRY, FE-DOB, TOK2.

Shared root causes (fix the source once):
- **REC1 + B2B W3/W4** — one transactional+locked reconcile boundary serves both flows.
- **PROMO1/PROMO2 + B2B A1/A2** — one atomic guarded `tryConsume` moved to realized redemption.
- **PAY1 (B2C register + pay-for-report + checkout) + B2B PAY1** — one "commit pending txn before the irreversible link call" pattern.
- **EXP1 + EXP2** — one expiry sweep + per-service expiry enforcement in the gates.

---

## Appendix — method & confidence
- 6 parallel finders by domain, each self-refuting (default to "not a bug" on doubt). `[CONFIRMED]` = could not refute; `[LIKELY]` = a documented doubt or precondition.
- Hand-verified by grep: AUTH1 (`AuthorizationService.java:172` + `application.yml` four blocks), REC1 (`PaymentWebhookController.java:176/194/389`), PAY1 (link-before-save in both register controllers), TOK1 (`LinkBuilder` `?t=` + `NotificationDispatcher:40`).
- Line numbers reflect source as of 2026-06-04 on `dhruv-from-palak` and may drift — re-grep the cited symbol if a line looks off.
