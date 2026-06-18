package com.kccitm.api.repository.Career9.counselling;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.career9.counselling.CounsellingRequest;

public interface CounsellingRequestRepository
        extends JpaRepository<CounsellingRequest, Long> {

    /** Idempotency guard: at most one open request per (student, assessment). */
    Optional<CounsellingRequest> findFirstByUserStudentIdAndAssessmentIdAndStatus(
            Long userStudentId, Long assessmentId, String status);

    /** Admin list — newest first. */
    List<CounsellingRequest> findByStatusOrderByCreatedAtDesc(String status);

    /** All open requests for an assessment — used to auto-close when a counsellor is assigned. */
    List<CounsellingRequest> findByAssessmentIdAndStatus(Long assessmentId, String status);
}
