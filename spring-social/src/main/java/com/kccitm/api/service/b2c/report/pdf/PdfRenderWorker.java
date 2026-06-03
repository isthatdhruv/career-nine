package com.kccitm.api.service.b2c.report.pdf;

import com.kccitm.api.model.career9.report.PdfRenderJob;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.report.PdfRenderJobRepository;
import com.kccitm.api.service.DigitalOceanSpacesService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/** Drains the pdf_render_job queue, rendering each via Gotenberg → Spaces. */
@Component
public class PdfRenderWorker {

    private static final Logger log = LoggerFactory.getLogger(PdfRenderWorker.class);

    @Autowired private PdfRenderClaimService claimService;
    @Autowired private PdfRenderJobRepository jobRepository;
    @Autowired private GeneratedReportRepository generatedReportRepository;
    @Autowired private GotenbergClient gotenberg;
    @Autowired private DigitalOceanSpacesService spaces;

    /** Claim a batch (transactional, SKIP LOCKED) and render each outside the claim txn. */
    @Scheduled(fixedDelayString = "${app.pdf-render.poll-ms:3000}")
    public void pollAndRender() {
        List<PdfRenderJob> batch = claimService.claimBatch();
        for (PdfRenderJob job : batch) {
            try {
                renderOne(job);
            } catch (Exception e) {
                log.error("Unexpected error rendering job {}", job.getPdfRenderJobId(), e);
            }
        }
    }

    /** Render a single claimed job. Visible for testing. */
    void renderOne(PdfRenderJob job) {
        try {
            byte[] pdf = gotenberg.renderUrl(job.getReportUrl());
            String folder = folderOf(job.getReportUrl());
            String fileName = pdfFileNameOf(job.getReportUrl());
            String pdfUrl = spaces.uploadBytes(pdf, "application/pdf", folder, fileName);

            generatedReportRepository.findById(job.getGeneratedReportId()).ifPresent(gr -> {
                gr.setPdfUrl(pdfUrl);
                gr.setPdfStatus("ready");
                generatedReportRepository.save(gr);
            });
            job.setStatus(PdfRenderJob.DONE);
            job.setLeaseUntil(null);
            jobRepository.save(job);
        } catch (Exception e) {
            job.setAttempts(job.getAttempts() + 1);
            job.setLastError(truncate(e.getMessage(), 1000));
            job.setLeaseUntil(null);
            if (job.getAttempts() >= job.getMaxAttempts()) {
                job.setStatus(PdfRenderJob.FAILED);
                generatedReportRepository.findById(job.getGeneratedReportId()).ifPresent(gr -> {
                    gr.setPdfStatus("failed");
                    generatedReportRepository.save(gr);
                });
            } else {
                job.setStatus(PdfRenderJob.PENDING); // retry next tick
            }
            jobRepository.save(job);
            log.warn("PDF render attempt {} failed for job {}: {}",
                    job.getAttempts(), job.getPdfRenderJobId(), e.getMessage());
        }
    }

    /** "https://cdn/a/b/student_3_x.html" → "a/b" (path between host and filename). */
    static String folderOf(String url) {
        String path = url.replaceFirst("^https?://[^/]+/", "");
        int slash = path.lastIndexOf('/');
        return slash >= 0 ? path.substring(0, slash) : "";
    }

    /** ".../student_3_x.html" → "student_3_x.pdf". */
    static String pdfFileNameOf(String url) {
        String path = url.substring(url.lastIndexOf('/') + 1);
        return path.replaceFirst("\\.html?($|\\?.*$)", "") + ".pdf";
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
