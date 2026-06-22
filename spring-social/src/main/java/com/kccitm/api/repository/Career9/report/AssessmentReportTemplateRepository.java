package com.kccitm.api.repository.Career9.report;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.report.AssessmentReportTemplate;

@Repository
public interface AssessmentReportTemplateRepository
        extends JpaRepository<AssessmentReportTemplate, Long> {

    List<AssessmentReportTemplate> findByAssessmentId(Long assessmentId);

    Optional<AssessmentReportTemplate> findByAssessmentIdAndIsDefaultTrue(Long assessmentId);

    Optional<AssessmentReportTemplate> findByAssessmentIdAndReportTemplate_Id(
            Long assessmentId, Long reportTemplateId);

    boolean existsByAssessmentId(Long assessmentId);

    long countByAssessmentId(Long assessmentId);

    // Catalog delete-guard: is this template still mapped to any assessment?
    boolean existsByReportTemplate_Id(Long reportTemplateId);

    long countByReportTemplate_Id(Long reportTemplateId);
}
