package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Collection;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.AssessmentTable;

@Repository
public interface AssessmentTableRepository extends JpaRepository<AssessmentTable, Long> {

    List<AssessmentTable> findByQuestionnaireQuestionnaireId(Long questionnaireId);

    /**
     * Batch fetch assessments by IDs - eliminates N+1 queries in prefetch/login.
     */
    @Query("SELECT a FROM AssessmentTable a LEFT JOIN FETCH a.questionnaire WHERE a.id IN :ids")
    List<AssessmentTable> findAllByIdInWithQuestionnaire(@Param("ids") Collection<Long> ids);

    @Query("SELECT a FROM AssessmentTable a JOIN a.questionnaire q JOIN q.section qs WHERE qs.section.sectionId = :sectionId")
    List<AssessmentTable> findByQuestionSectionId(@Param("sectionId") Long sectionId);

    /**
     * Lightweight projection returning only id, name, and isActive.
     * Does not cascade into questionnaire/questions/options.
     */
    interface AssessmentSummary {
        Long getId();
        String getAssessmentName();
        Boolean getIsActive();
        Boolean getQuestionnaireType();
    }

    @Query("SELECT a.id AS id, a.AssessmentName AS assessmentName, a.isActive AS isActive, q.type AS questionnaireType FROM AssessmentTable a LEFT JOIN a.questionnaire q")
    List<AssessmentSummary> findAssessmentSummaryList();

    List<AssessmentTable> findByIsLockedTrue();

    List<AssessmentTable> findByIsDeletedFalseOrIsDeletedIsNull();

    List<AssessmentTable> findByIsDeletedTrue();

    @Query("SELECT a.id AS id, a.AssessmentName AS assessmentName, a.isActive AS isActive, q.type AS questionnaireType FROM AssessmentTable a LEFT JOIN a.questionnaire q WHERE a.isDeleted = false OR a.isDeleted IS NULL")
    List<AssessmentSummary> findAssessmentSummaryListNotDeleted();

    @Query("SELECT DISTINCT a.id AS id, a.AssessmentName AS assessmentName, a.isActive AS isActive, q.type AS questionnaireType " +
           "FROM AssessmentTable a LEFT JOIN a.questionnaire q JOIN AssessmentInstituteMapping m ON a.id = m.assessmentId " +
           "WHERE m.instituteCode = :instituteCode AND m.isActive = true AND (a.isDeleted = false OR a.isDeleted IS NULL)")
    List<AssessmentSummary> findAssessmentSummariesByInstitute(@Param("instituteCode") Integer instituteCode);

}
