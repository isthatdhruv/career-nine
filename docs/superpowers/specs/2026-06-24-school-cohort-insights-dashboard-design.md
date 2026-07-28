# School Admin Cohort Insights Dashboard ("Dashboard 2") — Design

- **Date:** 2026-06-24
- **Status:** Draft for review (design only — no implementation)
- **Scope:** Backend + frontend architecture for a school-admin-facing, per-school, cross-student insights page. The cohort aggregation *formulas* are intentionally out of scope ("logic defined later"); this document fixes the *system architecture* around them.
- **Revision note (v2):** After investigating existing infrastructure, this design now **extends the existing `SchoolReport` infrastructure** instead of creating a new `cohort_insight_generation` table (which would have duplicated it). The aggregation logic is built as a **pluggable component** with a placeholder implementation; real Navigator-360-style cohort formulas drop in later.

---

## 1. Context & Problem

The Career-9 system already has:

- **Dashboard 1** — a school-admin operational dashboard (assessment counts/activity) that already exists and renders on login. **Not in scope.**
- **Student Navigator 360** — a per-student, per-assessment insights page. Each student's per-assessment result is computed by `Navigator360EngineService.computeNavigator360(...)` and **precomputed + stored** as a serialized `Navigator360Result` in `GeneratedReport.navigator_dashboard_json` at report-generation time.
- **`InsightDashboardService`** — a **per-student** presentation-decoupling layer (`buildForStudent(...)`). Confirmed *not* cohort-capable and *not* reused here.
- **`SchoolReport` infrastructure (the foundation we extend)** — see §3.
- **ABAC scoping** — `UserStudent` / `InstituteDetail` carry a Hibernate `scopeFilter` that auto-narrows queries to the caller's institute(s) via `UserRoleScope`.

**Dashboard 2** is the new ask: a separate page, a *cohort* version of Navigator 360 — "all students combined" for a school, with its own aggregation logic — laid out as the same per-assessment cards.

**The driving constraint:** the school admin's view must **never trigger heavy recomputation on login / page load.** Reads must be cheap lookups of pre-generated data.

### Reframe that shaped the design

Login frequency is not what makes cohort insights stale — **only a student completing an assessment changes the inputs.** Combined with the fact that **per-student results are already precomputed**, cohort generation is *aggregation over already-computed per-student JSONs*, not recomputation from raw answers. A manual, explicit, generate-and-store model is therefore cheap and safe while the aggregation logic is still being designed.

---

## 2. Goals / Non-Goals

**Goals**
- A separate cohort-insights page for school admins, scoped to their own school.
- Insights are **generated explicitly** (on click) and **stored**; the page reads only stored data — zero computation on read.
- Generation unit = `(institute × assessment)`, mirroring Navigator 360's per-assessment card model.
- Freshness, coverage, and logic-version are visible and trustworthy.
- **Reuse, not duplicate:** extend `SchoolReport` storage + endpoints + frontend scaffold.
- The aggregation is a **pluggable component** behind an interface, with a clearly-labeled placeholder implementation so the end-to-end pipeline is fully built and testable now.

**Non-Goals**
- The real cohort aggregation **formulas** ("different logic and calculations"). Defined later; a placeholder/pluggable implementation stands in.
- Cross-assessment *joint* insights (fusing multiple assessments into one card). Per-assessment cards only; storage does not preclude this later.
- Automatic refresh (scheduled or event-driven). Explicitly rejected — see §8.
- School-admin self-service generation. Generation/refresh is **superadmin-only**.
- Reusing `InsightDashboardService` (per-student; not applicable).

---

## 3. Existing Foundation: `SchoolReport`

We extend this rather than build new. What already exists:

- **Table `school_report`** — unique key `(institute_code, assessment_id)` — **exactly our generation unit.**
- Columns already present: `reportData` (JSON payload, engine-agnostic), `aiInsights` (JSON, currently unused), `totalStudents`, `studentsWithScores` (→ our coverage), `status` (`"generated" | "stale"`), `instituteName`, `assessmentName`, `createdAt`, `updatedAt`.
- **Endpoints:** `POST /bet-report-data/school-report` (compute live aggregation across students), `POST /bet-report-data/school-report/save` (persist), `GET /bet-report-data/school-report/get/{instituteCode}/{assessmentId}` (retrieve).
- **Frontend:** `SchoolReportModal.tsx` renders school-level insights — currently **orphaned** (sidebar link removed; not wired to any school-admin page).

**Divergence to bridge:** the current aggregation is BET-style MQ/MQT stats; our target is Navigator-360-style cohort insights (RIASEC / MI / abilities / career matches). The **storage + save/get + frontend scaffold are reused as-is**; only the *aggregation logic* differs — and that logic is the deferred, pluggable part.

---

## 4. Confirmed Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Refresh model | On-demand / explicit generation (no auto jobs) |
| 2 | Who generates/refreshes | **Superadmin only** |
| 3 | Generation must be async | Yes — click enqueues a job; never blocks/serves synchronously |
| 4 | Generation unit | Per `(institute × assessment)` |
| 5 | Composition | Per-assessment cohort cards only (page = collection of cards) |
| 6 | Read source | **Only** the stored generation (no live compute on read) |
| 7 | Coverage denominator | Students who **completed** the assessment |
| 8 | Freshness/coverage stamps | Required (`computedAt`, included vs completed counts) |
| 9 | Logic versioning | `logicVersion` stamped per generation |
| 10 | Storage | **Extend `SchoolReport`** (no new parallel table) |
| 11 | Build scope | **Full scaffold + pluggable aggregation** (real formulas later) |

---

## 5. Architecture

