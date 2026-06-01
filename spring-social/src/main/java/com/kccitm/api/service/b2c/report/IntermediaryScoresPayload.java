package com.kccitm.api.service.b2c.report;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.kccitm.api.service.Navigator.NavigatorReportGenerationService;

/**
 * JSON-serializable mirror of {@link NavigatorReportGenerationService.IntermediaryScores}.
 * Persisted into {@code intermediary_scores.scores_json}. Kept as a separate
 * POJO so the persistence shape is decoupled from the inner DTO and won't
 * silently break when the inner class adds/removes fields.
 */
public class IntermediaryScoresPayload {

    public String studentName;
    public String studentClass;
    public Map<String, Integer> miScores       = new LinkedHashMap<>();
    public Map<String, Integer> aptitudeScores = new LinkedHashMap<>();
    public Map<String, Integer> riasecScores   = new LinkedHashMap<>();
    public List<String> selectedSOIs           = new ArrayList<>();
    public List<String> selectedValues         = new ArrayList<>();
    public List<String> selectedCareerAsps     = new ArrayList<>();

    public IntermediaryScoresPayload() {}

    /** Lift from the existing inner DTO so callers can serialize via Jackson. */
    public static IntermediaryScoresPayload fromDto(NavigatorReportGenerationService.IntermediaryScores src) {
        if (src == null) return null;
        IntermediaryScoresPayload p = new IntermediaryScoresPayload();
        p.studentName        = src.studentName;
        p.studentClass       = src.studentClass;
        if (src.miScores       != null) p.miScores.putAll(src.miScores);
        if (src.aptitudeScores != null) p.aptitudeScores.putAll(src.aptitudeScores);
        if (src.riasecScores   != null) p.riasecScores.putAll(src.riasecScores);
        if (src.selectedSOIs       != null) p.selectedSOIs.addAll(src.selectedSOIs);
        if (src.selectedValues     != null) p.selectedValues.addAll(src.selectedValues);
        if (src.selectedCareerAsps != null) p.selectedCareerAsps.addAll(src.selectedCareerAsps);
        return p;
    }

    /** Lower back to the inner DTO so the existing Navigator360EngineService can consume it. */
    public NavigatorReportGenerationService.IntermediaryScores toDto() {
        NavigatorReportGenerationService.IntermediaryScores d =
                new NavigatorReportGenerationService.IntermediaryScores();
        d.studentName        = this.studentName;
        d.studentClass       = this.studentClass;
        d.miScores           = this.miScores       != null ? new LinkedHashMap<>(this.miScores)       : new LinkedHashMap<>();
        d.aptitudeScores     = this.aptitudeScores != null ? new LinkedHashMap<>(this.aptitudeScores) : new LinkedHashMap<>();
        d.riasecScores       = this.riasecScores   != null ? new LinkedHashMap<>(this.riasecScores)   : new LinkedHashMap<>();
        d.selectedSOIs       = this.selectedSOIs       != null ? new ArrayList<>(this.selectedSOIs)       : new ArrayList<>();
        d.selectedValues     = this.selectedValues     != null ? new ArrayList<>(this.selectedValues)     : new ArrayList<>();
        d.selectedCareerAsps = this.selectedCareerAsps != null ? new ArrayList<>(this.selectedCareerAsps) : new ArrayList<>();
        return d;
    }
}
