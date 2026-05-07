# B2C Campaign-Tier Public Registration Links

**Date:** 2026-05-06
**Status:** Approved (design)
**Owner:** Dhruv Sharma

## Goal (one sentence)

Add public registration/checkout links for B2C campaigns at three URL granularities — campaign-wide, per-assessment, and per-tier — so marketers can drop a single link into any channel and students land on a layered registration page that funnels through tier selection, payment, and the same auto-login flow we just shipped for school-flow registrations.

## Why

The B2C data model (Campaign → CampaignAssessmentMapping → CampaignAssessmentTier → PricingTier) and the post-payment provisioning (`provisionB2CStudentAndEntitlement`) are already complete. The post-payment auto-login plumbing (`/payment/webhook/status/{linkId}` returning session payload, `PaymentStatusPage` polling on assessment domain) was shipped earlier today. What's missing is the **public-facing entrypoint** — the link a student opens that resolves to a campaign-tier offer, collects registration details, and triggers payment. Today admins can configure campaigns and tiers but have no URL to share.

## Approach

Selected: **Approach 1 — Parallel public surface, shared post-payment.**

- New `/campaign/public/*` endpoints alongside the existing `/assessment-mapping/public/*` (school flow). Different conceptual domains, different inputs.
- Reuses the existing `provisionB2CStudentAndEntitlement` post-payment handler — it already creates User + UserStudent + StudentAssessmentMapping + StudentEntitlement and stamps `userStudentId` on `PaymentTransaction`.
- Reuses `/payment/webhook/status/{linkId}` (auto-login session payload) and the assessment-domain `PaymentStatusPage` we just built.
- New frontend page `CampaignRegisterPage.tsx` on assessment domain handles all three URL shapes via conditional rendering on URL params — single component, three routes.

Rejected:

- **"Unify register endpoint with token polymorphism."** Would conflate institute mappings and campaign tiers behind one endpoint. The "token" abstraction grows type-tagging logic; the shared component bloats with conditional rendering for two distinct UXs.
- **"Greenfield B2C with no reuse."** Re-implements provisioning, auto-login, and polling that already work.

## Scope of changes

### Backend (`spring-social`) — new

- `model/career9/b2c/PromoCodeCampaign.java` — junction entity (`promo_code_id`, `campaign_id`).
- `repository/Career9/b2c/PromoCodeCampaignRepository.java` — JPA repo with `existsByPromoCodeIdAndCampaignId`, `findByPromoCodeId`, `findByCampaignId`, `deleteByPromoCodeId`.
- `controller/career9/b2c/CampaignPublicController.java` (new) at `/campaign/public/*`:
  - `GET /info/{slug}` — campaign + all active assessments + tiers.
  - `GET /info/{slug}/{assessmentId}` — campaign + that assessment + its tiers.
  - `GET /info/{slug}/{assessmentId}/{tierId}` — campaign + assessment + that single tier.
  - `POST /register/{slug}/{assessmentId}/{tierId}` — creates `PaymentTransaction` with `campaignAssessmentTierId`, returns `payment_required` + `paymentUrl` (or session payload on free path).

### Backend — modified

- `PromoCodeController.validatePromoCode`: body now accepts optional `campaignId`. Validation rules in §"Promo code semantics" below.
- `PromoCodeController` gains:
  - `PUT /promo-codes/{id}/campaigns` — set the campaign list (delete-then-insert against junction).
  - `GET /promo-codes/{id}/campaigns` — read the linked campaign IDs.
- `config/SecurityConfig`: add `/campaign/public/**` to permitted-without-auth list (parallel to `/assessment-mapping/public/**`).
- `application.yml`: `app.b2c.frontendBaseUrl` flipped per profile from `dashboard.career-9.com` → `assessment.career-9.com`. Affects `LinkBuilder.campaignLanding(slug)`.

### Backend — reused (no change)

