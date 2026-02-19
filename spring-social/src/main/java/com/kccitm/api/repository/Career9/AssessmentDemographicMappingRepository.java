package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.AssessmentDemographicMapping;

@Repository
public interface AssessmentDemographicMappingRepository extends JpaRepository<AssessmentDemographicMapping, Long> {
    List<AssessmentDemographicMapping> findByAssessmentIdOrderByDisplayOrderAsc(Long assessmentId);
    Optional<AssessmentDemographicMapping> findByAssessmentIdAndFieldDefinitionFieldId(Long assessmentId, Long fieldId);
    void deleteByAssessmentId(Long assessmentId);
    void deleteByAssessmentIdAndFieldDefinitionFieldId(Long assessmentId, Long fieldId);
}
