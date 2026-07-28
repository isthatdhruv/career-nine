package com.kccitm.api.service.dashboard.cohort;

import java.util.List;

import com.kccitm.api.service.b2c.pager.Navigator360Models.Navigator360Result;

/**
 * Pluggable cohort aggregation. Operates over already-precomputed per-student
 * Navigator360Result objects for one (institute, assessment) and emits one payload.
 * The real cohort formulas implement this interface later; until then a placeholder
 * implementation stands in. Implementations MUST be deterministic for a given input.
 */
public interface CohortInsightAggregator {

    CohortInsightPayload aggregate(Long instituteCode, Long assessmentId, List<Navigator360Result> perStudent);

    /** Stamped onto every generation so stale-logic payloads are detectable. */
    String logicVersion();
}