- `provisionB2CStudentAndEntitlement` (lines 294-362 of `PaymentWebhookController`) — already creates User + StudentInfo + UserStudent + StudentAssessmentMapping + StudentEntitlement and stamps `userStudentId`.
- `/payment/webhook/status/{linkId}` (modified earlier today) — already returns session payload when `paid` AND `userStudentId` is populated.
- `EntitlementService.activateOnPayment(transactionId)` — already triggers welcome email + tier-specific service delivery.
- `RazorpayService.createPaymentLink` — already used by `AssessmentInstituteMappingController.createPaymentAndRedirect`.
- `CampaignResolutionService` — for resolving `purchasePath` and `counsellingModel` (mapping override or campaign default).

### Assessment domain (`career-nine-assessment`) — new

- `pages/CampaignRegisterPage.tsx` — single component, three URL shapes, conditional rendering.
- `api-clients/campaignAPI.ts` — `getCampaignInfo()` (overloaded for the three URL shapes), `registerForCampaignTier()`.
- `App.tsx` adds three routes: `/c/:slug`, `/c/:slug/:assessmentId`, `/c/:slug/:assessmentId/:tierId`.
- `api-clients/promoCodeAPI.ts` — extended to accept optional `campaignId`.

### Assessment domain — reused (no change)

- `PaymentStatusPage.tsx` (shipped earlier today) — already handles polling and auto-login regardless of whether the transaction is school-flow or B2C-flow, since the discriminator is `userStudentId` not transaction type.
- `utils/toast.ts`, `api/http.ts`, `AllottedAssessmentPage.tsx` — unchanged.

### Dashboard (`react-social`) — new

- `pages/B2C/Campaign/components/RegistrationLinks.tsx` — renders the three URL forms per (campaign, assessment, tier) with copy-to-clipboard. Mounted on `CampaignEditPage` after save.
- `pages/PromoCode/components/CampaignPicker.tsx` — multi-select to attach a promo code to one or more campaigns. Added to `PromoCodePage` create/edit form.
- `routing/AppRoutes.tsx` — new `CampaignLandingRedirect` component for `/c/:slug`, `/c/:slug/:assessmentId`, `/c/:slug/:assessmentId/:tierId`. Cheap insurance against any test-sent emails containing dashboard `/c/...` URLs from when `LinkBuilder.frontendBaseUrl` still pointed there.

### Dashboard — modified

- `pages/PromoCode/API/PromoCode_APIs.ts` — new `getPromoCodeCampaigns(id)` and `setPromoCodeCampaigns(id, campaignIds[])` clients.
- `pages/PromoCode/PromoCodePage.tsx` — wires the `CampaignPicker` into the form lifecycle.
- `pages/B2C/Campaign/CampaignEditPage.tsx` — mounts `RegistrationLinks` after save.

## Data model

### New: `promo_code_campaigns` junction table

```java
@Entity
@Table(
  name = "promo_code_campaigns",
  uniqueConstraints = @UniqueConstraint(columnNames = {"promo_code_id", "campaign_id"})
)
public class PromoCodeCampaign {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "promo_code_id", nullable = false)
    private Long promoCodeId;

    @Column(name = "campaign_id", nullable = false)
    private Long campaignId;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @PrePersist void prePersist() { if (createdAt == null) createdAt = new Date(); }
    // getters/setters
}
```

Hibernate `ddl-auto: update` creates the table on next backend boot.

### `PromoCode` itself: no schema change

Promo metadata (code, discount, expiry, max uses) stays on the existing entity. Scoping is purely via the junction.

### Promo code semantics

| Junction state | School flow (existing) | Campaign flow (new) |
|---|---|---|
| 0 rows | Valid (preserves existing global behavior) | Rejected — "Code not valid for this campaign" |
| ≥ 1 rows, current campaign in junction | Rejected — "Code is for a specific campaign — open the campaign link to use it" | Valid |
| ≥ 1 rows, current campaign NOT in junction | Rejected — same as above | Rejected — "Code not valid for this campaign" |

Today's existing school-flow promo codes have no junction rows, so their behavior is preserved unchanged.

### No other entity changes

`Campaign`, `CampaignAssessmentMapping`, `CampaignAssessmentTier`, `PricingTier` are already complete for this work. `PaymentTransaction` already has `campaignAssessmentTierId`.

## Backend public endpoints

### `GET /campaign/public/info/{slug}`

Response shape:

