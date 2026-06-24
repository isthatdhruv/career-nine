package com.kccitm.api.service.dashboard.cohort;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.SchoolReport;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.SchoolReportRepository;
import com.kccitm.api.service.b2c.pager.Navigator360Models.Navigator360Result;

/**
 * Orchestrates on-demand cohort-insight generation for one (institute, assessment).
 * Source = already-precomputed per-student Navigator360Result JSONs; output = one
 * payload stored in school_report. Generation runs async; reads are pure lookups.
 */
@Service
public class CohortInsightGenerationService {

    private static final Logger log = LoggerFactory.getLogger(CohortInsightGenerationService.class);

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_GENERATING = "GENERATING";
    public static final String STATUS_GENERATED = "GENERATED";
    public static final String STATUS_FAILED = "FAILED";

    private final SchoolReportRepository schoolReportRepository;
    private final GeneratedReportRepository generatedReportRepository;
    private final StudentAssessmentMappingRepository mappingRepository;
    private final CohortInsightAggregator aggregator;
    private final ObjectMapper objectMapper;

    public CohortInsightGenerationService(
            SchoolReportRepository schoolReportRepository,
            GeneratedReportRepository generatedReportRepository,
            StudentAssessmentMappingRepository mappingRepository,
            CohortInsightAggregator aggregator,
            ObjectMapper objectMapper) {
        this.schoolReportRepository = schoolReportRepository;
        this.generatedReportRepository = generatedReportRepository;
        this.mappingRepository = mappingRepository;
        this.aggregator = aggregator;
        this.objectMapper = objectMapper;
    }

    /**
     * Mark a generation as enqueued (PENDING). Returns false (no-op) if a run is
     * already PENDING or GENERATING — the duplicate-click guard.
     */
    @Transactional
    public boolean markPending(Long instituteCode, Long assessmentId, Long generatedBy) {
        SchoolReport row = schoolReportRepository
                .findByInstituteCodeAndAssessmentId(instituteCode, assessmentId)
                .orElseGet(() -> {
                    SchoolReport sr = new SchoolReport();
                    sr.setInstituteCode(instituteCode);
                    sr.setAssessmentId(assessmentId);
                    return sr;
                });

        String status = row.getGenerationStatus();
        if (STATUS_PENDING.equals(status) || STATUS_GENERATING.equals(status)) {
            return false;
        }
        row.setGenerationStatus(STATUS_PENDING);
        row.setGeneratedBy(generatedBy);
        schoolReportRepository.save(row);
        return true;
    }

    /** Async entry point — returns immediately to the HTTP thread. */
    @Async("applicationTaskExecutor")
    public void runGenerationAsync(Long instituteCode, Long assessmentId) {
        try {
            generateInternal(instituteCode, assessmentId);
        } catch (Exception ex) {
            log.error("Cohort insight generation failed institute={} assessment={}",
                    instituteCode, assessmentId, ex);
        }
    }

    /** Synchronous generation core (unit-tested). */
    @Transactional
    public void generateInternal(Long instituteCode, Long assessmentId) {
        SchoolReport row = schoolReportRepository
                .findByInstituteCodeAndAssessmentId(instituteCode, assessmentId)
                .orElseGet(() -> {
                    SchoolReport sr = new SchoolReport();
                    sr.setInstituteCode(instituteCode);
                    sr.setAssessmentId(assessmentId);
                    return sr;
                });

        // Guard: if another pass already flipped to GENERATING, don't double-run.
        if (STATUS_GENERATING.equals(row.getGenerationStatus())) {
            log.info("Cohort generation already in progress institute={} assessment={}", instituteCode, assessmentId);
            return;
        }
        row.setGenerationStatus(STATUS_GENERATING);
        schoolReportRepository.save(row);

        try {
            List<GeneratedReport> reports =
                    generatedReportRepository.findPagerReportsByInstituteAndAssessment(instituteCode, assessmentId);

            List<Navigator360Result> perStudent = new ArrayList<>();
            for (GeneratedReport gr : reports) {
                String json = gr.getNavigatorDashboardJson();
                if (json == null || json.isEmpty()) {
                    continue;
                }
                try {
                    perStudent.add(objectMapper.readValue(json, Navigator360Result.class));
                } catch (Exception parseEx) {
                    log.warn("Skipping unparseable navigator JSON report={}", gr.getGeneratedReportId(), parseEx);
                }
            }

            long completed = mappingRepository.countCompletedByInstituteAndAssessment(instituteCode, assessmentId);
            CohortInsightPayload payload = aggregator.aggregate(instituteCode, assessmentId, perStudent);

            row.setReportData(objectMapper.writeValueAsString(payload));
            row.setLogicVersion(aggregator.logicVersion());
            row.setStudentsWithScores(perStudent.size());
            row.setCompletedCount((int) completed);
            row.setTotalStudents((int) completed);
            row.setGenerationStatus(STATUS_GENERATED);
            schoolReportRepository.save(row);
            log.info("Cohort insight generated institute={} assessment={} included={} completed={}",
                    instituteCode, assessmentId, perStudent.size(), completed);
        } catch (Exception ex) {
            row.setGenerationStatus(STATUS_FAILED);
            schoolReportRepository.save(row);
            log.error("Cohort insight generation error institute={} assessment={}", instituteCode, assessmentId, ex);
        }
    }

    /** Read path — pure lookup + freshness/staleness computation. No heavy work. */
    @Transactional(readOnly = true)
    public CohortInsightView getView(Long instituteCode, Long assessmentId) {
        CohortInsightView view = new CohortInsightView();
        view.instituteCode = instituteCode;
        view.assessmentId = assessmentId;
        view.currentLogicVersion = aggregator.logicVersion();

        Optional<SchoolReport> opt =
                schoolReportRepository.findByInstituteCodeAndAssessmentId(instituteCode, assessmentId);
        if (!opt.isPresent()) {
            return view; // status null => NOT_GENERATED
        }
        SchoolReport sr = opt.get();
        view.status = sr.getGenerationStatus();
        view.logicVersion = sr.getLogicVersion();
        view.includedCount = sr.getStudentsWithScores();
        view.completedCount = sr.getCompletedCount();
        view.computedAt = sr.getUpdatedAt();
        view.logicStale = sr.getLogicVersion() != null
                && !sr.getLogicVersion().equals(view.currentLogicVersion);

        long currentCompleted = mappingRepository.countCompletedByInstituteAndAssessment(instituteCode, assessmentId);
        int included = view.includedCount == null ? 0 : view.includedCount;
        view.newSinceGeneration = (int) Math.max(0, currentCompleted - included);

        if (STATUS_GENERATED.equals(sr.getGenerationStatus()) && sr.getReportData() != null) {
            try {
                view.payload = objectMapper.readValue(sr.getReportData(), CohortInsightPayload.class);
            } catch (Exception ex) {
                log.warn("Failed to parse stored cohort payload institute={} assessment={}",
                        instituteCode, assessmentId, ex);
            }
        }
        return view;
    }
}
