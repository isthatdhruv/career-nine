package com.kccitm.api.service.b2c.report;

/**
 * Single source of truth for engine-version tags written to
 * {@code intermediary_scores.engine_version} and
 * {@code calculated_report_data.engine_version}. Bumping a value here forces
 * cache miss on the next {@code ReportService.generate(force=false)} call for
 * any row that still carries the old tag.
 *
 * <p><strong>Bump policy</strong>: whenever calc logic changes in a way that
 * would produce different placeholder values for the same inputs, increment
 * the matching constant and add a line to {@code docs/engine-versions.md}.
 */
public final class EngineVersions {

    private EngineVersions() {}

    /** Bumped when NavigatorReportGenerationService.computeIntermediaryScores changes shape or numeric outputs. */
    public static final String INTERMEDIARY_V1 = "intermediary-v1";

    /** Bumped when BetPlaceholderCalculator's placeholder mapping changes. */
    public static final String BET_V1 = "bet-v1";

    /** Bumped when LegacyPlaceholderCalculator's placeholder mapping changes. */
    public static final String LEGACY_V1 = "legacy-v1";

    /** Bumped when PagerPlaceholderCalculator's placeholder mapping changes (incl. FourPagerEngineService.buildPlaceholders). */
    public static final String PAGER_V1 = "pager-v3";
}
