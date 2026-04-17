# 4-Pager Report — Final Plan

## Context

Career-Nine already ships two report formats from the existing assessments: **BET** (`BetReportDataController`) and **Navigator** (`NavigatorReportDataController`). Dr. Mira Desai's team wants a third output — a 4-page PDF per student — driven by the **Navigator 360** psychometric instrument. The three grade-specific templates already sit at [spring-social/src/main/resources/four-pager-template/](spring-social/src/main/resources/four-pager-template/); the spec (`Navigator 360 Technical Specification v1.0`) defines the data-cleaning, scoring, matching, and flag logic that must feed the templates.

Critical finding on exploration: the scoring engine **already exists** in the frontend. [Navigator360Engine.ts](react-social/src/app/pages/ReportsHub/navigator360/Navigator360Engine.ts) implements Navigator 360 spec sections 3–9 (normalization, stanine, absolute-level gate, Potential Score, Preference Score, career matching, CCI, Alignment, and flags P-01/P-03/P-05/P-06/P-07/P-10 + BIAS-01..04). This means the 4-pager is primarily a **new rendering layer on top of an existing engine**, not a new scoring system — with a handful of small gap-fills.

## Confirmed Decisions

- **New report type** `fourPager` sits alongside `bet` and `navigator` — NOT three separate types, NOT a concat of three templates. One 4-page report per student.
- **Template variant by grade** (from spec §1):
  - Grade 6–8 → [insight-navigator.html](spring-social/src/main/resources/four-pager-template/insight-navigator.html)
  - Grade 9–10 → [subject-navigator.html](spring-social/src/main/resources/four-pager-template/subject-navigator.html)
  - Grade 11–12 → [career-navigator.html](spring-social/src/main/resources/four-pager-template/career-navigator.html)
  - Grade source: `IntermediaryScores.studentClass` (already consumed by [Navigator360Engine.ts:538-543](react-social/src/app/pages/ReportsHub/navigator360/Navigator360Engine.ts#L538-L543) via `resolveGradeGroup`).
- **Trigger rule**: Every assessment whose `questionnaire.type === 'general'` produces **both** the existing 18-page Navigator PDF **and** the new 4-pager. Hub shows single + bulk download for each independently.
- **Data source**: The existing `computeNavigator360()` output (`Navigator360Result`). No new scoring pipeline.
- **Rendering**: Frontend — fetch raw template HTML, substitute `{{placeholders}}` in-browser, pipe through `htmlToPdfBlob` (same path as Navigator360). DigitalOcean Spaces hosts the three HTML files (same pattern as the Navigator 18-page template).
- **Storage & tracking**: One `GeneratedReport` row per (student, assessment, `typeOfReport='fourPager'`). Visibility toggles, bulk ZIP, email/WhatsApp inherit the existing generic flow — `typeOfReport` is already a free-form string on that entity.

## What Already Works (verified in code)

Already implemented in [react-social/src/app/pages/ReportsHub/navigator360/](react-social/src/app/pages/ReportsHub/navigator360/):
- Normalization (RIASEC 0–100%, Ability/MI 0–100%) — spec §3.
- Stanine lookup + HIGH/MODERATE/LOW classification — spec §4.
- Potential Score with absolute-level gate (Personality 25 + Intelligence 25 + Ability 30 + Academic 20) — spec §5.
- Preference Score (P1 Values + P2 Aspirations + P3 Culture + P4 Subjects) — spec §6.
- Career matching: potential match, values match, conflict penalty, aspiration bonus, suitability %, suitability 1–9 — spec §7.
- CCI — spec §8. Alignment Score — spec §9.
- Bias flags BIAS-01..04, psychometric flags P-01/P-03/P-05/P-06/P-07/P-10 — spec §§10–12.
- Holland code, grade-group resolution.
- `htmlToPdfBlob` client-side PDF util at [react-social/src/app/pages/ReportGeneration/utils/htmlToPdf.ts](react-social/src/app/pages/ReportGeneration/utils/htmlToPdf.ts).
- Generic bulk-zip, visibility, and distribution over any `typeOfReport` string.

## Gaps the 4-Pager Work Must Close

### Scoring gaps (small — bolt onto the existing engine)
1. **Data-cleaning flags** — `ERR-01` (blanks > 5), `ERR-02` (doubles > 5), `ERR-04` (Section A/B/C missing), `WARN-01` (2 items in A/B/C). Spec §§2.1–2.4. Currently the engine receives already-cleaned `IntermediaryScores` and has no visibility of `total_issues`. Add a `cleaningSummary` input to `computeNavigator360()` or a sibling function that runs before it.
2. **Flag P-08** (values–aspiration conflict) — not in [Navigator360Engine.ts:collectFlags](react-social/src/app/pages/ReportsHub/navigator360/Navigator360Engine.ts#L463). Implement using the existing `VALUE_CONFLICTS` table.
3. **Flag P-09** (academic–ability discrepancy) — not implemented. Simple threshold check (`HIGH` abilities + academic < 50%, or academic > 85% + all abilities `LOW`).
4. **`completionPct`** is hardcoded to `1.0` at [Navigator360Engine.ts:262](react-social/src/app/pages/ReportsHub/navigator360/Navigator360Engine.ts#L262). Wire it from the cleaning summary so spec §5.6 reliability adjustment actually runs.

### Career library gap
[Navigator360CareerData.ts](react-social/src/app/pages/ReportsHub/navigator360/Navigator360CareerData.ts) currently holds **15** career definitions. The spec's companion profession-mapping sheet lists **277**. The 4-pager displays 9 careers on page 4, so 15 is technically enough to populate a single report — but for ranking fidelity and to avoid the same handful of careers appearing for every student, the library should be expanded. Treat this as a **data task** independent of code: ingest the 277-row mapping (CSV / JSON) into `CAREER_DEFINITIONS`. Out of scope for the initial 4-pager MVP, on scope as a follow-up.

### Rendering gap (the main work)
No 4-pager render layer exists yet.

## Implementation Plan

### 1. Upload templates to DigitalOcean Spaces
Upload the three HTML files under `four-pager-template-assets/` (same bucket pattern as the Navigator 18-page template). Keep the local copies in [spring-social/src/main/resources/four-pager-template/](spring-social/src/main/resources/four-pager-template/) as canonical source of truth. Add a short README in that folder pointing to the bucket URLs.

### 2. Close the scoring gaps
Edit [Navigator360Engine.ts](react-social/src/app/pages/ReportsHub/navigator360/Navigator360Engine.ts):
- Add a `DataCleaningSummary` type (blanks, doubles, per-section-A/B/C counts, `totalIssues`, validity verdict, grade-specific `completionPct`).
- Add `validateAndClean(raw)` that runs §§2.1–2.5 and returns the summary + cleaned scores. Route all 4-pager / Navigator 18-page callers through it.
- In `collectFlags()`, append P-08 (use `VALUE_CONFLICTS`) and P-09 (ability-vs-academic).
- In `computePotentialScore()`, replace `completionPct = 1.0` with the value from the cleaning summary.
- Surface `ERR-01/02/04` + `WARN-01` as `FlagInfo` entries so the report can show the supportive student-facing messages from spec §11.

These changes are additive — the existing 18-page Navigator report continues to work and silently benefits from the added flags.

### 3. Build the 4-pager render module
New folder [react-social/src/app/pages/ReportsHub/fourPager/](react-social/src/app/pages/ReportsHub/fourPager/) mirroring `navigator360/`:

- `FourPagerTypes.ts` — placeholder-keys type (the ~106 `{{keys}}` from the 3 templates), grouped by template variant.
- `FourPagerTemplates.ts` — DO Spaces URLs for the 3 templates; fetch + in-memory cache.
- `FourPagerEngine.ts` — single function `buildFourPagerData(result: Navigator360Result, student: StudentProfile): Record<string, string>` that:
  - Picks the template variant from `result.gradeGroup`.
  - Maps `Navigator360Result` fields to the template's 106 placeholders:
    - Cover/page 2: student name, grade, age, school, city, report date, QR code URL.
    - Page 3 "Your Nature": top-3 RIASEC (with label + level + description), top-3 MI, top-4 abilities.
    - Page 3 "Your Preference": first 5 `result.values`, `result.subjectsOfInterest` (3) + subject alignment = `result.preferenceScore.p4Subjects`, `result.careerAspirations` (3) + aspiration coherence + `cci` as clarity index, 4 strength-profile badges (e.g., top-1 RIASEC / MI / ability / highest value).
    - Page 4: `result.alignmentScore`, spec-text `clarityDescription` from `result.cci`, `result.topCareers.slice(0,9)` for the grid (name / `suitability9` / short description / tags), 5 growth areas derived from `LOW` dimensions across RIASEC + MI + Ability with supportive action text, growth note.
- `FourPagerReport.tsx` — React preview component that loads the template + filled data, renders into a hidden iframe, exposes `toPdfBlob()` using `htmlToPdfBlob`. Preview modal variant mirrors `Navigator360Preview`.
- `FourPagerAPI.ts` — thin wrappers that fetch the underlying `Navigator360Result` (reuse `fetchNavigator360Scores` in [Navigator360API.ts](react-social/src/app/pages/ReportsHub/navigator360/Navigator360API.ts)) and submit the final PDF blob + URL back to `GeneratedReport` with `typeOfReport='fourPager'`.

### 4. Teach the hub about the third type
Edit [UnifiedReport_APIs.ts](react-social/src/app/pages/UnifiedReportManagement/API/UnifiedReport_APIs.ts):
- Extend `ReportType` to `'bet' | 'navigator' | 'fourPager'`.
- Add `getReportTypes(assessment): ReportType[]` returning:
  - `['bet']` when `questionnaire.type === true`.
  - `['navigator']` when plain Navigator.
  - `['navigator', 'fourPager']` when `questionnaire.type === 'general'`.
- Keep `getReportType()` returning the primary (first of the list) so current call sites compile.
- Update every dispatcher helper (`generateDataForAssessment`, `getReportDataByAssessment`, `generateReportsForAssessment`, `getReportUrls`, `downloadReport`, `exportReportExcel`) to take an explicit `type: ReportType` argument so the UI can invoke per type.

### 5. Hub UI in [ReportsHubPage.tsx](react-social/src/app/pages/ReportsHub/ReportsHubPage.tsx)
- Replace the binary `isBet` / `isNavigator` derivation at [ReportsHubPage.tsx:222-224](react-social/src/app/pages/ReportsHub/ReportsHubPage.tsx#L222-L224) with `const applicableTypes = getReportTypes(selectedAssessmentObj)`.
- For general assessments (2 applicable types), render two groups of per-student cells (tabs or side-by-side columns): Navigator (18-page) and 4-Pager. Each row gets its own Generate / Preview / Download / Visibility toggles sourced from its own `reportDataMap` slice keyed by type.
- Preview click dispatches to `Navigator360Preview` or new `FourPagerPreview` based on which row was clicked.
- Bulk-generate + bulk-zip modals grow a report-type radio (Navigator / 4-Pager). `zipJobs` state is already generic on name so no schema change — just embed the type in the zip name + zip call.

### 6. Questionnaire type tri-state
The binary `questionnaire.type` boolean can't represent three values. Minimum-disruption path:
- Add a nullable `reportCategory` string column to the `Questionnaire` entity (values: `bet` / `navigator` / `general`).
- Backend: `getReportTypes` reads `reportCategory` if set, falls back to legacy boolean.
- Frontend admin: the questionnaire-create/edit page gets a small dropdown for `reportCategory`.
- Data migration: existing rows stay on the legacy boolean; admins only need to set `reportCategory = 'general'` on the subset that should produce the 4-pager.

### 7. PDF persistence path
Client-side: fill HTML → iframe → `htmlToPdfBlob` → upload via the same persistence endpoint Navigator uses (POST to `/generated-report` with `typeOfReport='fourPager'` + PDF URL). No new backend endpoint; reuses existing Spaces upload flow.

## Files most likely to change

New:
- [react-social/src/app/pages/ReportsHub/fourPager/](react-social/src/app/pages/ReportsHub/fourPager/) (API, Engine, Templates, Report, Types, Preview)

Edit:
- [react-social/src/app/pages/ReportsHub/navigator360/Navigator360Engine.ts](react-social/src/app/pages/ReportsHub/navigator360/Navigator360Engine.ts) — add cleaning step, P-08, P-09, use `completionPct`.
- [react-social/src/app/pages/ReportsHub/navigator360/Navigator360Types.ts](react-social/src/app/pages/ReportsHub/navigator360/Navigator360Types.ts) — add `DataCleaningSummary`.
- [react-social/src/app/pages/UnifiedReportManagement/API/UnifiedReport_APIs.ts](react-social/src/app/pages/UnifiedReportManagement/API/UnifiedReport_APIs.ts) — extend `ReportType`, add `getReportTypes`, make dispatchers type-explicit.
- [react-social/src/app/pages/ReportsHub/ReportsHubPage.tsx](react-social/src/app/pages/ReportsHub/ReportsHubPage.tsx) — plural report types per assessment, dual UI rows on general assessments.
- Questionnaire entity + its controller + admin UI — add `reportCategory`.

Out of scope (follow-up):
- Expanding `CAREER_DEFINITIONS` from 15 → 277 using the profession-mapping sheet (data work, no code change).

## Reuse candidates (don't rewrite)
- The entire Navigator 360 scoring pipeline in `Navigator360Engine.ts`.
- `htmlToPdfBlob` at [react-social/.../ReportGeneration/utils/htmlToPdf.ts](react-social/src/app/pages/ReportGeneration/utils/htmlToPdf.ts).
- `Navigator360Preview` pattern as the model for `FourPagerPreview`.
- `ReportZipController` + hub's `zipJobs` state (generic over `typeOfReport`).
- `GeneratedReport` + visibility flow (generic over `typeOfReport`).

## Verification

- Seed one general assessment with students across 6–8, 9–10, 11–12.
- From the hub, generate both Navigator and 4-Pager reports; confirm both appear as independent download entries with separate visibility toggles.
- Spot-check PDFs: the 6–8 student uses `insight-navigator.html`, 9–10 uses `subject-navigator.html`, 11–12 uses `career-navigator.html`.
- Inspect rendered output — no raw `{{...}}` placeholders leak through; all 106 fields resolve.
- Validate scores against a hand-computed worked example from the spec (spec §§3.1, 3.2, 5 give examples).
- Trigger an ERR-01 condition (inject >5 blanks) — confirm the 4-pager shows the supportive student message from spec §11, the dashboard shows the red badge, and the counsellor-only note appears where privilege allows.
- Bulk-zip each report type separately; each 4-pager PDF is 4 pages.
- Confirm BET and plain Navigator flows still work unchanged (regression).
