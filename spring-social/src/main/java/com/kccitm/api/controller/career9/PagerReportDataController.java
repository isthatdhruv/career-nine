package com.kccitm.api.controller.career9;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;

import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;
import com.kccitm.api.service.Navigator.NavigatorReportGenerationService;
import com.kccitm.api.service.Navigator.NavigatorReportGenerationService.IntermediaryScores;
import com.kccitm.api.service.b2c.pager.FourPagerEngineService;
import com.kccitm.api.service.b2c.pager.FourPagerEngineService.PagerVariant;
import com.kccitm.api.service.b2c.pager.Navigator360EngineService;
import com.kccitm.api.service.b2c.pager.Navigator360Models.Navigator360Result;
import com.kccitm.api.service.b2c.pager.Navigator360Models.StudentMeta;
import com.kccitm.api.service.b2c.pager.PagerScoreSource;

/**
 * Backend pipeline for the new "pager" report — the Navigator 4-pager
 * (insight / subject / career variants, picked by grade group) introduced for
 * B2C campaigns. Mirrors {@link BetReportDataController} and
 * {@link NavigatorReportDataController} so that
 * {@link com.kccitm.api.service.b2c.ReportPreparationService} can dispatch
 * uniformly across the three report families.
 *
 * <p>Pipeline (matches BET / Navigator):
 * <ol>
 *   <li>{@link PagerScoreSource#getIntermediaryScores(Long, Long)} —
 *       MySQL primary, retry-on-race-window for the submit→persist gap.</li>
 *   <li>{@link Navigator360EngineService#computeNavigator360} — derives Holland
 *       code, RIASEC/MI/Ability levels, career matches, CCI, alignment, flags.</li>
 *   <li>{@link FourPagerEngineService#resolveVariant} — insight (6-8) /
 *       subject (9-10) / career (11-12).</li>
 *   <li>Load matching template from {@code resources/four-pager-template/}.</li>
 *   <li>{@link FourPagerEngineService#buildPlaceholders} + {@code fillTemplate}.</li>
 *   <li>Upload filled HTML to DO Spaces (public read).</li>
 *   <li>Upsert {@code generated_report} row with {@code type_of_report = "pager"}.</li>
 *   <li>Return the public CDN URL.</li>
 * </ol>
 */
@Controller
public class PagerReportDataController {

    private static final Logger logger = LoggerFactory.getLogger(PagerReportDataController.class);

    @Autowired private NavigatorReportGenerationService navigatorReportGenerationService;
    @Autowired private PagerScoreSource pagerScoreSource;
    @Autowired private Navigator360EngineService engine;
    @Autowired private FourPagerEngineService placeholderBuilder;
    @Autowired private DigitalOceanSpacesService spacesService;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private GeneratedReportRepository generatedReportRepository;

