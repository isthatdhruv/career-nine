package com.kccitm.api.service;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Single source of truth for marking a StudentAssessmentMapping as completed.
 *
 * Every submission path (batch submit, Redis flush, Firebase import, async processor)
 * must go through this service instead of calling setStatus("completed") directly.
 * The service verifies that the student has actually answered every question in the
 * linked questionnaire before flipping the status — otherwise it marks the mapping
 * as "ongoing" (or leaves it untouched if already completed by an earlier full submit).
 */
@Service
public class AssessmentCompletionService {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentCompletionService.class);

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private QuestionnaireQuestionRepository questionnaireQuestionRepository;

    @Autowired
    private AssessmentAnswerRepository assessmentAnswerRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    /**
     * Returns the total number of questions in the questionnaire linked to this assessment,
     * or 0 if no questionnaire is linked. Uses a COUNT query — does not load entities.
     */
    public int getTotalQuestions(Long assessmentId) {
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId).orElse(null);
        if (assessment == null || assessment.getQuestionnaire() == null) {
            return 0;
        }
        Long count = questionnaireQuestionRepository
                .countByQuestionnaireId(assessment.getQuestionnaire().getQuestionnaireId());
        return count != null ? count.intValue() : 0;
    }

    /**
     * Counts how many DISTINCT questions the student has answered for this assessment.
     * Uses COUNT(DISTINCT questionnaire_question_id) — not raw row count — because
     * ranking and multi-select questions produce multiple answer rows per question.
     */
    public int getAnsweredCount(Long userStudentId, Long assessmentId) {
        Long count = assessmentAnswerRepository
                .countDistinctQuestionsAnsweredByStudent(userStudentId, assessmentId);
        return count != null ? count.intValue() : 0;
    }

    /**
     * Returns true iff the student has answered every question in the assessment.
     * Assessments with 0 questions (unlinked questionnaires) always return false so
     * they are never silently marked completed.
     */
    public boolean isFullyAnswered(Long userStudentId, Long assessmentId) {
        int total = getTotalQuestions(assessmentId);
        if (total <= 0) return false;
        return getAnsweredCount(userStudentId, assessmentId) >= total;
    }

    /**
     * Guarded completion: flips the mapping to "completed" only when every question
     * has been answered; otherwise sets it to "ongoing". Saves the mapping and
     * returns the resolved status string ("completed" | "ongoing").
     *
     * Use this from every submission path EXCEPT the explicit admin force-complete endpoint.
     */
    public String markCompletedIfFullyAnswered(StudentAssessmentMapping mapping) {
        if (mapping == null || mapping.getUserStudent() == null) {
            return null;
        }
        Long studentId = mapping.getUserStudent().getUserStudentId();
        Long assessmentId = mapping.getAssessmentId();

        int total = getTotalQuestions(assessmentId);
        int answered = getAnsweredCount(studentId, assessmentId);

        String resolved;
        if (total > 0 && answered >= total) {
            resolved = "completed";
        } else {
            resolved = "ongoing";
        }

        mapping.setStatus(resolved);
        studentAssessmentMappingRepository.save(mapping);

        logger.info("Completion check: student={} assessment={} answered={}/{} → status={}",
                studentId, assessmentId, answered, total, resolved);
        return resolved;
    }
}
