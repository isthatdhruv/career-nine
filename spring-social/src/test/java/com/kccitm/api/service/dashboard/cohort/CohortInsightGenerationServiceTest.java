package com.kccitm.api.service.dashboard.cohort;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.SchoolReport;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.SchoolReportRepository;

class CohortInsightGenerationServiceTest {

    private SchoolReportRepository schoolReportRepository;
    private GeneratedReportRepository generatedReportRepository;
    private StudentAssessmentMappingRepository mappingRepository;
    private CohortInsightGenerationService service;

    @BeforeEach
    void setUp() {
        schoolReportRepository = mock(SchoolReportRepository.class);
        generatedReportRepository = mock(GeneratedReportRepository.class);
        mappingRepository = mock(StudentAssessmentMappingRepository.class);
        service = new CohortInsightGenerationService(
                schoolReportRepository,
                generatedReportRepository,
                mappingRepository,
                new PlaceholderCohortInsightAggregator(),
                new ObjectMapper());
    }

    private GeneratedReport reportWithRiasec(double realisticPct) {
        GeneratedReport gr = new GeneratedReport();
        gr.setNavigatorDashboardJson(
                "{\"riasec\":[{\"name\":\"Realistic\",\"normPct\":" + realisticPct + "}]}");
        return gr;
    }

    @Test
    void generateInternalWritesPayloadCoverageAndGeneratedStatus() throws Exception {
        SchoolReport existing = new SchoolReport();
        existing.setInstituteCode(1L);
        existing.setAssessmentId(5L);
        when(schoolReportRepository.findByInstituteCodeAndAssessmentId(1L, 5L))
                .thenReturn(Optional.of(existing));
        when(generatedReportRepository.findPagerReportsByInstituteAndAssessment(1L, 5L))
                .thenReturn(Arrays.asList(reportWithRiasec(40.0), reportWithRiasec(60.0)));
        when(mappingRepository.countCompletedByInstituteAndAssessment(1L, 5L)).thenReturn(3L);
        when(schoolReportRepository.save(any(SchoolReport.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        service.generateInternal(1L, 5L);

        ArgumentCaptor<SchoolReport> captor = ArgumentCaptor.forClass(SchoolReport.class);
        // last save is the GENERATED write
        org.mockito.Mockito.verify(schoolReportRepository, org.mockito.Mockito.atLeastOnce())
                .save(captor.capture());
        SchoolReport saved = captor.getValue();
        assertThat(saved.getGenerationStatus()).isEqualTo(CohortInsightGenerationService.STATUS_GENERATED);
        assertThat(saved.getCompletedCount()).isEqualTo(3);
        assertThat(saved.getStudentsWithScores()).isEqualTo(2);
        assertThat(saved.getLogicVersion()).isEqualTo(PlaceholderCohortInsightAggregator.LOGIC_VERSION);

        CohortInsightPayload payload = new ObjectMapper()
                .readValue(saved.getReportData(), CohortInsightPayload.class);
        assertThat(payload.studentCount).isEqualTo(2);
    }

    @Test
    void generateInternalSetsFailedStatusWhenSourceLoadThrows() {
        SchoolReport existing = new SchoolReport();
        existing.setInstituteCode(1L);
        existing.setAssessmentId(5L);
        when(schoolReportRepository.findByInstituteCodeAndAssessmentId(1L, 5L))
                .thenReturn(Optional.of(existing));
        when(generatedReportRepository.findPagerReportsByInstituteAndAssessment(1L, 5L))
                .thenThrow(new RuntimeException("db down"));
        when(schoolReportRepository.save(any(SchoolReport.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        service.generateInternal(1L, 5L);

        ArgumentCaptor<SchoolReport> captor = ArgumentCaptor.forClass(SchoolReport.class);
        org.mockito.Mockito.verify(schoolReportRepository, org.mockito.Mockito.atLeastOnce())
                .save(captor.capture());
        assertThat(captor.getValue().getGenerationStatus())
                .isEqualTo(CohortInsightGenerationService.STATUS_FAILED);
    }

    @Test
    void markPendingReturnsFalseWhenAlreadyGenerating() {
        SchoolReport existing = new SchoolReport();
        existing.setGenerationStatus(CohortInsightGenerationService.STATUS_GENERATING);
        when(schoolReportRepository.findByInstituteCodeAndAssessmentId(1L, 5L))
                .thenReturn(Optional.of(existing));

        boolean enqueued = service.markPending(1L, 5L, 99L);

        assertThat(enqueued).isFalse();
    }

    @Test
    void getViewComputesNewSinceGenerationAndLogicStaleness() throws Exception {
        SchoolReport sr = new SchoolReport();
        sr.setInstituteCode(1L);
        sr.setAssessmentId(5L);
        sr.setGenerationStatus(CohortInsightGenerationService.STATUS_GENERATED);
        sr.setLogicVersion("old-logic");
        sr.setStudentsWithScores(2);
        sr.setCompletedCount(2);
        CohortInsightPayload p = new CohortInsightPayload();
        p.studentCount = 2;
        sr.setReportData(new ObjectMapper().writeValueAsString(p));
        when(schoolReportRepository.findByInstituteCodeAndAssessmentId(1L, 5L))
                .thenReturn(Optional.of(sr));
        when(mappingRepository.countCompletedByInstituteAndAssessment(1L, 5L)).thenReturn(5L);

        CohortInsightView view = service.getView(1L, 5L);

        assertThat(view.status).isEqualTo(CohortInsightGenerationService.STATUS_GENERATED);
        assertThat(view.newSinceGeneration).isEqualTo(3); // 5 current - 2 included
        assertThat(view.logicStale).isTrue();             // "old-logic" != placeholder-v0
        assertThat(view.payload).isNotNull();
        assertThat(view.payload.studentCount).isEqualTo(2);
    }

    @Test
    void getViewReturnsNotGeneratedWhenNoRow() {
        when(schoolReportRepository.findByInstituteCodeAndAssessmentId(1L, 5L))
                .thenReturn(Optional.empty());
        CohortInsightView view = service.getView(1L, 5L);
        assertThat(view.status).isNull();
        assertThat(view.payload).isNull();
    }
}
