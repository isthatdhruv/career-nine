# Navigator Pro report engine — design

Date: 2026-09-10 · Status: approved in discussion, awaiting written review
Sources: `navigator-pro/Report_Generator_TechSpec.pdf` (v2, new bank), `Report_Logic_Spec.xlsx`, `Report_Content_Logic.xlsx`, `Final_Item_Bank_Navigator_Pro_2nd_Sept_FIXED.xlsx`, `NavigatorPro_SAMPLE_Report_Priya_Sharma.pdf`

## 1. Goal

Add a fourth report engine, `navigator_pro`, to the unified report pipeline. It scores the
91-item Navigator Pro instrument by bank lookup, applies the generation gates, computes
cohort norms and bands, and emits the placeholder map that fills a Navigator Pro HTML
template. Everything downstream (template or default resolution, `force`, calculated-data
caching, HTML fill, Spaces upload, PDF render, `generated_report` upsert, Kafka worker,
Generate Queue) is reused unchanged.

Phase 1 (this spec) delivers scoring, gates R1–R5, norms, bands, zone, values and every
non-blend placeholder. The two-tier blend (top-3 specialisations, sectors, tie, R6 Explorer)
and its copy are phase 2, blocked on `Guidance_Engine_TwoTier.xlsx` and the pilot content
texts, neither of which is available. Their placeholder keys are reserved now so the
template contract does not change later.

## 2. Context (what exists today)

- Engines are strategies: `PlaceholderCalculator` (`typeCode`, `engineVersion`,
  `usesIntermediary`, `calculate`). `ReportService` collects every implementation and routes
  by `ReportTemplate.engineCode`. Adding an engine is adding a bean.
- `TemplateRenderer` is plain `{{key}}` substitution with no conditionals. `ReportService`
  also embeds the whole placeholder map in the page as `chartDataJson`. Therefore every
  conditional text must arrive pre-resolved, and nothing internal may be placed in the map.
- The pipeline carries only `force`, `reportTemplateId`, `emailMode`, `batchId` on the
  event; the worker never inspects the engine. Terminal sanity failures mark the row
  `failed` and go to the DLT; routing errors are a benign skip.
- A pilot Navigator Pro questionnaire exists (local id 20; copies 21, 22; assessment 58
  "Navigator Pro Internal Testing"). Sections and platform headers:
  Adaptability_1..36 (old block), Navigator_Pro:_Personality_1..37, Fundamental_Skillset_1..27,
  Specialized_Skillset_1..12, Work_Values_1 (question type `ranking`). Option texts for
  Personality, Fundamental behavioural, Specialized and all twelve Work Values match the bank
  exactly. Three reasoning MCQs (F_NUM_1, F_CAU_1, F_SPR_1) do not, and the Adaptability block
  is the retired 36-item scale. The questionnaire must be re-imported to the September bank
  before real scoring; this engine detects a stale questionnaire and says so (§8).
- Apache POI is already a dependency; BET ships its own item-code workbook on the classpath.

## 3. Architecture

New package `com.kccitm.api.service.b2c.navigatorpro`:

| Class | Responsibility | Depends on |
|---|---|---|
| `NavigatorProCalculationService` | `PlaceholderCalculator` entry point. Loads answers, resolves items, runs scorer, gates, norms, content binding; returns the placeholder map. The only class with repository access. | repositories, the four below |
| `NavigatorProItemBank` | Loads `item-bank.xlsx` and `header-map.csv` once at startup into immutable maps; validates the bank; resolves platform header → item code. | classpath resources, POI |
| `NavigatorProScorer` | Pure functions: `Map<itemCode, Response>` → `NavigatorProScores` (indices, factors, sub-domains, reasoning, domain ratings, families, shape, values, validity flags, attention pass, missing items). No I/O. | `NavigatorProItemBank` |
| `NavigatorProNorms` | Cohort statistics: percentile rank, medians, n-gates, precision, zone; per-assessment cache. | `NavigatorProScorer` output for cohort members |
| `NavigatorProContent` | Verbatim copy from the content workbook: band paragraphs, factor definitions, zone copy, values lookup, banner, static lines. Pure lookups. | nothing |

Supporting changes outside the package: `EngineVersions.NAVIGATOR_PRO_V1`, a line in
`docs/engine-versions.md`, `ReportSuppressedException`, one migration, a producer gate, a
`ReportService` catch, a controller mapping, and two small frontend edits (§13).

## 4. Routing and manual-only generation

