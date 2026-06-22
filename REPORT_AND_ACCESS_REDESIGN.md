# Report Delivery & Access/Entitlement Redesign

> Status: **Planning / analysis complete.** Branch `dhruv-from-palak`. Last updated 2026-06-18.
> This document is the single source of truth for the streamlining of report generation, report
> emailing, entitlement, dashboard access, and counselling access. It captures the verified
> current state, the target model, every flow, the gaps found by a full-codebase audit, the open
> decisions, and the phased implementation plan.

---

## 1. Executive summary

Access to paid services (report, counselling, LMS, dashboard) is today decided by **four scattered
gates** plus a **second, half-built counselling gate**. The result: a double-emailer on every
submission, three different "can this student see the report" truths, and a counselling subsystem
with two disconnected halves (one of which never writes its counters).

The redesign collapses all of this to **one rule**: a single row, `StudentEntitlement`, is the
source of truth, carrying **three independent locks** (report, counselling, LMS). The **dashboard
becomes universal** (no lock). Everything else either *feeds* the row (tier snapshots, school
plans, payments) or *reads* it (email delivery, portal access, booking).

The three business cases you described — **free report**, **school-paid report**, **pay-per-report**
— are not three code paths; they are three tier configurations that differ only in **when the
report lock flips true**. Pay-per-report further splits by **timing**: pay at registration
(`PAY_FIRST`) or pay after the assessment, like counselling (`PAY_LATER`).

```
                         ┌──────────────────────────────────────────────┐
   FEEDERS (writers)     │   StudentEntitlement   (1 per student+assmt)  │   CONSUMERS (readers)
 ───────────────────────▶│   finalReportActive  ─ report lock           │◀───────────────────────
  • tier snapshot         │   counsellingActive + pool ─ counselling lock │  report delivery (email+view)
    (free/school/paid)    │   lmsActive          ─ lms lock              │  counselling eligibility+booking
  • school plan feeder    │   status / token / dates                     │  lms launch (future)
  • per-slot payment      │   dashboard*  ← REMOVED (universal)          │  (dashboard = universal, no lock)
                         └──────────────────────────────────────────────┘
```

---

## 2. Current state (the mess being replaced)

