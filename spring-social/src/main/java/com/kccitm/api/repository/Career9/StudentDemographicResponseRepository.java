package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.StudentDemographicResponse;

@Repository
public interface StudentDemographicResponseRepository extends JpaRepository<StudentDemographicResponse, Long> {
    List<StudentDemographicResponse> findByUserStudentIdAndAssessmentId(Long userStudentId, Long assessmentId);
    Optional<StudentDemographicResponse> findByUserStudentIdAndAssessmentIdAndFieldDefinitionFieldId(
            Long userStudentId, Long assessmentId, Long fieldId);
    void deleteByUserStudentIdAndAssessmentId(Long userStudentId, Long assessmentId);

    // Cross-assessment lookups: demographic data is per-student per-field, not per-assessment
    List<StudentDemographicResponse> findByUserStudentId(Long userStudentId);
    List<StudentDemographicResponse> findByUserStudentIdAndFieldDefinitionFieldId(
            Long userStudentId, Long fieldId);
}
