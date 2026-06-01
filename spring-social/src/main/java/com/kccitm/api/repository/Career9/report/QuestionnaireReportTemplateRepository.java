package com.kccitm.api.repository.Career9.report;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.report.QuestionnaireReportTemplate;

@Repository
public interface QuestionnaireReportTemplateRepository
        extends JpaRepository<QuestionnaireReportTemplate, Long> {

    List<QuestionnaireReportTemplate> findByQuestionnaireId(Long questionnaireId);

    Optional<QuestionnaireReportTemplate> findByQuestionnaireIdAndIsDefaultTrue(Long questionnaireId);

    Optional<QuestionnaireReportTemplate> findByQuestionnaireIdAndReportTemplate_Id(
            Long questionnaireId, Long reportTemplateId);

    boolean existsByQuestionnaireId(Long questionnaireId);

    long countByQuestionnaireId(Long questionnaireId);
}
