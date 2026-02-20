package com.kccitm.api.controller.career9;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.transaction.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.AssessmentProctoringQuestionLog;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.repository.Career9.AssessmentProctoringQuestionLogRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;

@RestController
@RequestMapping("/assessment-proctoring")
public class AssessmentProctoringController {

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private AssessmentProctoringQuestionLogRepository questionLogRepository;

    @Autowired
    private QuestionnaireQuestionRepository questionnaireQuestionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @SuppressWarnings("unchecked")
    @Transactional
    @PostMapping(value = "/save", headers = "Accept=application/json")
    public ResponseEntity<?> saveProctoringData(@RequestBody Map<String, Object> payload) {
        try {
            Long userStudentId = ((Number) payload.get("userStudentId")).longValue();
            Long assessmentId = ((Number) payload.get("assessmentId")).longValue();

            UserStudent userStudent = userStudentRepository.findById(userStudentId)
                    .orElseThrow(() -> new RuntimeException("UserStudent not found"));

            AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
                    .orElseThrow(() -> new RuntimeException("Assessment not found"));

            List<Map<String, Object>> perQuestionData =
                    (List<Map<String, Object>>) payload.get("perQuestionData");

            if (perQuestionData == null || perQuestionData.isEmpty()) {
                return ResponseEntity.badRequest().body("No per-question data provided");
            }

            // Delete old data if re-submitting
            questionLogRepository.deleteByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);

            for (Map<String, Object> qData : perQuestionData) {
                Long qqId = ((Number) qData.get("questionnaireQuestionId")).longValue();

                QuestionnaireQuestion qq = questionnaireQuestionRepository.findById(qqId)
                        .orElse(null);
                if (qq == null) continue;

                AssessmentProctoringQuestionLog qLog = new AssessmentProctoringQuestionLog();
                qLog.setUserStudent(userStudent);
                qLog.setAssessment(assessment);
                qLog.setQuestionnaireQuestion(qq);

                qLog.setScreenWidth(((Number) qData.get("screenWidth")).intValue());
                qLog.setScreenHeight(((Number) qData.get("screenHeight")).intValue());
                qLog.setQuestionRectJson(objectMapper.writeValueAsString(qData.get("questionRect")));
                qLog.setOptionsRectJson(objectMapper.writeValueAsString(qData.get("optionsRect")));
                qLog.setGazePointsJson(objectMapper.writeValueAsString(qData.get("gazePoints")));
                qLog.setTimeSpentMs(((Number) qData.get("timeSpentMs")).longValue());
                qLog.setQuestionStartTime(((Number) qData.get("questionStartTime")).longValue());
                qLog.setQuestionEndTime(((Number) qData.get("questionEndTime")).longValue());
                qLog.setMouseClickCount(((Number) qData.get("mouseClickCount")).intValue());
                qLog.setMouseClicksJson(objectMapper.writeValueAsString(qData.get("mouseClicks")));
                qLog.setMaxFacesDetected(((Number) qData.get("maxFacesDetected")).intValue());
                qLog.setAvgFacesDetected(((Number) qData.get("avgFacesDetected")).doubleValue());
                qLog.setHeadAwayCount(((Number) qData.get("headAwayCount")).intValue());
                qLog.setTabSwitchCount(((Number) qData.get("tabSwitchCount")).intValue());

                // New WebGazer eye-tracking fields (nullable for backward compat)
                Object eyeGazePoints = qData.get("eyeGazePoints");
                if (eyeGazePoints != null) {
                    qLog.setEyeGazePointsJson(objectMapper.writeValueAsString(eyeGazePoints));
                }

                Object firstLookedOptionId = qData.get("firstLookedOptionId");
                if (firstLookedOptionId != null) {
                    qLog.setFirstLookedOptionId(((Number) firstLookedOptionId).longValue());
                }

                questionLogRepository.save(qLog);
            }

            return ResponseEntity.ok(Map.of("status", "success", "questionsSaved", perQuestionData.size()));

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error saving proctoring data: " + e.getMessage());
        }
    }

    @GetMapping(value = "/getByStudent/{studentId}", headers = "Accept=application/json")
    public ResponseEntity<?> getByStudent(@PathVariable Long studentId) {
        List<AssessmentProctoringQuestionLog> logs = questionLogRepository
                .findByUserStudentUserStudentId(studentId);
        return ResponseEntity.ok(logs);
    }

    @GetMapping(value = "/getByAssessment/{assessmentId}", headers = "Accept=application/json")
    public ResponseEntity<?> getByAssessment(@PathVariable Long assessmentId) {
        List<AssessmentProctoringQuestionLog> logs = questionLogRepository
                .findByAssessmentId(assessmentId);
        return ResponseEntity.ok(logs);
    }

    @GetMapping(value = "/get/{studentId}/{assessmentId}", headers = "Accept=application/json")
    public ResponseEntity<?> getByStudentAndAssessment(
            @PathVariable Long studentId, @PathVariable Long assessmentId) {
        List<AssessmentProctoringQuestionLog> logs = questionLogRepository
                .findByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId);
        return ResponseEntity.ok(logs);
    }
}
