package com.kccitm.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.career9.AssessmentRawScore;

public interface AssessmentRawScoreRepository
        extends JpaRepository<AssessmentRawScore, Long> {

    void deleteByStudentAssessmentMappingStudentAssessmentId(Long studentAssessmentId);
}
