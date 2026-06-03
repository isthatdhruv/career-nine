package com.kccitm.api.service.b2c.report.pdf;

import com.kccitm.api.model.career9.report.PdfRenderJob;
import com.kccitm.api.repository.Career9.report.PdfRenderJobRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

/** Atomically claims a batch of runnable jobs and marks them RENDERING with a lease. */
@Service
public class PdfRenderClaimService {

    @Autowired private PdfRenderJobRepository jobRepository;

    @Value("${app.pdf-render.max-concurrent:4}") private int maxConcurrent;
    @Value("${app.pdf-render.lease-seconds:180}") private int leaseSeconds;

    /** SKIP LOCKED claim + lease, all in one transaction so the row locks hold. */
    @Transactional
    public List<PdfRenderJob> claimBatch() {
        List<PdfRenderJob> jobs = jobRepository.claimRunnable(new Date(), maxConcurrent);
        Date lease = new Date(System.currentTimeMillis() + leaseSeconds * 1000L);
        for (PdfRenderJob j : jobs) {
            j.setStatus(PdfRenderJob.RENDERING);
            j.setLeaseUntil(lease);
        }
        jobRepository.saveAll(jobs);
        return jobs;
    }
}
