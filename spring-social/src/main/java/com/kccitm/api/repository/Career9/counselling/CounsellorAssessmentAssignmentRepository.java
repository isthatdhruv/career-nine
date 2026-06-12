package com.kccitm.api.repository.Career9.counselling;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kccitm.api.model.career9.counselling.CounsellorAssessmentAssignment;

public interface CounsellorAssessmentAssignmentRepository
        extends JpaRepository<CounsellorAssessmentAssignment, Long> {

    List<CounsellorAssessmentAssignment> findByAssessmentId(Long assessmentId);

    List<CounsellorAssessmentAssignment> findByCounsellorId(Long counsellorId);

    boolean existsByCounsellorIdAndAssessmentId(Long counsellorId, Long assessmentId);

    /** Active counsellor ids assigned to an assessment — used to filter bookable slots. */
    @Query("SELECT a.counsellor.id FROM CounsellorAssessmentAssignment a "
            + "WHERE a.assessmentId = :assessmentId AND a.isActive = true")
    List<Long> findActiveCounsellorIdsForAssessment(@Param("assessmentId") Long assessmentId);
}
