package com.kccitm.api.service.b2c.report;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.career9.NavigatorReportData;
import com.kccitm.api.service.Navigator.NavigatorReportGenerationService;

/**
 * Wraps the existing legacy 18-page Navigator pipeline. Delegates to
 * {@link NavigatorReportGenerationService#generateForStudent} (which also
 * persists into {@code navigator_report_data} for FE bulk-export compat),
 * then flattens the resulting entity into a placeholder map.
 *
 * <p>Field flattening is intentionally minimal here — the legacy
 * NavigatorReportDataController has the canonical key set in its template-fill
 * code (~lines 833-1011). When that gets extracted into a proper formatter
 * (follow-up), this method should be updated to call it directly.
 */
@Component
public class LegacyPlaceholderCalculator implements PlaceholderCalculator {

    @Autowired private NavigatorReportGenerationService navigatorReportGenerationService;

    @Override public String typeCode()         { return "legacy"; }
    @Override public String engineVersion()    { return EngineVersions.LEGACY_V1; }
    @Override public boolean usesIntermediary() { return true; }

    @Override
    public Map<String, Object> calculate(Long userStudentId, Long assessmentId,
                                         IntermediaryScoresPayload intermediary) {
        // Runs the full Navigator pipeline (also writes navigator_report_data row).
        NavigatorReportData data = navigatorReportGenerationService.generateForStudent(
                userStudentId, assessmentId, /*skipAI=*/ false);

        return flatten(data);
    }

    /**
     * Minimal flatten — covers the most-used placeholders. Anything missing
     * here renders as {@code ""} in the template, matching FourPagerEngineService.fillTemplate's
     * behavior. Extend as needed; this is intentionally narrow during the
     * deprecation window because the legacy NavigatorReportDataController still
     * owns the canonical rendering path.
     */
    private Map<String, Object> flatten(NavigatorReportData d) {
        Map<String, Object> m = new HashMap<>();
        if (d == null) return m;

        m.put("student_name",        n(d.getStudentName()));
        m.put("student_name_caps",   n(d.getStudentNameCaps()));
        m.put("student_first_name",  n(d.getStudentFirstName()));
        m.put("student_class",       n(d.getStudentClass()));
        m.put("student_school",      n(d.getStudentSchool()));

        m.put("personality_1_text",  n(d.getPersonality1Text()));
        m.put("personality_2_text",  n(d.getPersonality2Text()));
        m.put("personality_3_text",  n(d.getPersonality3Text()));

        m.put("intelligence_1_text", n(d.getIntelligence1Text()));
        m.put("intelligence_2_text", n(d.getIntelligence2Text()));
        m.put("intelligence_3_text", n(d.getIntelligence3Text()));

        m.put("ability_1",           n(d.getAbility1()));
        m.put("ability_2",           n(d.getAbility2()));
        m.put("ability_3",           n(d.getAbility3()));
        m.put("ability_4",           n(d.getAbility4()));

        m.put("soi_1",  n(d.getSoi1()));
        m.put("soi_2",  n(d.getSoi2()));
        m.put("soi_3",  n(d.getSoi3()));
        m.put("soi_4",  n(d.getSoi4()));
        m.put("soi_5",  n(d.getSoi5()));

        m.put("values_1", n(d.getValues1()));
        m.put("values_2", n(d.getValues2()));
        m.put("values_3", n(d.getValues3()));
        m.put("values_4", n(d.getValues4()));

        m.put("career_asp_1", n(d.getCareerAsp1()));
        m.put("career_asp_2", n(d.getCareerAsp2()));
        m.put("career_asp_3", n(d.getCareerAsp3()));
        m.put("career_asp_4", n(d.getCareerAsp4()));

        m.put("learning_style",   n(d.getLearningStyle()));
        m.put("learning_style_1", n(d.getLearningStyle1()));
        m.put("learning_style_2", n(d.getLearningStyle2()));
        m.put("learning_style_3", n(d.getLearningStyle3()));

        m.put("summary",                  n(d.getSummary()));
        m.put("learning_style_summary",   n(d.getLearningStyleSummary()));
        m.put("recommendations",          n(d.getRecommendations()));
        m.put("can_at_school",            n(d.getCanAtSchool()));
        m.put("can_at_home",              n(d.getCanAtHome()));

        return m;
    }

    private static String n(Object v) { return v == null ? "" : String.valueOf(v); }
}
