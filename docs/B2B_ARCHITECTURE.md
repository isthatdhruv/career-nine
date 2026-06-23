# B2B Assessment System — Architecture

> **Branch:** `dhruv-from-palak` · **Stack:** Spring Boot backend + two React SPAs (career-nine-assessment, react-social)
> **Backend root:** `/home/morningstar/Projects/career-nine-sandbox/spring-social/src/main/java/com/kccitm/api/`
> **Migrations:** `/home/morningstar/Projects/career-nine-sandbox/spring-social/src/main/resources/db/migration/`
> **Audience:** the engineer deciding the final UI plan. Every table column, endpoint URL, service method, and file path is preserved.

---

## Table of contents

1. [Executive overview](#1-executive-overview)
2. [Data model](#2-data-model)
3. [Sub-system A — Per-level (unified) mapping](#3-sub-system-a--per-level-unified-mapping)
4. [Sub-system B — Legacy school registration](#4-sub-system-b--legacy-school-registration)
5. [Catalog SSOT (`institute_assessment`)](#5-catalog-ssot-institute_assessment)
6. [Entitlements & access gating](#6-entitlements--access-gating)
7. [Payments & free→paid upgrade](#7-payments--freepaid-upgrade)
8. [Frontend surface](#8-frontend-surface)
9. [End-to-end flows](#9-end-to-end-flows)
10. [Known gaps / risks (relevant to a UI re-split)](#10-known-gaps--risks-relevant-to-a-ui-re-split)

---

## 1. Executive overview

The **B2B (institute-driven) assessment system** lets a school/institute offer Career-9 assessments to its students and collect (optionally) money for them. The lifecycle is:

1. An admin **maps assessments to an institute** (optionally scoped to a session / class / section), which mints **registration links** (a free token and a paid token).
2. A student opens a link and **self-registers** on the public student SPA. The backend creates the student's account (`User` + `StudentInfo` + `UserStudent`), grants ABAC authorization, and either provisions immediately (free) or routes to Razorpay (paid).
3. Registration mints a **`StudentEntitlement`** — the single contract row that grants **final report / dashboard / counselling / LMS** access, with denormalized service flags snapshotted from the purchased **tier**.
4. A free-registered student can later **upgrade free→paid**; the paid wave's services are **additively unioned** onto the student's existing entitlement.

### The THREE sub-systems and the ONE shared SSOT

There are **three parallel registration pipelines** that were never unified at the row level. The **only** table all three converge on is the catalog SSOT **`institute_assessment`** ("which assessments does this institute offer").

| | **A — Per-level mapping** (current) | **B — Legacy school** (deprecated, still served) | **C — B2C campaign** (institute-tied) |
|---|---|---|---|
| Link/token table | `assessment_institute_mapping` (`token`/`paid_token`/`free_token`) | `school_registration_link` (`token`) + `school_assessment_config` | campaign links (outside this table set) |
| Tier/pricing table | `assessment_mapping_tier` (free `is_free`/`-1` + paid waves) | `school_assessment_tier` | campaign pricing/assessment tiers |
| Payment discriminator | `payment_transaction.mapping_id` + `mapping_tier_id` | `payment_transaction.school_config_id` (+ overloaded `mapping_tier_id`) | `payment_transaction.campaign_id` + `campaign_assessment_tier_id` |
| Entitlement discriminator | `student_entitlements.mapping_id` | **none — mints no entitlement** | `student_entitlements.campaign_id` |
| Mints `StudentEntitlement`? | **Yes** (`activateB2BOnPayment`) | **No** | Yes (`activateOnPayment`) |
| Calls `institute_assessment.ensure()`? | **Yes** (on mapping create) | **No** | Yes (on campaign create) |

```
                         ┌──────────────────────────────────────────┐
                         │   institute_assessment   [CATALOG SSOT]   │
                         │   "this institute offers this assessment" │
                         │   UNIQUE(institute_code, assessment_id)   │
                         └────────────▲───────▲───────▲──────────────┘
            ensure() on create        │       │       │  backfill (V…006)
        ┌─────────────────────────────┘       │       └──────────────────────────┐
        │                          (no ensure — GAP)                              │
 ┌──────┴───────────────┐   ┌──────────────┴────────────┐        ┌────────────────┴───────────┐
 │ A. PER-LEVEL MAPPING  │   │ B. LEGACY SCHOOL          │        │ C. B2C CAMPAIGN            │
 │ assessment_institute_ │   │ school_assessment_config  │        │ campaigns / campaign_*     │
 │   mapping             │   │ school_registration_link  │        │                            │
 │ assessment_mapping_   │   │ school_assessment_tier    │        │ campaign_*_tier            │
 │   tier                │   │                           │        │                            │
 └──────┬───────────────┘   └──────────────┬────────────┘        └────────────────┬───────────┘
        │ mints/unions               (mints NO entitlement — GAP)                  │ activateOnPayment
        ▼                                   ▼                                       ▼
 ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 │  student_entitlements   [shared access-grant row]   campaign_id XOR mapping_id            │
 │  service flags: final_report / dashboard / counselling / lms  →  consumed by SAME gates   │
 └─────────────────────────────────────────────────────────────────────────────────────────┘
        ▲ all money flows through ───── payment_transaction (Razorpay Payment Links) ─────────
```

Key cross-cutting facts:
- All B2B cross-references (`assessment_id`, `institute_code`, `mapping_id`, `session_id`, `class_id`, `section_id`, `user_student_id`, `campaign_id`, `mapping_tier_id`) are **soft references** — plain scalar columns with no DB FK, resolved in service code. Only the school `session→class→section` tree and `user_student→institute/student_info` use real JPA `@JoinColumn` FKs.
- The **access gates never inspect `campaign_id`/`mapping_id`** — they read only the denormalized service flags on `student_entitlements` scoped by `(userStudentId, assessmentId)`. This is why a B2B grant (`campaign_id=NULL`, `mapping_id` set) passes the same gates as a B2C grant.

---

## 2. Data model

All entity paths below are under `…/model/`. Migrations are `V20260606*` unless noted.

### 2.1 ASCII ER diagram

```
                            ┌─────────────────────────────────────────────┐
                            │  institute_detail_new      [INSTITUTE]       │
                            │  PK institute_code  INT  IDENTITY            │
                            │     institute_name (NN), city, state, phone  │
                            │     max_assessments, max_class, max_students │
                            │     is_school, school_logo(LONGBLOB)         │
                            │     logo_url VARCHAR(500)        ← whitelabel │
                            │     is_whitelabel TINYINT(1) DEF 0 ← w'label  │
                            │     assessment_cookie_auth_enabled           │
                            └───┬───────────────┬───────────────┬──────────┘
        institute_code ────────┘               │               └──────── institute_code (nullable)
        (FK, many places, mostly soft)         │                                     │
                                               │ institute_id→institute_code         │
              ┌──── session->class->section tree (school namespace) ────┐            │
              ▼                                                          │            ▼
   ┌────────────────────┐    ┌──────────────────────┐   ┌────────────────────┐  ┌──────────────────────┐
   │ school_session     │    │ school_classes       │   │ school_sections    │  │ user_student  [USER] │
   │ PK id INT IDENTITY │◄───│ PK id INT IDENTITY   │◄──│ PK id INT IDENTITY │  │ PK user_student_id   │
   │ session_year       │ 1:N│ class_name           │1:N│ section_name       │  │ FK institute_id      │
   │ FK institute_id    │    │ FK school_session_id │   │ FK school_classes_id│ │ FK id → student_info │
   │   →institute_code  │    │   (NN)               │   │   (NN)             │  │ user_id→student_user │
   └────────────────────┘    └──────────────────────┘   └────────────────────┘  │ info_completed       │
              ▲ session_id          ▲ class_id                ▲ section_id        │ counselling_allowed  │
              │ class_id            │                         │                   │ reports_visible      │
              │ section_id  (all soft refs — plain INT cols, no DB FK)            └──────────┬───────────┘
              │                                                                              │ user_student_id (soft)
   ╔══════════╧════════════════════════════════════════════════════════════════╗            │
   ║  institute_assessment   [CATALOG SSOT — the ONE shared point]              ║            │
   ║  PK id BIGINT · institute_code INT NN · assessment_id BIGINT NN            ║            │
   ║  UNIQUE uk_institute_assessment(institute_code, assessment_id)             ║            │
   ║  is_active, created_at, updated_at                                         ║            │
   ╚════════════════════════════════════════════════════════════════════════════╝            │
        ▲ assessment_id (catalog backfilled FROM all 3 sources below)                         │
        │                                                                                      │
   ┌────┴──────────────── SYSTEM A: PER-LEVEL (redesign, current) ───────────────┐            │
   │ ┌──────────────────────────────────────────────────────────────┐            │            │
   │ │ assessment_institute_mapping        [PER-LEVEL]               │            │            │
   │ │ PK mapping_id BIGINT · assessment_id BIGINT NN                │            │            │
   │ │    institute_code INT NN                                      │            │            │
   │ │    mapping_level {INSTITUTE|SESSION|CLASS|SECTION}            │            │            │
   │ │    session_id, class_id, section_id  (nullable scope ids)    │            │            │
   │ │    token / paid_token / free_token  (all VARCHAR(36) UNIQUE) │            │            │
   │ │    paid_active, free_active, is_active                       │            │            │
   │ │    amount (legacy), migrated_from_school_config_id           │            │            │
   │ │ UNIQUE(assessment_id,institute_code,session_id,class_id,     │            │            │
   │ │        section_id)                                           │            │            │
   │ └───────────────────────────┬──────────────────────────────────┘            │            │
   │              mapping_id (FK) │ 1:N                                           │            │
   │ ┌────────────────────────────▼─────────────────────────────────┐            │            │
   │ │ assessment_mapping_tier             [PER-LEVEL TIERS]         │            │            │
   │ │ PK tier_id · mapping_id BIGINT NN · sort_order INT NN         │            │            │
   │ │ UNIQUE uk_mapping_tier_sort(mapping_id, sort_order)           │            │            │
   │ │    name, description, amount                                  │            │            │
   │ │    is_free (one per mapping, sort_order=-1, amount 0)         │            │            │
   │ │    max_registrations, current_count, is_active               │            │            │
   │ │    includes_final_report / includes_dashboard(+validity_days)│            │            │
   │ │    includes_counselling(+session_count) / includes_lms(+days)│            │            │
   │ └──────────────────────────────────────────────────────────────┘            │            │
   └─────────────────────────────────────────────────────────────────────────────┘            │
                                                                                                │
   ┌──────────── SYSTEM B: LEGACY-SCHOOL (deprecated, still served) ───────────────┐           │
   │ ┌──────────────────────────────┐  ┌──────────────────────────────┐            │           │
   │ │ school_assessment_config     │  │ school_registration_link     │            │           │
   │ │ PK config_id · institute_code│  │ PK link_id · institute_code  │            │           │
   │ │    session_id, class_id,     │  │    session_id                │            │           │
   │ │    assessment_id, amount     │  │    token VARCHAR(36) UNIQUE  │            │           │
   │ │ UNIQUE(institute_code,       │  │    max_registrations,        │            │           │
   │ │        session_id, class_id) │  │      current_count           │            │           │
   │ └──────────────────────────────┘  │ UNIQUE(institute_code,       │            │           │
   │ ┌──────────────────────────────┐  │        session_id)           │            │           │
   │ │ school_assessment_tier       │  └──────────────────────────────┘            │           │
   │ │ PK tier_id                   │  (institute_code/session_id are BIGINT here) │           │
   │ │    institute_code, session_id│                                              │           │
   │ │    assessment_id, name, desc │  NO is_free flag, NO includes_* inclusions   │           │
   │ │    amount, sort_order, caps  │  → mints NO entitlement                      │           │
   │ │ UNIQUE(institute_code,       │                                              │           │
   │ │  session_id,assessment_id,   │                                              │           │
   │ │  sort_order)                 │                                              │           │
   │ └──────────────────────────────┘                                             │           │
   └──────────────────────────────────────────────────────────────────────────────┘           │
                                                                                                │
   ┌──────────────── SYSTEM C: ENTITLEMENT + PAYMENT (shared B2B/B2C) ───────────────────────────┘
   │ ┌──────────────────────────────────────────┐   ┌──────────────────────────────────────────┐
   │ │ payment_transaction        [PAYMENT]     │   │ student_entitlements     [ENTITLEMENT]   │
   │ │ PK transaction_id                        │   │ PK entitlement_id                        │
   │ │   razorpay_link_id UNIQUE, payment_id,   │   │   user_student_id → user_student         │
   │ │     order_id                             │   │   assessment_id BIGINT NN                │
   │ │   mapping_id      → assessment_institute_│   │   mapping_id    → assessment_institute_  │
   │ │     mapping (B2B)                        │   │     mapping (B2B; null for B2C)          │
   │ │   school_config_id→ school_assessment_   │   │   campaign_id   (B2C; null for B2B)      │
   │ │     config (legacy)                      │   │   payment_transaction_id → payment_txn   │
   │ │   campaign_id (B2C)                      │   │   purchase_path VARCHAR(1)               │
   │ │   mapping_tier_id  → OVERLOADED:         │   │   status {pending|active|expired|        │
   │ │      assessment_mapping_tier (if         │   │      revoked|refunded}                   │
   │ │      mapping_id) OR school_assessment_   │   │   granted_at, expires_at                 │
   │ │      tier (if school_config_id)          │   │   access_token (64) UNIQUE + expires_at  │
   │ │   campaign_assessment_tier_id (B2C)      │   │   dashboard_active + dashboard_expires   │
   │ │   purchase_path VARCHAR(1)               │   │   counselling_active + sessions_total/   │
   │ │   amount NN, original_amount, promo_*    │   │      used                                │
   │ │   student_name/email/phone/dob           │   │   lms_active + lms_expires_at            │
   │ │   user_student_id, assessment_id,        │   │   final_report_active                    │
   │ │     institute_code                       │   │   report_prepared_at                     │
   │ │   status {created|...}, email flags      │   │                                          │
   │ └─────────────┬────────────────────────────┘   └──────────────────────────────────────────┘
   │               └── payment_transaction_id ──────►
   └───────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Per-table reference

#### Institute & session tree (the school namespace — REAL FKs)

**`institute_detail_new`** — `model/career9/school/InstituteDetail.java` — the institute/school master record; root of the whole B2B tree.
- PK `institute_code` `INT` IDENTITY (used in ABAC `scopeFilter`)
- `institute_name` VARCHAR `@NotNull`; `institute_address`, `city`, `state`, `phone`
- `max_assessments` `INT` — cap on catalog enrolment; null/0 = unlimited
- `max_class`, `max_students`, `max_contact_persons` `INT`; `is_school` BOOLEAN
- `school_logo` `LONGBLOB` (legacy); `logo_url` `VARCHAR(500)` — whitelabel CDN URL (V…007)
- `is_whitelabel` `TINYINT(1) DEFAULT 0` — whitelabel opt-in; NULL treated FALSE (V…007)
- `assessment_cookie_auth_enabled` BOOLEAN — defaults TRUE via `@PrePersist`; `display` BOOLEAN
- Relations: `@OneToMany` → `SchoolSession`; `@ManyToMany` → `BoardName` via `institute_board_mapping`; `@OneToMany` → `ContactPerson`, `InstituteCourse`

**`school_session`** — `model/career9/school/SchoolSession.java` — academic-year bucket. PK `id` INT IDENTITY; `session_year`; FK `institute_id` → `institute_detail_new.institute_code` (`@ManyToOne`, NN, real JoinColumn); `@OneToMany` → `SchoolClasses` (cascade ALL, orphanRemoval).

**`school_classes`** — `model/career9/school/SchoolClasses.java` — PK `id` INT IDENTITY; `class_name`; FK `school_session_id` → `school_session.id` (NN); `@OneToMany` → `SchoolSections`.

**`school_sections`** — `model/career9/school/SchoolSections.java` — PK `id` INT IDENTITY; `section_name`; FK `school_classes_id` → `school_classes.id` (NN).

> The `session_id` / `class_id` / `section_id` columns on the mapping/config/tier tables point at these PKs but as **plain INT soft references** (no DB FK).

#### Catalog SSOT

**`institute_assessment`** — `model/career9/InstituteAssessment.java` (DDL V20260606001) — see [§5](#5-catalog-ssot-institute_assessment).
- PK `id` BIGINT · `institute_code` INT NN · `assessment_id` BIGINT NN
- **UNIQUE** `uk_institute_assessment(institute_code, assessment_id)`
- `is_active` BOOLEAN DEFAULT TRUE, `created_at`, `updated_at`

#### Sub-system A — per-level mapping + tiers

**`assessment_institute_mapping`** — `model/career9/AssessmentInstituteMapping.java`
- PK `mapping_id` BIGINT IDENTITY · `assessment_id` BIGINT NN · `institute_code` INT NN
- `mapping_level` `VARCHAR(20)` NN — string enum `INSTITUTE | SESSION | CLASS | SECTION`
- `session_id`, `class_id`, `section_id` INT nullable (scope coords by level)
- `token` `VARCHAR(36)` **UNIQUE** NN — legacy single token (new rows set it = `paid_token`)
- `paid_token` `VARCHAR(36)` **UNIQUE**, `free_token` `VARCHAR(36)` **UNIQUE** — dual links (V…002)
- `paid_active`, `free_active`, `is_active` BOOLEAN DEFAULT TRUE
- `amount` BIGINT (legacy single price, deprecated by tiers)
- `migrated_from_school_config_id` BIGINT — idempotency marker for school backfill (V…005)
- **UNIQUE** `(assessment_id, institute_code, session_id, class_id, section_id)` (ineffective when any coord is NULL — i.e. every level except SECTION; duplicate detection is also done in code)

**`assessment_mapping_tier`** — `model/career9/AssessmentMappingTier.java`
- PK `tier_id` BIGINT · `mapping_id` BIGINT NN (soft FK) · `sort_order` INT NN (free tier uses reserved `-1`)
- **UNIQUE** `uk_mapping_tier_sort(mapping_id, sort_order)`
- `name` VARCHAR(100) NN · `description` VARCHAR(200) · `amount` BIGINT
- `is_free` BOOLEAN DEFAULT FALSE — exactly one per mapping, amount 0 (V…003)
- `max_registrations`, `current_count` INT DEFAULT 0, `is_active`
- Inclusions (all BOOLEAN DEFAULT FALSE): `includes_final_report`, `includes_dashboard` (+`dashboard_validity_days`, V…003), `includes_counselling` (+`counselling_session_count`), `includes_lms` (+`lms_validity_days`)

#### Sub-system B — legacy school

**`school_assessment_config`** — `model/career9/SchoolAssessmentConfig.java` — PK `config_id` BIGINT; `institute_code` INT NN, `session_id` INT NN, `class_id` INT NN, `assessment_id` BIGINT NN, `amount` BIGINT, `is_active`, `created_at`. **UNIQUE** `(institute_code, session_id, class_id)`.

**`school_registration_link`** — `model/career9/SchoolRegistrationLink.java` — PK `link_id` BIGINT; `institute_code` INT NN, `session_id` INT NN, `token` VARCHAR(36) **UNIQUE** NN, `is_active`, `max_registrations`, `current_count` (NN DEFAULT 0). **UNIQUE** `(institute_code, session_id)`.

**`school_assessment_tier`** — `model/career9/SchoolAssessmentTier.java` — PK `tier_id` BIGINT; `institute_code` **BIGINT** NN, `session_id` **BIGINT** NN, `assessment_id` BIGINT NN (note: BIGINT where the mapping side is INT — MySQL compares numerically); `name` VARCHAR(100) NN, `description` VARCHAR(200) NN, `amount` BIGINT, `sort_order` INT NN, `max_registrations`, `current_count` INT DEFAULT 0, `is_active`. **UNIQUE** `uk_school_assessment_tier_sort(institute_code, session_id, assessment_id, sort_order)`. **No `is_free` flag, no `includes_*` inclusions.**

#### Sub-system C — entitlements + payments (shared)

**`student_entitlements`** — `model/career9/b2c/StudentEntitlement.java` — the single access-grant row.
- PK `entitlement_id` BIGINT · `user_student_id` (soft) · `assessment_id` BIGINT NN
- **`mapping_id`** BIGINT nullable — **B2B source** → `assessment_institute_mapping`; null for B2C (V…004)
- **`campaign_id`** BIGINT nullable — B2C source; `campaign_assessment_tier_id`, `pricing_tier_id` (B2C)
- `payment_transaction_id` → `payment_transaction`; `purchase_path VARCHAR(1)`; `counselling_model VARCHAR(1)`
- `status VARCHAR(20) DEFAULT 'pending'` — {pending | active | expired | revoked | refunded}
- `granted_at`, `expires_at`; `access_token VARCHAR(64)` **UNIQUE** + `access_token_expires_at`
- Service flags: `dashboard_active`+`dashboard_expires_at`, `counselling_active`+`counselling_sessions_total/used`, `lms_active`+`lms_expires_at`, `final_report_active` (all BOOLEAN DEFAULT FALSE); `report_prepared_at`
- **Invariant:** `campaign_id` XOR `mapping_id` distinguishes B2C vs B2B.

**`payment_transaction`** — `model/career9/PaymentTransaction.java` — Razorpay record.
- PK `transaction_id` BIGINT · `razorpay_link_id VARCHAR(50)` **UNIQUE**, `razorpay_payment_id`, `razorpay_order_id`
- `mapping_id` (B2B), `school_config_id` (legacy), `campaign_id` (B2C) — mutually exclusive discriminators
- **`mapping_tier_id`** — **OVERLOADED**: → `assessment_mapping_tier` when `mapping_id` set, → `school_assessment_tier` when `school_config_id` set (see [§7.3](#73-the-overloaded-mapping_tier_id))
- `campaign_assessment_tier_id` (B2C tier); `purchase_path VARCHAR(1)`
- `amount` BIGINT NN, `original_amount`, `promo_code`, `promo_discount_percent`, `currency VARCHAR(10) DEFAULT 'INR'`
- `status VARCHAR(20) DEFAULT 'created'`; `payment_link_url`, `short_url`; `failure_reason`
- `student_name/email/phone/dob`, `user_student_id`, `assessment_id`, `institute_code`
- `welcome_email_sent`, `nudge_email_sent`; `created_at`, `updated_at`

#### User tables (just enough for the FK)

**`user_student`** — `model/career9/UserStudent.java` — junction of login + profile + institute; the entitlement/payment target. PK `user_student_id` BIGINT; FK `institute_id` → `institute_detail_new.institute_code` (`@ManyToOne` **nullable**, drives ABAC `scopeFilter`); FK `id` → `student_info.id` (NN); `user_id` BIGINT NN → `student_user.id` (soft); `info_completed`, `counselling_allowed`, `reports_visible`.

**`student_user`** — `model/User.java` (`@Table("student_user")`) — login row. PK `id`; `username`, `dob_date` (used for login, **not hashed**), `password`, `career_nine_rollnumber`, `is_super_admin`, `is_active`, `phone`, `organisation`, `google_auth_string`.

**`student_info`** — `model/career9/StudentInfo.java` (`@Table("student_info")`) — student profile; PK `id` INT IDENTITY (target of `user_student.id`); declares the shared `scopeFilter`.

### 2.3 Shared vs parallel — the one-line summary

- **Shared across all three sub-systems:** `institute_assessment` (catalog SSOT), `student_entitlements`, `payment_transaction`, and the whole `User`/`StudentInfo`/`UserStudent` account graph.
- **Parallel (never unified):** the link/token tables and tier tables of A vs B vs C. They join **only** indirectly through `(institute_code, assessment_id)` landing in `institute_assessment`.
- **The overloads to remember:** `payment_transaction.mapping_tier_id` (A's tier table vs B's tier table); `student_entitlements.mapping_id` XOR `campaign_id` (A/B vs C).

### 2.4 Flyway migrations (`V20260606*`)

| Migration | Effect |
|---|---|
| **001** `__institute_assessment_catalog.sql` | Creates `institute_assessment` (PK, UNIQUE `uk_institute_assessment`). Backfills from active `assessment_institute_mapping` **and** active `school_assessment_config`, deduped. |
| **002** `__assessment_mapping_dual_links.sql` | Adds `paid_token`, `free_token`, `paid_active`, `free_active`, `migrated_from_school_config_id`. Sets `paid_token = token` (preserves distributed links) and `free_token = UUID()` per row. |
| **003** `__assessment_mapping_tier_free_and_dashboard.sql` | Adds `is_free`, `includes_dashboard`, `dashboard_validity_days`. Inserts one free tier (`sort_order=-1`, amount 0) for every mapping lacking one. |
| **004** `__student_entitlement_mapping_id.sql` | Adds nullable `mapping_id BIGINT` to `student_entitlements` (B2B source; B2C leaves null). |
| **005** `__school_flow_backfill.sql` | Folds legacy school into unified: (1) one `CLASS`-level mapping per active `school_assessment_config` (fresh tokens, idempotent via `migrated_from_school_config_id`); (2) a free tier per migrated mapping; (3) clones `school_assessment_tier` rows as paid waves. |
| **006** `__institute_assessment_b2c_backfill.sql` | Backfills institute-tied B2C campaign assessments (`campaigns.institute_code` JOIN `campaign_assessment_mapping`, non-deleted) into the catalog. Skips NULL `institute_code`. |
| **007** `__institute_add_whitelabel.sql` | Adds `logo_url VARCHAR(500) NULL` and `is_whitelabel TINYINT(1) NULL DEFAULT 0` to `institute_detail_new`. |

> **Migration vs runtime gap:** V005 only mints **new** unified mappings from existing school configs; already-distributed `/school-register/{token}` links keep being served by the legacy controller. And the legacy **runtime** write path never feeds the catalog (see [§4](#4-sub-system-b--legacy-school-registration), [§10](#10-known-gaps--risks-relevant-to-a-ui-re-split)).

---

## 3. Sub-system A — Per-level (unified) mapping

**Controller:** `controller/career9/AssessmentInstituteMappingController.java` (`@RequestMapping("/assessment-mapping")`, 1397 lines)
**Services:** `service/career9/InstituteAssessmentService.java`, `service/career9/AssessmentMappingTierService.java`
**Repos:** `repository/Career9/AssessmentInstituteMappingRepository.java`, `repository/Career9/AssessmentMappingTierRepository.java`

### 3.1 Admin & public endpoints

Auth column: `@PreAuthorize(@auth.allows('<perm>'))`; **PUBLIC** = no `@PreAuthorize`, reachable via `PUBLIC_PATHS` (`/assessment-mapping/public/**`, permitAll + CSRF-exempt), gated only by the path token.

| # | Method | URL | Auth | Purpose |
|---|--------|-----|------|---------|
| 1 | POST | `/assessment-mapping/create` | `assessment_institute_mapping.create` `@Transactional` | Create a per-level mapping; mints dual link tokens, auto-creates free tier, **syncs catalog via `ensure()`** |
| 2 | GET | `/assessment-mapping/getAll` | `…read` (scopeFilter) | List all mappings (scope-filtered) |
| 3 | GET | `/assessment-mapping/getByInstitute/{instituteCode}` | `…read` | Mappings for an institute |
| 4 | GET | `/assessment-mapping/getByInstitute/{instituteCode}/assessments` | `…read` | Assessment summaries offered by institute (`AssessmentTableRepository.AssessmentSummary`) |
| 5 | GET | `/assessment-mapping/get/{id}` | `…read` | Single mapping / 404 |
| 6 | PUT | `/assessment-mapping/update/{id}` | `…update` | Patch `isActive` and/or `amount` only |
| 7 | DELETE | `/assessment-mapping/delete/{id}` | `…delete` | Delete mapping |
| 8 | GET | `/assessment-mapping/institute/{instituteCode}/catalog` | `…read` | List institute↔assessment catalog |
| 9 | POST | `/assessment-mapping/institute/{instituteCode}/catalog` | `…create` | Enable assessments in catalog (**cap-enforced** `enable`) |
| 10 | PATCH | `/assessment-mapping/institute/catalog/{id}/toggle` | `…update` | Flip catalog row `is_active` |
| 11 | DELETE | `/assessment-mapping/institute/catalog/{id}` | `…delete` | Remove catalog row |
| 12 | PATCH | `/assessment-mapping/{mappingId}/link/{linkType}/toggle` | `…update` | Toggle `free`/`paid` link `*_active` |
| 13 | GET | `/assessment-mapping/{mappingId}/tiers` | `…read` | List tiers (sortOrder asc) |
| 14 | POST | `/assessment-mapping/{mappingId}/tiers` | `…create` | Create a pricing tier/wave (needs `name`, `description`≤200, `sortOrder`; `currentCount` forced 0) |
| 15 | PUT | `/assessment-mapping/tiers/{tierId}` | `…update` | Update tier fields/inclusions |
| 16 | PATCH | `/assessment-mapping/tiers/{tierId}/toggle` | `…update` | Flip tier `is_active` |
| 17 | DELETE | `/assessment-mapping/tiers/{tierId}` | `…delete` | Delete tier |
| 18 | POST | `/assessment-mapping/tiers/{tierId}/recount` | `…update` | Rebuild `currentCount` from paid txns |
| 19 | GET | `/assessment-mapping/public/info/{token}` | **PUBLIC** | Resolve link → FREE/PAID, amount, inclusions, `registrationClosed`, branding, level tree |
| 20 | POST | `/assessment-mapping/public/register/{token}` | **PUBLIC** `@Transactional` | Self-registration: resolve wave, enforce caps, provision or redirect to pay |
| 21 | GET | `/assessment-mapping/public/upgrade-info/{entitlementId}` | **PUBLIC** | Free→paid upgrade availability for an entitlement |
| 22 | POST | `/assessment-mapping/public/pay-for-upgrade` | **PUBLIC** | Create Razorpay link to upgrade a free student |

> **Security note (endpoints 21–22):** `/public/info` and `/public/register` are gated by an unguessable per-mapping UUID token, but `/public/upgrade-info/{entitlementId}` and `/public/pay-for-upgrade` are gated only by a **sequential numeric entitlement id** (the only check is `campaignId == null && mappingId != null`). Anyone who can enumerate entitlement ids can read assessment/inclusion data and mint upgrade payment links for arbitrary students. Flagged for the UI/security review.

### 3.2 Catalog `ensure()` integration (on mapping create)

`createMapping` validates the assessment + institute, normalizes level coordinates (`normalizeLevelCoordinates` nulls coords that don't apply; `levelCoordinatesPresent` requires the level's coords), rejects exact-duplicate mappings **in code** (the DB unique key is ineffective when any coord is NULL), mints the dual tokens (paid token doubles as the legacy non-null/unique `token`), defaults `paidActive`/`freeActive` true, saves, **auto-creates the free tier** (`is_free=true`, `sort_order=-1`, amount 0, inclusions off), then:

```java
instituteAssessmentService.ensure(saved.getInstituteCode(), saved.getAssessmentId());
```

`ensure()` is the **idempotent, uncapped** upsert (existing+active → no-op; existing+disabled → reactivate; missing → insert). It deliberately does **not** enforce `maxAssessments` — a registration-link create must never be refused by a catalog limit. The cap is enforced only by `enable` (endpoint #9). Full detail in [§5](#5-catalog-ssot-institute_assessment).

### 3.3 Tier / wave resolution algorithm

Each mapping owns at most **one free tier** (`is_free=true`, `sort_order=-1`) and zero-or-more **paid waves** (`is_free=false`, each with a `sort_order`).

**Paid wave selection** — `AssessmentMappingTierService.resolveActiveTier(List)`: keep `is_active=true` waves, order ascending by `sortOrder` (null → `Integer.MAX_VALUE`, sorts last), drop full ones (`currentCount >= maxRegistrations`), take the **first survivor**. This yields **sequential waves**: wave 0 sells out → wave 1 becomes current → etc. **Cap rule:** `maxRegistrations` null or `0` = unlimited; else full when `currentCount >= maxRegistrations`. All active waves full → returns `null` = **registration closed (sold out)**.

```java
public AssessmentMappingTier resolveActiveTier(List<AssessmentMappingTier> tiers) {
    if (tiers == null) return null;
    return tiers.stream()
        .filter(t -> Boolean.TRUE.equals(t.getIsActive()))
        .sorted(Comparator.comparingInt(t -> t.getSortOrder() == null ? Integer.MAX_VALUE : t.getSortOrder()))
        .filter(t -> { Integer max = t.getMaxRegistrations();
                       int cur = t.getCurrentCount() == null ? 0 : t.getCurrentCount();
                       return max == null || max == 0 || cur < max; })
        .findFirst().orElse(null);
}
```

**Free tier selection** is inline in `resolveEffectiveTier` (NOT via `resolveActiveTier`): take `findFirstByMappingIdAndIsFreeTrue`, apply the same cap rule. `free_active`/`paid_active` on the mapping gate the respective branch before tiers are even loaded.

**Write-time cap enforcement** — `AssessmentMappingTierRepository.tryIncrementCount` is a single atomic conditional UPDATE:

```sql
UPDATE AssessmentMappingTier t SET t.currentCount = COALESCE(t.currentCount,0)+1
WHERE t.tierId = :tierId AND (COALESCE(t.maxRegistrations,0)=0 OR COALESCE(t.currentCount,0) < COALESCE(t.maxRegistrations,0))
```

Returns rows-affected (0 = lost the cap race). Read-time `resolveActiveTier` is the **soft** gate; this UPDATE is the **hard, race-safe** gate. **Drift backstop:** `recountTier(tierId)` = `countByMappingTierIdAndStatusAndMappingIdIsNotNull(tierId, "paid")` (the `MappingIdIsNotNull` qualifier prevents a school tier sharing the same numeric id from polluting the count — see the overloading in [§7.3](#73-the-overloaded-mapping_tier_id)).

### 3.4 The unified public registration flow

#### `/public/info/{token}`
`resolveLink(token)` tries `paid_token`, then `free_token`, then the legacy single `token` column (each branch requires mapping `is_active`):

```java
private ResolvedLink resolveLink(String token) {
    Optional<...> paid = mappingRepository.findByPaidToken(token);
    if (paid.isPresent() && Boolean.TRUE.equals(paid.get().getIsActive())) return new ResolvedLink(paid.get(), false);
    Optional<...> free = mappingRepository.findByFreeToken(token);
    if (free.isPresent() && Boolean.TRUE.equals(free.get().getIsActive())) return new ResolvedLink(free.get(), true);
    Optional<...> legacy = mappingRepository.findByTokenAndIsActive(token, true);   // un-backfilled rows
    return legacy.map(m -> new ResolvedLink(m, false)).orElse(null);
}
```

`linkType` is set straight from `link.freeLink`; `resolveEffectiveTier(link, closed)` drives `amount`/`inclusions`/`registrationClosed`. FREE → the single `is_free` tier, `amount` hard-coded `0`; PAID → the active wave, `amount` = wave amount + `activeTierName`. `inclusionsOf(effective)` emits `includesFinalReport`, `includesDashboard`, `includesCounselling`, `counsellingSessionCount`, `includesLms`, `lmsValidityDays`, `dashboardValidityDays`. The response also adds assessment/institute names, `brandingService.forInstitute(...)` (whitelabel), the fixed coords, and the **"what the student must still pick" tree** by level (INSTITUTE → full session→class→section tree; SESSION → `availableClasses`; CLASS → `availableSections`; SECTION → nothing).

#### `/public/register/{token}` (method `registerStudentByToken`)
Steps:
1. `resolveLink(token)` → 404 if null.
2. Parse `name/email/dob(dd-MM-yyyy)/phone/gender`; require name/email/phone/dob.
3. Resolve class/section by `mapping_level` (SECTION uses mapping coords; CLASS reads `schoolSectionId` from body; SESSION/INSTITUTE read `classId`+`schoolSectionId` from body).
4. **`resolveEffectiveTier`** → if null, **400 "Registrations are closed for this link"** (sold-out is rejected, never silently downgraded to free). Compute `paymentRequired = !freeLink && amount > 0`.
5. Promo (only if `paymentRequired`): validate active/expiry/usage, discount ∈ [0,100], `finalAmount = amount*(100-pct)/100`, clamp a sub-100% discount up to `1L` so it can't fall onto the free path; **consumption deferred** to realized redemption.
6. Duplicate by **email+institute** (requires **DOB match** to prevent impersonation since this path can return a session token).
7. Duplicate by **DOB+institute+class+name**.
   - Each duplicate routes to `handleExistingStudentWithPayment` (paid) or `handleExistingStudent` (free).
8. **Paid path** → `createPaymentAndRedirect(...)` (creates a `"created"` txn + Razorpay link; no account yet — webhook provisions). See [§7.1](#71-paid-b2b-registration).
9. **Free path** (free link or 100% promo) — the full provisioning block:
   - `tierRepository.tryIncrementCount(activeTierId)` (cap-guarded slot claim)
   - Fabricate a **zero-amount `status="paid"` `PaymentTransaction`** stamped with `mappingId` + `mappingTierId` — this is both the ledger row AND the **entitlement source**
   - Create `User(randomInt, dob)` + `StudentInfo` + `UserStudent`; `rollNumberService.generateNextRollNumber(...)`
   - `studentProvisioningService.provision(userStudent)` (ABAC); `membershipService.setPrimaryInstitute(...)`
   - `StudentAssessmentMapping(userStudentId, assessmentId)`
   - `entitlementService.activateB2BOnPayment(freeTxn.getTransactionId())` ← **mints the entitlement, even for free**
   - `consumePromoIfPresent(promoCodeStr)`
   - `studentSessionService.buildSessionPayload(...)` + `issueAssessmentSessionCookie(...)` (auto-login; cookie deferred to `afterCommit` to avoid an FK self-deadlock on the just-inserted `student_user` row)
   - `sendRegistrationEmail(email, name, username, dobStr, assessmentName)` (failure swallowed)
   - Returns `{status:"success", username, dob, …sessionPayload}`

> **Free-path cap note:** registration is **not** rolled back if `tryIncrementCount` returns 0 (a race past the cap). `resolveEffectiveTier` already rejected a full free tier; the increment is best-effort atomicity on top.

#### Sold-out propagation
`resolveEffectiveTier` sets `closed[0]=true` when the link flag is off (`free_active`/`paid_active`), no eligible tier exists, or the cap is hit. `/info` surfaces this as `registrationClosed`; `/register` rejects with 400. **A paid link never silently downgrades to free.**

---

## 4. Sub-system B — Legacy school registration

**Controller:** `controller/career9/SchoolRegistrationController.java` (`@RequestMapping("/school-registration")`)
**Collaborators:** `AssessmentMappingTierService` (school-tier methods), `StudentProvisioningService`, `StudentInstituteMembershipService`, `PaymentTransactionWriter` (`saveInNewTransaction`, REQUIRES_NEW), `RazorpayService`, `SmtpEmailService`, `CareerNineRollNumberService`, `PromoCodeRepository`. Paid completion lands in `PaymentWebhookController` (branch `txn.getSchoolConfigId() != null`).

### 4.1 Admin & public endpoints

| Method | URL | Auth (`@PreAuthorize`) | Purpose |
|---|---|---|---|
| POST | `/school-registration/config/create` | `school_registration.create` | Upsert one class→assessment config (by institute+session+class); reactivates if existing |
| POST | `/school-registration/config/batch-save` | `school_registration.create` | Authoritative bulk upsert for (institute,session); **deactivates any active config whose class is absent** from the batch |
| GET | `/school-registration/config/by-institute/{instituteCode}/{sessionId}` | `school_registration.read,#instituteCode,#sessionId,null,null` | List configs |
| PUT | `/school-registration/config/update/{configId}` | `school_registration.update` | Patch `assessmentId`/`amount`/`isActive` |
| DELETE | `/school-registration/config/delete/{configId}` | `school_registration.delete` | Hard-delete a config |
| POST | `/school-registration/link/generate` | `school_registration.create` | Get-or-create the single (institute,session) link (UUID token) |
| GET | `/school-registration/link/by-institute/{instituteCode}/{sessionId}` | `school_registration.read,…` | Fetch the link |
| PUT | `/school-registration/link/toggle/{linkId}` | `school_registration.update` | Flip link `isActive` |
| PUT | `/school-registration/link/{linkId}/max-registrations` | `school_registration.update` | Set link `maxRegistrations` (rejects negative) |
| GET | `/school-registration/tiers/{instituteCode}/{sessionId}/{assessmentId}` | `school_registration.read,…` | List school tiers (by sortOrder) |
| POST | `/school-registration/tiers/{instituteCode}/{sessionId}/{assessmentId}` | `school_registration.create` | Create a school tier (validates name/description≤200/sortOrder; forces `currentCount=0`) |
| PUT | `/school-registration/tiers/{tierId}` | `school_registration.update` | Update tier; **on price change, cancels outstanding "created" Razorpay links scoped to that tierId** |
| PATCH | `/school-registration/tiers/{tierId}/toggle` | `school_registration.update` | Flip tier `isActive` |
| DELETE | `/school-registration/tiers/{tierId}` | `school_registration.delete` | Hard-delete a tier |
| POST | `/school-registration/tiers/{tierId}/recount` | `school_registration.update` | Rebuild tier `currentCount` from paid school txns |
| GET | `/school-registration/public/info/{token}` | `school_registration.read` | Landing data: institute, branding, session, classes + tier amount + sections |
| POST | `/school-registration/public/verify-details/{token}` | `school_registration.read` | Pre-check: is this email/phone+DOB already a student here? Returns username |
| POST | `/school-registration/public/register/{token}` | `school_registration.create` | Student registration |

> **Auth note — the "public" endpoints are NOT anonymous.** All three `/public/*` endpoints are annotated `@PreAuthorize(...)` (`school_registration.read`/`.create`) and each carries `// PUBLIC?: flagged for 15-06 exclusions review`. In code they are gated by `@auth` exactly like admin endpoints (presumably whitelisted elsewhere in the security config) — **not `permitAll()` at the controller layer**, unlike sub-system A's truly-public endpoints. The scope-less permission form is used because the token itself carries the institute+session.

### 4.2 School tier model — `school_assessment_tier` vs `assessment_mapping_tier`

| Aspect | `school_assessment_tier` (B) | `assessment_mapping_tier` (A) |
|---|---|---|
| Scope | `(institute_code, session_id, assessment_id)` triple | single `mapping_id` |
| Unique key | `(institute_code, session_id, assessment_id, sort_order)` | `(mapping_id, sort_order)` |
| Free flag | **none** — free ⇔ `amount` null/0, no designated free tier | explicit `is_free` (one per mapping, `sort_order=-1`, amount 0) |
| Inclusions | **none** — no report/dashboard/counselling/LMS toggles | `includes_final_report`, `includes_dashboard`(+validity), `includes_counselling`(+sessions), `includes_lms`(+validity) |
| `institute_code`/`session_id` type | **BIGINT** | INT |

Both share the **identical resolution algorithm** (`resolveActiveSchoolTier` vs `resolveActiveTier`) and the **identical cap-guarded `tryIncrementCount` SQL`; they differ only in table/scope and the free-flag/inclusion richness.

### 4.3 The public school registration flow

#### `/public/info/{token}`
`linkRepository.findByTokenAndIsActive(token,true)` → 404 if missing/inactive → yields `instituteCode`, `sessionId`. Adds institute name + branding + session. For each active config (`findByInstituteCodeAndSessionIdAndIsActiveTrue`), it resolves pricing **from the tier, not the config**:

```java
SchoolAssessmentTier activeTier = tierService.resolveActiveTierForSchoolAssessment(
        instituteCode.longValue(), sessionId.longValue(), config.getAssessmentId());
if (activeTier != null) { classInfo.put("amount", activeTier.getAmount() != null ? activeTier.getAmount() : 0);
                          classInfo.put("registrationClosed", false); }
else { classInfo.put("amount", 0); classInfo.put("registrationClosed", true); }   // no active tier ⇒ closed
```

> **`SchoolAssessmentConfig.amount` is effectively dead** for public pricing — the amount always comes from the tier.

#### `/public/register/{token}`
1. Validate token → `instituteCode`, `sessionId`.
2. Extract `name/email/dob/phone/gender/classId/schoolSectionId` (name/email/phone/dob/classId required).
3. `findByInstituteCodeAndSessionIdAndClassId(...)` → 400 if absent; **409 CONFLICT if `config.isActive` is false** (re-enforces deactivation even if a client posts classId directly). `assessmentId = config.getAssessmentId()`.
4. Re-resolve active tier; null → 409 "Registration closed for this assessment". `paymentRequired = amount > 0`, `activeTierId = tier.getTierId()`.
5. `studentClass = parseClassNumber(classId)` (strips non-digits; never the PK).
6. Promo (if paymentRequired); **not consumed here** — deferred.
7. Duplicate checks (email+institute, then dob+institute+class+name) → paid → `handleExistingStudentWithPayment`; free → `handleExistingStudent`.
8. **Paid path** → `createPaymentAndRedirect`: saves `PaymentTransaction(status="created")` via `paymentTransactionWriter.saveInNewTransaction` (REQUIRES_NEW, committed BEFORE the Razorpay call), stamping `schoolConfigId`, `mappingTierId=activeTierId`, amounts, promo. Creates Razorpay link, cancels older still-"created" links, returns `{status:"payment_required", paymentUrl, transactionId, amount}`. **No student created here** — webhook does it.
9. **Free path** (amount 0 / 100% promo): optional zero-amount `status="paid"` txn (only if promo drove it to 0), then `User`+`StudentInfo`+`UserStudent`, `studentProvisioningService.provision(...)`, `membershipService.setPrimaryInstitute(..., "school-free-provision")`, `incrementSchoolTierCount(activeTierId)`, `StudentAssessmentMapping`, `consumePromoIfPresent`, `sendRegistrationEmail`. Returns `{status:"success", username, dob}`.

#### Count increment
- **Free path** increments the **TIER** (`incrementSchoolTierCount` → `schoolTierRepository.tryIncrementCount`), NOT the link.
- **`SchoolRegistrationLink.currentCount` is touched ONLY by the webhook** (`PaymentWebhookController.tryIncrementSchoolLink`, on a paid school webhook), which also auto-deactivates the link at cap. Free path never moves the link counter.

### 4.4 The two GAPS (explicit)

1. **Mints NO `StudentEntitlement`.** `grep "Entitlement"` in `SchoolRegistrationController.java` = **zero matches**; no `EntitlementService` autowire. The paid completion in `PaymentWebhookController` for the school branch (`createStudentAndAllotAssessment`/`handleExistingStudentPayment`) **also does not call `entitlementService`** — `activateB2BOnPayment`/`activateOnPayment` fire only on the B2B-mapping and B2C branches. A school registration's entire footprint is `User` + `StudentInfo` + `UserStudent` + ABAC role/scope + institute membership + `StudentAssessmentMapping`. **Assessment access is conferred purely by `StudentAssessmentMapping`** — there is no report/dashboard/counselling/LMS entitlement and the entitlement-keyed gates ([§6](#6-entitlements--access-gating)) will deny these students.
2. **Never calls `instituteAssessmentService.ensure()`.** `grep ensure/instituteAssessment/InstituteAssessment` in `SchoolRegistrationController.java` = **zero matches**; not in its tier service, not in its provisioning service, not in the school webhook branch. `ensure()` is invoked only from `AssessmentInstituteMappingController` (line 226) and `CampaignController` (lines 156, 237). **So the live legacy school flow never feeds the catalog SSOT** — only the one-time V005 migration backfilled the school configs that existed at migration time. New school configs created at runtime are absent from `institute_assessment` and therefore from Reports Hub.

---

## 5. Catalog SSOT (`institute_assessment`)

**Entity:** `model/career9/InstituteAssessment.java` · **Service:** `service/career9/InstituteAssessmentService.java` · **DDL:** V20260606001

### 5.1 Schema
PK `id` BIGINT IDENTITY · `institute_code` INT NN · `assessment_id` BIGINT NN · **UNIQUE** `uk_institute_assessment(institute_code, assessment_id)` · `is_active` BOOLEAN DEFAULT TRUE · `created_at` · `updated_at`. Semantics: "this assessment is offered by this institute."

### 5.2 Service API — `ensure` vs `enable`

| | `ensure(instituteCode, assessmentId)` | `enable(...)` (catalog POST endpoint #9) |
|---|---|---|
| Purpose | Idempotent upsert from any mapping/campaign write | Admin explicitly enabling assessments |
| Cap (`maxAssessments`) | **NOT enforced** (a link create must never be refused) | **Enforced** — throws `IllegalStateException("Assessment limit reached for this institute (max N)")` (→ 400) before activating/inserting each id past the cap |
| Behavior | existing+active → no-op; existing+disabled → **reactivate**; missing → **insert** | activates/inserts cap-permitting |

```java
@Transactional
public InstituteAssessment ensure(Integer instituteCode, Long assessmentId) {
    if (instituteCode == null || assessmentId == null) return null;
    Optional<InstituteAssessment> existing = repository.findByInstituteCodeAndAssessmentId(instituteCode, assessmentId);
    if (existing.isPresent()) {
        InstituteAssessment ia = existing.get();
        if (!Boolean.TRUE.equals(ia.getIsActive())) { ia.setIsActive(true); return repository.save(ia); }
        return ia;
    }
    return repository.save(new InstituteAssessment(instituteCode, assessmentId));
}
```

### 5.3 Every current `ensure()` upsert call site

| Call site | Trigger | Feeds catalog? |
|---|---|---|
| `AssessmentInstituteMappingController.java:226` (`createMapping`) | Sub-system A mapping create | ✅ |
| `CampaignController.java:156` | B2C campaign create/edit | ✅ |
| `CampaignController.java:237` | B2C campaign assessment add | ✅ |
| **Sub-system B (school) — anywhere** | — | ❌ **never** (GAP — [§4.4](#44-the-two-gaps-explicit)) |
| **B2C webhook runtime** | — | ❌ relies on create-time `ensure()` + V006 backfill |

### 5.4 Read consumers & backfills
- **Reads:** Reports Hub treats `institute_assessment` as the single union "what assessments does this institute really offer." Endpoint #8 (`GET …/institute/{code}/catalog`) and the admin catalog UI read it.
- **Backfills:** V001 (from A's mappings + B's configs, deduped), V006 (institute-tied B2C campaign assessments). These are one-time migrations; runtime coverage depends on the `ensure()` call sites above — hence the school runtime gap.

---

## 6. Entitlements & access gating

**Service:** `service/b2c/EntitlementService.java` · **Model:** `model/career9/b2c/StudentEntitlement.java` · **Controller:** `controller/career9/b2c/EntitlementController.java` · **Scheduler:** `service/b2c/EntitlementSchedulerService.java`

### 6.1 The contract row
`StudentEntitlement` is the **single access-grant row shared by B2C and B2B**. Discriminator: `campaign_id` (B2C) XOR `mapping_id` (B2B); the model comment states the invariant `(campaign_id XOR mapping_id)`. Service flags are **denormalized snapshots taken at activation** so future tier edits don't reshape an existing grant: `final_report_active`, `dashboard_active`(+`dashboard_expires_at`), `counselling_active`(+`counselling_sessions_total`/`_used`), `lms_active`(+`lms_expires_at`), plus overall `expires_at`. `access_token` (unique 64-char, 30-byte SecureRandom) + `access_token_expires_at` gate every public deep link. `status` ∈ {pending, active, expired, revoked, refunded}.

### 6.2 Lifecycle
- **`createPending(userStudentId, campaignId, assessmentId, purchasePath, counsellingModel)`** — B2C pending; idempotent by `(userStudentId, assessmentId, campaignId)`. Called from `EntitlementController.startFreeTrial` and `CampaignPublicController`.
- **`activateB2BOnPayment(paymentTransactionId)`** — the **single B2B entry point** for both first free registration and free→paid upgrade. Requires the txn to carry `mapping_id` + `mapping_tier_id` (so `campaign_id` stays NULL). Triple-layered idempotency: (1) lookup by `paymentTransactionId`; (2) early no-op if already `active` for this txn; (3) terminal-state guard — never resurrect a `revoked`/`refunded` row. **Sends no email** — the register/webhook paths own credential delivery.
- **`findOrCreateB2B(txn)`** — reuses the student's latest non-terminal B2B row (`campaign_id == null`) for the same assessment so the upgrade **merges in place** rather than spawning a new entitlement.
- **`applyMappingTierSnapshot(e, tier)`** — the B2B **additive UNION** (see [§7.2](#72-freepaid-upgrade)).
- Others: `onAssessmentCompleted` (emails report link at submit), `redeemAccessToken(token, entitlementId)` (public redemption — returns the row only if token valid, ids match, status ∈ {active, pending}, not expired), `revoke`/`extendExpiry`/`consumeCounsellingSession`/`resendServiceLink` (all `STATE1`-guarded; resend ignores caller-supplied recipient to prevent token exfiltration).

### 6.3 Why B2B (campaign_id=NULL, mapping_id set) passes the same gates
**Every gate queries by `(userStudentId, assessmentId)` + the service flag only — it never reads `campaignId` or `mappingId`.** Because `activateB2BOnPayment` writes the identical flag columns and sets `status=active`, a B2B row is indistinguishable from a B2C row at the gate.

| Gate | File | Predicate (no campaign/mapping term) |
|---|---|---|
| Dashboard / Insight | `service/dashboard/insight/InsightAccessService.java` (consumed by `InsightDashboardService.applyAccess:109`) | released report OR (`status=="active"` && `dashboardActive` && window not expired) |
| Final-report PDF | `controller/career9/BetReportDataController.java:133` | `redeemAccessToken` then `finalReportActive` (403 else) |
| Report-prepare | `controller/career9/b2c/ReportPreparationController.java:60` | `status=="active"` && `finalReportActive` && `assessmentId` match |
| Counselling | `controller/career9/b2c/CampaignPublicController.java:1014` | `counsellingActive` && `(total-used)>0` |
| Dashboard SSO | `EntitlementController.redeemDashboardToken:265` | re-checks `dashboardActive` + window (defensive) |

The discriminator (`campaign_id` vs `mapping_id`) matters only to the **minting** services, never to the **consuming** gates. The `EntitlementSchedulerService` hourly sweep (lines 108–123) flips per-service flags off on expiry purely from flag+expiry columns — also campaign/mapping-agnostic.

### 6.4 Provisioning (`StudentProvisioningService`)
`service/StudentProvisioningService.java` is the central idempotent ABAC provisioner. It does **not** create `User`/`StudentInfo`/`UserStudent` (callers do); it grants the authorization bundle. `provision(UserStudent)` → `provision(userId, instituteId)` performs three idempotent steps: (1) `normalizeProviderMarker` (sets `User.provider = custom_student` only when null), (2) `ensureStudentMapping` (`UserRoleGroupMapping` to the `student` role group, seeded by V20260522001), (3) `ensureInstituteScope` (`UserRoleScope` scoped to the institute; **NULL = wildcard** for B2C students). Credentials are **username + DOB** (DOB unhashed); the credential email is owned by the registration controller, not this service.

---

## 7. Payments & free→paid upgrade

**Files:** `controller/career9/AssessmentInstituteMappingController.java`, `controller/career9/PaymentWebhookController.java`, `controller/career9/PaymentController.java`, `service/b2c/EntitlementService.java`, `service/career9/AssessmentMappingTierService.java`.

> **Gateway:** Razorpay **Payment Links** (not Orders). `razorpayService.createPaymentLink(...)` returns `linkId` + `shortUrl`; `razorpay_order_id`/`razorpay_payment_id` are back-filled from the webhook's `payment.entity` at capture. There is no separate order-creation step.

### 7.1 Paid B2B registration

**Link creation** (`createPaymentAndRedirect`): the `payment_transaction` row is written **before** the irreversible Razorpay call ("PAY1" ordering) in its own committed transaction via `paymentTransactionWriter.saveInNewTransaction(txn)`:

```java
PaymentTransaction txn = new PaymentTransaction();
txn.setMappingId(mappingId);            txn.setMappingTierId(mappingTierId);   // active AssessmentMappingTier.tier_id
txn.setAmount(finalAmountInr);          txn.setOriginalAmount(originalAmountInr);
txn.setAssessmentId(assessmentId);      txn.setInstituteCode(instituteCode);
txn.setStudentName(name); txn.setStudentEmail(email); txn.setStudentDob(dob); txn.setStudentPhone(phone);
txn.setStatus("created");
txn = paymentTransactionWriter.saveInNewTransaction(txn);
// → createPaymentLink → stamp razorpayLinkId/shortUrl → saveInNewTransaction → cancelPriorOutstandingLinks
```

Razorpay `notes` carry `mappingId`, `assessmentId`, `instituteCode`, `studentEmail/Name`, and crucially `transactionId` (PAY1 fallback recovery key). Response: `{status:"payment_required", paymentUrl, transactionId, amount}`.

**The paid-B2B `payment_transaction` row:**

| column | value |
|---|---|
| `mapping_id` | the mapping (B2B discriminator; non-null) |
| `campaign_id` / `school_config_id` | null |
| `mapping_tier_id` | the active paid `AssessmentMappingTier.tier_id` |
| `amount` / `original_amount` | post-promo / pre-promo INR |
| `purchase_path` | **null** on first-paid registration (not load-bearing for B2B minting) |
| `status` | `created` → `paid` (webhook) |
| `user_student_id` | null at creation; stamped by webhook after provisioning |

> `POST /payment/generate-link` (admin) creates a txn with `mappingId`/`assessmentId`/`instituteCode` but **does NOT set `mappingTierId`** (hand-entered amount) — so `activateB2BOnPayment` does **not** fire for admin-generated links. Only public `/register` and `/pay-for-upgrade` stamp the tier id.

**Webhook** (`POST /payment/webhook/razorpay`, `payment_link.paid`): HMAC-verified against **raw bytes** (`verifyWebhookSignature(payloadBytes, signature)`; bad/missing → 401). `handlePaymentLinkPaid` locks the row with `findByRazorpayLinkIdForUpdate(linkId)` (serializes deliveries; PAY1 fallback recovers by `notes.transactionId`), then `markPaidAndProvision(txn, payment, notes)` (idempotent: `if ("paid".equals(txn.getStatus())) return false;`). Branching:

```java
if (txn.getCampaignId() != null && txn.getCampaignAssessmentTierId() != null) {
    provisionB2CStudentAndEntitlement(txn);
} else {
    createStudentAndAllotAssessment(txn);
    if (txn.getMappingId() != null && "paid".equals(txn.getStatus())) {
        entitlementService.activateB2BOnPayment(txn.getTransactionId());   // first paid OR upgrade
    }
}
```

`createStudentAndAllotAssessment` (B2B branch): idempotent redrive if `userStudentId` set (just `ensureAssessmentMapping`); duplicate-by-email → `handleExistingStudentPayment`; else create `User`+rollnumber+`StudentInfo`+`UserStudent` + `provision` + `setPrimaryInstitute` + `tryIncrementSchoolLink`/`tryIncrementMappingTier` + `StudentAssessmentMapping` + stamp `userStudentId` + welcome email. On exception → `status="paid_provisioning_failed"` + `failureReason`. Then `activateB2BOnPayment` mints the entitlement; `consumePromoIfPresent` runs while still `paid`. Webhook returns **200 on success, 500 on any exception** (Razorpay retries); idempotency via row lock + `status=="paid"` early-exit. Safety net: `GET /payment/webhook/status/{razorpayLinkId}?reconcile=1` re-drives `reconcilePaidAndProvision` through the Spring proxy (same lock), and for txns already carrying `user_student_id` returns the session payload + mints the `cn_at_asmnt` cookie once paid.

### 7.2 Free→paid upgrade

A free-registered student already has a `StudentEntitlement` (`campaign_id=null`, `mapping_id` set, free-tier inclusions — minted at registration via the zero-amount `status="paid"` txn).

**Endpoints** (both in `AssessmentInstituteMappingController`, public, entitlement-id-gated):
- `GET /assessment-mapping/public/upgrade-info/{entitlementId}` — validates `campaignId==null && mappingId!=null`, resolves the mapping's **active paid wave**, returns `{available, amount, tierName, inclusions, current:{finalReportActive,dashboardActive,counsellingActive,lmsActive}}` so the SPA renders only the delta. No priced wave → `{available:false}`.
- `POST /assessment-mapping/public/pay-for-upgrade` body `{entitlementId}` — re-validates, re-resolves the active paid wave, pulls contact from the student's `UserStudent`/`StudentInfo`, creates the **upgrade txn**:

```java
txn.setMappingId(mapping.getMappingId());
txn.setMappingTierId(wave.getTierId());        // the active PAID wave
txn.setAmount(wave.getAmount());  txn.setOriginalAmount(wave.getAmount());
txn.setUserStudentId(ent.getUserStudentId());  // ← PRE-SET: webhook creates NO new account
txn.setPurchasePath("U");                       // ← the 'U' upgrade marker
txn.setStatus("created");
txn = paymentTransactionWriter.saveInNewTransaction(txn);
```

**What makes it upgrade-shaped:** `user_student_id` is **pre-set** → in `createStudentAndAllotAssessment` the guard `if (txn.getUserStudentId() != null) { ensureAssessmentMapping(...); return; }` short-circuits all account creation **and skips the tier-cap increment**. `purchase_path='U'` is an analytics/audit marker (the webhook branches on `mapping_id`/`campaign_id`/`user_student_id`, not on `'U'`). `mapping_tier_id` points at the **paid wave**, so the snapshot pulls in the paid services.

**The UNION** (`applyMappingTierSnapshot`) — additive, never drops a granted service, **max** sessions, **later** window:

```java
e.setFinalReportActive(Boolean.TRUE.equals(e.getFinalReportActive()) || Boolean.TRUE.equals(tier.getIncludesFinalReport()));
e.setDashboardActive  (Boolean.TRUE.equals(e.getDashboardActive())   || Boolean.TRUE.equals(tier.getIncludesDashboard()));
e.setCounsellingActive(Boolean.TRUE.equals(e.getCounsellingActive()) || Boolean.TRUE.equals(tier.getIncludesCounselling()));
e.setLmsActive        (Boolean.TRUE.equals(e.getLmsActive())         || Boolean.TRUE.equals(tier.getIncludesLms()));
e.setCounsellingSessionsTotal(Math.max(curSessions, newSessions));            // sessions: max, not sum
// dashboard/LMS windows extended to laterExpiry(...); overall expires_at = earliest active service window
```

> **Contrast with B2C:** `applyTierSnapshot` (B2C, from a `PricingTier`) **overwrites** flags (plain `set`, not OR). B2C free→paid is handled by promoting the same pending row (`activateOnPayment`/`upgradePending`), not unioning. **The additive-union is specifically B2B behavior** — a student who registered free (report-only) and pays for dashboard/counselling keeps the report and gains the new services on one row.

**Confirmed `activateB2BOnPayment` call sites:** `AssessmentInstituteMappingController.java:887` (free, new student), `:1218` (free, existing student new assignment), `PaymentWebhookController.java:482` (paid first registration AND free→paid upgrade).

### 7.3 The overloaded `mapping_tier_id`

A single nullable column carries an id belonging to **one of two tables** — `assessment_mapping_tier` (B2B) **or** `school_assessment_tier` (legacy school). There is no separate `school_tier_id`. The disambiguator is a **sibling column on the same row**:

- `school_config_id` non-null ⇒ **school tier table**
- `mapping_id` non-null ⇒ **assessment-mapping tier table**
- `campaign_id` non-null ⇒ B2C, which uses the separate `campaign_assessment_tier_id` (never overloads `mapping_tier_id`)

Disambiguation at every read site:

```java
// PaymentWebhookController.tryIncrementMappingTier — cap increment
boolean school = txn.getSchoolConfigId() != null;
int rows = school ? schoolAssessmentTierRepository.tryIncrementCount(txn.getMappingTierId())
                  : assessmentMappingTierRepository.tryIncrementCount(txn.getMappingTierId());

// EntitlementService.activateB2BOnPayment — only fires for mapping_id != null; loads ONLY from
// assessmentMappingTierRepository.findById(txn.getMappingTierId()). School txns never reach it.

// AssessmentMappingTierService recount — scoped so a numeric collision can't cross-pollinate:
paymentTransactionRepository.countByMappingTierIdAndStatusAndMappingIdIsNotNull(tierId, "paid");      // mapping
paymentTransactionRepository.countByMappingTierIdAndStatusAndSchoolConfigIdIsNotNull(tierId, "paid"); // school
```

The column **remains physically overloaded** (a commented design compromise: *"The single mappingTierId column is overloaded… Route to the correct table"*) but is safely disambiguated everywhere because `school_config_id` and `mapping_id` are mutually exclusive on a given txn.

### 7.4 Payment endpoint table

| Method | URL | Auth | Purpose |
|---|---|---|---|
| POST | `/payment/generate-link` | `payment.create` | Admin: create txn (mapping/assessment/institute, **hand-entered amount, no `mapping_tier_id` → no minting**) + Razorpay link |
| POST | `/payment/generate-campaign-link` | `payment.create` | Admin: B2C campaign link (sets `campaign_id`+`campaign_assessment_tier_id`+`purchase_path`); 503 if B2C disabled |
| GET | `/payment/transactions` | `payment.read.all` | List txns (status/instituteCode filters) |
| GET | `/payment/transactions/by-mapping/{mappingId}` | `payment.read` | Txns for one mapping |
| POST | `/payment/{transactionId}/send-nudge` | `payment.update` | Payment-pending nudge email |
| POST | `/payment/{transactionId}/resend-welcome` | `payment.update` | Resend welcome (paid only) |
| POST | `/payment/{transactionId}/send-email` | `payment.update` | Email link; logs `payment_notification_log` |
| POST | `/payment/{transactionId}/send-whatsapp` | `payment.update` | `wa.me` message; logs notification |
| GET | `/payment/{transactionId}/notifications` | `payment.read` | Notification log |
| POST | `/payment/webhook/razorpay` | **Razorpay HMAC** (no JWT) | Primary webhook: paid → provision + (B2B) `activateB2BOnPayment`; also expired/cancelled/failed |
| GET | `/payment/webhook/status/{razorpayLinkId}` | `payment_webhook.read` | Status poll; `?reconcile=1` → locked mark-paid+provision; issues session cookie when paid |
| GET | `/payment/webhook/info/{transactionId}` | `payment_webhook.read` | Txn info for the form (amount, status, names) |
| POST | `/payment/webhook/register/{transactionId}` | `payment.create` | Student fills pre-payment details onto the txn |
| POST | `/assessment-mapping/public/register/{token}` | Public (token) | **B2B self-registration** (free or paid) |
| GET | `/assessment-mapping/public/info/{token}` | Public (token) | B2B link info |
| GET | `/assessment-mapping/public/upgrade-info/{entitlementId}` | Public (entitlement-id) | **Free→paid upgrade quote** |
| POST | `/assessment-mapping/public/pay-for-upgrade` | Public (entitlement-id) | **Free→paid upgrade checkout** (`purchase_path='U'`) |
| GET | `/student-checkout/dashboard-options` | `isAuthenticated()` | B2C self-service: dashboard-including campaign tiers |
| POST | `/student-checkout/dashboard-link` | `isAuthenticated()` | B2C self-service: Razorpay link for chosen campaign tier |

**`purchase_path` values:** `'B'` (B2C bundle default, from `applyTierSnapshot`/campaign default), `'U'` (free→paid upgrade, set in `payForUpgrade`); B2B first-paid leaves it **null**.

---

## 8. Frontend surface

Two separate React SPAs share the same Spring backend but ship to different hosts.

| App | Dir | Tooling | Base-URL env | Role |
|---|---|---|---|---|
| **career-nine-assessment** (student) | `/career-nine-assessment` | Vite | `VITE_API_URL` (axios `baseURL`, `src/api/http.ts:61`, `withCredentials:true`) | Public registration + upgrade + taking the assessment |
| **react-social** (admin) | `/react-social` | CRA | `REACT_APP_API_URL` (every `_APIs.ts`); link host `REACT_APP_ASSESSMENT_APP_URL` (default `https://assessment.career-9.com`) | Admin: create mappings/catalog/links, configure institutes |

### 8.1 Student app — page → token type → backend

All public registration lands in the single career-nine-assessment SPA; routing is by URL/token (`src/App.tsx`).

| Route | Page component | Token/param | Flow | API client |
|---|---|---|---|---|
| `/assessment-register/:token` | `AssessmentRegisterPage.tsx` | per-mapping token (free or paid) | **B2B unified mapping** | `assessmentMappingAPI.ts` |
| `/assessment-upgrade/:entitlementId` | `AssessmentUpgradePage.tsx` | entitlementId | **B2B upgrade** | `assessmentMappingAPI.ts` |
| `/school-register/:token` | `SchoolAssessmentRegisterPage.tsx` | per-session school link | **B2B legacy "School Level"** | `schoolRegistrationAPI.ts` |
| `/c/:slug`, `/c/:slug/:assessmentId`, `/c/:slug/:assessmentId/:tierId` | `CampaignRegisterPage.tsx` | campaign slug | B2C campaign (contrast) | `campaignAPI.ts` |
| `/c/:slug/:assessmentId/upgrade/:entitlementId` | `PayForReportPage.tsx` | entitlementId | B2C upgrade | `campaignAPI.ts` |
| `/payment-status` | `PaymentStatusPage.tsx` | — | post-Razorpay landing (all paid flows) | — |

Behaviors:
- **Free vs Paid (B2B unified):** both land on the **same** `AssessmentRegisterPage`; the page branches on backend-resolved `mappingInfo.linkType === "PAID"` (never on `amount > 0`). A paid link is a single resolved wave price (no tier picker). `registrationClosed` is honored (no fall-through). Paid `payment_required` → redirect to `res.data.paymentUrl`. Free success → write the auto-login session payload (`userStudentId` + `assessments` + `dob`) to `localStorage`, navigate to `/allotted-assessment`.
- **School flow is a distinct surface:** different page/token/controller, with a debounced pre-submit `verifyStudentDetails` check; submit gated on `verifyStatus === "verified"`.
- **Whitelabel:** rendered on both `AssessmentRegisterPage` (`mappingInfo.branding`) and `SchoolAssessmentRegisterPage` (`schoolInfo.branding`) — when `branding.whitelabel && branding.logoUrl`, show the school logo; the "CAREER-9" footer is always kept.
- **Promo codes:** both B2B pages call `validatePromoCode` (`promoCodeAPI.ts` → `POST /promo-codes/public/validate`) and pass `promoCode` in the register body.
- **`/assessment-upgrade/:entitlementId` is wired but NOT linked from any page** in either repo (no generator builds that URL — confirmed by grep). Reachable only by direct URL / external email. (The B2C upgrade CTA uses the separate `/c/.../upgrade/...` route.)

### 8.2 Admin app — routes & menu (react-social)

**Routes** (`src/app/routing/PrivateRoutes.tsx`):

| Path | Component | Guard |
|---|---|---|
| `/college` | `College/CollegePage` | `institute.read` |
| `/college/create` | `College/CollegePage` | `institute.write` |
| `/college/edit/:id` | `CollegeEditPage` | (institute) |
| `/assessment-mapping` | `AssessmentMapping/AssessmentMappingPage` | (institute) |
| `/school/principal/dashboard/...` | `dashboard/InstituteDashboard` | `institute.read` |
| `/text-response-mapping` | `TextResponseMapping/TextResponseMappingPage` | — |
| `/old-data-mapping` | `OldDataMapping/OldDataMappingPage` | — |

> **No top-level route for the catalog or the school-registration panel** — they are mounted inside other surfaces.

**Menu** (`src/_metronic/layout/components/aside/AsideMenuMain.tsx`), under **Institute → Institute Management** (gated by `showInstitute`):
- `/college` — "Institute" (list)
- `/assessment-mapping` — "Assessment Mapping" (standalone unified mapping page)
- plus `/contact-person`, `/group-student`, `/reminders`, `/student-management`, `/student-list`, `/board`, `/upload-excel`. Under **Assessment Management**: `/text-response-mapping`.

**How each B2B admin surface is reached:**
- **Unified Assessment Mapping** (mappings, catalog, dual free/paid links, tiers): `/assessment-mapping` → `AssessmentMappingPage.tsx` → institute picker → `AssessmentMappingPanel` (`College/components/AssessmentMappingPanel.tsx`), which embeds `CatalogSelector` and opens `TierManagementModal`. QR via `qrcode.react`.
- **Institute catalog** ("which assessments this institute offers"): `InstituteCatalogPicker` (`College/components/InstituteCatalogPicker.tsx`), mounted as **Step 3 of `InstituteWizardModal`** (opened from `CollegePage.tsx:93`). Steps: 1=details (+logo upload for whitelabel), 2=`InstituteSessionDetailsPanel`, 3=`InstituteCatalogPicker`.
- **School-level registration** (single session link + per-class config): `SchoolAssessmentMappingPanel` → `SchoolTierManagementModal` (mounted via `SchoolAssessmentMappingModal`; **self-contained, not opened from `CollegeTable` in the current tree — effectively standalone/legacy entry**, while the live unified path is `/assessment-mapping` + the College wizard).
- **College CRUD + sessions/classes/sections**: `CollegePage.tsx` + `College/components/*`, backed by `College_APIs.ts`.

### 8.3 Module → endpoint map

**Student app (`VITE_API_URL`):**
- `assessmentMappingAPI.ts` (B2B unified): `getMappingInfoByToken` → `GET /assessment-mapping/public/info/{token}` · `registerStudentByToken` → `POST /assessment-mapping/public/register/{token}` · `getUpgradeInfo` → `GET /assessment-mapping/public/upgrade-info/{entitlementId}` · `payForUpgrade` → `POST /assessment-mapping/public/pay-for-upgrade`
- `schoolRegistrationAPI.ts` (B2B school): `getSchoolInfo` → `GET /school-registration/public/info/{token}` · `verifyStudentDetails` → `POST /school-registration/public/verify-details/{token}` · `registerSchoolStudent` → `POST /school-registration/public/register/{token}`
- `promoCodeAPI.ts`: `validatePromoCode` → `POST /promo-codes/public/validate`
- `campaignAPI.ts` (B2C, contrast): `/campaign/public/*`, `/entitlement/redeem-token`, `/bet-report-data/public/prepare`

**Admin app (`REACT_APP_API_URL`):**
- `AssessmentMapping/API/AssessmentMapping_APIs.ts`: mappings (`POST /assessment-mapping/create`, `GET …/getByInstitute/{code}`, `…/getByInstitute/{code}/assessments`, `PUT …/update/{id}`, `DELETE …/delete/{id}`, `GET /assessments/get/list-summary`); catalog (`GET|POST /assessment-mapping/institute/{code}/catalog`, `PATCH …/institute/catalog/{id}/toggle`, `DELETE …/institute/catalog/{id}`); link toggle (`PATCH …/{mappingId}/link/{free|paid}/toggle`); tiers (`GET|POST …/{mappingId}/tiers`, `PUT …/tiers/{tierId}`, `PATCH …/tiers/{tierId}/toggle`, `DELETE …/tiers/{tierId}`, `POST …/tiers/{tierId}/recount`); public preview (`…/public/info/{token}`, `…/public/register/{token}`)
- `SchoolRegistration/API/SchoolRegistration_APIs.ts`: config (`create`, `batch-save`, `by-institute/{code}/{sessionId}`, `update/{id}`, `delete/{id}`); links (`generate`, `by-institute/{code}/{sessionId}`, `toggle/{id}`, `{id}/max-registrations`); tiers (`{code}/{sessionId}/{assessmentId}`, `{tierId}` + toggle/delete); public (info/register/verify-details)
- `College/API/College_APIs.ts`: institute (`/instituteDetail/get|get/list|getbyid/{id}|update|upload-logo|delete/{id}|deleted|restore/{id}|map-contacts-boards|get-mappings/{code}`); sessions/classes/sections (`/schoolSession/*`, `/schoolSession/class/*`, `/schoolSession/section/*`, `/schoolSession/resolve-or-create`). **`POST /instituteDetail/upload-logo`** → DO Spaces, the whitelabel logo.

**Cross-app link generation** (admin builds, student consumes), via `REACT_APP_ASSESSMENT_APP_URL`:
- `${ASSESSMENT_APP_URL}/assessment-register/${token}` (`AssessmentMappingPanel.tsx:31`)
- `${ASSESSMENT_APP_URL}/school-register/${link.token}` (`SchoolAssessmentMappingPanel.tsx:206-207`)
- `${ASSESSMENT_APP_URL}/c/{slug}/...` (`RegistrationLinks.tsx`)

**Legacy bridge redirects** (`react-social/src/app/routing/AppRoutes.tsx`) keep already-distributed dashboard-host links alive (preserving query string): `/assessment-register/:token` → assessment app (38-49, 246-249); `/school-register/:token` (82-94, 250-253); `/payment-status` (51-61); `/c/:slug` → `CampaignLandingRedirect` (63-77); `/student-login` → `https://assessment.career-9.com/` (243-245).

---

## 9. End-to-end flows

For each: the trigger, tables written, and whether `institute_assessment` is fed.

### (a) Admin sets up a per-level mapping + shares free+paid links
Admin → `/assessment-mapping` → picks institute → `POST /assessment-mapping/create` (`createMapping`). **Writes:** `assessment_institute_mapping` (1 row, mints `paid_token`/`free_token`/`token`, `paid_active=free_active=true`), `assessment_mapping_tier` (1 free tier, `is_free=true`, `sort_order=-1`, amount 0), and `instituteAssessmentService.ensure(...)` → `institute_assessment`. Admin then adds paid waves (`POST …/{mappingId}/tiers`) and shares `${ASSESSMENT_APP_URL}/assessment-register/{paid_token}` and `/{free_token}`. **Catalog fed:** ✅.

### (b) Admin sets up legacy school registration + shares one link
Admin → School panel → `POST /school-registration/config/create` (or `batch-save`) per class, `POST /school-registration/link/generate` (one (institute,session) token), `POST /school-registration/tiers/...` for pricing. **Writes:** `school_assessment_config`, `school_registration_link`, `school_assessment_tier`. Shares `${ASSESSMENT_APP_URL}/school-register/{token}`. **Catalog fed:** ❌ (no `ensure()` on the school path — only V005 backfilled pre-existing configs).

### (c) Student registers FREE (sub-system A) → entitlement minted
Student opens `/assessment-register/{free_token}` → `GET /assessment-mapping/public/info/{token}` (FREE, amount 0, inclusions) → `POST …/register/{token}`. Free path: `tryIncrementCount(freeTier)`; **writes** zero-amount `status="paid"` `payment_transaction` (with `mapping_id`+`mapping_tier_id`); `student_user` (`User`), `student_info`, `user_student`; ABAC (`UserRoleGroupMapping`, `UserRoleScope`); institute membership; `student_assessment_mapping`; then **`activateB2BOnPayment` writes `student_entitlements`** (free-tier inclusions, `campaign_id=null`, `mapping_id` set, `status=active`, `access_token`). Auto-login cookie + credentials email. **Catalog fed:** not re-fed (already enrolled at create-time).

### (d) Student registers PAID (sub-system A) → payment → webhook → entitlement
Student opens `/assessment-register/{paid_token}` → `/info` (PAID, wave amount) → `/register`. Paid path: **writes** `payment_transaction` (`status="created"`, `mapping_id`+`mapping_tier_id`=active wave) → Razorpay link → redirect. On `payment_link.paid`: webhook locks the row, `markPaidAndProvision` → `createStudentAndAllotAssessment` **writes** `student_user`/`student_info`/`user_student` + ABAC + membership + `tryIncrementMappingTier` (cap) + `student_assessment_mapping` + stamps `user_student_id`; then `activateB2BOnPayment` **writes** `student_entitlements` (paid-wave inclusions). Welcome email + session cookie. **Catalog fed:** not re-fed (enrolled at create-time).

### (e) Free student upgrades → `purchase_path='U'` → webhook unions paid wave
Student opens (via email/direct URL) `/assessment-upgrade/{entitlementId}` → `GET …/public/upgrade-info/{entitlementId}` (active paid wave + current-flags delta) → `POST …/public/pay-for-upgrade`. **Writes** `payment_transaction` (`status="created"`, `mapping_id`+`mapping_tier_id`=paid wave, **`user_student_id` pre-set**, `purchase_path='U'`) → Razorpay link. On `payment_link.paid`: webhook → `createStudentAndAllotAssessment` **no-ops account creation** (pre-set `user_student_id`; **no cap re-increment**) → `activateB2BOnPayment` → `findOrCreateB2B` reuses the existing free entitlement → `applyMappingTierSnapshot` **UNIONs** the paid wave's flags onto it (OR flags, max sessions, later windows), re-points `payment_transaction_id`. **No new entitlement, no new account.** **Catalog fed:** no.

> **Legacy school free / paid registration (for contrast):** writes the account graph + ABAC + membership + `student_assessment_mapping` (+ tier/link counts) but **mints NO `student_entitlements`** and **does NOT feed the catalog** — assessment access is conferred purely by `student_assessment_mapping`, and the entitlement-keyed report/dashboard/counselling/LMS gates will deny these students.

---

## 10. Known gaps / risks (relevant to a UI re-split)

| # | Gap / risk | Detail & location | UI/architecture impact |
|---|---|---|---|
| 1 | **Legacy school mints NO entitlement** | `SchoolRegistrationController` and the school webhook branch never call `entitlementService`; access is only `student_assessment_mapping` ([§4.4](#44-the-two-gaps-explicit)). | School-registered students cannot pass the report/dashboard/counselling/LMS gates ([§6.3](#63-why-b2b-campaign_idnull-mapping_id-set-passes-the-same-gates)). Any UI that surfaces those services for school students will silently 403. Decide whether to migrate school onto the unified A path (V005 already mints unified mappings for existing configs) or wire `activateB2BOnPayment` into the school webhook. |
| 2 | **Legacy school never feeds the catalog** | No `ensure()` on any school write path ([§4.4](#44-the-two-gaps-explicit), [§5.3](#53-every-current-ensure-upsert-call-site)). Only V005/V001 backfilled pre-existing configs; **runtime-created school configs are absent from `institute_assessment`** and thus from Reports Hub. | Reports Hub under-reports school assessments created after migration. A re-split should either route school creates through `ensure()` or deprecate the school create path entirely. |
| 3 | **`@PreAuthorize` on "public" school endpoints** | All three `/school-registration/public/*` are `@PreAuthorize`-gated (`// PUBLIC?: flagged for 15-06 exclusions review`), unlike sub-system A's truly-`permitAll` `/assessment-mapping/public/**` ([§4.1](#41-admin--public-endpoints)). | If the security exclusion list isn't kept in sync, anonymous students get 401/403 on the school flow. Inconsistent with A — a UI re-split should unify the public-endpoint security model. |
| 4 | **`mapping_tier_id` overloaded across two tier tables** | One column → `assessment_mapping_tier` OR `school_assessment_tier`, disambiguated only by the `mapping_id`/`school_config_id` sibling ([§7.3](#73-the-overloaded-mapping_tier_id)). Recounts are scoped to avoid cross-pollination. | Fragile; any new consumer of `mapping_tier_id` MUST replicate the sibling-column routing or it will read the wrong table. Folding school into A removes this overload. |
| 5 | **Upgrade endpoints gated by sequential entitlement id** | `/public/upgrade-info/{entitlementId}` and `/public/pay-for-upgrade` are gated only by an enumerable numeric id; the sole check is `campaignId==null && mappingId!=null` ([§3.1](#31-admin--public-endpoints)). | Enumeration exposes assessment/inclusion data and lets a caller mint upgrade payment links for arbitrary students. Consider requiring the entitlement `access_token`, as the deep-link gates already do. |
| 6 | **`/assessment-upgrade/:entitlementId` route is orphaned** | Wired in the student SPA but linked from nowhere; reachable only by direct URL / external email ([§8.1](#81-student-app--page--token-type--backend)). | If the upgrade flow is part of the UI plan, a CTA/link generator must be added; otherwise the route is dead. |
| 7 | **Two standalone vs wizard entry points for mapping/school admin** | Unified mapping is reachable both standalone (`/assessment-mapping`) and via the College wizard (catalog step); the school panel is self-contained and not wired into `CollegeTable` ([§8.2](#82-admin-app--routes--menu-react-social)). | Ambiguous admin IA. A re-split should pick one canonical entry per surface (likely the College wizard for catalog, `/assessment-mapping` for links/tiers) and retire the orphaned school modal. |
| 8 | **`SchoolAssessmentConfig.amount` is dead for pricing** | Public school pricing always comes from the tier, never the config's `amount` ([§4.3](#43-the-public-school-registration-flow)). | Don't expose/edit config `amount` in any new UI — it misleads admins. |
| 9 | **B2C webhook catalog coverage relies on create-time `ensure()` + V006** | The B2C runtime webhook doesn't re-`ensure()`; coverage depends on campaign-create `ensure()` (CampaignController:156/237) and the one-time V006 backfill ([§5.3](#53-every-current-ensure-upsert-call-site)). | Acceptable today but the same class of gap as #2 — note it if campaign-create paths change. |
| 10 | **Free-path cap is best-effort** | Sub-system A free registration is not rolled back if `tryIncrementCount` returns 0 (lost cap race) ([§3.4](#34-the-unified-public-registration-flow)). | A capped free tier can be overshot by 1 under concurrency. Surface caps as soft in the UI, not hard guarantees. |