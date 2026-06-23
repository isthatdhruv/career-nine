# B2B Unified Assessment-Mapping — Redesign Spec

**Branch:** `dhruv-from-palak` · **Status:** design locked, not yet implemented · **Date:** 2026-06-06

This document describes **what changes functionally and logically**, then **the user and system flows** for the redesigned B2B assessment-mapping experience.

---

## 1. Intent

Today there are **two separate B2B mapping systems** with two UI panels, two backend controllers, two tier tables, two public registration pages, **no real free-vs-paid link distinction**, and **no way to grant report/dashboard/counselling/LMS access** to B2B students at all. The redesign collapses them into:

1. **One unified mapping area** — map an assessment and generate links **per institute / per session / per class / per section, all in one place**.
2. **A direct Institute↔Assessment catalog table** — an assessment is first "mapped to" an institute (set in the institute-creation wizard), decoupled from per-level registration links.
3. **Two link types for every level** — a **paid** link (priced via sequential-wave tiers) and an **always-free** link (a zero-price tier), both pointing at the assessment app.
4. **Real service grants** — every registration mints a `StudentEntitlement` (the same mechanism B2C uses) so report / dashboard / counselling / LMS access is actually granted and enforced — for **free links too**.
5. **A free→paid upgrade path** — a free-registered student can later pay to add services (mirrors the B2C PayForReport upsell).

### Locked decisions

| Concern | Decision |
|---|---|
| Mapping page | One unified area; the School/Detail toggle is removed |
| Institute↔assessment | New `institute_assessment` catalog; wizard Step 3 = catalog picker; mapping page upserts it on every link create; backfilled from both legacy sources |
| Two links | `free_token` + `paid_token` per mapping row; per-link active toggles; explicit `linkType` in public info |
| Free-link inclusions | **The free link is a designated zero-price `is_free` tier** carrying the inclusion toggles + its own cap (one inclusion + one cap mechanism for both links) |
| Unified level | New `INSTITUTE` level; student picks session + class + section at registration |
| Paid tiers | Sequential-wave auto-resolve (one current price, no student picker) |
| Service grants | **Every registration mints a `StudentEntitlement`** from the resolved tier — reuses the B2C entitlement gates as-is (`campaign_id = null`) |
| Free→paid upgrade | Supported — a free student pays the current active paid wave to upgrade their entitlement |
| School flow | Folded in & deprecated: new links use the unified model; existing `/school-register` tokens keep working; existing configs/tiers backfilled into the unified model |

---

## 2. Current state (what exists today)

| System | Tables | Public page | Tiers | Token model |
|---|---|---|---|---|
| **Per-level flow** (Class/Section/Session panel + wizard Step 3) | `assessment_institute_mapping`, `assessment_mapping_tier` | `/assessment-register/{token}` | per `mapping_id`, has report/counselling/LMS toggles | 1 token per mapping row |
| **School-Level flow** (School Level panel) | `school_assessment_config`, `school_registration_link`, `school_assessment_tier` | `/school-register/{token}` | per `(institute, session, assessment)`, no toggles | 1 token per `(institute, session)` |

Problems this redesign fixes (full list in §9):

- **No institute↔assessment table** — only a `DISTINCT` query.
- **Free vs paid is fake** — one token per mapping; "Free" and "Paid" URLs are byte-identical; free-vs-paid is decided only by `amount > 0` at registration time.
- **Sold-out renders as free** — when a paid tier's cap is hit, the backend returns `amount = 0` and the app lets students register free.
- **Service toggles grant nothing** — B2B provisioning creates **no `StudentEntitlement`**, so report/dashboard/counselling/LMS access is never granted (paid *or* free), and `includes_dashboard` doesn't even exist on the B2B tier.
- **Security inconsistency** — school public endpoints carry `@PreAuthorize`; per-level ones rely on `PUBLIC_PATHS`.
- **`payment_transaction.mapping_tier_id` overloaded** across two tier tables.
- **Institute PK bug** — `institute_code` is an auto-generated PK but the wizard collects a typed code; Step 3 can target the wrong institute.

