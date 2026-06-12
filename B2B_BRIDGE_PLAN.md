# B2B Bridge — Implementation Plan (Phase 1 of the path to the target design)

> Goal: restore the **two-area** admin UI (School mapping + per-session/class/section mapping) while keeping the redesign's logic — **both areas feed the `institute_assessment` SSOT**, and **both mint `StudentEntitlement`s so all students get report/dashboard/counselling/LMS**.
> This is **Option 3 (the bridge)** from [B2B_TARGET_DESIGN.md](B2B_TARGET_DESIGN.md): every change here survives verbatim into the Option-1 target. Keeps the two table families separate; unifies the *seams* (catalog feed, entitlement mint, security).

## Design decision: the shared entitlement seam
`EntitlementService.activateB2BOnPayment` is hardwired to `mapping_id` + `assessment_mapping_tier`. School txns carry `school_config_id` + a `school_assessment_tier` id, and `student_entitlements` has no school discriminator. So:
- Refactor `applyMappingTierSnapshot(e, tier)` → `applyInclusionSnapshot(e, ServiceInclusions)` (a small value object with the 8 inclusion fields). **One snapshot core, shared by both areas.**
- Add `activateSchoolOnPayment(txnId)` mirroring `activateB2BOnPayment` but loading from `schoolAssessmentTierRepository` and stamping the school discriminator. Thin entry point, shared core.
- `student_entitlements` gains nullable `school_config_id`; the source discriminator becomes a 3-way (exactly one of `campaign_id` / `mapping_id` / `school_config_id`).
- `school_assessment_tier` gains the 8 `includes_*` columns so school tiers can carry service inclusions.

---

## Phase 1A — Frontend: restore the two-area page  *(independent, low-risk)*
- **AssessmentMappingPage.tsx** — re-introduce `type Level = "SCHOOL" | "DETAIL"`, `level` state (default `SCHOOL`), the `LevelOption` toggle, the green/slate header gradient, and the conditional render of `SchoolAssessmentMappingPanel` (SCHOOL) vs `AssessmentMappingPanel` (DETAIL). **Keep `useInstitutes()`** (do not revert to `ReadCollegeList`). Template = `git show main:…AssessmentMappingPage.tsx`.
- Un-orphans `SchoolAssessmentMappingPanel` (already tier-based on this branch via `SchoolTierManagementModal`). Props already match `{instituteCode, instituteName, active}`.
- Verify `tsc` clean.

## Phase 1B — Backend: school feeds the SSOT  *(small)*
- **SchoolRegistrationController** — inject `instituteAssessmentService.ensure(instituteCode, assessmentId)` in `createConfig` and `batchSaveConfigs` (per saved config's assessment). Autowire `InstituteAssessmentService`. Closes catalog Gap #2.

## Phase 1C — Backend: school entitlements  *(the core change — touches money/access)*
1. **Flyway `V20260606008__school_tier_inclusions.sql`** — add to `school_assessment_tier`: `includes_final_report`, `includes_dashboard` (+`dashboard_validity_days`), `includes_counselling` (+`counselling_session_count`), `includes_lms` (+`lms_validity_days`). All `BOOLEAN DEFAULT FALSE` / nullable INT.
2. **Flyway `V20260606009__entitlement_school_config_id.sql`** — add `school_config_id BIGINT NULL` to `student_entitlements`.
3. **SchoolAssessmentTier.java** — add the 8 inclusion fields + getters/setters.
4. **StudentEntitlement.java** — add `schoolConfigId` field + getters/setters.
5. **EntitlementService.java** — extract `ServiceInclusions` value object; refactor `applyMappingTierSnapshot` to `applyInclusionSnapshot(e, inc)`; add `AssessmentMappingTier.toInclusions()` + `SchoolAssessmentTier.toInclusions()` adapters; add `activateSchoolOnPayment(txnId)` (find-or-create entitlement where `campaignId==null && mappingId==null`, load school tier, apply snapshot, stamp `schoolConfigId`, set active + access token). Autowire `SchoolAssessmentTierRepository`.
6. **SchoolRegistrationController free path** (`registerSchoolStudent`, ~L749) — **always** mint the zero-amount `status="paid"` txn for free registrations (not just the 100%-promo case), set `userStudentId` after the student is created, then call `entitlementService.activateSchoolOnPayment(txn.getTransactionId())`. Mirror in `handleExistingStudent`.
7. **PaymentWebhookController school branch** (~L477) — after `createStudentAndAllotAssessment(txn)`, if `txn.getSchoolConfigId() != null && "paid".equals(txn.getStatus())`, call `entitlementService.activateSchoolOnPayment(txn.getTransactionId())`. Mirror in `handleExistingStudentPayment`.

## Phase 1D — School tier inclusions UI + security
- **School tier create/update endpoints** (`SchoolRegistrationController` `/tiers/*`) — read/write the 8 `includes_*` fields.
- **SchoolTierManagementModal.tsx** — add the inclusion toggles (mirror `TierManagementModal`'s free-tier "Included services" card).
- **Security** — make the 3 `/school-registration/public/*` endpoints truly public (match Area A's `permitAll` + token posture) instead of `@PreAuthorize`. Verify against `PUBLIC_PATHS` / security config. Closes Gap #3.

## Phase 1E — Verify
- Backend compiles + boots; 2 new Flyway migrations apply.
- Frontend `tsc` clean.
- Smoke: school config save → catalog row appears; school FREE register → entitlement minted (report/dashboard per tier); school PAID → webhook mints entitlement; per-level area unchanged.

## Explicitly NOT in this phase (target-design, later)
Promoting the link to a first-class N:M aggregate; deleting `school_*` tables; de-overloading `payment_transaction.mapping_tier_id`; `service_policy` extraction; B2C convergence. (See [B2B_TARGET_DESIGN.md](B2B_TARGET_DESIGN.md) §2.)
