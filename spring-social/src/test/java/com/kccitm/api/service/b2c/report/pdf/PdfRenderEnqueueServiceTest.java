package com.kccitm.api.service.b2c.report.pdf;

import com.kccitm.api.model.career9.report.PdfRenderJob;
import com.kccitm.api.repository.Career9.report.PdfRenderJobRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PdfRenderEnqueueServiceTest {

    @Mock PdfRenderJobRepository jobRepository;
    @InjectMocks PdfRenderEnqueueService service;

    @Test
    void enqueue_resetsExistingJobToPending() {
        PdfRenderJob existing = new PdfRenderJob();
        existing.setStatus(PdfRenderJob.FAILED);
        existing.setAttempts(3);
        existing.setLastError("boom");
        when(jobRepository.findByGeneratedReportId(7L)).thenReturn(Optional.of(existing));

        service.enqueue(7L, "https://cdn/r.html");

        ArgumentCaptor<PdfRenderJob> cap = ArgumentCaptor.forClass(PdfRenderJob.class);
        verify(jobRepository).save(cap.capture());
        PdfRenderJob saved = cap.getValue();
        assertThat(saved.getStatus()).isEqualTo(PdfRenderJob.PENDING);
        assertThat(saved.getAttempts()).isZero();
        assertThat(saved.getLastError()).isNull();
        assertThat(saved.getReportUrl()).isEqualTo("https://cdn/r.html");
    }
}
