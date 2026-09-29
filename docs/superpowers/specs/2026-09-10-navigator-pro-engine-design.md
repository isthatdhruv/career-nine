# Navigator Pro report engine — design

Date: 2026-09-10 (revised the same day for MQT-based scoring) · Status: approved in discussion, awaiting written review
Sources: `navigator-pro/Report_Generator_TechSpec.pdf` (v2, new bank), `Report_Logic_Spec.xlsx`, `Report_Content_Logic.xlsx`, `Final_Item_Bank_Navigator_Pro_2nd_Sept_FIXED.xlsx` (psychometric reference only), `NavigatorPro_SAMPLE_Report_Priya_Sharma.pdf`

## 1. Goal

Add a fourth report engine, `navigator_pro`, to the unified report pipeline. It scores the
91-item Navigator Pro instrument from the platform's measured-quality-type (MQT) option
scores, applies the generation gates, computes cohort norms and bands, and emits the
placeholder map that fills a Navigator Pro HTML template. Everything downstream (template or
default resolution, `force`, calculated-data caching, HTML fill, Spaces upload, PDF render,
`generated_report` upsert, Kafka worker, Generate Queue) is reused unchanged.

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
- **Scoring model.** Every `AssessmentQuestionOptions` row carries zero or more
  `OptionScoreBasedOnMEasuredQualityTypes` rows: an integer score per
  `MeasuredQualityTypes` (MQT), each MQT grouped under a `MeasuredQualities` block. Reverse-keyed
  items are entered with inverted scores, so summing is the whole scoring step. On submission
  `AssessmentSubmissionProcessorService` already sums scores per MQT into `AssessmentRawScore`
  (ranking rows multiplied by rank order). This engine recomputes from the answer rows instead
  of reading `AssessmentRawScore`, because it needs per-item rules (validity thresholds,
  attention, reasoning chips, rank order) and must reflect corrected option scores on `force`.
- A pilot Navigator Pro questionnaire exists (local id 20; copies 21, 22; assessment 58
  "Navigator Pro Internal Testing"). Its MQT setup: Personality = Doer, Thinker, Creator,
  Helper, Persuader, Organizer (six questions each, Yes 1 / No 0) plus "Personality- Validity"
  for the attention item (No 1 / Yes 0); Fundamental Skills = Numbers & data, Digital &
  information, Thinking & problem-solving (six questions), Creating & improving, Getting things
  done (1–4) plus a single "none" type for the five MCQs; Specialized Skills = the twelve domain
  names (1–5); Work Values = one ranking question whose twelve options each score 1 under a
  value-orientation type. The Adaptability section is the retired 36-item block (Grit, Growth,
  Learnability, Proactive, Curiosity, Validity) and three reasoning MCQs carry the pilot's
  wrong options. The questionnaire must be re-imported to the September bank before real
  scoring; this engine detects a stale questionnaire and says so (§8).

## 3. Architecture

New package `com.kccitm.api.service.b2c.navigatorpro`:

| Class | Responsibility | Depends on |
|---|---|---|
| `NavigatorProCalculationService` | `PlaceholderCalculator` entry point. Runs the schema check, loads answers, builds contribution rows, runs scorer, gates, norms, content binding; returns the placeholder map. The only class with repository access. | repositories, the four below |
| `NavigatorProConstructMap` | Loads `mqt-map.yml` once: construct → MQT names, expected question count, score range. Resolves an MQT name to its construct. | classpath resource |
| `NavigatorProScorer` | Pure functions: contribution rows (construct, question id, score, rank order) → `NavigatorProScores` (indices, factors, sub-domains, reasoning chips, domain ratings, families, shape, values, validity flags, attention pass, incomplete list). No I/O. | `NavigatorProConstructMap` |
| `NavigatorProNorms` | Cohort statistics: percentile rank, medians, n-gates, precision, zone; per-assessment cache. | scorer output for cohort members |
| `NavigatorProContent` | Verbatim copy from the content workbook: band paragraphs, factor definitions, zone copy, values lookup, banner, static lines. Pure lookups. | nothing |

