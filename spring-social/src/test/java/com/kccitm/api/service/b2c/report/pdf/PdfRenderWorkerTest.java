package com.kccitm.api.service.b2c.report.pdf;

import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.report.PdfRenderJob;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.report.PdfRenderJobRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PdfRenderWorkerTest {

    @Mock PdfRenderClaimService claimService; // unused by renderOne tests; satisfies @InjectMocks
    @Mock PdfRenderJobRepository jobRepository;
    @Mock GeneratedReportRepository generatedReportRepository;
    @Mock GotenbergClient gotenberg;
    @Mock DigitalOceanSpacesService spaces;
    @InjectMocks PdfRenderWorker worker;

    private PdfRenderJob job(long grId) {
        PdfRenderJob j = new PdfRenderJob();
        j.setGeneratedReportId(grId);
        j.setReportUrl("https://cdn/report-renders/pager-insight/assessment-9/student_3_pager-insight.html");
        j.setStatus(PdfRenderJob.RENDERING);
        j.setMaxAttempts(3);
        return j;
    }

    @Test
    void renderOne_success_uploadsPdf_marksReady() {
        PdfRenderJob j = job(42L);
        GeneratedReport gr = new GeneratedReport();
        when(gotenberg.renderUrl(j.getReportUrl())).thenReturn("%PDF".getBytes());
        when(spaces.uploadBytes(any(), eq("application/pdf"),
                eq("report-renders/pager-insight/assessment-9"),
                eq("student_3_pager-insight.pdf"))).thenReturn("https://cdn/.../student_3_pager-insight.pdf");
        when(generatedReportRepository.findById(42L)).thenReturn(Optional.of(gr));

        worker.renderOne(j);

        assertThat(gr.getPdfStatus()).isEqualTo("ready");
        assertThat(gr.getPdfUrl()).isEqualTo("https://cdn/.../student_3_pager-insight.pdf");
        assertThat(j.getStatus()).isEqualTo(PdfRenderJob.DONE);
        verify(generatedReportRepository).save(gr);
        verify(jobRepository).save(j);
    }

    @Test
    void renderOne_failure_underBudget_requeuesPending() {
        PdfRenderJob j = job(42L);
        j.setAttempts(0);
        when(gotenberg.renderUrl(anyString())).thenThrow(new IllegalStateException("HTTP 503"));

        worker.renderOne(j);

        assertThat(j.getStatus()).isEqualTo(PdfRenderJob.PENDING);
        assertThat(j.getAttempts()).isEqualTo(1);
        assertThat(j.getLastError()).contains("503");
        verify(jobRepository).save(j);
        verify(generatedReportRepository, never()).save(any());
    }

    @Test
    void renderOne_failure_overBudget_marksFailed_andReportFailed() {
        PdfRenderJob j = job(42L);
        j.setAttempts(2); // this attempt makes 3 == maxAttempts
        GeneratedReport gr = new GeneratedReport();
        when(gotenberg.renderUrl(anyString())).thenThrow(new IllegalStateException("boom"));
        when(generatedReportRepository.findById(42L)).thenReturn(Optional.of(gr));

        worker.renderOne(j);

        assertThat(j.getStatus()).isEqualTo(PdfRenderJob.FAILED);
        assertThat(gr.getPdfStatus()).isEqualTo("failed");
        verify(jobRepository).save(j);
        verify(generatedReportRepository).save(gr);
    }

    @Test
    void folderOf_stripsHostAndFilename() {
        assertThat(PdfRenderWorker.folderOf(
            "https://storage-c9.sgp1.digitaloceanspaces.com/pager-reports/insight/assessment-9/student_3_pager-insight.html"))
            .isEqualTo("pager-reports/insight/assessment-9");
    }

    @Test
    void pdfFileNameOf_swapsExtension() {
        assertThat(PdfRenderWorker.pdfFileNameOf(
            "https://cdn/x/student_3_pager-insight.html"))
            .isEqualTo("student_3_pager-insight.pdf");
    }
}
