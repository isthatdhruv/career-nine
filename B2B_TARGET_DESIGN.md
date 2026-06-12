# B2B Areas A & B — Target Design (Staff Engineer's Call)

> Source of record: `B2B_ARCHITECTURE.md` §1–§10, verified in code against `SchoolAssessmentConfig.java` (UNIQUE `institute_code, session_id, class_id`; own `assessment_id` per row), `SchoolAssessmentTier.java` (UNIQUE `institute_code, session_id, assessment_id, sort_order`; **BIGINT** institute/session; has `max_registrations`/`current_count`), `AssessmentMappingTier.java` (UNIQUE `mapping_id, sort_order`; **INT** scope), `CampaignAssessmentTier.java` (picker: `is_default`, **no** cap/wave/`is_free`), and `SchoolRegistrationController.java` (per-class→single-assessment derivation at :107/:147, authoritative batch deactivation by **class** at :171–177, one link per `(institute, session)` at :227).

---

## 1. The core question, reframed

Strip away the table names and there is exactly one domain event under both areas:

> **An institute offers an assessment to an audience, prices it with optional paid waves over a free tier, hands out registration link(s), and on every registration mints exactly one entitlement that grants services and gates access.**

Area A and Area B are **not two domains.** They differ on precisely two axes, and nothing else:

| Axis | Area A (per-level) | Area B (school) |
|---|---|---|
| **Audience / scope** | a *coordinate* in the institute→session→class→section tree | one institute+session **cohort** spanning many classes |
| **Link distribution** | one FREE + one PAID link **per scope** | **one** capped link spanning the whole cohort |

Everything downstream — catalog feed, pricing-wave-with-cap engine, entitlement mint, payment, gates, security — is *identical in intent* and only *accidentally* divergent in code. B's defects (no entitlement, no catalog feed, gated "public" endpoints, overloaded `mapping_tier_id`, no inclusions) are all symptoms of one disease: **it forked the spine instead of writing through it.**

So the decision everything hangs on is **not** "unify or keep separate." It's narrower and sharper:

> **Do the two axes that genuinely differ (audience-shape, link-distribution) get modeled as *data variants on one engine*, or as *separate pipelines*?**

The answer is **data variants on one engine.** Unify the spine completely; keep A and B as two *authoring experiences* and two *audience/link shapes* that compile to the same rows. This is the "Pragmatic Shared-Spine" thesis — **but corrected** for the two facts its own critique exposed, and hardened with the best ideas from the other three proposals.

**The one thing all four proposals got wrong and the critiques nailed:** the shape of a school link. It is **not** "one assessment over a class-set" (Radical Unifier / DDD's `CLASS_SET`), and it is **not** "multi-assessment, student-picks-assessment-on-arrival" (Shared-Spine's polymorphic offer). It is, verified in code: **a heterogeneous bundle of `(class → exactly one assessment)` pairs, sharing one link-level cap, where the price ladder is keyed per-`(institute, session, assessment)` and shared across every class running that assessment.** The student picks a *class*; the assessment is a pure function of the class. The right model must represent this natively — not approximate it.

---

## 2. The recommended target design (north star)

**Name: One Offer Engine, Two Audience Shapes, One Cohort-Link.**

