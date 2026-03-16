package com.kccitm.api.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentQuestionOptionsRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

@Service
public class PartialAnswerFlushService {

    private static final Logger logger = LoggerFactory.getLogger(PartialAnswerFlushService.class);

    @Autowired
    private AssessmentSessionService assessmentSessionService;

    @Autowired
    private AssessmentAnswerRepository assessmentAnswerRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private QuestionnaireQuestionRepository questionnaireQuestionRepository;

    @Autowired
    private AssessmentQuestionOptionsRepository assessmentQuestionOptionsRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @SuppressWarnings("unchecked")
    @Transactional
    public boolean flushOneStudent(Long studentId, Long assessmentId) {
        Map<String, Object> partial = assessmentSessionService.getPartialAnswers(studentId, assessmentId);
        if (partial == null) return false;

        List<Map<String, Object>> answers = (List<Map<String, Object>>) partial.get("answers");
        if (answers == null || answers.isEmpty()) return false;

        UserStudent userStudent = userStudentRepository.findById(studentId).orElse(null);
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId).orElse(null);
        if (userStudent == null || assessment == null) return false;

        // Bulk fetch questions and options
        List<Long> questionIds = new ArrayList<>();
        List<Long> optionIds = new ArrayList<>();
        for (Map<String, Object> ansMap : answers) {
            questionIds.add(((Number) ansMap.get("questionnaireQuestionId")).longValue());
            if (ansMap.containsKey("optionId")) {
                optionIds.add(((Number) ansMap.get("optionId")).longValue());
            }
        }

        Map<Long, QuestionnaireQuestion> questionCache = new HashMap<>();
        if (!questionIds.isEmpty()) {
            questionnaireQuestionRepository.findAllByIdIn(questionIds)
                    .forEach(qq -> questionCache.put(qq.getQuestionnaireQuestionId(), qq));
        }

        Map<Long, AssessmentQuestionOptions> optionCache = new HashMap<>();
        if (!optionIds.isEmpty()) {
            assessmentQuestionOptionsRepository.findAllById(optionIds)
                    .forEach(opt -> optionCache.put(opt.getOptionId(), opt));
        }

        // Build answer entities
        List<AssessmentAnswer> answersToSave = new ArrayList<>();
        for (Map<String, Object> ansMap : answers) {
            Long qId = ((Number) ansMap.get("questionnaireQuestionId")).longValue();
            QuestionnaireQuestion question = questionCache.get(qId);

            String textResponse = ansMap.containsKey("textResponse")
                    ? (String) ansMap.get("textResponse") : null;

            if (textResponse != null && question != null) {
                AssessmentAnswer ans = new AssessmentAnswer();
                ans.setUserStudent(userStudent);
                ans.setAssessment(assessment);
                ans.setQuestionnaireQuestion(question);
                ans.setTextResponse(textResponse);
                answersToSave.add(ans);
            } else if (ansMap.containsKey("optionId")) {
                Long oId = ((Number) ansMap.get("optionId")).longValue();
                Integer rankOrder = ansMap.containsKey("rankOrder")
                        ? ((Number) ansMap.get("rankOrder")).intValue() : null;
                AssessmentQuestionOptions option = optionCache.get(oId);
                if (question == null || option == null) continue;

                AssessmentAnswer ans = new AssessmentAnswer();
                ans.setUserStudent(userStudent);
                ans.setAssessment(assessment);
                ans.setQuestionnaireQuestion(question);
                ans.setOption(option);
                if (rankOrder != null) ans.setRankOrder(rankOrder);
                answersToSave.add(ans);
            }
        }

        // Delete-and-replace in MySQL
        assessmentAnswerRepository.deleteByUserStudent_UserStudentIdAndAssessment_Id(studentId, assessmentId);
        assessmentAnswerRepository.saveAll(answersToSave);

        // Do NOT delete from Redis — let 24h TTL handle cleanup
        logger.info("Flushed {} answers for student={} assessment={}", answersToSave.size(), studentId, assessmentId);
        return true;
    }

    @Scheduled(fixedRate = 180000) // 3 minutes
    public void autoFlushPartials() {
        List<Map<String, Object>> entries = assessmentSessionService.getAllPartialAnswerEntries(null);
        if (entries.isEmpty()) return;

        int success = 0, failed = 0;
        for (Map<String, Object> entry : entries) {
            try {
                Long studentId = ((Number) entry.get("userStudentId")).longValue();
                Long assessmentId = ((Number) entry.get("assessmentId")).longValue();
                // Skip if student already submitted — async processor handles it
                if (assessmentSessionService.hasSubmissionLock(studentId, assessmentId)) {
                    continue;
                }
                // Skip if assessment is completed — don't overwrite scored answers with raw partials.
                // This is defense-in-depth: the reset endpoint clears Redis, but a race window exists
                // if reset fires while this scheduler already fetched the entry list.
                String mappingStatus = studentAssessmentMappingRepository
                        .findFirstByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId)
                        .map(m -> m.getStatus())
                        .orElse(null);
                if ("completed".equals(mappingStatus)) {
                    // Stale partial key — clean it up proactively
                    assessmentSessionService.deletePartialAnswers(studentId, assessmentId);
                    continue;
                }
                if (flushOneStudent(studentId, assessmentId)) success++;
            } catch (Exception e) {
                failed++;
                logger.warn("Scheduled flush failed for entry: {}", entry, e);
            }
        }
        if (success > 0 || failed > 0) {
            logger.info("Scheduled partial flush: {} succeeded, {} failed", success, failed);
        }
    }
}
