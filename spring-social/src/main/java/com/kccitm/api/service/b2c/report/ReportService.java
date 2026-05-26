package com.kccitm.api.service.b2c.report;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.Questionaire.Questionnaire;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.report.CalculatedReportData;
import com.kccitm.api.model.career9.report.IntermediaryScoresRow;
import com.kccitm.api.model.career9.report.ReportSubtype;
import com.kccitm.api.model.career9.report.ReportType;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.report.CalculatedReportDataRepository;
import com.kccitm.api.repository.Career9.report.IntermediaryScoresRepository;
import com.kccitm.api.repository.Career9.report.ReportSubtypeRepository;
import com.kccitm.api.repository.Career9.report.ReportTypeRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;
import com.kccitm.api.service.Navigator.NavigatorReportGenerationService;
import com.kccitm.api.service.b2c.pager.PagerScoreSource;
import com.kccitm.api.service.b2c.report.SanityCheckService.SanityResult;

/**
 * Unified report-generation orchestrator. Drives one entry point for BET,
 * Legacy 18-page, and Pager 4-pager — see plan
 * {@code /home/babayaga/.claude/plans/1-b-2-indexed-valley.md}.
 *
 * <p>Flow ({@code force=false}):
 * <ol>
 *   <li>Sanity pre-flight (mapping completed).</li>
 *   <li>Resolve {@link ReportType} + {@link ReportSubtype} from the
 *       questionnaire, with grade-based fallback during deprecation window.</li>
 *   <li>If strategy uses intermediary scores: load cached
 *       {@code intermediary_scores} row OR compute via
 *       {@link PagerScoreSource} (which carries the async-persistence
 *       retry).</li>
 *   <li>Load cached {@code calculated_report_data} row OR call strategy
 *       and upsert.</li>
 *   <li>Always re-fetch template from Spaces (cached) + fill + re-upload
 *       rendered HTML — template edits propagate without recomputing.</li>
 *   <li>Upsert {@code generated_report} with new URL.</li>
 * </ol>
 */
@Service
public class ReportService {

    private static final Logger logger = LoggerFactory.getLogger(ReportService.class);

    @Autowired private SanityCheckService sanityCheckService;
    @Autowired private PagerScoreSource pagerScoreSource;

    @Autowired private ReportTypeRepository reportTypeRepository;
    @Autowired private ReportSubtypeRepository reportSubtypeRepository;
    @Autowired private IntermediaryScoresRepository intermediaryScoresRepository;
    @Autowired private CalculatedReportDataRepository calculatedReportDataRepository;
    @Autowired private GeneratedReportRepository generatedReportRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private UserStudentRepository userStudentRepository;

    @Autowired private TemplateCache templateCache;
    @Autowired private TemplateRenderer templateRenderer;
    @Autowired private DigitalOceanSpacesService spacesService;
    @Autowired private ObjectMapper objectMapper;

    @Autowired private List<PlaceholderCalculator> allStrategies;

    private Map<String, PlaceholderCalculator> strategyByType;

    @PostConstruct
    public void init() {
        strategyByType = new HashMap<>();
        for (PlaceholderCalculator c : allStrategies) {
            strategyByType.put(c.typeCode(), c);
        }
        logger.info("ReportService initialized with strategies: {}", strategyByType.keySet());
    }

    public ReportResult generate(Long userStudentId, Long assessmentId, boolean force) {
        // 1. Sanity pre-flight
        SanityResult sanity = sanityCheckService.existsAndComplete(userStudentId, assessmentId);
        if (!sanity.ok) {
            throw new SanityFailedException(sanity.code, sanity.reason);
        }

        // 2. Resolve (type, subtype)
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new ReportRoutingException("Assessment not found: " + assessmentId));
        TypeAndSubtype routing = resolveTypeAndSubtype(assessment, userStudentId);
        ReportType    type    = routing.type;
        ReportSubtype subtype = routing.subtype;

        PlaceholderCalculator strategy = strategyByType.get(type.getCode());
        if (strategy == null) {
            throw new ReportRoutingException("No strategy registered for type=" + type.getCode());
        }

        // 3. Intermediary scores (Pager/Legacy only)
        IntermediaryScoresPayload intermediary = null;
        if (strategy.usesIntermediary()) {
            intermediary = ensureIntermediaryScores(userStudentId, assessmentId, force);
        }