Supporting changes outside the package: `EngineVersions.NAVIGATOR_PRO_V1`, a line in
`docs/engine-versions.md`, `ReportSuppressedException`, one migration, a producer gate, a
`ReportService` catch, a controller mapping, and two small frontend edits (§18).

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

## 5. Construct identification (by MQT name)

Nothing is identified by item code or `excel_question_header`. A question belongs to a
construct because its options carry scores under that construct's MQT. The construct map
(§6) lists, per construct, the MQT names that feed it. Scores an option carries under MQTs the
map does not mention are ignored.

Constructs and their MQTs (names as they must exist after the re-import):

| Construct | MQT name(s) | Questions | Score range |
|---|---|---|---|
| Internal Drive (f_id) | Internal Drive | 4 | 1–5 |
| Sustained Tenacity (f_st) | Sustained Tenacity | 3 | 1–5 |
| Adaptive Execution (f_ae) | Adaptive Execution | 4 | 1–5 |
| Drive index | union of the three factor rows | 11 | — |
| Validity | Validity | 3 | 1–5, oriented: higher = more suspicious |
| Attention | Personality- Validity | 1 | 0–1, 1 = pass |
| Families R/I/A/S/E/C | Doer / Thinker / Creator / Helper / Persuader / Organizer | 6 each | 0–1 |
| Foundation subs ND/DI/TP/CI/GD | Numbers & data / Digital & information / Thinking & problem-solving / Creating & improving / Getting things done | 4/4/6/4/4 | 1–4 |
| Reasoning checks | Numeracy / Data reading / Causal reasoning / Source judgment / Spreadsheet logic | 1 each | 0–1, 1 = correct |
| Specialized domains (12) | Software Development … Technical Business & Consulting (bank names) | 1 each | 1–5 |
| Work Values | the ranking question (identified as the assessment's only `ranking` question) | 1, 12 options | rank order 1–4 |

Reversal is entirely a data-entry matter: A_ID_3, A_ST_2, A_AE_3 are entered with inverted
scores under their factor MQT; the validity items are entered so the suspicious answer scores
high (A_V_1 and A_V_3: Strongly agree 5; A_V_2, the infrequency item: Strongly disagree 5).
The engine has no reverse step anywhere.

## 6. The construct map resource

`src/main/resources/navigator-pro/mqt-map.yml`: for each construct key, the MQT names,
expected question count and allowed score range from the table in §5, plus family display
names (Hands-on, Analytical, Creative, Social, Enterprising, Organising) and domain keys
(`d_sd` … `d_tb`). Loaded once at startup; a malformed file fails startup. Renaming an MQT in
the admin means editing this file, not code. MQT names are matched after trim and
case-insensitively.

## 7. Answer reading

One query loads the student's `AssessmentAnswer` rows for the assessment with option and
option scores. For each row and each of its option's scores whose MQT resolves to a mapped
construct, one contribution (construct, questionnaire question id, score) is produced. The
ranking question's rows produce (values, option text, rank order). Text-response rows use the
mapped option when present.

Completeness uses the per-assessment index from the schema check (§8): every question the
index assigns to a scored construct must have exactly one contribution. Zero contributions
means the student skipped it; more than one means duplicate rows. Both mark the question
*incomplete* and are logged with student, assessment, construct and question id.

## 8. Questionnaire schema check (configuration errors)

Once per assessment (cached by assessment id), the engine scans the questionnaire's questions
and options and builds the index question id → construct. It then validates: every construct
in the map has exactly its expected number of questions; every option of an indexed question
carries a score for its construct; scores lie in the construct's range; no question is indexed
to two constructs; exactly one `ranking` question with twelve options exists. Any violation
throws `ReportRoutingException` listing the construct, the missing MQT or the offending
question ids. This distinguishes "questionnaire not on the September bank" (admin problem,
benign skip in the worker, 400-class in the controller) from "student incomplete" (R5). The
pilot questionnaire fails this check today on the Adaptability and reasoning constructs.

## 9. Scoring formulas

Σ denotes the sum of a construct's contribution scores (reversal already in the scores).
Scaling is exact (double); rounding happens only when a display value is emitted.

| Output | Formula |
|---|---|
| f_id | (Σ Internal Drive − 4) / 16 × 100 |
| f_st | (Σ Sustained Tenacity − 3) / 12 × 100 |
| f_ae | (Σ Adaptive Execution − 4) / 16 × 100 |
| drive | (Σ all 11 factor rows − 11) / 44 × 100 |
| fs_nd, fs_di, fs_tp, fs_ci, fs_gd | (Σ sub-domain − k) / (3k) × 100 with k = 4, 4, 6, 4, 4 |
| foundation | (Σ all 22 sub-domain rows − 22) / 66 × 100 |
| reasoning | count of reasoning rows with score 1 (0..5); one chip per reasoning MQT |
| d_* (12 domains) | (score − 1) / 4 × 100 |
| skill | (Σ 12 domain rows − 12) / 48 × 100 |
| fam_r … fam_c | Σ family rows / 6 × 100 |
| profile_shape | families sorted descending; Flat when top − second < `flat-gap` (10), else Differentiated |
| value_1..4 | option text at rank order 1..4 |
| validity_flags | count of Validity rows with score ≥ 4 (internal only, never in the map) |
| attention | the Personality- Validity row's score is 1 |

Worked example, Internal Drive: Agree 4, Strongly agree 5, Disagree on the reverse item
(stored 4), Agree 4 → Σ 17 → (17 − 4) / 16 × 100 = 81. Drive is the same eleven rows added
once across the three factors, never a fourth MQT.

The values orientation vector is not computed in phase 1: it is only needed by the blend.

## 10. Gates and suppression

Evaluation order and outcomes:

1. R1 attention: attention row missing or score ≠ 1 → suppress, code `R1`.
2. R2 validity: never suppresses. Flags ≥ `banner-flag-count` (2) → `response_quality_banner`
   set and `counselling_mandatory` true. One flag → logged only.
3. R5 incomplete: any question in a scored construct incomplete (§7) → suppress, code `R5`.
   Evaluated before R3/R4 because those need complete family and domain data.
4. R3 weak peak: Differentiated and max family < `weak-peak` (50) → suppress, code `R3`.
5. R4 no signal: Flat and max domain rating < `no-signal-domain` (50) and values missing →
   suppress, code `R4`.
6. R6 Explorer: reserved for phase 2; `explorer` is always false.

Interpretation I1: the ranking question is not a scored construct for R5; fewer than four
ranked rows renders the value placeholders empty and counts as "values missing" for R4.

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
  R1–R5. The engine loads the assessment's answers with the existing export query, builds
  contributions and scores each member with `NavigatorProScorer`, and keeps the members'
  drive, f_id, f_st, f_ae, foundation, skill and reasoning values. The student is part of
  their own cohort.
- Cache: one norm set per assessment, keyed on (assessment id, completed-mapping count),
  time-limited to 60 seconds, so a Generate Queue run shares one norm set and a re-run after
  more completions recomputes.
- n = cohort size = `batch_n`. Precision `prec` = round(100 / √n).
- Percentile rank of x within cohort values v: P = 100 × (|{v < x}| + 0.5 × |{v = x}|) / n
  (midrank convention). Bands use the unrounded P; display shows "P" + round(P).
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
`second_family` (display names from the map), `profile_shape`.

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
the precision line, the twelve values rows (icon, title, why; joined on exact option text),
the response-quality banner, the cover caption and footer, the ring subtitles, the About and
How-to-read blocks, the sector caveat, and the zone name for each quadrant. The factor callout
is composed from its template in content sheet 3.

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
| Construct map missing or malformed | Application fails to start with the validation message |
| Questionnaire fails the schema check (missing MQT, wrong counts, unscored option, range) | `ReportRoutingException` naming the gaps; worker skips benignly; controller 400-class |
| Student question skipped or duplicated in a scored construct | R5 suppression; construct and question id logged |
| Attention / weak peak / no signal | R1 / R3 / R4 suppression, row `suppressed` with reason |
| Cohort under 30 | Raw-only report, not an error |
| Score under an unmapped MQT | Ignored |
| Any other exception | Existing worker path (retry then DLT, row `failed`) |

## 17. Testing

- `NavigatorProConstructMapTest`: every construct present with counts and ranges, name
  matching (trim, case), malformed file rejected.
- `NavigatorProScorerTest` with contribution-row fixtures from the tech spec: MAX (all 100,
  reasoning 5/5, no flags), MIN (all zero, reasoning 0/5), REVERSE (a reverse item whose stored
  score is 1 for Strongly agree contributes 1), VALIDITY (two oriented rows at 4 and 5 → 2
  flags; A_V_2 Disagree stored as 5 counts as a flag), ATTENTION (attention row 0 → R1). Plus:
  flat vs differentiated shape, R3, R4 with values missing, R5 on a skipped and on a
  duplicated question, values ranking order, drive as the union of factor rows.
- `NavigatorProNormsTest`: percentile midrank on ties, band cut at unrounded 74.9/75,
  precision, cohorts of 29 (suppressed), 30, 59 (provisional 50/50) and 60 (medians), zone
  assignment on the cut.
- `NavigatorProCalculationServiceTest` (mocked repositories): full key set present, reserved
  keys empty, banner set on two flags, suppression exception on R1, schema-check failure on a
  questionnaire shaped like the pilot (old Adaptability block, single "none" reasoning type).
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
- Resource: `navigator-pro/mqt-map.yml`.

## 19. Assumptions and rulings

- R1 (user ruling, 2026-09-10): all reversal is done at score level; the engine sums MQT
  scores and has no reverse step. The bank workbook is reference only.
- R2 (user ruling): Adaptability MQTs are factor-level (Internal Drive, Sustained Tenacity,
  Adaptive Execution) plus one Validity MQT; the five reasoning MCQs get five named MQTs;
  the pilot names stay for Personality, Fundamental, Specialized and Work Values.
- A1: validity scores are entered oriented so that the suspicious answer is high, and a flag is
  a Validity row scoring ≥ 4. The logic workbook's literal rule (A_V_2 ≥ 4, A_V_3 ≤ 2) contradicts
  those items' wording because the new codes were renumbered against the legacy V1–V3; the
  orientation is settled at data entry, not in code.
- A2: midrank percentile convention.
- A3: percentile bands for indices, raw RAG for sub-domain bars.
- A4: family display names Hands-on, Analytical, Creative, Social, Enterprising, Organising.
- I1: the ranking question is not R5-scored; it feeds R4 and empties the value placeholders.
- From the bank's own "TO CONFIRM" list: agreement-scale wording, the MCQ keys for
  F_SPR_1/F_NUM_1, the rank-scoring rule 4/3/2/1, the attention-item wording.

## 20. Out of scope

The HTML template; the questionnaire re-import itself (admin work; the schema check reports
its readiness); the student insight dashboard for this engine (it will report "not available
yet"); reading-over-reading deltas; automated counselling queueing; the blend, sectors, R6 and
their copy; auto-generation on submit (config flip later).

## 21. Definition of done (phase 1)

All tests in §17 green; the full backend suite green; a Navigator Pro template with engine
`navigator_pro` can be created in the admin; generating for a student of a re-imported
questionnaire produces a report with every non-reserved key filled; the pilot questionnaire
yields the schema error naming Adaptability and reasoning; an attention-failed student yields a
`suppressed` row visible in the Reports Hub; on-submit completion of a Navigator Pro
assessment enqueues nothing while the Generate Queue still works.