- `typeCode()` = `navigator_pro`; `engineVersion()` = `navigator_pro-v1`; `usesIntermediary()` = false.
- Property `report.pipeline.manual-only-engines` (comma list, default `navigator_pro`).
  `ReportPipelineProducer.enqueue` (the on-submit path) resolves the assessment's default
  template via `ReportService.resolveTemplate(assessmentId, null)`; if the engine code is in
  the list it logs at INFO and returns `true` (handled; the legacy auto-gen must not run
  either). A `ReportRoutingException` during resolution is caught and the event is enqueued
  as before (the worker already treats "no template" as a benign skip).
  `enqueueAdmin` (Generate Queue) and the synchronous endpoints are not gated.
  Enabling auto-generation later means removing the engine from the property.

## 5. Item identification

Items are identified by `QuestionnaireQuestion.excelQuestionHeader`. A header resolves when it
equals a bank item code (`A_ID_1`) or appears in `header-map.csv` (platform header → item
code). The map is generated from the bank's Code Map sheet (Personality 37, Fundamental 27,
Specialized 12, Work Values 1) plus 14 Adaptability rows.

Assumption A1: the re-imported Adaptability section uses headers `Adaptability_1..14` in the
bank's administered order (A_ID_1, A_ID_2, A_ID_3, A_V_1, A_ID_4, A_ST_1, A_ST_2, A_V_2,
A_ST_3, A_AE_1, A_AE_2, A_AE_3, A_V_3, A_AE_4). If the import uses different headers, only
the CSV changes.

Family membership derives from the item-code prefix (`P_R`, `P_I`, `P_A`, `P_S`, `P_E`,
`P_C`), never from the Code Map's construct column (which still labels `P_R_6` as
Investigative). `P_AC_1` belongs to no family.

## 6. Scoring configuration (the bank)

- `src/main/resources/navigator-pro/item-bank.xlsx` is a byte-for-byte copy of the FIXED file.
  Sheet "Final Item Bank" is read with POI; every cell is read as text (`DataFormatter`), so
  `=A2+B2` is an option string, not a formula. Marks cells parse to integers; the Work Values
  row's "By rank" marks are ignored (rank-scored, §9).
- Loaded once into an immutable structure: item code → statement, construct, domain,
  ordered list of (option text, marks). Option texts are normalised for matching: trim and
  collapse internal whitespace; matching is otherwise exact and case-sensitive.
- Startup validation (any failure aborts application start): exactly 91 codes with the
  expected prefixes; every non-values option has an integer mark; `A_ID_3`, `A_ST_2`, `A_AE_3`
  carry marks 5..1; each of the five MCQs has exactly one option with mark 1; blank option
  cells (the known `F_SPR_1` erratum) are skipped.

## 7. Answer reading

One query loads the student's `AssessmentAnswer` rows for the assessment with question,
option and header. For each row the header resolves to an item code (unknown headers are
ignored and counted for diagnostics).

- Single-choice items: the chosen option's text, normalised, looked up in the bank → marks.
  No row, or no matching option text, marks the item *incomplete* (logged with student,
  assessment, item code, raw text).
- `W_V_1` (ranking): rows carry `rankOrder`; ranks 1..4 map to the option text. Fewer than
  four ranked rows means *values missing*.
- Validity items `A_V_1..3` record the response marks 1..5; they never enter an index.
- `P_AC_1`: pass when the chosen option is `No` (marks 1).

## 8. Questionnaire schema check (configuration errors)

Before scoring a student, the engine validates the assessment's questionnaire against the
bank (cached per assessment id): every one of the 91 codes resolves to exactly one question,
and every non-values question's option texts are a subset of the bank's option texts for that
code. Any violation throws `ReportRoutingException` listing the offending codes and texts.
This distinguishes "questionnaire not on the September bank" (admin problem, benign skip in
the worker, 400-class in the controller) from "student incomplete" (R5).

## 9. Scoring formulas

All sums are integer sums of marks; scaling is exact (double); rounding happens only when a
display value is emitted. Σ denotes summation over the listed items.

| Output | Formula |
|---|---|
| drive | (Σ marks of the 11 trait items − 11) / 44 × 100 |
| f_id | (Σ A_ID_1..4 − 4) / 16 × 100 |
| f_st | (Σ A_ST_1..3 − 3) / 12 × 100 |
| f_ae | (Σ A_AE_1..4 − 4) / 16 × 100 |
| foundation | (Σ 22 behavioural items − 22) / 66 × 100 |
| fs_nd, fs_di, fs_tp, fs_ci, fs_gd | (Σ sub-domain − k) / (3k) × 100 with k = 4, 4, 6, 4, 4 |
| reasoning | count of marks = 1 over F_NUM_1, F_DAT_1, F_CAU_1, F_SRC_1, F_SPR_1 (0..5) |
| skill | (Σ 12 specialized items − 12) / 48 × 100 |
| d_* (12 domains) | (m − 1) / 4 × 100 |
| fam_r … fam_c | Yes-count / 6 × 100 |
| profile_shape | families sorted descending; Flat when top − second < `flat-gap` (10), else Differentiated |
| value_1..4 | option text at rank 1..4 |
| validity_flags | count of: A_V_1 ≥ 4, A_V_2 ≥ 4, A_V_3 ≤ 2 (internal only) |