    /**
     * Generates the Navigator 4-pager (BET/Navigator-parity {@code prepareAndUploadForEntitlement}):
     * fetches scores, derives Navigator 360 result, fills the variant template,
     * uploads to DO Spaces, syncs {@code generated_report} with
     * {@code type_of_report = "pager"}, returns the public CDN URL.
     *
     * <p>Throws on failure so {@link com.kccitm.api.service.b2c.ReportPreparationService}
     * can map exceptions to log rows + 500s, identical to the BET path.
     */
    public String prepareAndUploadForEntitlement(Long userStudentId, Long assessmentId) {
        // 1. Short-circuit: if already generated, return the cached URL. The unique
        //    constraint on (user_student_id, assessment_id, type_of_report) gives
        //    us this idempotency by lookup.
        Optional<GeneratedReport> existing = generatedReportRepository
                .findByUserStudentUserStudentIdAndAssessmentIdAndTypeOfReport(
                        userStudentId, assessmentId, "pager");
        if (existing.isPresent()
                && "generated".equals(existing.get().getReportStatus())
                && existing.get().getReportUrl() != null) {
            return existing.get().getReportUrl();
        }

        // 2. Compute intermediary scores (MySQL primary, narrow retry window for
        //    the submit→persist race). Throws ScoreNotReady if the async
        //    processor still hasn't landed after the retry budget — caller
        //    surfaces this as a transient 500 so the SPA can refresh / retry.
        IntermediaryScores intermediary = pagerScoreSource.getIntermediaryScores(userStudentId, assessmentId);
        if (intermediary == null) {
            throw new IllegalStateException(
                "No scores available for student " + userStudentId + " / assessment " + assessmentId
                + ". Async persistence may still be in flight; please retry shortly.");
        }

        // 3. Derive the full Navigator 360 result (Holland, ranks, careers, CCI…).
        Navigator360Result result = engine.computeNavigator360(intermediary, null, null, 1.0);

        // 4. Pick variant from grade group and load the matching template.
        PagerVariant variant = placeholderBuilder.resolveVariant(result.gradeGroup);
        String template = loadTemplate(variant);
        if (template == null) {
            throw new IllegalStateException(
                "Could not load pager template " + placeholderBuilder.templateResourcePath(variant));
        }

        // 5. Build placeholder map + fill the HTML.
        StudentMeta meta = buildStudentMeta(userStudentId, result);
        Map<String, String> placeholders = placeholderBuilder.buildPlaceholders(result, meta);
        String filledHtml = placeholderBuilder.fillTemplate(template, placeholders);

        // 6. Upload to DO Spaces. Per-student, per-assessment, per-variant key
        //    so a re-take overwrites cleanly without colliding with another
        //    student's report.
        String safeName = (meta.studentName != null ? meta.studentName : "student")
                .replaceAll("[^a-zA-Z0-9]", "_").toLowerCase();
        String fileName = safeName + "_" + userStudentId + "_" + variant.key + "_pager.html";
        String folder = "pager-reports/assessment-" + assessmentId + "/" + variant.key;
        String reportUrl = spacesService.uploadBytes(
                filledHtml.getBytes(StandardCharsets.UTF_8), "text/html", folder, fileName);

        // 7. Upsert the unified status row with type_of_report = "pager".
        syncGeneratedReport(userStudentId, assessmentId, "generated", reportUrl);

        logger.info("Pager report generated for student={} assessment={} variant={} url={}",
                userStudentId, assessmentId, variant.key, reportUrl);
        return reportUrl;
    }

    private String loadTemplate(PagerVariant variant) {
        String path = placeholderBuilder.templateResourcePath(variant);
        try (InputStream is = getClass().getClassLoader().getResourceAsStream(path)) {
            if (is == null) return null;
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            logger.error("Failed to load pager template {}: {}", path, e.getMessage());
            return null;
        }
    }

    private StudentMeta buildStudentMeta(Long userStudentId, Navigator360Result result) {
        StudentMeta meta = new StudentMeta();
        meta.studentName = result.studentName;
        meta.studentClass = result.studentClass;

        // Pull school name/city from StudentInfo + Institute (best-effort).
        userStudentRepository.findById(userStudentId).ifPresent(us -> {
            StudentInfo si = us.getStudentInfo();
            if (si != null) {
                if (si.getStudentClass() != null) {
                    meta.studentClass = String.valueOf(si.getStudentClass());
                }
                if (us.getInstitute() != null) {
                    meta.schoolName = us.getInstitute().getInstituteName();
                    meta.schoolCity = us.getInstitute().getCity();
                }
            }
        });
        // Age / reportUrl deliberately blank — templates render empty cleanly.
        return meta;
    }

    /**
     * Upsert helper. Mirrors {@code syncGeneratedReport} in BET / Navigator
     * controllers but keys on {@code type_of_report = "pager"}.
     */
    private void syncGeneratedReport(Long userStudentId, Long assessmentId, String status, String reportUrl) {
        try {
            GeneratedReport gr = generatedReportRepository
                    .findByUserStudentUserStudentIdAndAssessmentIdAndTypeOfReport(
                            userStudentId, assessmentId, "pager")
                    .orElseGet(() -> {
                        GeneratedReport newGr = new GeneratedReport();
                        newGr.setUserStudent(userStudentRepository.findById(userStudentId).orElse(null));
                        newGr.setAssessmentId(assessmentId);
                        newGr.setTypeOfReport("pager");
                        newGr.setCreatedAt(new Date());
                        return newGr;
                    });
            gr.setReportStatus(status);
            gr.setReportUrl(reportUrl);
            gr.setUpdatedAt(new Date());
            generatedReportRepository.save(gr);
        } catch (Exception e) {
            logger.warn("Failed to sync generated_report row for pager (non-fatal): {}", e.getMessage());
        }
    }

    /** Reference held for future Redis-fallback wiring; not currently invoked directly. */
    @SuppressWarnings("unused")
    private NavigatorReportGenerationService getRawScorer() { return navigatorReportGenerationService; }
}