### 5.1 Page & UX
- A **separate page/route** for school admins — a cohort "Navigator 360" — not part of the login (Dashboard 1) view. (Wire up / repurpose the orphaned `SchoolReportModal` scaffold, or a dedicated page consuming the same data.)
- Same **card-per-assessment** layout as student Navigator 360.
- Each assessment card has one state: **Not generated** (default) · **Generating** (async job in flight) · **Ready** (shows stored cohort payload).
- Ready cards show a freshness banner, e.g. *"Generated {date} from 142 of 200 completed · 18 new completions since."*

### 5.2 Generation unit & source
- One generation = `(instituteCode × assessmentId)` → one `school_report` row.
- **Input:** the already-stored per-student `Navigator360Result` JSONs (`GeneratedReport.navigator_dashboard_json`) for that institute + assessment, for students who completed.
- A pluggable `CohortInsightAggregator` runs over those per-student results and produces one payload stored in `school_report.reportData` (and/or `aiInsights`). **No raw-answer recomputation.**

### 5.3 Write path (superadmin)
1. Superadmin clicks "Generate" / "Refresh" for an institute+assessment.
2. Request **enqueues an async job** and returns immediately (reuse existing async/report pipeline).
3. Status transitions: `PENDING → GENERATING → GENERATED` (or `FAILED`). (Extends the current `status` field's value set.)
4. A **per-key lock** on `(instituteCode, assessmentId, logicVersion)` prevents duplicate concurrent runs from double-clicks.
5. Same-version regenerate **overwrites the row**; a `logicVersion` change is recorded so stale-logic payloads are detectable.

### 5.4 Read path & scoping (school admin)
1. School admin opens the page.
2. Existing ABAC `scopeFilter` pins the query to their institute(s); read endpoint enforces institute ownership.
3. Page reads the stored `school_report` payload only → renders cards. **Zero computation on read.**

### 5.5 Freshness & logic-version safety
- Stamp `computedAt` (existing `updatedAt`), `studentsWithScores` (included), and a completed-count (coverage denominator).
- **Staleness signal** = (current completed-count for institute+assessment) − included-count → drives the "N new completions since" banner and can flip `status` to `stale`.
- `logicVersion` lets the system flag/regenerate payloads computed with a superseded formula instead of silently serving dead logic.

---

## 6. Data Model Changes (extend `school_report`)

Add to the existing table (no new table):

| Column | Type | Purpose |
|--------|------|---------|
| `logic_version` | string/int | aggregation-logic version |
| `generation_status` | enum | `PENDING` / `GENERATING` / `GENERATED` / `FAILED` (or extend existing `status` value set) |
| `generated_by` | FK → user | superadmin who triggered |
| `completed_count` | int | students who *completed* at generation time (coverage denominator) |

Existing columns reused: `institute_code`, `assessment_id`, `report_data`, `ai_insights`, `total_students`, `students_with_scores`, `status`, `updated_at`.

---

## 7. Permissions

- New permission `dashboard.school.insights.generate` — **superadmin only** (generate + refresh). (Distinct from the existing `bet_report_data.create`.)
- New read permission for `school_admin` to view the cohort page; read path scoped by ABAC `scopeFilter` to the admin's own institute.

---

## 8. Pluggable Aggregation

- Interface, e.g. `CohortInsightAggregator.aggregate(instituteCode, assessmentId, List<Navigator360Result> perStudent) → payload`.
- Ship a **clearly-labeled placeholder/v0 implementation** that emits a minimal valid payload (e.g. student count + a simple averaged RIASEC), enough to prove the end-to-end pipeline and write tests against.
- The real Navigator-360-style cohort formulas implement this interface later, bumping `logicVersion`.
- **Assumption to validate when formulas are defined:** the real logic operates over per-student `Navigator360Result`s (not raw answers). If it needs raw answers, §5.2's "no recompute" efficiency breaks and the source changes.

---

## 9. Alternatives Considered (and why rejected)

- **New `cohort_insight_generation` table (original spec v1)** — rejected: duplicates `SchoolReport`, which already has the exact key, payload, coverage, status, and endpoints.
- **Live compute on read** — rejected: violates the no-recompute-on-login constraint.
- **Event-driven recompute (on each completion)** — rejected for now: aggregation logic still in flux; auto-recomputing with in-flux formulas is a liability.
- **Scheduled batch recompute** — rejected for now: same in-flux-logic risk; no freshness requirement demands it.
- **Reuse BET MQ/MQT aggregation as v1 logic** — not chosen: user opted for a pluggable placeholder over wiring BET stats as the interim real logic.
- **On-demand explicit generation (chosen)** — a human publishes results when logic is ready; cheapest infra; reuses existing patterns; removes login-time recompute entirely.

---

## 10. Risks & Open Items

- **Stale-but-no-warning** → mitigated by the freshness banner + staleness signal (§5.5).
- **Heavy synchronous generation** → mitigated by async + status (§5.3).
- **Serving results from dead logic** → mitigated by `logicVersion` (§5.5, §6).
- **Empty experience before first generation** → explicit "Not generated" card state (§5.1).
- **Engine mismatch** → `SchoolReport`'s current payload is BET MQ/MQT; cohort-Nav360 payload shape differs. The `reportData` JSON column is engine-agnostic, but the frontend card renderer must handle the new shape (likely a new page rather than the BET modal verbatim).
- **Placeholder visibility** → the v0 aggregator must produce *something* coherent so "Ready" cards aren't misleadingly empty; clearly mark it as placeholder.

---

## 11. Out of Scope / Future

- Real cohort aggregation formulas (the deferred core).
- Cross-assessment joint insights (fused multi-assessment cards).
- Versioned generation *history* / term-over-term comparison UI.
- School-admin self-service generation with rate-limiting.
- Populating the `aiInsights` field with generated narrative content.