```json
{
  "campaign": {
    "campaignId": 12, "name": "...", "slug": "career-explorer-2026",
    "brandLogoUrl": "...", "targetAudience": "Class 11-12",
    "description": "...", "validFrom": "...", "validTo": "..."
  },
  "assessments": [
    {
      "assessmentId": 7, "assessmentName": "Career Aptitude Test", "isActive": true,
      "purchasePath": "B", "counsellingModel": "1",
      "tiers": [
        {
          "campaignAssessmentTierId": 33, "tierId": 4,
          "name": "Basic", "description": "...",
          "basePriceInr": 999, "priceInr": 999,
          "currency": "INR", "isDefault": true,
          "includesFinalReport": true, "includesDashboard": false,
          "includesCounselling": false, "counsellingSessionCount": null,
          "includesLms": false, "lmsValidityDays": null, "dashboardValidityDays": null
        }
      ]
    }
  ]
}
```

`priceInr` = `priceOverrideInr` if set, else `pricingTier.basePriceInr`. Excludes assessments/tiers where `isActive=false` or `isDeleted=true`. `purchasePath` and `counsellingModel` resolved via `CampaignResolutionService` (mapping override or campaign default).

**Failures:** 404 if campaign not found, deleted, or `validTo` in the past.

### `GET /campaign/public/info/{slug}/{assessmentId}` and `/{tierId}`

Same shape, narrowed. `assessments` array contains only the requested one; `tiers` array on it contains only the requested tier (if `tierId` provided). 404 if the IDs don't compose to a valid (campaign, assessment, tier) triplet.

The three `info` paths are implemented in one controller method that branches on which path-vars are present.

### `POST /campaign/public/register/{slug}/{assessmentId}/{tierId}`

Request:

```json
{
  "name": "...", "email": "...", "dob": "dd-MM-yyyy",
  "phone": "", "gender": "",
  "promoCode": ""
}
```

Logic:

1. Resolve campaign by slug → resolve `CampaignAssessmentTier` by (campaignId, assessmentId, tierId). 404 on either.
2. Compute `originalPaise = priceInr * 100`.
3. Validate name/email/dob format; reject 400 on bad input.
4. If `promoCode` present: validate (junction must include this `campaignId`, not expired, under max uses). Compute `finalPaise = originalPaise * (100 - discountPercent) / 100`. Increment `currentUses`.
5. **Email duplicate check (DOB-match tightening, mirrors school flow):** lookup by email globally (`StudentInfoRepository.findByEmail` — B2C is institute-less). If existing student found:
   - DOB matches → attach this assessment + entitlement to existing `UserStudent` (free path) or proceed to payment for them (paid path).
   - DOB mismatch → 400 "This email is already registered with a different date of birth."
6. **Free path** (`finalPaise == 0`):
   - Inline-create User + StudentInfo + UserStudent + `StudentAssessmentMapping` + zero-amount `PaymentTransaction` with `campaignAssessmentTierId` set, `status="paid"`, `userStudentId` stamped.
   - Call `entitlementService.activateOnPayment(transactionId)` to fire welcome email + provision entitlement.
   - Return `{ status: "success", username, dob, userStudentId, assessments: [...] }` — same shape school flow returns; auto-login uses identical frontend code.
7. **Paid path** (`finalPaise > 0`):
   - Create Razorpay payment link via `razorpayService.createPaymentLink(...)` with `notes` containing `campaignAssessmentTierId`, `campaignId`, `assessmentId`, `tierId`.
   - Persist `PaymentTransaction` with `status="created"`, `mappingId=null`, `campaignAssessmentTierId` set, `assessmentId` set, `amount=finalPaise`, student fields populated.
   - Return `{ status: "payment_required", paymentUrl, transactionId, amount }`.
8. **Webhook handles the rest, no new backend code.** Razorpay fires `payment_link.paid` → `handlePaymentLinkPaid` calls `provisionB2CStudentAndEntitlement` (since `txn.getCampaignAssessmentTierId()` is set) → creates User + UserStudent + StudentAssessmentMapping + StudentEntitlement and stamps `userStudentId`. Frontend's `/payment-status` polling picks up `paid` + `userStudentId` and auto-logs in.

### `POST /promo-codes/public/validate` (extension)

Body now: `{ code, campaignId? }`. Validation matrix as in §"Promo code semantics."

