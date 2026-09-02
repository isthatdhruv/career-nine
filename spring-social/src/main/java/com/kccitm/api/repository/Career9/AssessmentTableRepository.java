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

    /**
     * The institute's catalog ("which assessments this institute offers", set in the
     * wizard's Map-Assessments step), named. Distinct from
     * {@link #findAssessmentSummariesByInstitute} above, which lists whatever has a
     * registration link — a superset that can include assessments the institute was
     * never enabled for.
     */
    @Query("SELECT DISTINCT a.id AS id, a.AssessmentName AS assessmentName, a.isActive AS isActive, q.type AS questionnaireType " +
           "FROM AssessmentTable a LEFT JOIN a.questionnaire q JOIN InstituteAssessment ia ON a.id = ia.assessmentId " +
           "WHERE ia.instituteCode = :instituteCode AND ia.isActive = true AND (a.isDeleted = false OR a.isDeleted IS NULL)")
    List<AssessmentSummary> findCatalogAssessmentSummariesByInstitute(@Param("instituteCode") Integer instituteCode);

    /**
     * Multi-institute variant of {@link #findAssessmentSummariesByInstitute} for
     * ABAC-scoped list endpoints (a user can be mapped to several institutes).
     */
    @Query("SELECT DISTINCT a.id AS id, a.AssessmentName AS assessmentName, a.isActive AS isActive, q.type AS questionnaireType " +
           "FROM AssessmentTable a LEFT JOIN a.questionnaire q JOIN AssessmentInstituteMapping m ON a.id = m.assessmentId " +
           "WHERE m.instituteCode IN :instituteCodes AND m.isActive = true AND (a.isDeleted = false OR a.isDeleted IS NULL)")
    List<AssessmentSummary> findAssessmentSummariesByInstitutes(
            @Param("instituteCodes") Collection<Integer> instituteCodes);

    /**
     * Assessments any of the institutes' students are actually allotted to
     * (StudentAssessmentMapping), regardless of registration-link mappings.
     * Unioned with the mapping-based list on scoped endpoints so direct
     * per-student allotments stay visible (same rule as the Data Download
     * filter sources).
     */
    @Query("SELECT DISTINCT a.id AS id, a.AssessmentName AS assessmentName, a.isActive AS isActive, q.type AS questionnaireType " +
           "FROM AssessmentTable a LEFT JOIN a.questionnaire q JOIN StudentAssessmentMapping sm ON a.id = sm.assessmentId " +
           "WHERE sm.userStudent.institute.instituteCode IN :instituteCodes AND (a.isDeleted = false OR a.isDeleted IS NULL)")
    List<AssessmentSummary> findStudentAssignedAssessmentSummariesByInstitutes(
            @Param("instituteCodes") Collection<Integer> instituteCodes);

}
