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
import com.kccitm.api.model.career9.ReportTemplate;
import com.kccitm.api.model.career9.report.CalculatedReportData;
import com.kccitm.api.model.career9.report.IntermediaryScoresRow;
import com.kccitm.api.model.career9.report.QuestionnaireReportTemplate;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.ReportTemplateRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.report.CalculatedReportDataRepository;
import com.kccitm.api.repository.Career9.report.IntermediaryScoresRepository;
import com.kccitm.api.repository.Career9.report.QuestionnaireReportTemplateRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;
import com.kccitm.api.service.Navigator.NavigatorReportGenerationService;
import com.kccitm.api.service.b2c.pager.PagerScoreSource;
import com.kccitm.api.service.b2c.report.SanityCheckService.SanityResult;

/**
 * Unified report-generation orchestrator. One entry point for every report
 * type; routing is driven entirely by the chosen {@link ReportTemplate}'s
 * {@code engineCode} (bet / pager / legacy).
 *
 * <p>Flow ({@code force=false}):
 * <ol>
 *   <li>Sanity pre-flight (mapping completed).</li>
 *   <li>Resolve the {@link ReportTemplate}: an explicit {@code reportTemplateId}
 *       (validated to belong to the assessment's questionnaire), else the
 *       questionnaire's default template.</li>
 *   <li>If the strategy uses intermediary scores: load the cached
 *       {@code intermediary_scores} row OR compute via {@link PagerScoreSource}.</li>
 *   <li>Load the cached {@code calculated_report_data} row (keyed by template)
 *       OR call the strategy and upsert.</li>
 *   <li>Always re-fetch the template HTML from Spaces (cached), expose the full
 *       placeholder map as {@code chartDataJson} for client-side charts, fill,
 *       and re-upload — template edits propagate without recomputing.</li>
 *   <li>Upsert {@code generated_report} with the new URL.</li>
 * </ol>
 */
@Service
public class ReportService {

    private static final Logger logger = LoggerFactory.getLogger(ReportService.class);

    @Autowired private SanityCheckService sanityCheckService;
    @Autowired private PagerScoreSource pagerScoreSource;

    @Autowired private ReportTemplateRepository reportTemplateRepository;
    @Autowired private QuestionnaireReportTemplateRepository questionnaireReportTemplateRepository;
    @Autowired private IntermediaryScoresRepository intermediaryScoresRepository;
    @Autowired private CalculatedReportDataRepository calculatedReportDataRepository;
    @Autowired private GeneratedReportRepository generatedReportRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private UserStudentRepository userStudentRepository;

    @Autowired private TemplateCache templateCache;
    @Autowired private TemplateRenderer templateRenderer;
    @Autowired private DigitalOceanSpacesService spacesService;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private com.kccitm.api.service.b2c.report.pdf.PdfRenderService pdfRenderService;

    @Autowired private List<PlaceholderCalculator> allStrategies;

    private Map<String, PlaceholderCalculator> strategyByEngine;

    @PostConstruct
    public void init() {
        strategyByEngine = new HashMap<>();
        for (PlaceholderCalculator c : allStrategies) {
            strategyByEngine.put(c.typeCode(), c);
        }
        logger.info("ReportService initialized with engines: {}", strategyByEngine.keySet());
    }

