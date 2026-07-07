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