### `PUT /promo-codes/{id}/campaigns` and `GET /promo-codes/{id}/campaigns`

```java
@PutMapping("/{id}/campaigns")
public ResponseEntity<?> setCampaigns(@PathVariable Long id, @RequestBody Map<String, Object> req) {
    if (!promoCodeRepository.findById(id).isPresent()) return ResponseEntity.notFound().build();
    @SuppressWarnings("unchecked")
    List<Number> raw = (List<Number>) req.getOrDefault("campaignIds", new ArrayList<>());
    promoCodeCampaignRepository.deleteByPromoCodeId(id);
    for (Number cid : raw) {
        PromoCodeCampaign m = new PromoCodeCampaign();
        m.setPromoCodeId(id);
        m.setCampaignId(cid.longValue());
        promoCodeCampaignRepository.save(m);
    }
    return ResponseEntity.ok(Map.of("status", "ok"));
}

@GetMapping("/{id}/campaigns")
public ResponseEntity<?> getCampaigns(@PathVariable Long id) {
    return ResponseEntity.ok(
        promoCodeCampaignRepository.findByPromoCodeId(id).stream()
            .map(PromoCodeCampaign::getCampaignId).collect(Collectors.toList()));
}
```

## Frontend layered page architecture

### Routes

```tsx
<Route path="/c/:slug" element={<CampaignRegisterPage />} />
<Route path="/c/:slug/:assessmentId" element={<CampaignRegisterPage />} />
<Route path="/c/:slug/:assessmentId/:tierId" element={<CampaignRegisterPage />} />
```

### Component behavior

`CampaignRegisterPage.tsx` reads `useParams()` once at mount, fetches the appropriate `/campaign/public/info/...` endpoint based on which params are present, and conditionally renders three sections:

```
[Campaign Header — always shown: brand logo, name, target audience, description]
   ↓
[Assessment Picker]    ← shown only when assessmentId is NOT in URL
   ↓ (selecting an assessment updates a local state var, doesn't navigate)
[Tier Picker]          ← shown only when tierId is NOT in URL
   ↓ (selecting a tier updates local state)
[Registration Form]    ← shown once a tier is selected/locked
                         (locked = tierId in URL, selected = clicked from picker)
```

Single "current selection" tracked in state: `(selectedAssessmentId, selectedTierId)`. URL params seed it; pickers update it; the form binds against it. No navigation between picker steps — all in-place state changes for conversion-funnel UX.

### Endpoint mapping

| URL | Endpoint hit | Pickers shown |
|---|---|---|
| `/c/:slug` | `GET /campaign/public/info/:slug` | Assessment → Tier → Form |
| `/c/:slug/:aid` | `GET /campaign/public/info/:slug/:aid` | Tier → Form |
| `/c/:slug/:aid/:tid` | `GET /campaign/public/info/:slug/:aid/:tid` | Form (with locked-in tier summary above) |

Invalid IDs in the URL → backend 404 → page shows the existing "Link Unavailable" error UI (ported from school flow).

### Form