### 2.1 Report emailing — a double-emailer with two different gates
On a single B2C submission, [AssessmentSubmissionProcessorService](spring-social/src/main/java/com/kccitm/api/service/AssessmentSubmissionProcessorService.java#L525) fires **two** report-email systems back to back:

- **Line 525** → `EntitlementService.onAssessmentCompleted()` — emails a link, gated by
  `finalReportActive`: true → "final report ready"; false → "1-pager, unlock full report".
- **Line 537** → `reportPipelineProducer.enqueue()` — the Kafka pipeline; generates for **everyone**,
  emails **only if whitelabel**.

Consequences: a whitelabel B2B student with `finalReportActive` can be **double-emailed**; a plain
(non-whitelabel) B2B student gets **no report email at all**.

### 2.2 Report access — three different truths
- `finalReportActive` (on entitlement) gates the B2C token link `/bet-report-data/public/final`.
- `generated_report.visibleToStudent` gates the B2B portal list (`getVisibleReportsForStudent`).
- `GeneratedReport` *existence* is used as a gate by counselling eligibility.

These are set independently, so a student can be unlocked in one surface and locked in another.

### 2.3 Report generation — already universal (good)
The Kafka pipeline generates + renders a PDF into `generated_report` for **every** student on
completion. Only **sending** and **access** are conditional. This is exactly the desired shape and
is kept.

### 2.4 Entitlement — already the right shape, partly
`StudentEntitlement` already carries per-service flags snapshotted from a tier's `includes_*`
columns, across all three sources (B2C campaign, B2B mapping, B2B school). The model is sound; the
problem is that some consumers bypass it and some flip-points don't trigger delivery.

### 2.5 Counselling — one shared supply side + two demand gates (one half-built)
- **Supply side** (counsellors, availability templates → slot materialization, appointments,
  lifecycle sweep, OTP check-in, reminders, notifications) — fully built, shared.
- **Demand gate A — token/entitlement** ([CampaignPublicController](spring-social/src/main/java/com/kccitm/api/controller/career9/b2c/CampaignPublicController.java)): real & metered
  (`counsellingActive` + pool; consume at booking; credit-back on no-show; truly consumed at COMPLETED).
- **Demand gate B — portal eligibility** ([CounsellingEligibilityService](spring-social/src/main/java/com/kccitm/api/service/counselling/CounsellingEligibilityService.java) → `/api/counselling-appointment/book`):
  half-built. Resolves EVENT/PAID/REPORT tracks and **never reads the entitlement**.

### 2.6 Verified bugs (confirmed by grep)
- **`CounsellingPlan.sessionsUsed` is never written** — the EVENT track reads a counter nothing decrements (and nothing creates a plan in code; DB-seed only).
- **`CounsellingPayment` is never constructed/saved** — the PAID track reads a **dead table**.
- **Portal booking (`/api/counselling-appointment/book` → `BookingService.bookSlot`) meters nothing** — no entitlement, no consume, no credit-back. The only metered path is the token flow.

---

## 3. Target model

### 3.1 One source of truth, three locks
`StudentEntitlement` (one per student+assessment) holds:

| Lock | Field(s) | Read by |
|---|---|---|
| **Report** | `finalReportActive` | report email delivery + report view (portal + token) |
| **Counselling** | `counsellingActive` + `counsellingSessionsTotal/Used` | counselling eligibility + booking |
| **LMS** | `lmsActive` (+ `lmsExpiresAt`) | LMS launch (no feature yet — flag only) |
| ~~Dashboard~~ | ~~`dashboardActive` / `dashboardExpiresAt`~~ | **removed — dashboard is universal** |

### 3.2 Dashboard becomes universal
Any logged-in student sees the dashboard/insight. The **report and counselling tiles inside it**
self-gate from the three locks. Drop `dashboardActive`/`dashboardExpiresAt` and the tier
`includesDashboard`/`dashboardValidityDays`; gut `InsightAccessService` and `redeemDashboardToken`;
stop the expiry sweep touching dashboard.

### 3.3 LMS stays scaffolding
`lmsActive` + tier `includesLms` + expiry sweep + resend link exist, but there is **no LMS feature**
(`/lms/launch` is unbuilt). Keep the lock consistent; build nothing now.

---

## 4. The offer model — three report cases as tier configs

A **tier** (`PricingTier` B2C, `AssessmentMappingTier` B2B per-level, `SchoolAssessmentTier` school)
is the complete description of an offer:

| Field | Effect |
|---|---|
| `amount` / `isFree` | price, or the single free tier |
| `includesFinalReport` | → sets `finalReportActive` |
| `includesCounselling` + `counsellingSessionCount` + `counsellingPrice` | → counselling lock + pool + extra-session price |
| `includesLms` + `lmsValidityDays` | → lms lock |
| ~~`includesDashboard` / `dashboardValidityDays`~~ | **removed** |

The three cases differ only in **when `finalReportActive` flips true**:

| Case | Tier config | Flips true at | Who pays |
|---|---|---|---|
| **Free report** | free tier, `includesFinalReport=true` | registration | nobody |
| **School-paid report** | school/mapping tier, `includesFinalReport=true` | grant | institute (out-of-band) |
| **Pay-per-report @ registration** (`PAY_FIRST`) | paid tier, `includesFinalReport=true` | payment webhook (before assessment) | student |
| **Pay-per-report @ end** (`PAY_LATER`) | register free → upgrade to report tier post-assessment | upgrade payment webhook (after assessment) | student |

Report is **generated for all** regardless; only **send + access** are gated by the flag.

---

## 5. The link model

A registration link is a token resolving to **(mapping, which-tier, payment-timing)**:

- `AssessmentInstituteMapping.freeToken` → the `is_free` tier (`amount=0`). Used for free reports
  and for the "register free, pay later" entry.
- `AssessmentInstituteMapping.paidToken` → the active paid wave tier. Used for pay-at-registration.

`resolveLink(token)` → `ResolvedLink{mapping, freeLink}` → `resolveEffectiveTier()` picks the tier.
**That tier is the offer.** The mapping's `paymentTiming` (`PAY_FIRST`/`PAY_LATER`) decides *when*
paid locks are collected.

`LinkBuilder` ([spring-social/.../b2c/LinkBuilder.java](spring-social/src/main/java/com/kccitm/api/service/b2c/LinkBuilder.java)) builds the deep links the student receives:
`onePager`, `finalReport`, `dashboard` (SSO), `counsellingBook`, `counsellingMySessions`, `lmsLaunch`.

> ⚠️ Gap (see §10): a free tier is currently *allowed* to carry paid flags, so "school-paid via the
> free link" works only by accident. Needs explicit modeling or validation.

---

## 6. Registration flow

One token-based endpoint: `POST /assessment-mapping/public/register/{token}` (B2C campaign has its
analogue, `startFreeTrial`). Optimised sequence:

1. **Resolve** link → tier → offer (`reportActive?`, `counselling?`, `lms?`, price, timing).
2. **Capture registration data**: name, email, **DOB** (also the login secret), phone, gender,
   class/level, institute (from mapping). Dedup by email or (DOB+institute+class+name).
3. **Provision identity** (idempotent): `UserStudent` + `StudentInfo` + `StudentAssessmentMapping`
   + ABAC scope via `StudentProvisioningService`. Login = username + DOB.
4. **Create the entitlement** — exactly one per (student, assessment):
   - free / school-paid → `active`, locks already granted (`reportActive=true` at registration).
   - pay-per-report → `pending` (or `active` with the report lock still false until payment).
5. **Mint access token** (30-day) for tokenized deep links.

`createdAt` = registration date; `grantedAt` = activation; per-service expiry from validity-days;
**report never expires** once unlocked.

> ⚠️ Gap (see §10): "all-locks-off" tiers currently create **no** entitlement row — must always mint
> one for the SSOT to hold.

---

## 7. Payment — collection, timing, recording

### 7.1 Timing A — pay at registration (`PAY_FIRST`)
Student uses the **paid link**. `createPaymentAndRedirect()` writes a
`PaymentTransaction{status:created, mappingId, mappingTierId, student fields, amount}` **before**
calling Razorpay (recoverable record first), creates the Razorpay link, stamps
`razorpayLinkId`/`shortUrl`, cancels prior outstanding links. Student pays → webhook.

### 7.2 Timing B — pay after assessment (`PAY_LATER`, "like counselling")
Student registers on a free/cheaper tier (entitlement `pending`, `reportActive=false`), takes the
assessment. Report is **generated but locked**. Post-assessment the unlock offer is shown; paying
runs the **free→paid upgrade** → webhook → `activateB2BOnPayment()` **unions** the paid tier's
`includesFinalReport` onto the existing entitlement → `reportActive` flips true.

### 7.3 Recording & activation (single money-truth)
`PaymentWebhookController.markPaidAndProvision()`:
- Verifies HMAC, locks the txn row, idempotent on `status=='paid'`.
- Sets `status=paid`, stamps Razorpay IDs, backfills student details, then branches by discriminator:
  - `campaignId` → `activateOnPayment()` (B2C)
  - `mappingId` → `activateB2BOnPayment()` (B2B per-level)
  - `schoolConfigId` → `activateSchoolOnPayment()` (school)
  - `purpose=COUNSELLING_EXTRA|PAYLATER` → counselling slot finalize (§8)
- Activation **snapshots tier locks** (additive union — never drops), sets `status=active`,
  `grantedAt`, ensures token.

### 7.4 School-paid recording
Today school-paid is admin-granted with **no per-student transaction**. For scale we add a
**bulk-grant path** that mints active entitlements with `reportActive=true` (optionally zero-amount
txns for audit/refund). See §10 gap G7.

---

## 8. Service provision

### 8.1 Report (lock = `finalReportActive`)
- **Generation:** universal (Kafka pipeline → `generated_report`, `visibleToStudent=false` initially).
- **Delivery:** one idempotent `ReportDeliveryService.maybeDeliver(student, assessment)` — rule:
  `generated && finalReportActive && hasEmail` → **email** (single Kafka pipeline; gate changes
  `whitelabel → finalReportActive`; whitelabel becomes **branding/template only**) + **auto-set
  `visibleToStudent=true`**. Fires from **both** triggers, whichever is last: generation-complete
  **or** the payment/upgrade that flips the lock. Redis dedup keyed `(student, assessment)` is the
  single send-gate.
- `onAssessmentCompleted`'s direct send is **retired**; its locked-state "1-pager / unlock" teaser
  routes through the deliverer instead.

### 8.2 Counselling (lock = `counsellingActive` + pool)
Rewired so the **portal uses the entitlement** (the only metered counter):
- **Eligibility** reads the entitlement: bookable if `counsellingActive && (total-used)>0` (keeping
  the EVENT/PAID/REPORT payload shape so the FE is unaffected).
- **Booking** (token + portal both land in `BookingService`): consume on confirm, credit-back on
  no-show, truly consumed at COMPLETED. Converge the two booking entry points into one facade.
- **School plan** (`CounsellingPlan`) becomes a **feeder** that grants/refills entitlement sessions
  (and is decremented as students consume), so the institute cap is actually enforceable (soft).
- **Paid extra / PAY_LATER per-slot:** unchanged — `PaymentTransaction{COUNSELLING_EXTRA|PAYLATER}`
  → webhook → `confirmHeldSlot` → links/consumes entitlement. The dead `CounsellingPayment` is dropped.
- Supply side untouched.

### 8.3 Dashboard (no lock — universal)
`InsightAccessService` always-allow; `redeemDashboardToken` no longer gates; expiry sweep stops
touching dashboard; columns + tier flags dropped. The report/counselling tiles inside the dashboard
self-gate.

### 8.4 LMS (lock = `lmsActive`, flag only)
Kept as scaffolding. No feature behind `/lms/launch`. Keep the lock consistent; build nothing.

---

## 9. Frontend touchpoint map

| Surface | Who | Reads | Shows |
|---|---|---|---|
| Tier/offer config | Admin | tier `includes*` | Report / Counselling(+count,+price) / LMS toggles; price; payment timing. No dashboard toggle. |
| Public registration page | Prospect | resolved tier + timing | Free → "Register"; Paid@reg → price + "Pay & Register" |
| Razorpay hosted link | Student | `PaymentTransaction` | hosted checkout; return → SSO/thank-you |
| Post-assessment unlock | Student (Timing B) | `finalReportActive=false` | "Unlock full report ₹X" → upgrade payment |
| Dashboard — Report tile | Student | `finalReportActive` + `generated_report` | Locked (unlock CTA) / Ready (View·Download) |
| Dashboard — Counselling tile | Student | `counsellingActive` + pool | Book (N left) / Buy session ₹X |
| Email (report ready) | Student | deliverer | branded (whitelabel) or standard; PDF + deep link |
| My Sessions | Student | appointments | upcoming/past, reschedule once, join after check-in |
| Counsellor dashboard | Counsellor | appointments/slots | confirm/start/notes (unchanged) |
| Admin Reports Hub | Admin/counsellor | `generated_report` (ABAC-scoped) | generate/regenerate, hide override, bulk |

---

## 10. Audit gaps (found via full-codebase re-read, 2026-06-18)

### 🔴 Critical — undermine the SSOT premise if unfixed
- **G1. No uniqueness on `StudentEntitlement(student, assessment)`.** No DB constraint; six creation
  paths (`createPending`, `findOrCreateForUpgrade`, `findOrCreateB2B`, `grantSchoolEntitlement`,
  `startFreeTrial`, free registration) can create duplicates; readers pick `.get(0)` with *different*
  filters → counselling vs report endpoints can read **different rows**. Fix: canonical
  `resolveActiveEntitlement()` everywhere + uniqueness guard + index on `(user_student_id, assessment_id)`.
- **G2. All-locks-off tiers create no row** (`grantSchoolEntitlement` early-returns). Must **always
  mint** a row (even all-false) for the SSOT to hold.
- **G3. PAY_LATER strips only counselling, not the report.** "Pay-at-end-for-report" isn't wired:
  free tier must carry `includesFinalReport=false` and the upgrade must flip it — needs a
  `withoutFinalReport()` on the snapshot (or validation).
- **G4. Free tier can carry paid flags.** "School-paid via free link" works only by accident; needs
  explicit modeling (tier-source marker) or validation.

### 🟠 Important — delivery & counselling wiring to name explicitly
- **G5. `maybeDeliver()` must hook into all six `finalReportActive`-flip sites** (`activateOnPayment`,
  `upgradePending`, `activateB2BOnPayment`, `activateSchoolOnPayment`, `grantSchoolEntitlement`,
  `extendExpiry`) — none trigger delivery today.
- **G6. Admin-generated reports bypass the pipeline** (`UnifiedReportController` one-click/bulk,
  `NavigatorReportDataController`, `AssessmentCompletionService.markCompletedIfFullyAnswered`) → no
  email. Decision needed: deliver or stay silent (open decision (c)).
- **G7. School-paid has no per-student payment record and no bulk-grant endpoint.** Need a bulk-grant
  path minting active entitlements (`reportActive=true`) at scale.
- **G8. Counselling rewire is structural:** portal `/api/counselling-appointment/book` carries no
  `entitlementId`/`assessmentId` → can't consume or credit-back (credit-back needs
  `appointment.entitlementId`). Must thread `assessmentId` → resolve entitlement → one shared booking
  facade. Rewrite `CounsellingEligibilityService` to read the entitlement while **keeping the
  EVENT/PAID/REPORT payload shape** (FE branches on it).