The values orientation vector (Growth/Autonomy/Security/Reward/Impact) is not computed in
phase 1: its option-to-orientation mapping is only needed by the blend.

## 10. Gates and suppression

Evaluation order and outcomes:

1. R1 attention: `P_AC_1` not "No" → suppress, code `R1`.
2. R2 validity: never suppresses. 2+ flags → `response_quality_banner` set and
   `counselling_mandatory` true. 1 flag → logged only. The count is never in the map.
3. R5 incomplete: any of the 90 non-values items incomplete → suppress, code `R5`. Evaluated
   before R3/R4 because those need complete family and domain data (spec order otherwise kept).
4. R3 weak peak: Differentiated and max family < `weak-peak` (50) → suppress, code `R3`.
5. R4 no signal: Flat and max domain rating < `no-signal-domain` (50) and values missing →
   suppress, code `R4`.
6. R6 Explorer: reserved for phase 2; `explorer` is always false.

Interpretation I1: `W_V_1` is not a scored item for R5; its absence renders the value
placeholders empty and counts as "values missing" for R4. Without this reading, R4 could never
fire.

Suppression mechanics:

- `ReportSuppressedException(ruleCode, reason)` (unchecked) is thrown by `calculate`.
- `ReportService.generate` catches it, upserts the `generated_report` row for
  (student, assessment, template) with `report_status = "suppressed"`,
  `suppression_reason = "R1: attention check not passed"` (code + short reason), `updated_at`,
  no URL change, and rethrows. No `calculated_report_data` row is written.
- Migration `V20260910001__generated_report_suppression_reason.sql`: add
  `suppression_reason VARCHAR(500) NULL` to `generated_report`.
- `ReportGenerateConsumer` catches the exception, logs at WARN, and returns (ack; no retry,
  no DLT). The batch lifecycle counts it as processed.
- `UnifiedReportController` maps it to HTTP 422 with `code` = rule code and the reason; the
  bulk endpoint writes `status = "suppressed"` rows.
- Reports Hub: rows with status `suppressed` count with failed rows and show the reason. This
  list is the counselling queue until phase 2 automates it.

## 11. Norms, percentiles, zone

- Cohort: students of the same assessment whose mapping status is `completed` and who pass
  R1–R5. The engine loads the assessment's answers with the existing export query, scores
  each member with `NavigatorProScorer`, and keeps the members' drive, f_id, f_st, f_ae,
  foundation, skill and reasoning values. The student is part of their own cohort.
- Cache: one norm set per assessment, keyed on (assessment id, completed-mapping count),
  time-limited to 60 seconds, so a Generate Queue run shares one norm set and a re-run after
  more completions recomputes.
- n = cohort size = `batch_n`. Precision `prec` = round(100 / √n).
- Percentile rank of x within cohort values v: P = 100 × (|{v < x}| + 0.5 × |{v = x}|) / n
  (midrank convention). Bands use the unrounded P; display shows "P" + round(P).
  Assumption A2: the midrank convention; the spec says "empirical percentile rank" without
  naming one.
- n-gates: n < `percentile-min-n` (30) → `percentiles_suppressed` true; every percentile,
  percentile band and band paragraph is emitted empty; top and bottom factor fall back to raw
  factor order and `factor_callout` is empty. n < `norms-min-n` (60) → `norms_provisional`
  true and zone cuts are 50/50. n ≥ 60 → cuts are the cohort medians of drive and skill.
- Zone: skill ≥ skill cut and drive ≥ drive cut → "Ready to accelerate"; drive ≥ cut only →
  "Driven, still building"; skill ≥ cut only → "Skilled, needs a spark"; neither → "Starting the
  journey". "At the cut" counts as above.
- Comparability: no reading-over-reading deltas in phase 1.

## 12. Bands

- Index-level bands (drive, f_id, f_st, f_ae, foundation, skill, reasoning) are percentile-only:
  P ≥ 75 → Strong, 25 ≤ P < 75 → Developing, P < 25 → Early. Each carries the matching
  paragraph from content sheet 6 (21 texts).
