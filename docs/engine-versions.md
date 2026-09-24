# Engine version changelog

Version tags written to `intermediary_scores.engine_version` and
`calculated_report_data.engine_version` (see `EngineVersions.java`). Bumping a
tag forces a cache miss — placeholders are recomputed on the next
`ReportService.generate(force=false)` for rows carrying an older tag.

## pager

- **pager-v3** (2026-07-07) — added plain-word level placeholders
  `cp_1..3_level_text`, `mi_1..3_level_text`, `ab_1..4_level_text`
  ("High" / "Moderate" / "Low"), alongside the existing composite
  `*_level` strings.
- **pager-v2** (2026-06-01) — redesigned pager template placeholder set:
  `cci`, `most_suited_1/2`, `home_action`/`school_action`, `achievements`,
  `hobbies_interests`, `p1%..p9%`; aspirations extended to 4.
- **pager-v1** (2026-05-20) — initial `PagerPlaceholderCalculator` mapping
  (Navigator360 → four-pager placeholders).

## intermediary

- **intermediary-v1** (2026-05-20) — initial
  `computeIntermediaryScores` payload shape.

## bet

- **bet-v1** (2026-06-01) — initial `BetPlaceholderCalculator` mapping.

## legacy

- **legacy-v1** (2026-06-01) — initial `LegacyPlaceholderCalculator` mapping
  (flattened NavigatorReportData).

## navigator_pro

- **navigator_pro-v3** (2026-09-23) — engine moved to the v3 instrument and documents
  (Tech Spec v3, Report Logic v3, Backend Content v3, Core Algorithm Weightages): v3 MQT
  names and display map, 4-point Domain Exposure ((Σ−12)/36, per-domain (m−1)/3), gates
  R1/R2/R5/R3/R4 and R6 Explorer, internal percentiles for bands (never printed), locked
  .40/.40/.20 blend over all 12 domains, Track A/B, all copy from `content-v3.json`.
  Invalidates every navigator_pro-v1 calculation.
- **navigator_pro-v1** (2026-09-10) — initial `NavigatorProCalculationService` mapping
  (MQT option scores → factors, foundation, reasoning, skill, families, values,
  cohort percentiles, bands, zone; blend keys reserved).