- **G9. `CounsellingPlan`-as-feeder needs scaffolding:** new `counsellingPlanId` column + feeder
  method + creation trigger (rec: at assessment completion) + **soft** institute cap (report-only).
  Plans have **no admin CRUD** today (DB-seed only) → new admin endpoint.
- **G10. Locked-state 1-pager teaser idempotency** is keyed on `entitlementId` only → spam risk;
  re-key to `(student, assessment)`.

### 🟢 Low-risk / confirmed
- Dashboard removal ≈ 39 files, mechanical. **Ordering rule:** remove `redeemDashboardToken` gate +
  all readers **before** the drop-column migration. `expiresAt` recompute becomes LMS-only.
  `InsightAccessService` not coupled to report/counselling — safe.
- Dropping `CounsellingPayment` is clean (never written; only the dead eligibility read references it).
- `whitelabel → branding-only` is safe (non-whitelabel falls back to standard branding; plain-B2B
  schools now correctly get emailed — the intended behavior change).
- Admin manual sends (`/send-report-email`, `/send-reports`) and the completion-ack email stay
  separate from the unified deliverer.

---

## 11. Open decisions (must lock before execution-ready)

- **(a) PAY_LATER report deferral** — model as `withoutFinalReport()` on the snapshot, or enforce
  free-tier `includesFinalReport=false` via validation?
