package com.kccitm.api.service.b2c.report;

import java.util.Map;

/**
 * Strategy interface — one impl per report type ({@code bet}, {@code legacy},
 * {@code pager}). ReportService routes by {@link #typeCode()} and feeds the
 * already-computed (or null, for BET) intermediary scores into
 * {@link #calculate}. The returned placeholder map is serialized into
 * {@code calculated_report_data.calculated_json} and used to fill the HTML
 * template.
 */
public interface PlaceholderCalculator {

    /** Matches {@code report_type.code} — {@code "bet"}, {@code "legacy"}, {@code "pager"}. */
    String typeCode();

    /** Engine-version tag written to {@code calculated_report_data.engine_version}. */
    String engineVersion();

    /**
     * True if this strategy reads from {@code intermediary_scores}. BET returns
     * false (its intermediate is the OptionScoreBasedOnMEasuredQualityTypes
     * MQT map, not RIASEC/MI — see plan Risk #6).
     */
    boolean usesIntermediary();

    /**
     * Compute the placeholder map for a single (student, assessment) pair.
     * Routing is purely by {@link #typeCode()} (the template's engineCode); the
     * former {@code subtypeCode} only ever selected a different template HTML,
     * never different data, so it is no longer passed here.
     *
     * @param userStudentId   student PK
     * @param assessmentId    assessment PK
     * @param intermediary    pre-computed intermediary scores; {@code null} if {@link #usesIntermediary()} returns false
     */
    Map<String, Object> calculate(Long userStudentId, Long assessmentId,
                                  IntermediaryScoresPayload intermediary);
}
