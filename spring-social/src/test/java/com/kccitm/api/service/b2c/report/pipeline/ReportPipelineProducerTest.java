package com.kccitm.api.service.b2c.report.pipeline;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.branding.InstituteBrandingService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportPipelineProducerTest {

    @Mock KafkaTemplate<String, String> kafkaTemplate;
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @Mock InstituteBrandingService brandingService;
    @Mock UserStudentRepository userStudentRepository;
    @InjectMocks ReportPipelineProducer producer;

    @Test
    void enqueueAdmin_publishesEventWithAdminFields() throws Exception {
        UserStudent us = new UserStudent();
        us.setUserStudentId(5L);
        when(userStudentRepository.findByIdWithStudentInfo(5L)).thenReturn(Optional.of(us));
        BrandingDto brand = mock(BrandingDto.class);
        when(brand.isWhitelabel()).thenReturn(false);
        when(brandingService.forInstitute(any())).thenReturn(brand);

        producer.enqueueAdmin(5L, 9L, 7L, true, "all", "batch-1");

        ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(eq(ReportPipelineConfig.TOPIC_GENERATE), eq("5:9"), payload.capture());
        ReportGenerateEvent ev = new ObjectMapper().readValue(payload.getValue(), ReportGenerateEvent.class);
        assertThat(ev.force).isTrue();
        assertThat(ev.reportTemplateId).isEqualTo(7L);
        assertThat(ev.emailMode).isEqualTo("all");
        assertThat(ev.batchId).isEqualTo("batch-1");
    }

    @Test
    void enqueueAdmin_unknownStudent_throws() {
        when(userStudentRepository.findByIdWithStudentInfo(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> producer.enqueueAdmin(99L, 9L, null, false, "none", "b"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
