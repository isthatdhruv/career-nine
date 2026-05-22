# Assessment Mapping — Pricing Tiers Design

**Date:** 2026-05-22
**Status:** Approved (design)
**Branch:** `feat/assessment-mapping-pricing-tiers`

## Summary

Add **pricing tiers** to the `AssessmentInstituteMapping` system, replacing the single
`amount` price on a mapping with an ordered list of tiers. Each tier has a price and a
registration cap; the lowest-sort-order active tier whose cap is not yet reached is the
**live** price. When a tier's cap is exhausted, the next tier automatically becomes live.

Motivating use case: send a school a *pilot* link priced for the first N students (e.g.
₹0 for 100 students), after which pricing automatically switches to the *main* tier for
the next batch — with no manual intervention.

## Scope

- **In scope:** pricing tiers on `AssessmentInstituteMapping` (the token-based,
  externally-redirected mapping that already supports INSTITUTE / SESSION / CLASS /
  SECTION levels); admin CRUD for tiers; tier-aware public info + registration; tally
  upkeep; data migration; authorization on admin endpoints.
- **Out of scope (separate efforts):**
  - Unifying the two B2B admin panels / retiring `SchoolAssessmentConfig` (tracked in
    `project_assessment_mapping_unification`). Tiers are built on
    `AssessmentInstituteMapping` precisely because it is the model that survives that
    unification.
  - The B2C `Campaign` / `CampaignAssessmentTier` system — this is a **separate** tier
    entity and is not modified.
  - Entitlement / "what the student receives" features. B2B tiers are **price + cap
    only**; every tier delivers the same assessment and report.

## Key decisions (from brainstorming)

1. **Tier attachment:** per link/mapping. Each `AssessmentInstituteMapping` row owns its
   own independent tier set.
2. **Slot consumed:** on **successful completion** only — free tier: student created;
   paid tier: payment confirmed (Razorpay webhook). Abandoned/failed payments do not
   consume a slot.
3. **Tier entity:** a **new, standalone** B2B tier table, separate from the B2C
   `CampaignAssessmentTier`. Price + cap only — no feature flags, no entitlements.
4. **Active-tier resolution:** **stored per-tier tally** (`currentCount`), matching the
   existing school shared-link `currentCount` / `maxRegistrations` pattern. Drift is
   mitigated by decrement-on-delete/refund and an admin "recount" backstop.
5. **Authorization:** add `@PreAuthorize(@auth.allows(...))` to the admin mapping + tier
   endpoints (currently unprotected by convention). Public token-gated endpoints stay
   anonymous.

## Data model

### New table `assessment_mapping_tier` (entity `AssessmentMappingTier`)

| Column | Type | Notes |
|---|---|---|
| `tier_id` | Long PK, identity | |
| `mapping_id` | Long, FK → `assessment_institute_mapping.mapping_id`, not null | owner; tiers are per-link |
| `name` | String, not null | e.g. "Pilot", "Main" |
| `amount` | Long | price in ₹; `0` = free tier |
| `sort_order` | Integer, not null | lower = earlier |
| `max_registrations` | Integer, nullable | `null`/`0` = unlimited (terminal tier) |
| `current_count` | Integer, not null default 0 | the tally; incremented on completion |
| `is_active` | Boolean, not null default true | the activate/deactivate toggle |
| `created_at` / `updated_at` | timestamps | |

**Unique constraint:** `(mapping_id, sort_order)` — keeps ordering unambiguous per mapping.
**Index:** `(mapping_id, is_active, sort_order)` for fast active-tier resolution.

### `AssessmentInstituteMapping.amount`

Superseded by tiers but **retained** for backward compatibility: if a mapping has no
tier rows, the system falls back to treating `amount` as a single implicit unlimited
tier. Migration backfills a default tier for existing priced mappings (see Migration).

## Active-tier mechanics

- **Active tier** = the `is_active` tier with the lowest `sort_order` whose
  `current_count < max_registrations` (a `null`/`0` cap is unlimited and always
  qualifies).
- **Tally increment** on successful completion:
  - Free path: increment the chosen tier's `current_count` at student creation, inside
    the registration transaction.
  - Paid path: increment in the Razorpay webhook when the transaction flips to `paid`.
- **Tier attribution (single source for recount):** every tiered completion — free *and*
  paid — records a `PaymentTransaction` carrying the new nullable column
  `mapping_tier_id`. Free completions record a **zero-amount** `PaymentTransaction`
  (`status = paid`), reusing the pattern the codebase already uses for the 100%-promo
  free case. Paid completions stamp `mapping_tier_id` at *attempt* time and confirm via
  the webhook. This gives one queryable source so **recount** can rebuild `current_count`
  as `count(PaymentTransaction where mapping_tier_id = ? and status = 'paid')`, and it
  honors the student at the price they were quoted even if the tier flips mid-payment.
