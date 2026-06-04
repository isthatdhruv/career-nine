package com.kccitm.api.service.b2c.report.pdf;

import com.kccitm.api.service.DigitalOceanSpacesService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PdfRenderServiceTest {

    @Mock GotenbergClient gotenberg;
    @Mock DigitalOceanSpacesService spaces;
    @InjectMocks PdfRenderService service;

    @Test
    void renderAndUpload_rendersThenUploadsBesideHtml() {
        String htmlUrl = "https://storage-c9.sgp1.digitaloceanspaces.com/pager-reports/insight/assessment-9/student_3_pager-insight.html";
        when(gotenberg.renderUrl(htmlUrl)).thenReturn("%PDF".getBytes());
        when(spaces.uploadBytes(any(), eq("application/pdf"),
                eq("pager-reports/insight/assessment-9"),
                eq("student_3_pager-insight.pdf")))
            .thenReturn("https://cdn/pager-reports/insight/assessment-9/student_3_pager-insight.pdf");

        String pdfUrl = service.renderAndUpload(htmlUrl);

        assertThat(pdfUrl).isEqualTo("https://cdn/pager-reports/insight/assessment-9/student_3_pager-insight.pdf");
        verify(gotenberg).renderUrl(htmlUrl);
    }

    @Test
    void folderOf_stripsHostAndFilename() {
        assertThat(PdfRenderService.folderOf(
            "https://storage-c9.sgp1.digitaloceanspaces.com/pager-reports/insight/assessment-9/student_3_pager-insight.html"))
            .isEqualTo("pager-reports/insight/assessment-9");
    }

    @Test
    void pdfFileNameOf_swapsExtension() {
        assertThat(PdfRenderService.pdfFileNameOf(
            "https://cdn/x/student_3_pager-insight.html"))
            .isEqualTo("student_3_pager-insight.pdf");
    }
}
