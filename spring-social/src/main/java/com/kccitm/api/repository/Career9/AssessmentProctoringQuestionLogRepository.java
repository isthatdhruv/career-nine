package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.career9.AssessmentProctoringQuestionLog;

public interface AssessmentProctoringQuestionLogRepository
        extends JpaRepository<AssessmentProctoringQuestionLog, Long> {

    List<AssessmentProctoringQuestionLog> findByUserStudentUserStudentId(Long userStudentId);

    List<AssessmentProctoringQuestionLog> findByAssessmentId(Long assessmentId);

    List<AssessmentProctoringQuestionLog> findByUserStudentUserStudentIdAndAssessmentId(
            Long userStudentId, Long assessmentId);

    void deleteByUserStudentUserStudentIdAndAssessmentId(Long userStudentId, Long assessmentId);
}