- **Exhaustion:** if every active tier is full and none is unlimited, the link reports
  `registrationClosed: true`. Admin guidance: make the last tier unlimited unless a hard
  stop is intended.
- **Drift safeguards:** decrement `current_count` on registration delete / payment refund
  where detectable; plus admin **recount** endpoint that rebuilds `current_count` from
  actual completed registrations.

> Note on the tally choice: a stored counter is O(1) to read and matches the existing
> school-link pattern, at the cost of possible drift on deletes/refunds — addressed by
> the decrement + recount safeguards above. Near a cap boundary, payments in flight may
> let a few extra students see the cheaper tier; this is acceptable under the
> "count on completion" rule.

## Backend API

### Admin tier endpoints (protected via `@auth.allows()`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/assessment-mapping/{mappingId}/tiers` | list tiers (incl. `currentCount`) |
| POST | `/assessment-mapping/{mappingId}/tiers` | create tier (`name`, `amount`, `sortOrder`, `maxRegistrations`, `isActive`) |
| PUT | `/assessment-mapping/tiers/{tierId}` | edit tier |
| PATCH | `/assessment-mapping/tiers/{tierId}/toggle` | flip `isActive` |
| DELETE | `/assessment-mapping/tiers/{tierId}` | delete tier |
| POST | `/assessment-mapping/tiers/{tierId}/recount` | rebuild `currentCount` (drift backstop) |

`POST /assessment-mapping/create` gains an optional `tiers[]` array so the create form can
persist a mapping and its tiers in one call. Subsequent edits use the tier endpoints.

### Existing admin endpoints — authorization added

`create`, `getAll`, `getByInstitute`, `get/{id}`, `update/{id}`, `delete/{id}` gain
`@PreAuthorize(@auth.allows(...))` consistent with the codebase convention.

### Public endpoints (anonymous, token-gated — unchanged auth)

- `GET /assessment-mapping/public/info/{token}` — resolves the active tier server-side.
  **Backward-compatible:** still returns `amount` (now equal to the active tier's amount),
  plus additive fields `activeTierName` and `registrationClosed`. No external-app change
  required.
- `POST /assessment-mapping/public/register/{token}` — re-resolves the active tier
  **server-side** (never trusts a client-sent price), stamps `mapping_tier_id` on the
  registration / `PaymentTransaction`, and increments that tier's `current_count` on
  completion (free: inline; paid: webhook).

## Frontend (admin) UX

In the mapping create/edit form, the single **amount input is replaced by a "Manage
Tiers" button** with a summary line (e.g. "2 tiers · live: Pilot ₹0").

- **Tier List Modal** (opened from the button): lists each tier with name, amount, sort
  order, a `currentCount / maxRegistrations` progress indicator (e.g. "47 / 100"), and
  the **activate/deactivate toggle**. The currently-live tier is badged. Contains an
  **"Add Tier"** button.
- **Add/Edit Tier Modal** (second modal): captures `name`, `amount`, `sortOrder`,
  `maxRegistrations` (blank = unlimited), and the active toggle. Save / Cancel.
- **Create flow:** tiers are collected in form state via the modals and saved with the
  mapping (`tiers[]` on `/create`).
- **Edit flow:** modal actions call the tier endpoints directly.

## Migration

- For every existing `AssessmentInstituteMapping` with a non-null `amount`, create one
  tier: `{ name: "Standard", amount: <existing>, sortOrder: 1, maxRegistrations: null,
  currentCount: 0, isActive: true }`. Unlimited cap ⇒ pricing unchanged.
- Mappings with no amount remain free (no tier created; fallback path treats them as
  free).
- `PaymentTransaction` gains a nullable `mapping_tier_id` column.

## External app contract

No coordinated deploy required. `public/info` keeps returning `amount` (now the active
tier's price); new fields are additive. The external assessment app may later display
`activeTierName`, but is not required to change.

## Testing

- **Unit:** active-tier resolution (lowest active sort_order under cap; unlimited
  terminal; all-exhausted ⇒ closed); tally increment on free vs paid completion;
  decrement on delete/refund; recount rebuild.
- **Integration:** create mapping with tiers; public info reflects live tier; register
  free student increments tally and flips tier at cap; paid register stamps
  `mapping_tier_id`, webhook confirms + increments; exhausted link returns
  `registrationClosed`.
- **Migration:** existing priced mapping yields one unlimited "Standard" tier; pricing
  unchanged before/after.
- **Auth:** admin tier/mapping endpoints reject unauthorized callers; public token
  endpoints remain anonymous.
