package com.kccitm.api.service.b2c.report.pdf;

import com.kccitm.api.model.career9.report.PdfRenderJob;
import com.kccitm.api.repository.Career9.report.PdfRenderJobRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Creates or resets the single render job for a generated report. */
@Service
public class PdfRenderEnqueueService {

    @Autowired private PdfRenderJobRepository jobRepository;

    /** Upsert the job to PENDING with a fresh attempt budget. */
    public void enqueue(Long generatedReportId, String reportUrl) {
        PdfRenderJob job = jobRepository.findByGeneratedReportId(generatedReportId)
                .orElseGet(PdfRenderJob::new);
        job.setGeneratedReportId(generatedReportId);
        job.setReportUrl(reportUrl);
        job.setStatus(PdfRenderJob.PENDING);
        job.setAttempts(0);
        job.setLastError(null);
        job.setLeaseUntil(null);
        jobRepository.save(job);
    }
}
