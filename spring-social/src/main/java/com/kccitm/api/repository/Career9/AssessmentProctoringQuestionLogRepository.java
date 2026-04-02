package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kccitm.api.model.career9.AssessmentProctoringQuestionLog;

public interface AssessmentProctoringQuestionLogRepository
        extends JpaRepository<AssessmentProctoringQuestionLog, Long> {

    List<AssessmentProctoringQuestionLog> findByUserStudentUserStudentId(Long userStudentId);

    List<AssessmentProctoringQuestionLog> findByAssessmentId(Long assessmentId);

    List<AssessmentProctoringQuestionLog> findByUserStudentUserStudentIdAndAssessmentId(
            Long userStudentId, Long assessmentId);

    void deleteByUserStudentUserStudentIdAndAssessmentId(Long userStudentId, Long assessmentId);

    void deleteByUserStudentUserStudentId(Long userStudentId);

    /**
     * Fetch all proctoring logs for given student IDs and assessment IDs in a single query.
     * Use this instead of looping per-pair to avoid N+1 queries.
     */
    @Query("SELECT l FROM AssessmentProctoringQuestionLog l " +
           "WHERE l.userStudent.userStudentId IN :studentIds " +
           "AND l.assessment.id IN :assessmentIds " +
           "ORDER BY l.userStudent.userStudentId, l.assessment.id")
    List<AssessmentProctoringQuestionLog> findByStudentIdsAndAssessmentIds(
            @Param("studentIds") List<Long> studentIds,
            @Param("assessmentIds") List<Long> assessmentIds);
}