Same five fields as school flow minus class/section: name (req), email (req), dob (req with dd-mm-yyyy mask), phone (opt), gender (opt). Plus promo code section (mirrors school flow's `handleApplyPromo` / `handleRemovePromo`, but `validatePromoCode` now passes `campaignId`).

Submit response handling:

- `status: "success"` + `userStudentId` + `assessments` → free path: write localStorage, navigate to `/allotted-assessment`.
- `status: "payment_required"` + `paymentUrl` → `window.location.href = paymentUrl`. Razorpay redirects to `/payment-status` post-payment.
- 400 with impersonation-block message → `showErrorToast(message)`, form stays for retry.

### `<TierCard>` primitive

Reused for tier picker entries and the locked-tier summary card:

- Tier name as title
- Price line: `INR {priceInr}` with strikethrough on `basePriceInr` if `priceOverrideInr` is set
- Feature list derived from boolean `includes*` fields (final report, counselling sessions, dashboard validity, LMS validity)
- "Recommended" badge if `isDefault`
- "Select" button (picker mode) or no button (summary mode)

### What's NOT in the page

- No assessment-START token logic. Post-registration, student lands on `/allotted-assessment` (assessment domain, same-origin). Existing `EntitlementService.assessmentStart(accessToken, entitlementId)` email link remains for out-of-session access from a different device LATER, unchanged.
- No campaign-validity countdown / urgency UI. If `validTo` passed, backend 404s and we show the error state.
- No tier upgrade flow from inside the assessment dashboard. `LinkBuilder.upgradeFromOnePager` is a separate untouched feature.

## Admin UI changes

### `RegistrationLinks` component on `CampaignEditPage`

Mounted after a campaign is saved (so `id` and `slug` exist). Layout:

```
─── Public Registration Links ──────────────────────────────
   Share these URLs to drive students to register and pay.

   Campaign-wide link:
   https://assessment.career-9.com/c/{slug}                [Copy]
   Shows all assessments and tiers in this campaign.

   Per-assessment & per-tier links:

   ┌── Career Aptitude Test ─────────────────────────────┐
   │  Assessment-only link (shows tier picker):           │
   │  /c/{slug}/{assessmentId}                  [Copy]    │
   │                                                       │
   │  Per-tier deep links (skips picker):                  │
   │   • Basic    /c/{slug}/{aid}/{tierId-1}    [Copy]    │
   │   • Premium  /c/{slug}/{aid}/{tierId-2}    [Copy]    │
   └───────────────────────────────────────────────────────┘
```

URL builder reuses `process.env.REACT_APP_ASSESSMENT_APP_URL` (already populated in dashboard env files for the school flow). Copy-to-clipboard uses the same `setCopySuccess` pattern from `AssessmentMappingPanel.tsx`.

Data needed (campaign + assessments + tiers) is already returned by existing `GET /campaign/get/{id}` via `toFullDto`. No backend change for the admin side.

### Promo-code → campaigns mapping in `PromoCodePage`

New field in promo-code create/edit form: **"Restrict to campaigns"** with two states:

- **Available everywhere (school flow only — current behavior).** Default for existing codes. Saves no junction rows.
- **Restrict to specific campaigns.** Multi-select picker over active campaigns. Saves the picked campaign IDs to the junction.

Save flow:
1. `PUT /promo-codes/{id}` (existing endpoint, unchanged) for the code itself.
2. `PUT /promo-codes/{id}/campaigns` (new) with `campaignIds: [...]`.

### `CampaignLandingRedirect` on dashboard `AppRoutes.tsx`

Three new routes paralleling the existing `RedirectAssessmentRegister`/`RedirectPaymentStatus` from the school-flow plan:

```tsx
<Route path="/c/:slug" element={<CampaignLandingRedirect />} />
<Route path="/c/:slug/:assessmentId" element={<CampaignLandingRedirect />} />
<Route path="/c/:slug/:assessmentId/:tierId" element={<CampaignLandingRedirect />} />
```

The redirect component pulls `useParams()` and forwards to `${process.env.REACT_APP_ASSESSMENT_APP_URL}/c/${slug}/...` preserving query string. Cheap insurance for any test-sent emails containing stale dashboard `/c/...` URLs from before `app.b2c.frontendBaseUrl` flips.

### Unchanged elsewhere

- `PricingTierPage`, `TrackerPage` (B2C tracker auto-includes new transactions via existing `TrackerController`).
- `AssessmentMappingPanel` (school flow) — unchanged.

## User flows

### A — Open `/c/{slug}`, pick assessment + tier, free tier or 100% promo

```
Student → assessment.career-9.com/c/career-explorer-2026
       → page fetches /campaign/public/info/career-explorer-2026
       → renders assessment grid → student picks an assessment
       → renders tier grid → student picks a free/100%-promo tier
       → form fills → submit
       → backend register: free path, inline-creates everything,
         entitlementService.activateOnPayment, returns session
       → page writes localStorage, navigate /allotted-assessment
```

### B — Open `/c/{slug}/{assessmentId}/{tierId}`, paid tier

```
Student → assessment.career-9.com/c/.../{aid}/{tid}
       → page fetches narrow /info, renders form with locked tier card above
       → student fills form (with promo code optional)
       → backend register: paid path, creates Razorpay link + PaymentTransaction
       → page navigates to paymentUrl
       → student pays
       → Razorpay redirects to assessment.career-9.com/payment-status
       → PaymentStatusPage polls, sees paid + userStudentId
       → writes localStorage, navigate /allotted-assessment
```

### C — Existing student email + DOB match

```
Student opens campaign link, fills with their existing email and correct DOB
       → backend lookup by email finds StudentInfo
       → DOB matches stored studentDob
       → free path: attach new StudentAssessmentMapping + StudentEntitlement,
         return session
       → page auto-logs in, student sees both old and newly-added assessments
```

### D — Email exists with different DOB (impersonation block)

```
Student submits with classmate's email + own DOB
       → backend rejects 400 "This email is already registered with
         a different date of birth..."
       → toast surfaces it, form stays for retry
```

### E — Promo code valid for THIS campaign

```
Student enters code → frontend validatePromoCode({ code, campaignId })
       → backend: code has junction row matching campaignId, not expired
       → returns 200 { discountPercent }
       → page shows discount applied, register submission carries promoCode
       → backend re-validates and applies on register
```

### F — Promo code NOT valid for this campaign

```
Student enters code → frontend validatePromoCode({ code, campaignId })
       → backend: code has junction rows but none match this campaignId
       → returns 400 "Code not valid for this campaign"
       → toast surfaces it, no discount applied
```

### G — School-flow promo code attempted on campaign link

```
Student enters code → frontend validatePromoCode({ code, campaignId })
       → backend: code has 0 junction rows
       → returns 400 "This code is for a specific campaign —
         open the campaign link to use it"
```

(Counter-intuitive direction-of-travel because the message refers to the school-flow case but encountered on a campaign-flow page. Still clear that the code's wrong scope.)

### H — Old dashboard `/c/{slug}` link clicked (from test emails)

```
Student → dashboard.career-9.com/c/{slug}
       → CampaignLandingRedirect → assessment.career-9.com/c/{slug}
       → resumes Flow A
```

## Edge cases

| # | Case | Handling |
|---|---|---|
| 1 | Campaign not found / deleted / past validTo | Backend 404 → page shows existing error UI |
| 2 | URL has assessmentId not in this campaign | Same 404 |
| 3 | URL has tierId for a different assessment | Same 404 |
| 4 | URL points at inactive tier | Same 404 |
| 5 | priceOverrideInr makes a paid tier free | Free path triggers in register endpoint |
| 6 | Existing student email + matching DOB | Attach + auto-login (Flow C) |
| 7 | Email + DOB mismatch | 400 impersonation block (Flow D) |
| 8 | Promo not mapped to this campaign | 400 (Flow F) |
| 9 | Promo expired / over max uses | Existing 410 GONE responses |
| 10 | Global promo on campaign link | 400 with "different campaign" message (Flow G) |
| 11 | Razorpay tab closed mid-payment | New register attempt creates a fresh link; old expires per Razorpay TTL |
| 12 | Webhook slow, paid arrives before provisioning | /payment-status polling sees paid without userStudentId, keeps polling |
| 13 | Razorpay redirects to old dashboard /payment-status | Existing redirect catches it (Task 11 of school-flow plan) |
| 14 | Promo applied, page reloaded | Promo state lives in component state, not URL — reload clears it. Acceptable. |
| 15 | Same email registers via both school and campaign flows | Both StudentAssessmentMapping rows created if DOB matches. Both visible on /allotted-assessment. No conflict. |
| 16 | Many campaigns mapped to same promo code | Junction supports it; existsByPromoCodeIdAndCampaignId checks correctly |
| 17 | Admin deletes a campaign with promo-code mappings | Soft-delete sets isDeleted=true on Campaign. Junction rows orphan but never referenced (campaign 404s before reaching junction check). Acceptable to clean later. |

## Deploy ordering (immutable)

1. **Backend.** New `PromoCodeCampaign` entity + repository (Hibernate creates table on boot). New `CampaignPublicController`. `validatePromoCode` extension. `PromoCodeController` gains `setCampaigns`/`getCampaigns`. `SecurityConfig` permits `/campaign/public/**`. Additive — no existing endpoint behavior changes.
2. **Backend config.** `app.b2c.frontendBaseUrl` per profile flipped from dashboard to assessment domain. Same `application.yml` (gitignored) — apply on staging/prod servers at restart time. Could be batched with #1 at a single backend deploy.
3. **Assessment frontend.** New `CampaignRegisterPage`, routes, `campaignAPI` client, `promoCodeAPI` extended. Until #1 lands, the routes 404 the backend info call and show "Link Unavailable" — no breakage.
4. **Dashboard frontend.** `RegistrationLinks` on `CampaignEditPage`, promo-code campaign-mapping UI on `PromoCodePage`, `CampaignLandingRedirect` routes on `AppRoutes.tsx`. Until this lands, admins build URLs by hand — backward-compatible.

Each phase deploys independently behind a staging smoke test. No flag day.

## Backwards compatibility

- Existing school-flow promo codes (no junction rows): unchanged. School flow's `validatePromoCode` sends no `campaignId` → backend's "no junction rows" branch validates them.
- New B2C campaign promo codes never reach school flow (junction rows present → rejected with the "for a specific campaign" message).
- `app.b2c.frontendBaseUrl` flip affects only emails/links generated by `LinkBuilder` AFTER deploy. Already-sent welcome emails with `dashboard.career-9.com/c/{slug}` URLs continue to work via the new `CampaignLandingRedirect`.
- No existing entity mutated. `PaymentTransaction` already had `campaignAssessmentTierId`. `PromoCode` itself untouched. Schema additions are purely additive (one new junction table).

## Rollback

- **Step 4 (dashboard FE):** revert commits. Admins lose the new UI section; manually-constructed URLs still work. No user impact.
- **Step 3 (assessment FE):** revert commits. Routes `/c/...` 404 to `/student-login` (existing wildcard). In-flight payment polling continues working — `/payment-status` is unrelated to the registration page.
- **Step 2 (config):** revert `application.yml`, restart backend. New emails generate dashboard `/c/...` URLs again, which the redirect component (if step 4 still deployed) catches. If step 4 also reverted, dashboard 404s `/c/...` to its wildcard. Acceptable mid-rollback.
- **Step 1 (backend):** revert commits. New table stays (Hibernate doesn't drop). `/campaign/public/*` endpoints 404 → assessment-FE pages show "Link Unavailable." `validatePromoCode` reverts to ignoring `campaignId`. School-flow promo code calls keep working unchanged.

## Future work (deferred from this spec)

- **Per-campaign configurable demographic fields.** Extend `DemographicFieldDefinition` with a new `CampaignDemographicMapping` junction so admins can attach extra required/optional fields to specific campaigns (e.g., "occupation," "city," custom marketing-segmentation fields). The MVP form is fixed at name/email/dob/phone/gender. To pick this up later: build admin UI on `CampaignEditPage` paralleling existing `AssessmentDemographicMapping` admin, add `additionalFields` to the `info` response, render them in `CampaignRegisterPage` form, persist to `StudentDemographicResponse` in the register handler.
- **Slug fields on `AssessmentTable` and `PricingTier`** for prettier deep-link URLs (would replace numeric segments in `/c/:slug/:assessmentId/:tierId`).
- **Free-trial CTA on the campaign page.** Existing `start-free-trial` endpoint stays as-is, accessed via a different surface today.
- **Tier upgrade flow from inside the assessment dashboard.** `LinkBuilder.upgradeFromOnePager` is unimplemented; out of scope here.
- **Campaign-landing storefront UI** beyond simple grid (hero sections, testimonials, urgency banners). Visual polish, separate design effort.

## Open questions resolved during brainstorming

- Q: Granularity of links? **A: All three (per-campaign, per-assessment, per-tier).**
- Q: How do the three URL types relate? **A: Layered single component on assessment domain.**
- Q: Where does the public page live? **A: Assessment domain (same-origin auto-login).**
- Q: Form fields? **A: name/email/dob/phone/gender — same as school minus class/section. Configurable-per-campaign deferred to future.**
- Q: Promo codes in MVP? **A: Yes, included.**
- Q: Promo-code scoping to campaigns? **A: Junction table; many-to-many; preserves existing school-flow semantics.**
- Q: Approach? **A: Approach 1 — parallel public surface, shared post-payment.**