- **(b) School-paid modeling** — explicit tier-source + bulk-grant, or keep the free-link-carries-
  paid-flags convention with validation?
- **(c) Admin-generated reports** — deliver (email + unlock) or stay silent?
- **(d) Counselling plan-feeder** — create per-student entitlements at assessment completion
  (recommended) vs first-booking vs admin bulk; cap = soft (recommended).

---

## 12. Phased implementation plan

### Phase 0 — Foundations (SSOT integrity)
- Add canonical `resolveActiveEntitlement(student, assessment)` used by all readers.
- Add uniqueness guard + index on `student_entitlements(user_student_id, assessment_id)`.
- Always-mint an entitlement row (even all-locks-false). (G1, G2)

### Phase 1 — Dashboard removal (mechanical, unblocked)
- Drop `dashboardActive`/`dashboardExpiresAt` on `StudentEntitlement`; drop `includesDashboard`/
  `dashboardValidityDays` on `PricingTier`, `AssessmentMappingTier`, `SchoolAssessmentTier`.
- Gut `InsightAccessService.evaluate()` to status-only; remove the `redeemDashboardToken` dashboard
  gate; remove dashboard from `EntitlementSchedulerService.expireEntitlements()`, `ServiceInclusions`,
  `applyInclusionSnapshot`/`applyTierSnapshot`, `extendExpiry`, `grantSchoolEntitlement`.
