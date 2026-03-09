package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.service.AssessmentSessionService;

@RestController
@RequestMapping("/assessments")
public class LiveTrackingController {

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private AssessmentAnswerRepository assessmentAnswerRepository;

    @Autowired
    private QuestionnaireQuestionRepository questionnaireQuestionRepository;

    @Autowired
    private AssessmentSessionService assessmentSessionService;

    /**
     * Single efficient endpoint for live tracking.
     * Returns assessment info, total questions, all student statuses, and answer counts
     * in one response — optimized for low-bandwidth polling.
     */
    @GetMapping("/{assessmentId}/live-tracking")
    public ResponseEntity<?> getLiveTracking(@PathVariable Long assessmentId) {
        // 1. Get the assessment
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId).orElse(null);
        if (assessment == null) {
            return ResponseEntity.notFound().build();
        }

        // 2. Get total question count from the linked questionnaire
        int totalQuestions = 0;
        if (assessment.getQuestionnaire() != null) {
            totalQuestions = questionnaireQuestionRepository
                    .findByQuestionnaireIdWithOptions(assessment.getQuestionnaire().getQuestionnaireId())
                    .size();
        }

        // 3. Get all student mappings for this assessment
        List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                .findAllByAssessmentId(assessmentId);

        // 4. Build student entries with answer counts
        int notStarted = 0, ongoing = 0, completed = 0;
        List<Map<String, Object>> students = new ArrayList<>();

        for (StudentAssessmentMapping mapping : mappings) {
            String status = mapping.getStatus() != null ? mapping.getStatus() : "notstarted";

            switch (status) {
                case "ongoing":
                    ongoing++;
                    break;
                case "completed":
                    completed++;
                    break;
                default:
                    notStarted++;
                    break;
            }

            UserStudent us = mapping.getUserStudent();
            if (us == null) continue;

            Map<String, Object> entry = new HashMap<>();
            entry.put("userStudentId", us.getUserStudentId());
            entry.put("status", status);

            // Student name from StudentInfo
            StudentInfo si = us.getStudentInfo();
            entry.put("studentName", si != null ? si.getName() : "Unknown");
            entry.put("instituteName",
                    us.getInstitute() != null ? us.getInstitute().getInstituteName() : "");

            // For ongoing students: use live heartbeat data (localStorage-based count)
            // For completed students: use DB count (final submitted answers)
            // For notstarted: 0
            if ("ongoing".equals(status)) {
                Map<String, Object> heartbeat = assessmentSessionService
                        .getHeartbeat(us.getUserStudentId(), assessmentId);
                if (heartbeat != null) {
                    entry.put("currentPage", heartbeat.get("page"));
                    entry.put("currentSection", heartbeat.get("sectionName"));
                    entry.put("currentQuestionIndex", heartbeat.get("questionIndex"));
                    entry.put("lastSeen", heartbeat.get("timestamp"));
                    // Live answer count from student's browser
                    Object liveCount = heartbeat.get("answeredCount");
                    entry.put("answeredCount", liveCount != null ? liveCount : 0);
                } else {
                    entry.put("currentPage", null);
                    entry.put("answeredCount", 0);
                }
            } else if ("completed".equals(status)) {
                Long answered = assessmentAnswerRepository
                        .countByUserStudent_UserStudentIdAndAssessment_Id(
                                us.getUserStudentId(), assessmentId);
                entry.put("answeredCount", answered != null ? answered : 0);
            } else {
                entry.put("answeredCount", 0);
            }

            students.add(entry);
        }

        // 5. Build compact response
        Map<String, Object> response = new HashMap<>();
        response.put("assessmentId", assessmentId);
        response.put("assessmentName", assessment.getAssessmentName());
        response.put("totalQuestions", totalQuestions);
        response.put("students", students);

        Map<String, Integer> summary = new HashMap<>();
        summary.put("total", mappings.size());
        summary.put("notStarted", notStarted);
        summary.put("ongoing", ongoing);
        summary.put("completed", completed);
        response.put("summary", summary);

        return ResponseEntity.ok(response);
    }
}