        // 4. Calculated report data (per type+subtype)
        boolean reusedCalc = false;
        CalculatedReportData calcRow = null;
        Optional<CalculatedReportData> existing = calculatedReportDataRepository
                .findByUserStudentIdAndAssessmentIdAndReportType_CodeAndReportSubtype_Code(
                        userStudentId, assessmentId, type.getCode(), subtype.getCode());

        if (!force && existing.isPresent()
                && strategy.engineVersion().equals(existing.get().getEngineVersion())) {
            calcRow = existing.get();
            reusedCalc = true;
        } else {
            Map<String, Object> placeholders = strategy.calculate(
                    userStudentId, assessmentId, subtype.getCode(), intermediary);
            calcRow = upsertCalculatedReportData(
                    existing.orElse(null), userStudentId, assessmentId,
                    type, subtype, placeholders, strategy.engineVersion());
        }

        // 5. Render — always re-load template and re-fill (template edits propagate).
        String templateHtml = templateCache.get(
                subtype.getTemplateSpacesUrl(), subtype.getTemplateUploadedAt());
        if (templateHtml == null || templateHtml.isEmpty()) {
            throw new ReportRoutingException("Template not uploaded to Spaces for subtype "
                    + type.getCode() + "/" + subtype.getCode()
                    + " (expected template_spaces_url to be set; run the one-time bootstrap)");
        }

        Map<String, Object> placeholders = deserialize(calcRow.getCalculatedJson());
        String filledHtml = templateRenderer.fill(templateHtml, placeholders);

        // 6. Upload to Spaces
        String fileName = renderedFileName(userStudentId, subtype);
        String folder   = subtype.getSpacesRenderFolder() + "/assessment-" + assessmentId;
        String reportUrl = spacesService.uploadBytes(
                filledHtml.getBytes(StandardCharsets.UTF_8), "text/html", folder, fileName);

        // 7. Upsert generated_report
        GeneratedReport gr = upsertGeneratedReport(
                userStudentId, assessmentId, type, subtype, reportUrl);

