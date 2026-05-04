package com.kccitm.api.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kccitm.api.model.career9.AssessmentSubmissionFailure;

public interface AssessmentSubmissionFailureRepository
        extends JpaRepository<AssessmentSubmissionFailure, Long> {

    Optional<AssessmentSubmissionFailure> findByUserStudentIdAndAssessmentId(
            Long userStudentId, Long assessmentId);

    // Unresolved failures ready for retry (nextRetryAt <= now).
    @Query("SELECT f FROM AssessmentSubmissionFailure f " +
           "WHERE f.resolved = false " +
           "  AND f.nextRetryAt IS NOT NULL " +
           "  AND f.nextRetryAt <= :now")
    List<AssessmentSubmissionFailure> findDueForRetry(@Param("now") Instant now);

    // Unresolved failures older than a given cutoff — used by auto-expire sweep.
    @Query("SELECT f FROM AssessmentSubmissionFailure f " +
           "WHERE f.resolved = false " +
           "  AND f.firstFailedAt <= :cutoff")
    List<AssessmentSubmissionFailure> findUnresolvedBefore(@Param("cutoff") Instant cutoff);
}