    /**
     * @param reportTemplateId explicit template id, or {@code null} to use the
     *                         questionnaire's default template.
     */
    public ReportResult generate(Long userStudentId, Long assessmentId,
                                 Long reportTemplateId, boolean force) {
        // 1. Sanity pre-flight
        SanityResult sanity = sanityCheckService.existsAndComplete(userStudentId, assessmentId);
        if (!sanity.ok) {
            throw new SanityFailedException(sanity.code, sanity.reason);
        }

        // 2. Resolve the template (explicit id or questionnaire default)
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                .orElseThrow(() -> new ReportRoutingException("Assessment not found: " + assessmentId));
        Questionnaire q = assessment.getQuestionnaire();
        if (q == null) {
            throw new ReportRoutingException("Assessment " + assessmentId + " has no questionnaire");
        }
        ReportTemplate template = resolveTemplate(q.getQuestionnaireId(), reportTemplateId);

        if (template.getEngineCode() == null || template.getEngineCode().trim().isEmpty()) {
            throw new ReportRoutingException("Template " + template.getReportTemplateId()
                    + " has no engineCode set — cannot route to a scoring engine");
        }
        PlaceholderCalculator strategy = strategyByEngine.get(template.getEngineCode());
        if (strategy == null) {
            throw new ReportRoutingException(
                    "No engine registered for engineCode=" + template.getEngineCode()
                            + " (template " + templateLabel(template) + ")");
        }

        // 3. Intermediary scores (pager/legacy only)
        IntermediaryScoresPayload intermediary = null;
        if (strategy.usesIntermediary()) {
            intermediary = ensureIntermediaryScores(userStudentId, assessmentId, force);
        }

        // 4. Calculated report data (per template)
        boolean reusedCalc = false;
        CalculatedReportData calcRow;
        Optional<CalculatedReportData> existing = calculatedReportDataRepository
                .findByUserStudentIdAndAssessmentIdAndReportTemplate_Id(
                        userStudentId, assessmentId, template.getReportTemplateId());

        if (!force && existing.isPresent()
                && strategy.engineVersion().equals(existing.get().getEngineVersion())) {
            calcRow = existing.get();
            reusedCalc = true;
        } else {
            Map<String, Object> placeholders = strategy.calculate(userStudentId, assessmentId, intermediary);
            calcRow = upsertCalculatedReportData(
                    existing.orElse(null), userStudentId, assessmentId,
                    template, placeholders, strategy.engineVersion());
        }

        // 5. Render — always re-load template and re-fill (template edits propagate).
        String templateHtml = templateCache.get(
                template.getTemplateSpacesUrl(), template.getTemplateUploadedAt());
        if (templateHtml == null || templateHtml.isEmpty()) {
            throw new ReportRoutingException("Template HTML not uploaded to Spaces for template "
                    + templateLabel(template) + " (upload the HTML first)");
        }

        Map<String, Object> placeholders = deserialize(calcRow.getCalculatedJson());
        // Expose the whole placeholder set as a JSON blob so templates can draw
        // dynamic, per-student charts client-side. Embed in the template inside
        // <script type="application/json">{{chartDataJson}}</script>. Computed at
        // render time (not stored) so it never duplicates into the cached JSON.
        placeholders.put("chartDataJson", serialize(placeholders));
        String filledHtml = templateRenderer.fill(templateHtml, placeholders);

        // 6. Upload to Spaces
        String fileName = renderedFileName(userStudentId, template);
        String renderFolder = (template.getSpacesRenderFolder() != null
                && !template.getSpacesRenderFolder().trim().isEmpty())
                ? template.getSpacesRenderFolder()
                : "report-renders/" + templateLabel(template);
        String folder   = renderFolder + "/assessment-" + assessmentId;
        String reportUrl = spacesService.uploadBytes(
                filledHtml.getBytes(StandardCharsets.UTF_8), "text/html", folder, fileName);

        // 6b. Render the PDF synchronously so it exists the moment generation
        // returns — uploaded to Spaces beside the HTML. A render failure does NOT
        // fail generation (the HTML is already saved); the row is marked
        // pdf_status=failed and can be re-rendered via the retry endpoint.
        String pdfUrl = null;
        String pdfStatus = "failed";
        try {
            pdfUrl = pdfRenderService.renderAndUpload(reportUrl);
            pdfStatus = "ready";
        } catch (Exception e) {
            logger.error("PDF render failed for student {} assessment {} (HTML saved, pdf_status=failed): {}",
                    userStudentId, assessmentId, e.getMessage());
        }

        // 7. Upsert generated_report with the rendered PDF state.
        GeneratedReport gr = upsertGeneratedReport(userStudentId, assessmentId, template,
                reportUrl, pdfUrl, pdfStatus);

        return new ReportResult(reportUrl, template.getEngineCode(), templateLabel(template),
                calcRow.getCalculatedAt(), gr.getUpdatedAt(), reusedCalc,
                gr.getPdfUrl(), gr.getPdfStatus());
    }