        return new ReportResult(reportUrl, type.getCode(), subtype.getCode(),
                calcRow.getCalculatedAt(), gr.getUpdatedAt(), reusedCalc);
    }

    // ───────────────────────────────────────────────────────── helpers ──

    private static class TypeAndSubtype {
        final ReportType type;
        final ReportSubtype subtype;
        TypeAndSubtype(ReportType t, ReportSubtype s) { this.type = t; this.subtype = s; }
    }

    /**
     * Reads (report_type, report_subtype) from the questionnaire FKs. Falls
     * back to the legacy {@code questionnaire.type} boolean + student grade
     * during the backfill deprecation window (plan Risk #1).
     */
    private TypeAndSubtype resolveTypeAndSubtype(AssessmentTable assessment, Long userStudentId) {
        Questionnaire q = assessment.getQuestionnaire();
        if (q == null) {
            throw new ReportRoutingException(
                    "Assessment " + assessment.getId() + " has no questionnaire");
        }

        if (q.getReportType() != null && q.getReportSubtype() != null) {
            return new TypeAndSubtype(q.getReportType(), q.getReportSubtype());
        }

        // Deprecation-window fallback: infer from questionnaire.type + grade.
        logger.warn("Questionnaire {} not backfilled with report_type/subtype — using grade-based fallback",
                q.getQuestionnaireId());

        boolean isBet = Boolean.TRUE.equals(q.getType());
        String typeCode    = isBet ? "bet" : "pager";
        String subtypeCode = isBet ? "default" : inferSubtypeByGrade(userStudentId);

        ReportType t    = reportTypeRepository.findByCode(typeCode)
                .orElseThrow(() -> new ReportRoutingException("Missing report_type row: " + typeCode));
        ReportSubtype s = reportSubtypeRepository.findByReportTypeCodeAndCode(typeCode, subtypeCode)
                .orElseThrow(() -> new ReportRoutingException(
                        "Missing report_subtype row: " + typeCode + "/" + subtypeCode));
        return new TypeAndSubtype(t, s);
    }

    private String inferSubtypeByGrade(Long userStudentId) {
        Integer grade = userStudentRepository.findById(userStudentId)
                .map(UserStudent::getStudentInfo)
                .map(StudentInfo::getStudentClass)
                .orElse(null);
        if (grade == null) return "career";
        if (grade >= 6  && grade <= 8)  return "insight";
        if (grade >= 9  && grade <= 10) return "subject";
        if (grade >= 11 && grade <= 12) return "career";
        return "career";
    }

    private IntermediaryScoresPayload ensureIntermediaryScores(
            Long userStudentId, Long assessmentId, boolean force) {

        Optional<IntermediaryScoresRow> existing = intermediaryScoresRepository
                .findByUserStudentIdAndAssessmentId(userStudentId, assessmentId);

        if (!force && existing.isPresent()
                && EngineVersions.INTERMEDIARY_V1.equals(existing.get().getEngineVersion())) {
            try {
                return objectMapper.readValue(existing.get().getScoresJson(),
                        IntermediaryScoresPayload.class);
            } catch (Exception e) {
                logger.warn("Failed to deserialize cached intermediary scores; recomputing", e);
            }
        }

        // Compute via PagerScoreSource (carries the 5×200ms async-persistence retry).
        NavigatorReportGenerationService.IntermediaryScores fresh =
                pagerScoreSource.getIntermediaryScores(userStudentId, assessmentId);
        if (fresh == null) {
            throw new ScoresNotReadyException(
                    "Intermediary scores not available for student=" + userStudentId
                            + " assessment=" + assessmentId + " (async persistence in flight?)");
        }

        IntermediaryScoresPayload payload = IntermediaryScoresPayload.fromDto(fresh);
        upsertIntermediaryScoresRow(existing.orElse(null), userStudentId, assessmentId, payload);
        return payload;
    }

    private void upsertIntermediaryScoresRow(IntermediaryScoresRow existing,
                                             Long userStudentId, Long assessmentId,
                                             IntermediaryScoresPayload payload) {
        IntermediaryScoresRow row = existing != null ? existing : new IntermediaryScoresRow();
        row.setUserStudentId(userStudentId);
        row.setAssessmentId(assessmentId);
        try {
            row.setScoresJson(objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize intermediary scores", e);
        }
        row.setEngineVersion(EngineVersions.INTERMEDIARY_V1);
        row.setCalculatedAt(new Date());
        intermediaryScoresRepository.save(row);
    }

    private CalculatedReportData upsertCalculatedReportData(
            CalculatedReportData existing, Long userStudentId, Long assessmentId,
            ReportType type, ReportSubtype subtype,
            Map<String, Object> placeholders, String engineVersion) {

        CalculatedReportData row = existing != null ? existing : new CalculatedReportData();
        row.setUserStudentId(userStudentId);
        row.setAssessmentId(assessmentId);
        row.setReportType(type);
        row.setReportSubtype(subtype);
        try {
            row.setCalculatedJson(objectMapper.writeValueAsString(placeholders));
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize calculated placeholders", e);
        }
        row.setEngineVersion(engineVersion);
        row.setCalculatedAt(new Date());
        return calculatedReportDataRepository.save(row);
    }

    private GeneratedReport upsertGeneratedReport(Long userStudentId, Long assessmentId,
                                                  ReportType type, ReportSubtype subtype,
                                                  String reportUrl) {
        Optional<GeneratedReport> opt = generatedReportRepository
                .findByUserStudentUserStudentIdAndAssessmentIdAndTypeOfReport(
                        userStudentId, assessmentId, type.getCode());
        GeneratedReport gr = opt.orElseGet(() -> {
            GeneratedReport newGr = new GeneratedReport();
            newGr.setUserStudent(userStudentRepository.findById(userStudentId).orElse(null));
            newGr.setAssessmentId(assessmentId);
            newGr.setTypeOfReport(type.getCode());
            newGr.setCreatedAt(new Date());
            return newGr;
        });
        gr.setReportSubtype(subtype);
        gr.setReportStatus("generated");
        gr.setReportUrl(reportUrl);
        gr.setUpdatedAt(new Date());
        return generatedReportRepository.save(gr);
    }

    private static String renderedFileName(Long userStudentId, ReportSubtype subtype) {
        return "student_" + userStudentId + "_" + subtype.getCode() + ".html";
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> deserialize(String json) {
        if (json == null || json.isEmpty()) return new HashMap<>();
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            logger.error("Failed to deserialize calculated_json", e);
            return new HashMap<>();
        }
    }
}