---

## 3. Target data model

Four layers replace the two parallel systems.

### Layer 1 — Institute↔Assessment catalog (NEW)

```
TABLE institute_assessment
  id              BIGINT  PK IDENTITY
  institute_code  INT     NOT NULL   -> institute_detail_new.institute_code
  assessment_id   BIGINT  NOT NULL   -> assessment_table.id
  is_active       BOOLEAN DEFAULT TRUE
  created_at / updated_at TIMESTAMP
  UNIQUE (institute_code, assessment_id)
```

*"Which assessments this institute offers."* Set in wizard Step 3; kept in sync by the mapping page; backfilled from both legacy sources.

### Layer 2 — Per-level registration mappings (EXTEND `assessment_institute_mapping`)

```
ALTER assessment_institute_mapping ADD:
  free_token  VARCHAR(36) UNIQUE       -- always-free link
  paid_token  VARCHAR(36) UNIQUE       -- tier-priced link (= legacy `token` after backfill)
  free_active BOOLEAN DEFAULT TRUE      -- toggle the free link
  paid_active BOOLEAN DEFAULT TRUE      -- toggle the paid link
  migrated_from_school_config_id BIGINT NULL   -- idempotency marker for the school backfill

mapping_level now accepts: INSTITUTE | SESSION | CLASS | SECTION
```

- `is_active` (existing) = master switch for the mapping; `free_active`/`paid_active` toggle each link.
- **No `free_max_registrations`/`free_current_count` columns** — the free link's cap lives on its free tier (Layer 3).
- Legacy `token` retained for back-compat; `amount` on the mapping is **deprecated** (every link is now tier-backed).

### Layer 3 — Tiers (EXTEND `assessment_mapping_tier`)

```
ALTER assessment_mapping_tier ADD:
  is_free                   BOOLEAN DEFAULT FALSE   -- designates THE free tier (amount must be 0)
  includes_dashboard        BOOLEAN DEFAULT FALSE   -- parity with B2C PricingTier
  dashboard_validity_days   INT     NULL
```

Two kinds of tier per mapping:

| Tier kind | `is_free` | `amount` | Backs | Cap |
|---|---|---|---|---|
| **Free tier** (exactly one per mapping) | `true` | `0` | `free_token` | its `max_registrations`/`current_count` |
| **Paid wave tiers** (0..N) | `false` | `> 0` | `paid_token` | each wave's `max_registrations`/`current_count` |

Both kinds carry the full inclusion set: `includes_final_report`, `includes_dashboard`(+`dashboard_validity_days`), `includes_counselling`(+`counselling_session_count`), `includes_lms`(+`lms_validity_days`). Paid waves resolve via `resolveActiveTier` (lowest `sort_order` with cap room). The free tier is resolved directly by `free_token`.

### Layer 4 — Service grants (REUSE B2C `StudentEntitlement`)

`student_entitlements` (Hibernate-managed) is reused unchanged for gating. Relevant columns:
`user_student_id`, `campaign_id` (**null for B2B**), `assessment_id`, `payment_transaction_id`, `status` (`pending`→`active`→`expired`/`revoked`/`refunded`), `granted_at`, `expires_at`, `final_report_active`, `dashboard_active`(+`dashboard_expires_at`), `counselling_active`(+`counselling_sessions_total`/`_used`), `lms_active`(+`lms_expires_at`), `access_token`(unique, 30d TTL).