- Remove dashboard from all tier DTOs/controllers (`PricingTierController`, `CampaignPublicController`,
  `TrackerController`, `AssessmentInstituteMappingController`, `StudentCheckoutController`,
  `CampaignResolutionService`) and FE types/components (tier modals, ThankYouPage upsell, EntitlementDrawer,
  tracker chips, registration summaries, SSO landing 403 path).
- **Ordering rule:** code first, drop-column migration last. `expiresAt` becomes LMS-only.

### Phase 2 — Unified report delivery
- New `ReportDeliveryService.maybeDeliver()` (idempotent, Redis-deduped); fire from generation-complete
  **and** every `finalReportActive`-flip site (G5).
- Change Kafka email gate `whitelabel → finalReportActive`; whitelabel → branding only.
- Auto-set `visibleToStudent=true` on delivery (keep admin manual hide as override).
- Retire `onAssessmentCompleted` direct send; route the locked-state teaser through the deliverer,
  re-keyed `(student, assessment)` (G10).
- Decide admin-gen delivery (G6 / decision (c)).

### Phase 3 — Report access SSOT
- Collapse the three report-access truths (`finalReportActive` / `visibleToStudent` / report-exists)
  so the portal and token surfaces agree.

### Phase 4 — Pay-per-report timings + school-paid
- Wire PAY_LATER report deferral (decision (a)); free→paid upgrade flips `finalReportActive` then
  calls `maybeDeliver`.
- Model school-paid (decision (b)); add bulk-grant path (G7).
- Validate free-tier flags (G4).

