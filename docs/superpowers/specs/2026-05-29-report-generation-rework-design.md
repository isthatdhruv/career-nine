# Report Generation Rework — Architecture Design

**Date:** 2026-05-29
**Status:** Draft for review (open decisions flagged ⬚)
**Scope:** Career-9 assessment report generation only (not the legacy University-marks `FinalResult` pages).

---

## 1. Goal

Converge **all** admin report generation onto the single unified endpoint
`POST /generate-report-unified`, backed by one server-side engine. Eliminate the
parallel old pipelines (per-type one-click controllers, two-step batch
endpoints, and the duplicate **client-side TypeScript scoring engines**).

Work is split in two parts:

- **Part 1 — Frontend:** everything up to the endpoint call.
- **Part 2 — Backend:** everything after the endpoint call.

---

## 2. Current state (why this rework)

There are **two coexisting generation pipelines**, plus a third (client-side)
for previews:

1. **Unified (new):** `/generate-report-unified` → `ReportService` →
   strategy + cache tables + Spaces. Used by **only** `StudentManagementPage`.
2. **Old per-type (still live):** `/bet-`, `/navigator-`, `/pager-report-data/one-click-report`
   each carry full original logic (the doc comments *claim* they're shims —
   they are not). Used by `GroupStudentPage`, `StudentListPage`, and the
   orphaned `GroupStudentAdminPage`.
3. **Old batch + client engines:** `ReportsHub` and `UnifiedReportManagement`
   use the two-step `generateDataForAssessment` → `generateReportsForAssessment`
   plus **client-side** `Navigator360Engine` / `FourPagerEngine` that recompute
   scores in the browser (a full mirror of the Java scoring — drift risk).

### Confirmed design flaws

- **Single-pair bottleneck:** `Questionnaire.reportType`/`reportSubtype` is one
  FK pair, and `ReportService.generate(student, assessment)` resolves exactly
  one pair → one report. A general assessment needs **two** reports
  (legacy + pager).
- **Upsert clobber bug:** `generated_report` has a 4-column unique key
  `(user_student_id, assessment_id, type_of_report, report_subtype_id)`, but
  `upsertGeneratedReport()` and every repository finder key on
  `(…, type_of_report)` **only** — subtype is dropped. Two subtypes under one
  type silently overwrite each other. No `findBy…AndReportSubtype` exists.
- **Dual scoring engines:** Java (authoritative) + TypeScript (preview) →
  maintenance burden and divergence risk.
- **Type confusion:** `AssessmentTable` has its own legacy `reportType`
  **String** column, separate from `Questionnaire.reportType` **FK**.

---

## 3. Domain invariants (the foundation)

- A report is uniquely identified by the atom **`(student, assessment, type, subtype)`**.
- The **questionnaire defines the *allowed set*** of reports for an assessment —
  not a single report:
  - `bet` assessment → `{ bet/default }`
  - `general` assessment → `{ legacy/band, pager/band }` where
    `band = questionnaire.reportSubtype.code` (`insight` | `subject` | `career`).
- **One unified call generates exactly one report atom.** Batch = orchestrated loop.
- **Scoring lives only on the backend.** Previews render the server artifact (iframe).
- **Intermediary scores are computed once per `(student, assessment)`** and shared
  by legacy + pager (cache makes the 2nd call cheap). BET does not use them
  (it scores from the MQT option map).

### Subtype = grade band (from seed data)

The same three subtype codes exist under **both** general types:

| type    | subtype code | display              | grade |
|---------|--------------|----------------------|-------|
| legacy  | insight      | Insight Navigator    | 6–8   |
| legacy  | subject      | Subject Navigator    | 9–10  |
| legacy  | career       | Career Navigator     | 11–12 |
| pager   | insight      | Insight 4-Pager      | 6–8   |
| pager   | subject      | Subject 4-Pager      | 9–10  |
| pager   | career       | Career 4-Pager       | 11–12 |
| bet     | default      | BET                  | —     |

