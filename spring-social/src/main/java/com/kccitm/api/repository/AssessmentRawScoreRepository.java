package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.career9.AssessmentRawScore;

public interface AssessmentRawScoreRepository
        extends JpaRepository<AssessmentRawScore, Long> {

    void deleteByStudentAssessmentMappingStudentAssessmentId(Long studentAssessmentId);

    // For individual student score export
    List<AssessmentRawScore> findByStudentAssessmentMappingStudentAssessmentId(Long studentAssessmentId);

    // For bulk export by student assessment mapping IDs
    List<AssessmentRawScore> findByStudentAssessmentMappingStudentAssessmentIdIn(List<Long> studentAssessmentIds);
}
