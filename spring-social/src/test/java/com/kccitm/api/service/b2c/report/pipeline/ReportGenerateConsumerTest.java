package com.kccitm.api.service.b2c.report.pipeline;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.service.b2c.report.ReportResult;
import com.kccitm.api.service.b2c.report.ReportService;
import com.kccitm.api.service.b2c.report.pdf.PdfRenderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Date;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportGenerateConsumerTest {

    @Mock ReportService reportService;
    @Mock PdfRenderService pdfRenderService;
    @Mock KafkaTemplate<String, String> kafkaTemplate;
    @Mock GeneratedReportRepository generatedReportRepository;
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @InjectMocks ReportGenerateConsumer consumer;

    private ReportResult okResult() {
        return new ReportResult("http://html", "pager", "tpl", new Date(), new Date(), false,
                "http://pdf", "ready");
    }

    @BeforeEach
    void init() {
        ReflectionTestUtils.setField(consumer, "pdfAttempts", 1);
    }

    private String json(boolean whitelabel, String email, String emailMode,
                        Long templateId, boolean force) throws Exception {
        ReportGenerateEvent ev = new ReportGenerateEvent(5L, 9L, email, whitelabel, "S", null);
        ev.emailMode = emailMode;
        ev.reportTemplateId = templateId;
        ev.force = force;
        ev.batchId = "b1";
        return new ObjectMapper().writeValueAsString(ev);
    }

    @Test
    void passesForceAndTemplateIdThroughToReportService() throws Exception {
        when(reportService.generate(5L, 9L, 7L, true)).thenReturn(okResult());
        consumer.onGenerate(json(false, null, "none", 7L, true));
        verify(reportService).generate(5L, 9L, 7L, true);
    }

    @Test
    void emailModeAll_emailsNonWhitelabelStudentWithAddress() throws Exception {
        when(reportService.generate(5L, 9L, null, false)).thenReturn(okResult());
        consumer.onGenerate(json(false, "a@b.c", "all", null, false));
        verify(kafkaTemplate).send(eq(ReportPipelineConfig.TOPIC_EMAIL), eq("5:9"), anyString());
    }

    @Test
    void emailModeNone_neverEmailsEvenWhitelabelWithAddress() throws Exception {
        when(reportService.generate(5L, 9L, null, false)).thenReturn(okResult());
        consumer.onGenerate(json(true, "a@b.c", "none", null, false));
        verify(kafkaTemplate, never()).send(any(), any(), any());
    }

    @Test
    void emailModeAuto_keepsWhitelabelGating() throws Exception {
        when(reportService.generate(5L, 9L, null, false)).thenReturn(okResult());
        consumer.onGenerate(json(false, "a@b.c", "auto", null, false));
        verify(kafkaTemplate, never()).send(any(), any(), any());

        consumer.onGenerate(json(true, "a@b.c", "auto", null, false));
        verify(kafkaTemplate).send(eq(ReportPipelineConfig.TOPIC_EMAIL), eq("5:9"), anyString());
    }

    @Test
    void emailModeAll_withoutAddress_generatesButDoesNotEmail() throws Exception {
        when(reportService.generate(5L, 9L, null, false)).thenReturn(okResult());
        consumer.onGenerate(json(false, null, "all", null, false));
        verify(kafkaTemplate, never()).send(any(), any(), any());
    }
}
