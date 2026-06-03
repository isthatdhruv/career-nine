package com.kccitm.api.repository.Career9.report;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.report.PdfRenderJob;

@Repository
public interface PdfRenderJobRepository extends JpaRepository<PdfRenderJob, Long> {

    Optional<PdfRenderJob> findByGeneratedReportId(Long generatedReportId);

    /**
     * Claim runnable jobs without contention across instances: PENDING, or
     * RENDERING whose lease expired (crash recovery). SKIP LOCKED (MySQL 8)
     * lets concurrent pollers/instances each grab a disjoint batch. Must run
     * inside a transaction (see PdfRenderClaimService) so the row locks hold.
     */
    @Query(value = "SELECT * FROM pdf_render_job "
            + "WHERE status = 'pending' "
            + "   OR (status = 'rendering' AND (lease_until IS NULL OR lease_until < :now)) "
            + "ORDER BY pdf_render_job_id ASC "
            + "LIMIT :limit FOR UPDATE SKIP LOCKED",
            nativeQuery = true)
    List<PdfRenderJob> claimRunnable(@Param("now") Date now, @Param("limit") int limit);
}