- Foundation sub-domain bars use the raw thresholds from the display-rules sheet: ≥ 67 Strong
  (green), 34–66 Developing (amber), ≤ 33 Early (red). `lowest_bar` is the sub-domain with the
  lowest raw score (first in ND, DI, TP, CI, GD order on ties).
  Assumption A3: the split between percentile bands for indices and raw RAG for sub-domain
  bars resolves a conflict between sheets 4 and 5 and matches the sample report.
- Student-facing labels are only Strong / Developing / Early. The words low, poor, weak,
  average, below average, least motivated, fail never appear in emitted text.

## 13. Placeholder contract

Keys are snake_case without braces. Numbers are integers unless noted; booleans are
`true`/`false`; empty string means "not available". `chartDataJson` and `counselling_otp` are
added by `ReportService` and are not the engine's concern.

Identity and batch: `student_name`, `first_name`, `student_id` (institute roll number, else
Career-9 roll number, else platform id), `college` (institute name), `reading_no` (1 + the
student's earlier completed assessments whose default template engine is `navigator_pro`),
`reading_date` (mapping `completedAt`, `d MMM yyyy`), `batch_n`, `prec`, `career_library_url`.

Drive: `drive`, `f_id`, `f_st`, `f_ae`, `p_id`, `p_st`, `p_ae` (integers or empty),
`p_id_text`, `p_st_text`, `p_ae_text` ("P85" or empty), `top_factor`, `bottom_factor`
(display names), `top_factor_p`, `bottom_factor_p`, `drive_band`, `drive_text`, `f_id_band`,
`f_id_text`, `f_st_band`, `f_st_text`, `f_ae_band`, `f_ae_text`, `factor_callout`,
`def_id`, `def_st`, `def_ae` (student-facing definitions).

Foundation: `foundation`, `foundation_band`, `foundation_text`, `fs_nd`, `fs_di`, `fs_tp`,
`fs_ci`, `fs_gd`, each with `_band` and `_rag` (green/amber/red), `lowest_bar`,
`lowest_bar_step` (first-step line; empty until copy supplied).

Reasoning: `reasoning` (0..5), `reasoning_display` ("4/5"), `reasoning_band`,
`reasoning_text`, `chk_dat`, `chk_num`, `chk_cau`, `chk_src`, `chk_spr` (booleans) and
`chk_*_mark` ("✔"/"✘").

Skill: `skill`, `skill_p`, `skill_band`, `skill_text`, `d_sd`, `d_da`, `d_si`, `d_cy`,
`d_ux`, `d_ee`, `d_pe`, `d_md`, `d_cs`, `d_pc`, `d_qt`, `d_tb`.

Interests: `fam_r`, `fam_i`, `fam_a`, `fam_s`, `fam_e`, `fam_c`, `top_family`,
`second_family` (display names: Hands-on, Analytical, Creative, Social, Enterprising,
Organising — Assumption A4: these display names come from the sample report and dashboard;
the workbooks name the families only by Holland letter), `profile_shape`.

Zone: `zone`, `zone_copy`, `zone_note` ("Drive 73 (above the batch median) — skill 54 (above
median)…"; below 60 the note says "provisional cut" instead of "batch median"), `drive_median`,
`skill_median`, `norms_provisional`, `percentiles_suppressed`.

Values: `value_1..4`, `value_1..4_icon`, `value_1..4_why` (empty when values missing).

Quality: `response_quality_banner` (the full banner HTML block, or empty),
`counselling_mandatory`.

Reserved for phase 2, emitted now as empty or false: `explorer`, `top1`, `top2`, `top3`,
`top1_score`, `top2_score`, `top3_score`, `gap12`, `tie`, `sector_1..3`, `sector_1..3_fit`,
`tier_line`, `rank_copy_1..3`, `cta_variant`, `cta_text`, `one_line`, `move_1`, `move_2`,
`move_3`.

## 14. Copy binding

`NavigatorProContent` holds verbatim: the 21 band paragraphs, the three factor definitions,
the precision line, the twelve values rows (icon, title, why), the response-quality banner,
the cover caption and footer, the ring subtitles, the About and How-to-read blocks, the sector
caveat, and the zone name for each quadrant. The factor callout is composed from its template
in content sheet 3.

Copy the workbooks reference but do not contain — go-live inputs to be supplied, rendered
empty until then: three of the four student-facing zone paragraphs ("Ready to accelerate" is
taken from the sample), the mandatory-counselling CTA wording, four of the five lowest-bar
first-step lines ("Getting things done" is taken from the sample), and all phase-2 blend copy.
No placeholder text is ever printed; an unsupplied text is an empty string.

## 15. Configuration

`app.navigator-pro.career-library-url` (string, required for a live QR),
`app.navigator-pro.flat-gap` (10), `weak-peak` (50), `no-signal-domain` (50),
`banner-flag-count` (2), `norms-min-n` (60), `percentile-min-n` (30),
`report.pipeline.manual-only-engines` (`navigator_pro`).

## 16. Error handling

| Condition | Behaviour |
|---|---|
| Bank resource missing or invalid | Application fails to start with the validation message |
| Questionnaire missing/duplicate codes or option texts off the bank | `ReportRoutingException` naming items; worker skips benignly; controller 400-class |
| Student item unanswered or unmatched | R5 suppression; item code and raw text logged |
| Attention / weak peak / no signal | R1 / R3 / R4 suppression, row `suppressed` with reason |
| Cohort under 30 | Raw-only report, not an error |
| Unknown header in answers | Ignored, counted in a DEBUG line |
| Any other exception | Existing worker path (retry then DLT, row `failed`) |

## 17. Testing

- `NavigatorProItemBankTest`: 91 codes, option counts per block, text cells (the `=A2+B2`
  key), inverted marks on the three reverse items, MCQ single key, header-map resolution
  including the Adaptability assumption, unknown header rejection.
- `NavigatorProScorerTest` golden fixtures from the tech spec: MAX (all 100, reasoning 5/5,
  no flags), MIN (all zero, reasoning 0/5), REVERSE (Strongly agree on the three reverse items
  scores 1 each), VALIDITY (A_V_1 Agree + A_V_3 Disagree → 2 flags), ATTENTION (P_AC_1 Yes →
  R1). Plus: flat vs differentiated shape, R3, R4 with values missing, R5 with one missing
  item, values ranking.
- `NavigatorProNormsTest`: percentile midrank on ties, band cut at unrounded 74.9/75,
  precision, cohorts of 29 (suppressed), 30, 59 (provisional 50/50) and 60 (medians), zone
  assignment on the cut.
- `NavigatorProCalculationServiceTest` (mocked repositories): full key set present, reserved
  keys empty, banner set on two flags, suppression exception on R1, schema-check failure on a
  stale questionnaire.
- Pipeline: producer skips a manual-only engine on submit but not on admin enqueue;
  consumer acks a `ReportSuppressedException`; `ReportService` upserts the suppressed row.
- Frontend: `npm run typecheck` (58-error baseline) after the two edits.

## 18. Changes outside the new package

- `EngineVersions.NAVIGATOR_PRO_V1 = "navigator_pro-v1"`; `docs/engine-versions.md` entry.
- `ReportSuppressedException` in `service/b2c/report`.
- `ReportService.generate`: catch, upsert suppressed row, rethrow.
- `ReportGenerateConsumer`: catch and ack. `UnifiedReportController`: 422 mapping.
- `ReportPipelineProducer.enqueue`: manual-only gate. `application.yml`: the properties.
- Migration `V20260910001__generated_report_suppression_reason.sql`; `GeneratedReport`
  field and accessors.
- Frontend: `ReportTemplatesPage.tsx` engine list gains `navigator_pro`; Reports Hub shows
  `suppressed` with its reason alongside failed rows.
- Resources: `navigator-pro/item-bank.xlsx`, `navigator-pro/header-map.csv`.

## 19. Assumptions to confirm

- A1 Adaptability headers `Adaptability_1..14` in administered order (§5).
- A2 Midrank percentile convention (§11).
- A3 Percentile bands for indices, raw RAG for sub-domain bars (§12).
- A4 Family display names (§13).
- I1 `W_V_1` missing is not R5; it feeds R4 and empties the value placeholders (§10).
- From the bank's own "TO CONFIRM" list: agreement-scale wording, the MCQ keys for
  F_SPR_1/F_NUM_1, the rank-scoring rule 4/3/2/1, the attention-item wording.

## 20. Out of scope

The HTML template; the student insight dashboard for this engine (it will report "not
available yet"); reading-over-reading deltas; automated counselling queueing; the blend,
sectors, R6 and their copy; auto-generation on submit (config flip later).

## 21. Definition of done (phase 1)

All tests in §17 green; the full backend suite green; a Navigator Pro template with engine
`navigator_pro` can be created in the admin; generating for a student of a re-imported
questionnaire produces a report with every non-reserved key filled; a stale questionnaire
yields the schema error; an attention-failed student yields a `suppressed` row visible in the
Reports Hub; on-submit completion of a Navigator Pro assessment enqueues nothing while the
Generate Queue still works.
