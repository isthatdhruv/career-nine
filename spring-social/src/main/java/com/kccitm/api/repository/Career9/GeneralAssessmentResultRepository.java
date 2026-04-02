package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.career9.GeneralAssessmentResult;

public interface GeneralAssessmentResultRepository extends JpaRepository<GeneralAssessmentResult, Long> {

    Optional<GeneralAssessmentResult> findByUserStudentIdAndAssessmentId(Long userStudentId, Long assessmentId);

    List<GeneralAssessmentResult> findByAssessmentId(Long assessmentId);

    List<GeneralAssessmentResult> findByUserStudentId(Long userStudentId);

    void deleteByUserStudentIdAndAssessmentId(Long userStudentId, Long assessmentId);

    void deleteByUserStudentId(Long userStudentId);
}