**One new nullable column for B2B:** `mapping_id` (so a B2B entitlement knows its source mapping and the upgrade can resolve that mapping's paid wave). `campaign_id` stays null for B2B; `mapping_id` is set — symmetric with the `payment_transaction` discriminator pattern.

**The gates reuse as-is:** `InsightAccessService.evaluate(userStudentId, assessmentId)` and the token-gated report/dashboard/counselling/LMS endpoints read only `(userStudentId, assessmentId)` + the entitlement's boolean flags — never `campaign_id`. A B2B entitlement passes them with no gating-code change.

### Relationship diagram

```
institute_detail_new (PK institute_code)
   ├──< institute_assessment            (NEW catalog: institute ⇄ assessment, unique pair)
   └──< assessment_institute_mapping    (per-level links; free_token/paid_token + active flags)
            level ∈ {INSTITUTE, SESSION, CLASS, SECTION}
            └──< assessment_mapping_tier
                    is_free=true  (amount 0, inclusions, cap)   ── FREE link
                    is_free=false (waves: price + cap + inclusions) ── PAID link

registration/upgrade -> student_entitlements (campaign_id=null, mapping_id set, flags from tier)
                        -> reused by InsightAccessService + report/dashboard/counselling/LMS gates
```

---

## 4. Functional & logical changes by subsystem

### 4.1 Database / migrations (ordered after `V20260605002`)

| Migration | Change |
|---|---|
| `…__institute_assessment_catalog.sql` | Create `institute_assessment` (guarded). Backfill `DISTINCT (institute_code, assessment_id)` from `assessment_institute_mapping` (active) ∪ `school_assessment_config` (active), deduped. |
| `…__assessment_mapping_dual_links.sql` | Add `free_token`/`paid_token`/`free_active`/`paid_active`/`migrated_from_school_config_id`. Backfill `paid_token = token`; mint a fresh `free_token` per row. |
| `…__assessment_mapping_tier_free_and_dashboard.sql` | Add `is_free`, `includes_dashboard`, `dashboard_validity_days` to `assessment_mapping_tier`. **Backfill: create one `is_free=true`, `amount=0` tier for every existing mapping** (so each existing `free_token` works), inclusions default FALSE. |
| `…__student_entitlement_mapping_id.sql` | Add nullable `mapping_id` to `student_entitlements`. |
| `…__school_flow_backfill.sql` | For each active `school_assessment_config`: insert a `CLASS`-level `assessment_institute_mapping` (free/paid tokens, `migrated_from_school_config_id`), plus its free tier; clone matching `school_assessment_tier` → paid `assessment_mapping_tier` rows. Idempotent (skip already-migrated). |

Tables are Hibernate `ddl-auto`-managed (one datasource is `validate`), so every new column must also exist via Flyway with names/types matching the `@Column` annotations; Flyway runs before Hibernate on boot. All DDL `IF NOT EXISTS`-guarded.

### 4.2 Backend — catalog

- New `InstituteAssessment` entity + repo (`existsByInstituteCodeAndAssessmentId`, `findByInstituteCodeAndIsActive`) + service with idempotent upsert.
- Admin endpoints (reuse `assessment_institute_mapping.*` perms): `GET/POST /assessment-mapping/institute/{instituteCode}/catalog`, `PATCH …/catalog/{id}/toggle`, `DELETE …/{id}`. POST **respects `InstituteDetail.maxAssessments`** if set.
- `createMapping` (any level) **upserts the catalog row** for `(institute, assessment)`.

### 4.3 Backend — dual links, free tier, `INSTITUTE` level

- `createMapping` mints both tokens **and auto-creates the mapping's free tier** (`is_free=true`, `amount=0`, no inclusions by default). Validates `mapping_level` against the 4-value set; `INSTITUTE` stores no session/class/section.
- Token resolver: `findByPaidToken` → `findByFreeToken` → `(mapping, linkType)`.
- `GET /public/info/{token}` returns explicit **`linkType: FREE | PAID`** plus:
  - **FREE** → inclusions/cap from the `is_free` tier; `registrationClosed` if `!free_active` or free-tier cap hit.
  - **PAID** → `resolveActiveTier` over non-free tiers; **`registrationClosed` honored** (no silent free); returns `activeTierName`/`amount`.
  - **INSTITUTE level** → `availableSessions[]` (classes → sections) for the SPA cascade.
- `POST /public/register/{token}` branches on `linkType`; **both branches end by minting a `StudentEntitlement`** from the resolved tier (§4.5). FREE increments the free tier's cap; PAID runs the wave logic (Razorpay or 0/100%-promo free).
- New admin endpoints: per-link toggle (`PATCH …/{mappingId}/link/{free|paid}/toggle`). Free-tier cap is edited through the normal tier endpoints (it's a tier).
- `mapping_level` becomes a validated enum/constant set.

### 4.4 Backend — entitlement (the access grant)

- New `B2BEntitlementService.activateFromMappingTier(userStudentId, assessmentId, mappingId, mappingTier, paymentTransactionId)`:
  - Find-or-create by `(userStudentId, assessmentId)` (code-dedup, same as B2C — no DB unique key exists).
  - Map tier → entitlement: `includes_final_report→final_report_active`, `includes_dashboard→dashboard_active`(+`dashboard_expires_at = now+days`), `includes_counselling→counselling_active`(+`counselling_sessions_total`), `includes_lms→lms_active`(+`lms_expires_at = now+days`); `expires_at` = earliest window; `campaign_id=null`, `mapping_id` set, `status=active`, `granted_at=now`; mint `access_token` (30d).
  - **Always created on every registration** (free or paid), even when the free tier grants nothing — it's the access record *and* the upgrade anchor.
- Existing B2C gates (`InsightAccessService`, report/dashboard/counselling/LMS token endpoints, expiry sweep) consume it unchanged.

### 4.5 Backend — free→paid upgrade

- `GET /assessment-mapping/public/upgrade-info/{entitlementId}` → from the entitlement's `mapping_id`, resolve the current active **paid wave** + its inclusions + price.
- `POST /assessment-mapping/public/pay-for-upgrade {entitlementId}` → create a `created` `PaymentTransaction` (`mapping_id`, `mapping_tier_id` = active paid wave, `user_student_id`, `entitlementId` in notes, an upgrade marker) + Razorpay link.
- Webhook: on paid, **upgrade the existing entitlement** (re-snapshot from the paid tier — overwrite flags, recompute expiries; keep `status=active`). It does **not** create a new student. *(Default: upgrade buys the current active paid wave. Implementation guard: if the paid tier isn't a superset of the free inclusions, union the flags so nothing is lost.)*
- Assessment app gets a B2B upsell screen (mirror `PayForReportPage`).

### 4.6 Backend — school fold-in / deprecation

- New links all go through the unified model. `SchoolRegistrationController` admin create paths are no longer called by the UI.
- **Legacy `/school-register/{token}` public read + register stay live** for already-distributed links.
- Existing school data surfaces in the new UI via the §4.1 backfill. New tiers are always `assessment_mapping_tier` → ends the `mapping_tier_id` overload going forward.

### 4.7 react-social admin

- `AssessmentMappingPage` → **single area** (drop the School/Detail toggle).
- New unified panel: **catalog strip** + **per-assessment level picker** (Institute/Session/Class/Section) + **bulk class-grid** + **existing-mappings table** with a **Free link** (copy/QR + toggle) and a **Paid link** (copy/QR + Manage Tiers + toggle), using **distinct tokens**.
- **Tier modal gains:** an inclusion panel (Report / Dashboard / Counselling+sessions / LMS+days) on every tier, including the **free tier** ("Free link includes…"), plus the free-tier cap. Dashboard toggle added.
- **Wizard Step 3 → catalog picker** (multi-select writing `institute_assessment`); per-level link creation lives only on the mapping page.
- **Fix the institute-PK bug** — adopt the server-assigned `institute_code` before Step 2/3.
- API module gains catalog + dual-token + toggle + upgrade calls; the misleading "Paid (Dashboard)" label corrected.

### 4.8 Assessment app (`career-nine-assessment`)

- `/assessment-register/:token` reads **`linkType`** (FREE → no payment UI; PAID → single resolved wave price, no picker), **honors `registrationClosed`** (sold-out state), and handles the **INSTITUTE** session→class→section cascade.
- New **B2B upgrade screen** (mirror `PayForReportPage`) reachable by a free student to add services → `pay-for-upgrade`.
- Legacy `/school-register/:token` untouched.

---

## 5. User flows

### 5.1 Admin — onboard an institute (wizard)
1. **Step 1 – Basic Info** → Save *(system adopts the server-assigned `institute_code`)*.
2. **Step 2 – Session Details** → sessions → classes → sections.
3. **Step 3 – Map Assessments (catalog)** → multi-select assessments → `institute_assessment` rows (capped by `maxAssessments`). **No links here**, just the catalog.
4. Finish.

### 5.2 Admin — create registration links (unified mapping page)
1. Pick institute → see its catalog (can also enable a new assessment here → upserts catalog).
2. Choose assessment + **level** (Institute / Session / Class / Section, or bulk class-grid).
3. **Create** → mints **free + paid** links and a free tier; opens tier config.
4. Configure the **free link's inclusions** (Report/Dashboard/Counselling/LMS) + optional cap, and the **paid wave tiers** (price + cap + inclusions).
5. Share: copy/QR for free and/or paid link; toggle either; toggle the whole mapping.

### 5.3 Student — free link
1. Open free link → app loads `linkType = FREE`.
2. Fill form (Institute/Session levels also pick session/class/section).
3. Free cap hit / link off → **"Registration closed"**.
4. Else → account auto-created, **entitlement minted from the free tier** (e.g. report+dashboard if the admin enabled them), auto-login, credentials emailed → **Allotted Assessments** → start. Report/dashboard/etc. unlock per the entitlement.

### 5.4 Student — paid link
1. Open paid link → app loads `linkType = PAID` + the current wave price.
2. All waves sold out / link off → **"Registration closed"** (no silent free).
3. Fill form (+ session/class/section for Institute/Session); optional promo.
4. **Price > 0** → Razorpay → on success: provision + **entitlement from the purchased wave** → Allotted Assessments. **Price = 0** (100% promo / 0 wave) → free path → entitlement → start.

### 5.5 Student — institute-wide (INSTITUTE) link
Same as 5.3/5.4 but the form first asks the student to select **session → class → section** (from `availableSessions[]`).

### 5.6 Student — free→paid upgrade
1. A free-registered student opens the **upgrade screen** (from their dashboard / allotted-assessment).
2. App shows the current active **paid wave** for that mapping + what it adds (e.g. counselling + LMS).
3. Pay via Razorpay → **the existing entitlement is upgraded** (paid wave's inclusions + new expiry windows). No new account.

---

## 6. System flows

### 6.1 Catalog upsert (admin)
```
Wizard Step 3 (POST catalog)  OR  mapping-page createMapping(any level)
  -> InstituteAssessmentService.upsert(institute, assessment)   [idempotent, unique pair]
  -> (createMapping also) mint free_token + paid_token + auto-create the is_free tier
```

### 6.2 Public info resolution
```
GET /assessment-mapping/public/info/{token}
  -> paid_token? linkType=PAID : free_token? linkType=FREE : 404
  -> FREE: inclusions/cap from is_free tier; registrationClosed = !free_active || freeCapHit
  -> PAID: active = resolveActiveTier(non-free tiers)
           active == null -> registrationClosed = true (HONORED)
           else amount = active.amount
  -> level==INSTITUTE: include availableSessions[] (classes -> sections)
  -> return { linkType, amount, registrationClosed, mappingLevel, assessmentId/Name, instituteName, level meta }
```

### 6.3 Public register — FREE
```
POST /public/register/{token}   (FREE)
  -> tryIncrement free-tier current_count (atomic) ; fail -> 409 closed
  -> dedup (email+institute same-day DOB ; DOB+institute+class+name)
  -> create User(DOB) + StudentInfo + UserStudent + ABAC + StudentAssessmentMapping
  -> zero-amount 'paid' PaymentTransaction (mapping_id, mapping_tier_id=free tier)   [ledger]
  -> B2BEntitlementService.activateFromMappingTier(student, assessment, mapping, freeTier, txn)   [GRANT]
  -> issue cn_at_asmnt cookie + buildSessionPayload (auto-login) + credentials email
  -> 200 { userStudentId, assessments[], studentDob } -> SPA -> /allotted-assessment
```

### 6.4 Public register — PAID
```
POST /public/register/{token}   (PAID)
  -> active = resolveActiveTier(waves) ; null -> 400 closed
  -> amount = active.amount ; apply promo -> finalAmount
  -> finalAmount > 0: PaymentTransaction(created, mapping_id, mapping_tier_id=wave) + Razorpay link
                      -> webhook paid -> provision + activateFromMappingTier(..., wave, txn) [GRANT]
  -> else (0/100% promo): free path + activateFromMappingTier(..., wave, txn)
```

### 6.5 Free→paid upgrade
```
GET  /assessment-mapping/public/upgrade-info/{entitlementId}
       -> entitlement.mapping_id -> resolveActiveTier(paid waves) -> { price, inclusions }
POST /assessment-mapping/public/pay-for-upgrade { entitlementId }
       -> PaymentTransaction(created, mapping_id, mapping_tier_id=wave, user_student_id, notes:entitlementId+upgrade) + Razorpay
       -> webhook paid -> re-snapshot existing entitlement from the paid wave (overwrite/union flags, recompute expiries; status stays active)
```

### 6.6 School backfill (one-time, migration)
```
for each active school_assessment_config (institute, session, class, assessment), if not migrated:
   insert assessment_institute_mapping(level=CLASS, ..., free_token, paid_token, migrated_from_school_config_id)
   create its is_free tier (amount 0)
   clone school_assessment_tier(institute, session, assessment) -> paid assessment_mapping_tier(mapping_id)
   upsert institute_assessment(institute, assessment)
# Existing /school-register/{token} links remain served by the legacy controller.
```

---

## 7. Permissions & security
- New **admin** endpoints reuse the `assessment_institute_mapping.create/read/update/delete` permission family (no new unseeded permission codes).
- New **public** endpoints (`/assessment-mapping/public/**`, incl. upgrade) ride `PUBLIC_PATHS` permitAll — consistent with the existing per-level flow; avoids the `@PreAuthorize`-on-public inconsistency the school flow has.
- `auth.enforce-mode` is **not** flipped (intentional hold).
- Catalog/list endpoints carry the `scopeFilter` (`institute_code IN (:instituteIds)`) to prevent cross-institute leakage.
- Entitlement `access_token` keeps the 30-day TTL and the existing token-redeem gates.

---

## 8. Newly-surfaced sub-gaps & how they're resolved

| Sub-gap | Resolution (default) |
|---|---|
| Free link had no inclusion config | Free link = `is_free` zero-price tier carrying the toggles + cap |
| `includes_dashboard` absent on B2B tier (dashboard ungrantable) | Added `includes_dashboard` + `dashboard_validity_days` |
| Service toggles granted nothing at runtime | Every registration mints a `StudentEntitlement`; reuses B2C gates unchanged |
| Paid link with no paid waves configured | Paid token → no active tier → `registrationClosed=true`; admin UI warns "no priced tiers yet" |
| Upgrade needs an anchor entitlement | Always create an active entitlement on registration (even all-false free) |
| Upgrade must find the paid wave | New nullable `student_entitlements.mapping_id`; resolve the mapping's active wave |
| Upgrade flag semantics (paid ⊄ free) | Re-snapshot overwrites; **union** if the paid tier would drop a free-granted flag |
| `mapping.amount` legacy single price | Deprecated — every link is tier-backed |
| Upgrade payment routing | `PaymentTransaction` carries `mapping_id` + entitlementId + an upgrade marker → webhook upgrades instead of provisioning a new student |
| Entitlement dedup | Code find-or-create on `(userStudentId, assessmentId)` (no DB unique key) — same as B2C |

---

## 9. Logical gaps / bugs addressed (original)

| # | Issue | Resolution |
|---|---|---|
| 1 | No institute↔assessment table | New `institute_assessment` catalog, backfilled + kept in sync |
| 2 | Free/paid links byte-identical | Distinct `free_token`/`paid_token` + explicit `linkType` |
| 3 | Sold-out paid tier renders as free | `registrationClosed` honored end-to-end |
| 4 | School public endpoints carry `@PreAuthorize` | Unified flow uses `PUBLIC_PATHS`; legacy kept read-only/deprecated |
| 5 | `mapping_tier_id` overloaded across two tier tables | All new tiers are `assessment_mapping_tier` |
| 6 | `mapping_level` unvalidated bare string | Validated enum/constants incl. `INSTITUTE` |
| 7 | Institute PK IDENTITY vs typed code | Wizard adopts server-assigned `institute_code` before Step 2/3 |
| 8 | Two registration URL paths / API modules / tier modals | One unified page + `/assessment-register/{token}` |
| 9 | B2B granted no report/dashboard/counselling/LMS access at all | Entitlement minted per registration; B2C gates reused |

**Known residual (flagged, not in this pass):** `parseClassNumber` returns null for non-numeric classes (Nursery/LKG/UKG), weakening DOB+class+name dedup at CLASS/SECTION level.

---

## 10. Out of scope / deferred
- Retiring the legacy `/school-register` page entirely (kept alive for existing tokens).
- Migrating historical `payment_transaction` rows off the `mapping_tier_id` overload (only new rows are unambiguous).
- À-la-carte upgrades (pick individual services) — upgrade buys the current active paid wave as a bundle.
- Flipping `auth.enforce-mode`.

---

## 11. Build sequence & verification
**Phases:** (0) schema + migrations → (1) backend catalog → (2) backend dual-links + free tier + INSTITUTE level → (3) backend entitlement (`B2BEntitlementService`) → (4) backend free→paid upgrade → (5) school deprecation wiring → (6) react-social admin (page + wizard + tier inclusions + institute-PK fix) → (7) assessment app (register + upgrade) → (8) verify.

**Verification:** backend compile + boot on the staging DB (migrations apply), arch tests (`ControllerPreAuthorizeCoverageTest`, `PermissionCatalogSeedCoverageTest` no worse), `tsc` on both frontends, and a manual pass of free + paid + institute-wide registration **+ a free→paid upgrade** confirming the entitlement unlocks report/dashboard/counselling/LMS through the existing B2C gates.

**Discovered + fixed during verification — session-cookie self-deadlock:** the free registration auto-login path 500'd with a 50s `Lock wait timeout` on the `jwt_token_audit` insert. Root cause (pre-existing infra, latent until the free path ran end-to-end): `JwtTokenAuditService.record` is `@Transactional(REQUIRES_NEW)` and `jwt_token_audit` FK-references `student_user` (the `User` table); the register transaction holds an X lock on the just-inserted `User`, so the audit insert in the separate transaction blocked on it. **Fix:** `issueAssessmentSessionCookie` now defers cookie+audit to an `afterCommit` `TransactionSynchronization` (the `User` is committed → FK lock free), wrapped so a cookie/audit hiccup can never fail or roll back an otherwise-successful registration.

*No commits without request; changes scoped clear of the concurrent Lead feature; `auth.enforce-mode` untouched.*