A *per-scope offer* (A) and a *per-class offer inside a cohort* (B) are the **same row shape**: one assessment, one scope coordinate, its own free+paid tier ladder. The school's "one link, many classes, one cap" is **not** a property of an offer — it is a **first-class `registration_link` aggregate that groups many offers under one token and one cap.** This is the synthesis the critiques converged on independently: *promote the link to a first-class N:M aggregate (Radical Unifier's best idea), but keep offers mono-shape and single-assessment (Shared-Spine critique's correction), with reusable inclusion policies (Platform's best idea) and a hard billing/fulfillment split (DDD's best idea).*

### 2.1 Domain model (the spine — one set of tables)

```
institute_assessment                 [CATALOG SSOT — unchanged; fed by ONE writer]
   ▲ ensure()  ── called only inside OfferService.create(), in-txn
   │
service_policy                       [NEW — reusable named inclusion policy; promote pricing_tiers]
   policy_id PK · name · description
   includes_final_report
   includes_dashboard (+ dashboard_validity_days)
   includes_counselling (+ counselling_session_count)
   includes_lms (+ lms_validity_days)
   -- NO price, NO cap, NO institute scope. Pure "what services does this grant."
   │ referenced by
   ▼
assessment_offering                  [was assessment_institute_mapping — the ONE mono-shape offer row]
   offering_id PK
   institute_code INT NN
   assessment_id  BIGINT NN          ← ALWAYS present. One offering = one assessment. No nulls, no kind.
   scope_level {INSTITUTE|SESSION|CLASS|SECTION}
   session_id · class_id · section_id  (sentinel 0 = "not applicable", never NULL — see Inv. K)
   is_active
   UNIQUE (institute_code, assessment_id, session_id, class_id, section_id)   ← ENFORCEABLE (no nulls)
   -- DELETED from the old row: token, paid_token, free_token, paid_active, free_active, amount
   │ 1:N
   ▼
offering_tier                        [was assessment_mapping_tier — the ONE wave+cap table]
   tier_id PK · offering_id NN
   policy_id NN → service_policy      ← inclusions come from the policy, not inlined here
   sort_order INT NN  (free tier = -1)
   is_free BOOL  (exactly one per offering)
   amount BIGINT  (price override; 0 for free)
   max_registrations · current_count  (the per-wave cap; atomic tryIncrementCount)
   is_active
   UNIQUE (offering_id, sort_order)

registration_link                    [NEW first-class aggregate — replaces token columns AND school_registration_link]
   link_id PK · institute_code NN
   kind {FREE | PAID}
   token CHAR(36) UNIQUE NN
   is_active
   max_registrations · current_count  (OPTIONAL link-level cap — this is B's school-wide cap)
   │ N:M
   ▼
link_offering                        [NEW join — makes "one link, many offerings" first-class]
   link_id · offering_id  (PK pair)

payment_transaction                  [de-overloaded]
   ... offering_id  (was mapping_id) · offering_tier_id (was mapping_tier_id — ONE FK target)
   -- DELETED: school_config_id.  Discriminator: offering_id XOR campaign_id (DB CHECK, not a comment)

student_entitlements                 [contract row — minor rename + real constraint]
   ... offering_id (was mapping_id) · campaign_id
   access_token CHAR(64)  (unchanged; now the upgrade key)
   CHECK (offering_id IS NULL) <> (campaign_id IS NULL)   ← enforced, not a comment
```

### 2.2 What is unified vs. separate — and why

| Concern | Decision | Why | Whose idea |
|---|---|---|---|
| Inclusions (report/dashboard/counselling/LMS) | **Unified** → `service_policy` (named, reusable, NOT offer-scoped) | Kills A-inlines / B-has-none / C-factored-out drift. Re-price/re-include once, reuse across 50 offers. | Platform Architect |
| Pricing waves + caps | **Unified** → `offering_tier` (one table, A's algorithm byte-for-byte) | A and B already share the sequential-wave + atomic `tryIncrementCount` SQL. Kills the `mapping_tier_id` overload. | Shared-Spine |
| Entitlement mint | **Unified** → one `grant(offering, tier, student)` on **every** registration, free or paid | "School forgot to mint" becomes unrepresentable. Gap #1 closes by construction. | DDD / all four |
| Catalog feed | **Unified** → `ensure()` only inside `OfferService.create()`, in-txn | One create path → impossible to under-feed. Gap #2 closes by construction. | All four |
| Billing vs. fulfillment | **Separated** → free path mints entitlement **directly**, never fabricates a zero-amount `status="paid"` txn | Removes the fake-payment smell; `payment_transaction` exists iff money is owed. | DDD |
| Payment discriminator | **Unified** → `offering_id` + `offering_tier_id`, real XOR CHECK | Kills overload (Gap #4) *and* enforces the invariant that's only a comment today. | Shared-Spine + Platform |
| Public security | **Unified** → one `permitAll` + token posture | Kills the `@PreAuthorize`-on-public school endpoints (Gap #3). | All four |
| **Audience / scope** | **KEPT as data** → `scope_level` + coords on a mono-shape offer | The one genuine A/B difference. A column, not a pipeline. | Radical Unifier |
| **Link distribution** | **KEPT as data** → `registration_link` cardinality (1 offering vs. N) | The *other* genuine A/B difference. A row count, not a pipeline. | Radical Unifier |
| Admin authoring UI | **KEPT separate** → A's per-scope console, B's batch grid | Genuinely different jobs-to-be-done. Forcing B's bulk admin through A's grid is worse UX. | Shared-Spine |
| **B2C campaign pricing** | **NOT folded into `offering_tier`** | B2C is a *picker* (`is_default`, no caps/waves) — a different pricing semantic. It shares `service_policy`, `student_entitlements`, `payment_transaction`. It does **not** share the wave-cap engine. | Platform **critique** |

### 2.3 How the design is hardened against every stress-test

The critiques found five classes of defect across the four proposals. Here is how this synthesis resolves each:

1. **Tier fan-out shatters one cap into N (Radical Unifier BLOCKER).** Avoided entirely. The school cap lives on the **`registration_link`** (one row, one `max_registrations`), not cloned onto per-class tiers. Per-wave caps, if any, live on `offering_tier` and are genuinely per-offering. Two cap *owners*, never a fan-out of one cap into many.

2. **Nullable-coord UNIQUE doesn't fire (all unifier proposals).** Fixed by **Invariant K**: scope coords are `NOT NULL` with a sentinel `0` for "not applicable" (normalized by `scope_level`). `UNIQUE(institute_code, assessment_id, session_id, class_id, section_id)` now actually enforces — no in-code dedup, no MySQL `(x,y,NULL)`-is-distinct trap.

3. **Multi-assessment school offer is a phantom / heterogeneous bundle is unmodeled (DDD + Shared-Spine BLOCKERs).** Resolved correctly: a school link is **N mono-shape CLASS-scope offerings** (each `(class, one assessment)`) joined by one `registration_link`. Heterogeneous `{class7→A, class8→B}` is just two offerings under one link. No nullable `assessment_id`, no `CLASS_SET`, no per-tier assessment discriminator. The batch-save authoritative sweep stays keyed on **class** (deactivate the CLASS offering + prune its `link_offering` row).

4. **B2C picker jammed into the wave engine (Platform BLOCKER).** Rejected. B2C keeps its picker tables; it joins the spine only at `service_policy` + entitlements + payment. The "fold C in too" ambition is explicitly out of scope for this milestone.

5. **Migration is a no-rollback cliff inventing entitlement state (every proposal).** De-risked into **expand → migrate → contract** (§6 below), with the historical-cohort backfill treated as a separate, product-signed-off step — not buried as "the hardest trade-off."

### 2.4 Each area, concretely

**AREA A — per-level (per-scope offer, dual links per scope)**

- **Admin does:** picks institute → assessment → scope (INSTITUTE/SESSION/CLASS/SECTION) → creates the offer; adds paid waves by attaching named `service_policy` rows with prices.
- **Persisted:** one `assessment_offering` (mono-shape, `assessment_id` always set); one free `offering_tier` (`is_free`, `sort_order=-1`) + N paid tiers (each → a `service_policy`); two `registration_link` rows (`kind=FREE`, `kind=PAID`), each joined to this one offering via `link_offering`. `OfferService.create()` calls `ensure()` → catalog.
- **Student gets:** opens `/r/{token}`; backend reads `link.kind` (no token-column probe), resolves the active wave (sequential sellout preserved), shows price + inclusions **read off the policy**; free → instant mint, paid → Razorpay → webhook → mint. Free→paid upgrade unions a higher policy's services onto the same entitlement row.
- **Catalog / entitlement / pricing / tokens / security:** all via the shared spine. Behaviorally identical to today's good A flow, minus the fake-free-payment hack.

**AREA B — school (cohort of per-class offers under one capped link)**

- **Admin does:** picks a session → batch grid of `class → assessment` (the existing UX, unchanged on screen) → sets a per-assessment price ladder (now *with inclusions* via `service_policy`) → generates **one** capped link.
- **Persisted (the batch endpoint fans out):** for each `(class, assessment)` it upserts one **CLASS-scope** `assessment_offering` (+ free tier, + `ensure()`); clones the per-assessment ladder onto each offering's tiers (these are real per-offering tiers — but the **session-wide cap is on the link, so no cap shattering**); mints **one** `registration_link` (`kind=PAID` or `FREE`) with the school-wide `max_registrations`, joined via `link_offering` to **all** the batch's CLASS offerings. Authoritative sweep: any active CLASS offering for a class absent from the batch is deactivated *and* its `link_offering` row pruned (closes the critique's "deactivated offering still POST-able" hole).
- **Student gets:** opens the one school link; picks their **class**; backend derives the single assessment from the class, resolves that offering's active tier, provisions, and **mints an entitlement via the same `grant()` path.** School students now pass report/dashboard/counselling/LMS gates exactly like A students.
- **Catalog / entitlement:** fed/minted by construction — there is no separate school path that *could* skip them.

### 2.5 Fate of the legacy artifacts (explicit)

- **`school_assessment_config`** → **DELETED.** Each active row migrates to one CLASS-scope `assessment_offering`.
- **`school_registration_link`** → **DELETED.** Each row migrates to one `registration_link` (token preserved, so distributed `/school-register/{token}` URLs keep resolving) + `link_offering` rows to all the session's migrated CLASS offerings.
- **`school_assessment_tier`** → **DELETED.** Cloned into `offering_tier` (one set per migrated CLASS offering), each pointing at a `service_policy` (default: report-only, pending product sign-off — see §6).
- **`assessment_mapping_tier`** → **EVOLVED** into `offering_tier` (inclusions move out to `service_policy`; gains nothing it didn't have).
- **`payment_transaction.mapping_tier_id` overload** → **GONE.** Renamed `offering_tier_id`, single FK target. `school_config_id` column dropped. `mapping_id` → `offering_id`. Recount qualifiers (`MappingIdIsNotNull` / `SchoolConfigIdIsNotNull`) deleted — a recount is now `count by offering_tier_id`.

---

## 3. The invariants (non-negotiables)

1. **Every successful registration mints exactly one entitlement** — free or paid, A or B — through one `grant(offering, tier, student)` seam. No code path can register a student without an entitlement.
2. **A link resolves to exactly one pricing decision.** `link.kind` + (for multi-offering links) the student's *class* selects exactly one offering → its active tier (free, or first non-full paid wave). Never ambiguous.
3. **Sold-out is an explicit first-class state**, surfaced by `/info` and 409'd by `/register`. A PAID link **never** silently downgrades to free; a FREE link never routes to payment.
4. **The catalog is fed by every offer-create**, via `ensure()` inside `OfferService.create()`, in the same transaction. There is exactly one create path.
5. **One tier table, one FK.** `payment_transaction.offering_tier_id` resolves against `offering_tier` unconditionally. No sibling-column routing, ever.
6. **Inclusions live in exactly one place** (`service_policy`) and are **snapshotted additively** onto the entitlement at grant time (free→paid unions; never silently rewrites a B2B grant).
7. **Billing exists iff money is owed.** The free path mints the entitlement directly and creates **no** `payment_transaction`. No fabricated zero-amount `status="paid"` rows.
8. **Scope coords are NOT NULL (sentinel 0)** so the offering UNIQUE key actually enforces; duplicate offers are a DB error, not a hopeful in-code check.
9. **Cap ownership is explicit and singular.** A *tier* owns its per-wave count; a *link* owns its cohort-wide count. A registration may consume both, each via the same atomic conditional UPDATE — but no cap is ever cloned across rows.
10. **One public security posture:** all registration endpoints are `permitAll` + CSRF-exempt, gated solely by an unguessable token. Upgrades are gated by the entitlement's 64-char `access_token`, never its sequential PK.
11. **Discriminators are DB constraints, not comments.** `student_entitlements` and `payment_transaction` carry `offering_id XOR campaign_id` as an enforced CHECK.

---

## 4. The spectrum (choose your altitude)

**Option 1 — One Engine, Two Audience Shapes, One Cohort-Link (RECOMMENDED).**
*What it is:* §2. Mono-shape `assessment_offering`; `registration_link` promoted to a first-class N:M aggregate; `service_policy` as reusable inclusions; billing/fulfillment split; B2C left on its own pricing. A and B keep separate admin UIs but write the same rows.
*Costs:* one expand/migrate/contract migration; rebuild of token resolution onto `registration_link`; school admin re-pointed onto the offer API (UX unchanged on screen); a product decision on historical school inclusions.
*Buys:* all four live defects (entitlement, catalog, security, overload) close **by construction**; reusable inclusions; mixed free+paid school links and arbitrary cross-class links become trivial; one audit/analytics surface; B2C convergence is *available later* without being forced now.
*Forecloses:* nothing real. The only thing it deliberately doesn't do is fold B2C's picker into the wave engine — correctly, since they're different semantics.
*Why first:* it's the only option that closes all four gaps structurally **and** survives every adversarial critique, because it takes each proposal's best idea and drops each proposal's fatal misread.

**Option 2 — Shared-Spine, keep B's authoring tables thin (lighter).**
*What it is:* unify `offering_tier` + entitlement + `ensure()` + security exactly as Option 1, but **keep `registration_link` as today's token-columns-on-offering** and let B keep a thin `school_link` table that merely *groups* offerings. No first-class N:M link aggregate.
*Costs:* you still have two link representations; "one link, many scopes" stays a B-only special case.
*Buys:* slightly smaller migration; closes Gaps #1/#2/#3/#4 just as well.
*Forecloses:* mixed free+paid school links, arbitrary cross-class links, and a single clean token resolver. Leaves a latent "two link shapes" seam that will diverge again the first time someone wants an A-scope shared link.
*When to pick:* if migration appetite is low and you accept that link-distribution stays a B-special-case.

**Option 3 — "Two pipelines, both feed the SSOT via `ensure()` + both mint entitlements" (your earlier instinct — keep separate token/tier tables).**
*What it is:* leave `school_assessment_config/link/tier` and `assessment_institute_mapping/tier` as **separate table families**, but fix B in place: call `ensure()` in the school create path, route the school webhook + free path through `activateB2BOnPayment`, add `includes_*` columns to `school_assessment_tier`, and `permitAll` the school public endpoints.
*Costs:* **this is the honest evaluation you asked for.** It closes Gaps #1, #2, #3 — the *student-facing* defects — fast and with low risk. That's real and valuable. **But it leaves the structural defects open:** (a) `payment_transaction.mapping_tier_id` stays overloaded across two tier tables with overlapping id-spaces (Gap #4) — every recount stays booby-trapped with `…IsNotNull` qualifiers; (b) inclusions are now defined in **two** places that *will* drift the next time someone adds "includes_mentorship" and updates only one; (c) you still have two create paths, two tier algorithms maintained in parallel, two security surfaces to keep in sync — the divergence-generator stays alive; (d) you've duplicated the inclusion columns into a third table, making the SSOT-for-inclusions worse, not better.
*Buys:* smallest, safest diff; ships the student-facing fixes next week; no risky data migration.
*Where it's right:* as the **bridge**, not the destination. If you need B's students un-blocked *now*, do exactly this first — it's the safe subset of Option 1 and every line of it survives into the target. The Platform Architect's own closing advice and the Shared-Spine critique both independently converged on this as the phase-1 move.
*Where it leaves defects open:* the overloaded column, the duplicated inclusion definitions, and the two-pipelines-drift disease all persist. It treats symptoms, not the cause. **Don't stop here** — the whole reason this system accreted three pipelines is that someone always "just patched the symptom."

**Option 4 — Full convergence including B2C (most ambitious — NOT recommended now).**
*What it is:* Option 1 plus folding B2C campaigns onto the same offer aggregate.
*Costs:* B2C is a genuinely different pricing model (picker with `is_default`, no caps/waves) and a different snapshot semantic (overwrite vs. union). Folding it forces either dead columns or an `offer_type`-conditional table — re-creating the overload disease one layer up.
*Buys:* one mega-engine — *if* multi-audience cohorts and B2B/B2C unification actually become requirements.
*Forecloses:* nothing, but it's speculative. The seam B2C *should* share (`service_policy`, entitlements, payment) it already shares under Option 1.
*Verdict:* YAGNI for now. Option 1 leaves the door open; walk through it only when a real requirement arrives.

---

## 5. How the school "batch-assign + one capped link" UX survives

The admin workflow is **preserved on screen and improved underneath** under the recommended design:

- **The batch grid stays.** Pick session → grid of `class → assessment` → toggle assignments. Identical interaction to today.
- **On save, the same authoritative sweep runs** — keyed on **class** (verified the current semantic at `SchoolRegistrationController.java:171–177`): every class in the grid upserts its CLASS-scope offering; every previously-active class *absent* from the grid is deactivated **and** unlinked from the cohort link. No silent stale configs.
- **One capped link stays first-class.** The school-wide cap lives on the `registration_link.max_registrations` — exactly B's existing semantic, now race-safe on the link's own counter on *both* free and paid paths (today the free path never decremented the link — a current bug, fixed for free).
- **The per-assessment price ladder stays.** Admin sets one ladder per assessment; the batch applies it to every class running that assessment. The admin never sees per-class tier duplication — that's a persistence detail. To avoid "edit the Grade-9 price in 3 places," the admin UI edits the *ladder per assessment* and the service writes it through to each affected offering (the reverse-map the Radical Unifier critique demanded).
- **Improvements the admin gets for free:** inclusions on school registrations (pick a `service_policy`); the option of a separate FREE cohort link + PAID cohort link for the same session (impossible today); and `verify-details` pre-check survives as a first-class endpoint on the unified controller, not a footnote.

The net: **the school admin's mental model — "configure a session's classes, hand out one capped link" — is fully intact.** Only the storage and the (now-correct) entitlement/catalog behavior change.

---

## 6. What I'd actually do (the call)

**Build Option 1 — one mono-shape `assessment_offering`, a first-class `registration_link` aggregate joined N:M to offerings, `service_policy` as the reusable inclusion SSOT, a hard billing/fulfillment split, and B2C left on its own picker — reaching it via Option 3 as the bridge, not as the destination.** Ship the safe student-facing subset first (call `ensure()` + route every school registration through the one `grant()` seam + `permitAll` the school endpoints + `access_token`-gate upgrades), which un-blocks B's students next week and survives verbatim into the target; then do the expand/migrate/contract to land the structural fixes (kill the overload, promote the link, externalize inclusions, delete the three `school_*` tables).

**The single most important thing to get right: model the school link as N mono-shape CLASS offerings grouped by one first-class capped `registration_link` — never as one multi-assessment offer and never by cloning one shared cap onto N tiers.** Both unifier proposals died on exactly this; the code confirms a school link is a heterogeneous `(class→assessment)` bundle with the cap on the *link*. Get this shape right and every other benefit falls out; get it wrong and you reintroduce either a seat-integrity bug or a capability regression.

**The 2–3 highest-leverage decisions you must make:**
1. **Migration posture — expand/contract vs. flag-day.** Non-negotiable for live distributed school tokens and in-flight Razorpay links: dual-read the old token columns during a deprecation window, keep `migrated_from_*` idempotency markers, and **do not drop `school_*` until every in-flight `status="created"` link has resolved.** Step "drop tables" and "re-point live payments" must never be in the same irreversible script.
2. **Historical school inclusions — a product decision, not an engineering default.** `school_assessment_tier` carried no inclusion flags, so there is no ground truth for what already-registered school students "should" get. Decide the backfill grant (recommend: report-only baseline, with a finance/product sign-off and an admin tool to bump), and run the **entitlement backfill for the existing cohort as its own step** — the migration of *configs* alone leaves last month's students still dark.
3. **Where B2C joins the spine.** Commit now that B2C shares `service_policy` + entitlements + payment but **keeps its picker pricing** — so nobody later tries to jam its `is_default` model into the wave-cap engine. Drawing that line now is what keeps the unified engine from rotting into the next overloaded column.