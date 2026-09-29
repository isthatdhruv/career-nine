package com.kccitm.api.service.b2c.report;

import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.ReportTemplate;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.report.AssessmentReportTemplate;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.report.AssessmentReportTemplateRepository;
import com.kccitm.api.repository.Career9.report.CalculatedReportDataRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReportServiceSuppressionTest {

    @Mock SanityCheckService sanityCheckService;
    @Mock AssessmentTableRepository assessmentTableRepository;
    @Mock AssessmentReportTemplateRepository assessmentReportTemplateRepository;
    @Mock CalculatedReportDataRepository calculatedReportDataRepository;
    @Mock GeneratedReportRepository generatedReportRepository;
    @Mock UserStudentRepository userStudentRepository;
    @Mock PlaceholderCalculator strategy;
    @InjectMocks ReportService service;

    @BeforeEach
    void wire() {
        when(strategy.typeCode()).thenReturn("navigator_pro");
        when(strategy.usesIntermediary()).thenReturn(false);
        when(strategy.engineVersion()).thenReturn("navigator_pro-v1");
        ReflectionTestUtils.setField(service, "allStrategies", List.of(strategy));
        service.init();

        when(sanityCheckService.existsAndComplete(5L, 9L)).thenReturn(SanityCheckService.SanityResult.pass());
        when(assessmentTableRepository.existsById(9L)).thenReturn(true);
        ReportTemplate template = mock(ReportTemplate.class);
        when(template.getEngineCode()).thenReturn("navigator_pro");
        when(template.getReportTemplateId()).thenReturn(7L);
        AssessmentReportTemplate link = mock(AssessmentReportTemplate.class);
        when(link.getReportTemplate()).thenReturn(template);
        when(assessmentReportTemplateRepository.findByAssessmentIdAndIsDefaultTrue(9L)).thenReturn(Optional.of(link));
        when(calculatedReportDataRepository.findByUserStudentIdAndAssessmentIdAndReportTemplate_Id(5L, 9L, 7L))
                .thenReturn(Optional.empty());
        when(generatedReportRepository.findByUserStudentUserStudentIdAndAssessmentIdAndReportTemplate_Id(5L, 9L, 7L))
                .thenReturn(Optional.empty());
        UserStudent us = new UserStudent();
        us.setUserStudentId(5L);
        when(userStudentRepository.findById(5L)).thenReturn(Optional.of(us));
        when(generatedReportRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void suppression_recordsRowAndRethrows() {
        when(strategy.calculate(5L, 9L, null))
                .thenThrow(new ReportSuppressedException("R1", "attention check not passed"));

        assertThatThrownBy(() -> service.generate(5L, 9L, null, false))
                .isInstanceOf(ReportSuppressedException.class)
                .satisfies(e -> assertThat(((ReportSuppressedException) e).getRuleCode()).isEqualTo("R1"));

        ArgumentCaptor<GeneratedReport> saved = ArgumentCaptor.forClass(GeneratedReport.class);
        verify(generatedReportRepository).save(saved.capture());
        GeneratedReport gr = saved.getValue();
        assertThat(gr.getReportStatus()).isEqualTo("suppressed");
        assertThat(gr.getSuppressionReason()).isEqualTo("R1: attention check not passed");
        assertThat(gr.getTypeOfReport()).isEqualTo("navigator_pro");
        assertThat(gr.getAssessmentId()).isEqualTo(9L);
        verify(calculatedReportDataRepository, org.mockito.Mockito.never()).save(any());
    }
}
