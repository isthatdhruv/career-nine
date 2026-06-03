package com.kccitm.api.service.b2c.report;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.career9.BetReportData;
import com.kccitm.api.repository.Career9.BetReportDataRepository;

/**
 * BET strategy. Today the BET pipeline's calculation logic is inline in
 * {@code BetReportDataController.generateForStudentLive} (lines 1062-1152).
 * Pulling it out into a dedicated service is follow-up work; until then this
 * strategy delegates by:
 *
 * <ol>
 *   <li>Reading the most-recent {@code bet_report_data} row if one exists
 *       (the existing one-click path writes it before this strategy is wired in
 *       through the controller shim).</li>
 *   <li>Flattening the entity into a placeholder map matching
 *       {@code bet-template/combined.html}.</li>
 * </ol>
 *
 * <p>If no {@code bet_report_data} row exists yet, returns an empty map. The
 * caller (controller shim) ensures the row is materialized first.
 */
@Component
public class BetPlaceholderCalculator implements PlaceholderCalculator {

    @Autowired private BetReportDataRepository betReportDataRepository;

    @Override public String typeCode()         { return "bet"; }
    @Override public String engineVersion()    { return EngineVersions.BET_V1; }
    @Override public boolean usesIntermediary() { return false; }

    @Override
    public Map<String, Object> calculate(Long userStudentId, Long assessmentId,
                                         IntermediaryScoresPayload intermediary) {
        Optional<BetReportData> opt = betReportDataRepository
                .findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
        return flatten(opt.orElse(null));
    }

    private Map<String, Object> flatten(BetReportData d) {
        Map<String, Object> m = new HashMap<>();
        if (d == null) return m;

        m.put("name",                    n(d.getStudentName()));
        m.put("class",                   n(d.getStudentGrade()));
        m.put("cog1",                    n(d.getCog1()));
        m.put("cog2",                    n(d.getCog2()));
        m.put("cog3",                    n(d.getCog3()));
        m.put("cog3_description",        n(d.getCog3Description()));
        m.put("self_management_1",       n(d.getSelfManagement1()));
        m.put("self_management_2",       n(d.getSelfManagement2()));
        m.put("self_management_3",       n(d.getSelfManagement3()));
        m.put("social_insight",          n(d.getSocialInsight()));
        m.put("environment",             n(d.getEnvironment()));
        m.put("value1",                  n(d.getValue1()));
        m.put("value2",                  n(d.getValue2()));
        m.put("value3",                  n(d.getValue3()));
        m.put("value_overview",          n(d.getValueOverview()));

        return m;
    }

    private static String n(Object v) { return v == null ? "" : String.valueOf(v); }
}