### Phase 5 — Counselling SSOT rewire
- Thread `assessmentId` + entitlement resolution through portal booking; converge token + portal
  into one booking facade; meter consume/credit on both (G8).
- Rewrite `CounsellingEligibilityService` to read the entitlement, same payload shape.
- `CounsellingPlan` feeder: new `counsellingPlanId` column, feeder method, creation trigger, soft
  cap, admin CRUD (G9 / decision (d)).
- Drop `CounsellingPayment` (table + entity + repo + eligibility refs).

### Phase 6 — LMS
- Leave as scaffolding; ensure nothing in Phases 1–5 breaks the `lmsActive` lock.

---

## 13. Key file anchors

**Report pipeline / delivery**
- [ReportPipelineProducer](spring-social/src/main/java/com/kccitm/api/service/b2c/report/pipeline/ReportPipelineProducer.java)
- [ReportGenerateConsumer](spring-social/src/main/java/com/kccitm/api/service/b2c/report/pipeline/ReportGenerateConsumer.java)
- [ReportEmailConsumer](spring-social/src/main/java/com/kccitm/api/service/b2c/report/pipeline/ReportEmailConsumer.java)
- [ReportEmailIdempotency](spring-social/src/main/java/com/kccitm/api/service/b2c/report/pipeline/ReportEmailIdempotency.java)
- [InstituteBrandingService](spring-social/src/main/java/com/kccitm/api/service/branding/InstituteBrandingService.java)
- [AssessmentSubmissionProcessorService](spring-social/src/main/java/com/kccitm/api/service/AssessmentSubmissionProcessorService.java)
- [AssessmentCompletionService](spring-social/src/main/java/com/kccitm/api/service/AssessmentCompletionService.java)
- [UnifiedReportController](spring-social/src/main/java/com/kccitm/api/controller/career9/report/UnifiedReportController.java)
- [GeneratedReportController](spring-social/src/main/java/com/kccitm/api/controller/career9/GeneratedReportController.java)
- [BetReportDataController](spring-social/src/main/java/com/kccitm/api/controller/career9/BetReportDataController.java)

**Entitlement / payment / link**
- [StudentEntitlement](spring-social/src/main/java/com/kccitm/api/model/career9/b2c/StudentEntitlement.java)
- [EntitlementService](spring-social/src/main/java/com/kccitm/api/service/b2c/EntitlementService.java)
- [PaymentWebhookController](spring-social/src/main/java/com/kccitm/api/controller/career9/PaymentWebhookController.java)
- [AssessmentInstituteMappingController](spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentInstituteMappingController.java)
- [AssessmentMappingTier](spring-social/src/main/java/com/kccitm/api/model/career9/AssessmentMappingTier.java)
- [PricingTier](spring-social/src/main/java/com/kccitm/api/model/career9/b2c/PricingTier.java)
- [SchoolAssessmentTier](spring-social/src/main/java/com/kccitm/api/model/career9/SchoolAssessmentTier.java)
- [LinkBuilder](spring-social/src/main/java/com/kccitm/api/service/b2c/LinkBuilder.java)

**Dashboard / insight**
- [InsightAccessService](spring-social/src/main/java/com/kccitm/api/service/dashboard/insight/InsightAccessService.java)
- [EntitlementController](spring-social/src/main/java/com/kccitm/api/controller/career9/b2c/EntitlementController.java)
- [EntitlementSchedulerService](spring-social/src/main/java/com/kccitm/api/service/b2c/EntitlementSchedulerService.java)

**Counselling**
- [CounsellingEligibilityService](spring-social/src/main/java/com/kccitm/api/service/counselling/CounsellingEligibilityService.java)
- [BookingService](spring-social/src/main/java/com/kccitm/api/service/counselling/BookingService.java)
- [AppointmentService](spring-social/src/main/java/com/kccitm/api/service/counselling/AppointmentService.java)
- [CounsellingLifecycleService](spring-social/src/main/java/com/kccitm/api/service/counselling/CounsellingLifecycleService.java)
- [CounsellingAppointmentController](spring-social/src/main/java/com/kccitm/api/controller/career9/counselling/CounsellingAppointmentController.java)
- [CounsellingPlan](spring-social/src/main/java/com/kccitm/api/model/career9/counselling/CounsellingPlan.java)
- [CounsellingPayment](spring-social/src/main/java/com/kccitm/api/model/career9/counselling/CounsellingPayment.java) (to be dropped)

**Related design docs:** `B2B_ARCHITECTURE.md`, `ASSESSMENT_EVENT_AUDIT.md`.
