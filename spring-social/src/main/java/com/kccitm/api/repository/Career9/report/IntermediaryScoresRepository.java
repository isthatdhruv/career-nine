package com.kccitm.api.repository.Career9.report;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.report.IntermediaryScoresRow;

@Repository
public interface IntermediaryScoresRepository extends JpaRepository<IntermediaryScoresRow, Long> {

    Optional<IntermediaryScoresRow> findByUserStudentIdAndAssessmentId(Long userStudentId, Long assessmentId);
}