So the subtype **code is the shared grade-band dimension**; legacy and pager for
one assessment use the *same* code, differing only by type.

---

## 4. Decisions locked (via review Q&A)

| # | Decision | Choice |
|---|----------|--------|
| D1 | End state | Unified endpoint is the **only** generation path; old paths retired/shimmed. |
| D2 | Multiplicity | `(student, assessment)` can have multiple reports; varies by general/bet. |
| D3 | Subtype source | **From questionnaire mapping**, fixed per assessment (one assessment = one grade band). |
| D4 | General type handling | Only the subtype **code** matters; general **always offers both** legacy + pager. The mapped type FK is used only to detect bet vs general. |
| D5 | Trio pages | StudentManagement + GroupStudent + StudentList share one hook + card component. |
| D6 | ReportsHub bulk (general) | **Admin picks** which type to bulk-generate (Legacy / Pager / Both). |
| D7 | Preview | **Render the server `reportUrl` in an iframe**; delete client-side engines. |
| D8 | Orphan pages | **Comment out routes, keep page files** (conservative). |

### ⬚ Open decisions

- **D9 — Contract validation** *(recommended: FE sends `{type, subtype}`, backend
  validates against the questionnaire's allowed set).* Alternatives: backend
  derives subtype from type; or backend trusts FE without validation.
  **Required:** `type`/`subtype` are **optional** — when omitted, the endpoint
  falls back to the questionnaire's mapped `reportType`/`reportSubtype` and
  generates that (see §10.1 for the full contract).
- **D10 — Sync vs async generation** *(TBD).* Recommended default: synchronous
  per atom, FE loops for batch. To be discussed.

---

## 5. Frontend architecture (Part 1)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ADMIN SPA — single Reports domain  (app/reports/)                        │
│                                                                           │
│  pages/                          consume the SAME hook + components       │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐          │
│  │ StudentMgmt      │ │ GroupStudent     │ │ StudentList      │  (trio)   │
│  │  view-modal      │ │  view-modal      │ │  view-modal      │          │
│  └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘          │
│           └─────────────┬───────┴────────────────────┘                    │
│                         ▼                                                  │
│            ┌───────────────────────────┐      ┌────────────────────────┐  │
│            │ <AssessmentReportCard>    │      │ ReportsHubPage         │  │
│            │  ┌─────────────────────┐  │      │  bulk: type selector   │  │
│            │  │ Data row            │  │      │  Legacy/Pager/Both     │  │
│            │  ├─────────────────────┤  │      │  + progress + ZIP/mail │  │
│            │  │ Report row          │  │      └───────────┬────────────┘  │
│            │  │  resolveReportSet() │  │                  │               │
│            │  │   bet → [BET]       │  │                  │               │
│            │  │   gen → [Lgcy][Pgr] │  │                  │               │
│            │  └─────────┬───────────┘  │                  │               │
│            └────────────┼──────────────┘                  │               │
│                         ▼                                  ▼               │
│            ┌──────────────────────────────────────────────────────────┐  │
│            │  hooks/useReportGeneration()                              │  │
│            │   • per-atom state: Map<"stu-asm-type-sub",{url,status}>  │  │
│            │   • generateOne(atom, force)                              │  │
│            │   • generateBatch(atoms[], {concurrency, onProgress})     │  │
│            │   • hydrate(studentId)  ← getReportsByStudent             │  │
│            └──────────────────────────┬───────────────────────────────┘  │
│                                        ▼                                  │
│            ┌──────────────────────────────────────────────────────────┐  │
│            │  logic/resolveReportSet(questionnaire) → ReportAtom[]      │  │ pure, tested
│            │     reads reportType.code + reportSubtype.code            │  │
│            └──────────────────────────────────────────────────────────┘  │
│            ┌──────────────────────────────────────────────────────────┐  │
│            │  api/reportApi.ts   (ONLY module that talks to backend)   │  │
│            │   generateReport(stu, asm, type, subtype, force)          │  │
│            │   getReportsByStudent · toggleVisibility · zip · email    │  │
│            └──────────────────────────┬───────────────────────────────┘  │
│                                        │  ONE call shape                  │
│  components/ReportPreviewModal ──── iframe(reportUrl) ── no TS engine     │
└────────────────────────────────────────┼─────────────────────────────────┘
                                          ▼
                            POST /generate-report-unified
                            { userStudentId, assessmentId, type, subtype, force }
```

### Proposed structure

```
app/reports/
  api/        reportApi.ts            // only module hitting the backend
  model/      reportTypes.ts          // ReportType, ReportSubtype, ReportAtom
  logic/      resolveReportSet.ts     // questionnaire → ReportAtom[]  (pure, unit-tested)
  hooks/      useReportGeneration.ts  // single + batch state machine
  components/ AssessmentReportCard.tsx, ReportButton.tsx,
              ReportPreviewModal.tsx, BulkGenerateBar.tsx
  pages/      ReportsHubPage.tsx
```

### Report row logic

```ts
isBet = questionnaire.reportType?.code === "bet"   // fallback: questionnaire.type === true
band  = questionnaire.reportSubtype.code           // insight | subject | career (general only)

resolveReportSet(q):
  bet     → [ { type:"bet",    subtype:"default", label:"BET Report" } ]
  general → [ { type:"legacy", subtype: band,     label:"Legacy Report" },
              { type:"pager",  subtype: band,     label:"Pager Report" } ]
```

### State keying

Per-report state keyed `"student-assessment-type"` (subtype is fixed per type
here, so type disambiguates). Hydration buckets `/generated-reports/by-student`
rows by `typeOfReport`.

### Deletions (FE)

- API wrappers: `generateBet/Navigator/PagerReportOneClick`,
  `generateDataForAssessment`, `generateReportsForAssessment`,
  `generateBet/NavigatorReportData`, `generate*HtmlReports`,
  `generateAllReportsOneClick`, `generatePdf`/`generatePdfBulk` (already 0 callers).
- Client engines: `ReportsHub/navigator360/{Engine,Report,Types,CareerData,API}`,
  `ReportsHub/fourPager/*`. (~10 files; ends Java↔TS scoring drift.)

### Orphan pages (comment routes, keep files)

`ReportGenerationPage`, `BetReportGenerationPage`,
`NavigatorReportGenerationPage`, `UnifiedReportManagementPage` (+ `SingleAssessmentView`,
`AllAssessmentsView`), `GroupStudentAdminPage` (route already removed), `ReportsPage`.

---

## 6. Backend architecture (Part 2)

```
            POST /generate-report-unified  { userStudentId, assessmentId, type, subtype, force }
                                          │   @PreAuthorize ABAC (instituteOfStudent)
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ UnifiedReportController        (thin: validate body, map exceptions → HTTP)     │
└────────────────────────────────┬───────────────────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ ReportService.generate(stu, asm, type, subtype, force)   ── ORCHESTRATOR only   │
│                                                                                │
│  1 ─► SanityCheckService            mapping exists & status=completed          │
│                                                                                │
│  2 ─► ReportRoutingService          questionnaire → ALLOWED SET                │
│         • allowedSet(q): bet→{bet/default}; general→{legacy/band, pager/band}  │
│         • validate(requested ∈ allowed)   ──► ReportRoutingException(422)       │
│         • returns managed ReportType + ReportSubtype                           │
│                                                                                │
│  3 ─► IntermediaryScoreService      (only if strategy.usesIntermediary)        │
│         cache: intermediary_scores [stu, asm]  ◄── SHARED legacy+pager         │
│         miss → PagerScoreSource (async-persist retry) → upsert                 │
│                                                                                │
│  4 ─► PlaceholderCalculator strategy   (by type.code)                          │
│         ┌────────────┬────────────────┬────────────────┐                       │
│         │ Bet (MQT)  │ Legacy (interm)│ Pager (interm) │                       │
│         └────────────┴────────────────┴────────────────┘                       │
│         cache: calculated_report_data [stu, asm, type, subtype, engineVer]     │
│         hit (same engineVer, !force) → reuse;  else compute → upsert           │
│                                                                                │
│  5 ─► TemplateCache.get(subtype.templateUrl, uploadedAt)  ◄── Spaces (cached)   │
│       TemplateRenderer.fill(html, placeholders)                                │
│                                                                                │
│  6 ─► DigitalOceanSpacesService.upload(filledHtml → folder/asm-N/file)         │
│                                                                                │
│  7 ─► GeneratedReportService.upsert(stu, asm, type, SUBTYPE, url)              │
│         ★ keyed by (stu, asm, type, subtype) — subtype-aware (fixes clobber)   │
└──────────────────────────────────────────────────────────────────────────────┘
        │ reads/writes
        ▼
  ┌───────────────────────────────────────────────────────────────────────┐
  │ DATA                                                                    │
  │  questionnaire ── reportType FK ──► report_type (bet|legacy|pager)      │
  │                └─ reportSubtype FK ─► report_subtype (code=band,        │
  │                                       template_spaces_url, render_folder)│
  │  intermediary_scores   [stu, asm]                  (cache, engineVer)    │
  │  calculated_report_data[stu, asm, type, subtype]   (cache, engineVer)    │
  │  generated_report      [stu, asm, type, subtype] → url, status, visible │
  └───────────────────────────────────────────────────────────────────────┘
```

### Proposed structure

```
service/b2c/report/
  ReportService.java               // orchestrator (thin)
  routing/  ReportRoutingService.java   // allowed-set + validation
  scores/   IntermediaryScoreService.java
  calc/     PlaceholderCalculator.java (interface)
            BetPlaceholderCalculator, LegacyPlaceholderCalculator, PagerPlaceholderCalculator
  render/   TemplateCache.java, TemplateRenderer.java
  store/    GeneratedReportService.java  // subtype-aware upsert/find
  ReportResult.java, exceptions…
controller/career9/report/
  UnifiedReportController.java      // POST /generate-report-unified  (gains type, subtype)
```

### Rework vs today

- `generate()` gains `type, subtype` params.
- `resolveTypeAndSubtype` → **`ReportRoutingService`** returning the allowed set
  + validating the request (today it silently picks one pair).
- **`GeneratedReportService`** with subtype-aware finder/upsert (fixes clobber;
  add `findBy…AndTypeOfReportAndReportSubtype_Code`).
- Old per-type one-click controllers → **true shims** forwarding to `ReportService`
  (or comment them like the FE orphan routes).
- **Retire `AssessmentTable.reportType` String column**; questionnaire FK is the
  only authority.

---

## 7. End-to-end: "general assessment, generate both" (one student)

```
FE resolveReportSet(q) → [ {legacy, career}, {pager, career} ]
   │
   ├─► POST /generate-report-unified {…, legacy, career}
   │      validate ∈ allowed ✓ · interm MISS→compute+cache · legacy calc · render · upsert → url₁
   │
   └─► POST /generate-report-unified {…, pager, career}
          validate ∈ allowed ✓ · interm HIT (reused) · pager calc · render · upsert → url₂
                                     ▲ shared scores ⇒ 2nd call is cheap
   FE: card shows 2 chips → [Legacy ✓ view] [Pager ✓ view]
```

---

## 8. Data model (target)

```
student ──< student_assessment_mapping >── assessment_table ──1:1── questionnaire
                                                                      │  ├─ reportType  FK → report_type
                                                                      │  └─ reportSubtype FK → report_subtype
report_type (code: bet|legacy|pager)
report_subtype (report_type_id, code, display_name, template_spaces_url,
                template_spaces_key, template_uploaded_at, spaces_render_folder)
                UNIQUE (report_type_id, code)

intermediary_scores     (user_student_id, assessment_id, scores_json, engine_version)   -- cache
calculated_report_data  (user_student_id, assessment_id, report_type_id, report_subtype_id,
                         calculated_json, engine_version)                                -- cache
generated_report        (user_student_id, assessment_id, type_of_report, report_subtype_id,
                         report_url, report_status, visible_to_student)
                        UNIQUE (user_student_id, assessment_id, type_of_report, report_subtype_id)
```

---

## 9. Storage model — placeholders vs metadata

There is **no single common table**; there are **three** tables at **two grains**.
The two atom-grained tables share the *same natural key* — the report atom
`(student, assessment, type, subtype)` — and are **1:1** on it. That shared key
is the "common" dimension; they are two faces of one report.

```
GRAIN A: per (student, assessment)            ── shared across report types ──
  intermediary_scores
    key:  (user_student_id, assessment_id)
    body: scores_json, engine_version              [RAW-SCORE CACHE]
            │  (RIASEC / MI / aptitude — used by legacy + pager; BET skips)
            ▼
GRAIN B: per (student, assessment, type, subtype)  ── the report atom ──
  calculated_report_data                          generated_report
    key: (stu, asm, type, subtype) UNIQUE           key: (stu, asm, type, subtype) UNIQUE
    body: calculated_json, engine_version,          body: report_url, report_status,
          calculated_at                                   visible_to_student, timestamps
        [PLACEHOLDER CACHE]                             [DURABLE REGISTRY / METADATA]
```

### Why two separate tables at Grain B (not one merged table)

They have **different lifecycles**:

- `calculated_report_data` is a **recomputable cache**. It is invalidated by an
  `engine_version` bump or `force`. It can be dropped and rebuilt with no loss.
- `generated_report` is the **durable registry**. It owns `visible_to_student`,
  `report_status`, and the public `report_url` that emails / WhatsApp / the
  student portal link to. It **must survive** a score recompute.

Merging them would couple a cache-bust (engine-version change) to durable
visibility/URL state — exactly what should stay independent. So: keep separate.

### ⚠️ Normalization fix (consistency between the two atom tables)

Today they key the same atom **differently**:

| | type column | subtype | 
|---|---|---|
| `calculated_report_data` | `report_type_id` **FK**, NOT NULL | `report_subtype_id` FK, NOT NULL |
| `generated_report` | `type_of_report` **String**, NOT NULL | `report_subtype_id` FK, **nullable** |

**Target:** `generated_report` should also use `report_type_id` **FK** and make
`report_subtype_id` **NOT NULL**, so both Grain-B tables share an identical,
FK-based atom key. This:
- makes joins/finders uniform across the two tables,
- fixes the upsert-clobber bug cleanly (lookup is always by the full 4-col atom),
- aligns with retiring the legacy `AssessmentTable.reportType` String column.

---

## 10. Request & handling flow (which page sends what; how the backend responds)

### 10.1 What each page sends

**One request shape for everything** —
`POST /generate-report-unified { userStudentId, assessmentId, type?, subtype?, force }` —
one call = one report atom.

**`type` / `subtype` are optional.** Contract:
- **Both present** → validate against the questionnaire's allowed set, generate that atom.
- **Both omitted** → **fall back to what's mapped on the questionnaire**
  (`questionnaire.reportType` / `reportSubtype`); generate that single mapped
  report. (If the questionnaire mapping is also NULL → grade-based fallback, then
  `422 ROUTING`.) This keeps a zero-arg "just generate the mapped report" call
  working for callers that don't care about picking a specific type — and is the
  required future behavior.
- *(Partial — only `type`, no `subtype`)* → derive subtype from
  `questionnaire.reportSubtype.code` (the grade band).

| Surface | Trigger | Request(s) emitted |
|---|---|---|
| **Trio** — BET card | "Generate" / "Regenerate" | `{stu, asm, type:"bet", subtype:"default", force}` |
| **Trio** — General card | "Legacy Report" button | `{stu, asm, type:"legacy", subtype: band, force}` |
| **Trio** — General card | "Pager Report" button | `{stu, asm, type:"pager", subtype: band, force}` |
| **ReportsHub** — bulk | "Generate All" (selector = Legacy / Pager / Both) | loop over selected students × chosen type(s); each iteration emits one single-atom request (concurrency-limited, progress-tracked) |
| **Preview** (any surface) | "View" | **no generate** if a `generated_report` row already has a URL → fetch URL → iframe. If missing → emit one unified request, then iframe the returned URL. |

- `band = questionnaire.reportSubtype.code` (`insight`/`subject`/`career`), fixed per assessment.
- `force = true` only on explicit Regenerate; otherwise `false` (cache reuse).
- The FE never sends raw scores or placeholders — only the **atom coordinates**.

### 10.2 How the backend does the honours (per request)

```
REQUEST  { userStudentId, assessmentId, type, subtype, force }
   │
   ▼ UnifiedReportController  ── ABAC: institute-of-student ── validate body shape
   │
   ▼ ReportService.generate(stu, asm, type, subtype, force)
   │
   1. SanityCheckService.existsAndComplete(stu, asm)
   │      └─ reads student_assessment_mapping  → must be status=completed
   │         else → 503 NOT_COMPLETED / 422
   │
   2. ReportRoutingService.resolveAndValidate(questionnaire, type, subtype)
   │      ├─ reads questionnaire.reportType / reportSubtype  (+ report_type / report_subtype)
   │      ├─ builds ALLOWED SET:  bet→{bet/default} | general→{legacy/band, pager/band}
   │      └─ requested ∉ allowed → 422 ROUTING   ;  else → managed (ReportType, ReportSubtype)
   │
   3. IntermediaryScoreService.ensure(stu, asm, force)     (only if strategy.usesIntermediary)
   │      ├─ READ  intermediary_scores[stu, asm]
   │      │     hit (engineVer ok, !force) → reuse           ◄── shared by legacy & pager
   │      └─ miss → PagerScoreSource (async-persist retry) → WRITE intermediary_scores
   │              not ready → 503 SCORES_NOT_READY
   │
   4. PlaceholderCalculator[type].calculate(...)            (Bet | Legacy | Pager)
   │      ├─ READ  calculated_report_data[stu, asm, type, subtype]
   │      │     hit (engineVer match, !force) → reuse placeholders
   │      └─ miss/force → compute placeholder map → WRITE calculated_report_data
   │
   5. TemplateCache.get(subtype.template_spaces_url, uploaded_at)   ◄── Spaces (cached)
   │   TemplateRenderer.fill(html, placeholders)            (ALWAYS re-rendered →
   │                                                          template edits propagate)
   │
   6. DigitalOceanSpacesService.upload(filledHtml → subtype.render_folder/asm-N/file)
   │      └─ returns public CDN reportUrl
   │
   7. GeneratedReportService.upsert(stu, asm, type, subtype, reportUrl)
   │      └─ WRITE generated_report[stu, asm, type, subtype]   (subtype-aware!)
   │         status="generated", report_url=…, updated_at=now
   │         (preserves existing visible_to_student)
   │
   ▼ RESPONSE { status, type, subtype, reportUrl, calculatedAt, renderedAt, alreadyExisted }
```

**Table touch summary per request:**

| Step | `intermediary_scores` | `calculated_report_data` | `generated_report` |
|---|---|---|---|
| 1 Sanity | — | — | — (reads mapping) |
| 3 Scores | read, maybe write | — | — |
| 4 Placeholders | — | read, maybe write | — |
| 7 Persist | — | — | **upsert** |

So **placeholders land in `calculated_report_data`** and **generation metadata
lands in `generated_report`**, both at the same `(stu, asm, type, subtype)` atom,
while raw scores are cached once per `(stu, asm)` in `intermediary_scores`.

**Batch (ReportsHub) economics:** generating both general reports for a student
makes 2 requests; the first computes + caches intermediary scores, the second
reuses them (step 3 hit). Placeholders differ per type so each computes once.
Across a class, the FE loop is the only "batch" construct — the backend stays a
simple, idempotent, single-atom operation.

---

## 11. Work breakdown (for the implementation plan)

### Part 1 — Frontend
1. New `app/reports/` domain: `reportApi.ts`, `reportTypes.ts`, `resolveReportSet.ts`,
   `useReportGeneration.ts`, `AssessmentReportCard.tsx`, `ReportPreviewModal.tsx`,
   `BulkGenerateBar.tsx`.
2. Migrate the trio (StudentManagement, GroupStudent, StudentList) onto the shared
   hook + card; remove per-page duplicated modal/report code.
3. Rework ReportsHub: type selector, batch loop, iframe preview; delete client engines.
4. Comment orphan routes (keep files).
5. Extend the `Assessment` TS interface + assessment-list payload to carry
   `questionnaire.reportType.code` + `reportSubtype.code`.
6. **Fix: questionnaire Edit page does not prefill the existing report
   type/subtype mapping** (see Known bug below).

### Known bug — Edit page never *saved* the report type/subtype mapping ✅ FIXED

**Symptom:** opening a questionnaire in `QuestionareEditSinglePage` showed the
Report Type / Report Subtype dropdowns empty.

**Actual root cause (verified, not the frontend):** the prefill code and backend
serialization were both correct. The DB had `report_type_id` /
`report_subtype_id` **NULL for every questionnaire** — so there was nothing to
prefill. The mapping never persisted because **`QuestionnaireController.update()`
dropped it**:

- `resolveReportRouting(questionnaire)` resolved the FKs onto the **incoming**
  request object, but the update then copied a fixed list of fields onto the
  loaded **`existing`** entity and saved *that* — and **never copied
  `reportType` / `reportSubtype` across**. Create worked (saves the incoming
  object directly), but all existing questionnaires predate the feature and can
  only be mapped via edit → which discarded it → all NULL.

**Fix applied:** in `update()`'s `.map(existing -> …)` block, copy the resolved
FKs onto `existing`:
```java
existing.setReportType(questionnaire.getReportType());
existing.setReportSubtype(questionnaire.getReportSubtype());
```

**Follow-up:** existing rows are still NULL — the fix only makes *future* saves
stick. Either re-map questionnaires through the Edit UI, or run a one-time
backfill of `report_type_id` / `report_subtype_id` on the `questionire` table.

### Part 2 — Backend
1. `ReportService.generate(stu, asm, type, subtype, force)` + `UnifiedReportRequest`
   gains `type`, `subtype`.
2. `ReportRoutingService` (allowed-set + validation per D9).
3. `GeneratedReportService` subtype-aware finder/upsert (+ migration if needed).
4. Split services into `routing/ scores/ calc/ render/ store/`.
5. Convert old per-type one-click controllers to shims (or comment).
6. Retire `AssessmentTable.reportType` string column.
7. Ensure assessment payload serializes `questionnaire.reportType`/`reportSubtype`
   (with `code`) for the FE.

---

## 12. Open questions to resolve before/within implementation

- **D9** contract validation strategy (recommended: validate against allowed set).
- **D10** sync vs async generation (recommended: synchronous per atom).
- Backfill status: which questionnaires still lack `reportType`/`reportSubtype`
  FKs (they hit the grade-based fallback today). Needs an audit before retiring
  the fallback.
