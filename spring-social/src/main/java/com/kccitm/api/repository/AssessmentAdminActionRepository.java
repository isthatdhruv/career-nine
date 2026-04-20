package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.career9.AssessmentAdminAction;

public interface AssessmentAdminActionRepository
        extends JpaRepository<AssessmentAdminAction, Long> {

    List<AssessmentAdminAction> findByUserStudentIdAndAssessmentIdOrderByActionAtDesc(
            Long userStudentId, Long assessmentId);

    List<AssessmentAdminAction> findByAssessmentIdOrderByActionAtDesc(Long assessmentId);
}