    // ───────────────────────────────────────────────────────── helpers ──

    /**
     * Resolves the template to render. Explicit id wins (validated to belong to
     * the questionnaire). Otherwise the questionnaire's default; if no default
     * flag is set but exactly one template is mapped, it is adopted and flagged
     * default. Empty mapping → routing error.
     */
    private ReportTemplate resolveTemplate(Long questionnaireId, Long reportTemplateId) {
        if (reportTemplateId != null) {
            QuestionnaireReportTemplate link = questionnaireReportTemplateRepository
                    .findByQuestionnaireIdAndReportTemplate_Id(questionnaireId, reportTemplateId)
                    .orElseThrow(() -> new ReportRoutingException(
                            "Template " + reportTemplateId + " is not mapped to questionnaire " + questionnaireId));
            return link.getReportTemplate();
        }

        Optional<QuestionnaireReportTemplate> def = questionnaireReportTemplateRepository
                .findByQuestionnaireIdAndIsDefaultTrue(questionnaireId);
        if (def.isPresent()) {
            return def.get().getReportTemplate();
        }

        List<QuestionnaireReportTemplate> all = questionnaireReportTemplateRepository
                .findByQuestionnaireId(questionnaireId);
        if (all.isEmpty()) {
            throw new ReportRoutingException("No template mapped to questionnaire " + questionnaireId);
        }
        if (all.size() == 1) {
            QuestionnaireReportTemplate only = all.get(0);
            only.setIsDefault(true);
            questionnaireReportTemplateRepository.save(only);
            return only.getReportTemplate();
        }
        throw new ReportRoutingException("Questionnaire " + questionnaireId
                + " has multiple templates but no default — pass a reportTemplateId or set a default");
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
            ReportTemplate template, Map<String, Object> placeholders, String engineVersion) {

        CalculatedReportData row = existing != null ? existing : new CalculatedReportData();
        row.setUserStudentId(userStudentId);
        row.setAssessmentId(assessmentId);
        row.setReportTemplate(template);
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
                                                  ReportTemplate template, String reportUrl,
                                                  String pdfUrl, String pdfStatus) {
        Optional<GeneratedReport> opt = generatedReportRepository
                .findByUserStudentUserStudentIdAndAssessmentIdAndReportTemplate_Id(
                        userStudentId, assessmentId, template.getReportTemplateId());
        GeneratedReport gr = opt.orElseGet(() -> {
            GeneratedReport newGr = new GeneratedReport();
            newGr.setUserStudent(userStudentRepository.findById(userStudentId).orElse(null));
            newGr.setAssessmentId(assessmentId);
            newGr.setCreatedAt(new Date());
            return newGr;
        });
        // type_of_report keeps the engine code so the legacy String-keyed
        // GeneratedReport queries/endpoints keep working.
        gr.setTypeOfReport(template.getEngineCode());
        gr.setReportTemplate(template);
        gr.setReportStatus("generated");
        gr.setReportUrl(reportUrl);
        gr.setPdfUrl(pdfUrl);         // synchronously rendered above (null if render failed)
        gr.setPdfStatus(pdfStatus);   // "ready" on success, "failed" otherwise
        gr.setUpdatedAt(new Date());
        return generatedReportRepository.save(gr);
    }

    private static String renderedFileName(Long userStudentId, ReportTemplate template) {
        return "student_" + userStudentId + "_" + templateLabel(template) + ".html";
    }

    /** Stable label for paths/filenames: the code if set, else the id. */
    private static String templateLabel(ReportTemplate template) {
        if (template.getCode() != null && !template.getCode().trim().isEmpty()) {
            return template.getCode();
        }
        return "tpl" + template.getReportTemplateId();
    }

    private String serialize(Map<String, Object> data) {
        try {
            return objectMapper.writeValueAsString(data);
        } catch (Exception e) {
            logger.warn("Failed to serialize chartDataJson", e);
            return "{}";
        }
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
