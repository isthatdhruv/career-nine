package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.exception.ResourceNotFoundException;
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
    private AssessmentAnswerRepository assessmentAnswerRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private QuestionnaireQuestionRepository questionnaireQuestionRepository;

    @Autowired
    private AssessmentSessionService assessmentSessionService;

    /**
     * Lightweight endpoint: returns only student id, name, email, status.
     * Single JPQL query — no Redis, no answer counts, no N+1.
     */
    // no scope arg: identifies by assessmentId; scope-filter narrows access
    @PreAuthorize("@auth.allows('live_tracking.read')")
    @GetMapping("/{assessmentId}/live-tracking-lite")
    public ResponseEntity<?> getLiveTrackingLite(@PathVariable Long assessmentId) {
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId).orElse(null);
        if (assessment == null) {
            return ResponseEntity.notFound().build();
        }

        List<Object[]> rows = studentAssessmentMappingRepository.findLiteByAssessmentId(assessmentId);

        int notStarted = 0, ongoing = 0, completed = 0;
        List<Map<String, Object>> students = new ArrayList<>();

        for (Object[] row : rows) {
            Long userStudentId = (Long) row[0];
            String name = (String) row[1];
            String email = (String) row[2];
            String status = row[3] != null ? (String) row[3] : "notstarted";
            String username = row.length > 4 ? (String) row[4] : null;

            switch (status) {
                case "ongoing": ongoing++; break;
                case "completed": completed++; break;
                default: notStarted++; break;
            }

            Map<String, Object> entry = new HashMap<>();
            entry.put("userStudentId", userStudentId);
            entry.put("studentName", name != null ? name : "Unknown");
            entry.put("email", email != null ? email : "");
            entry.put("username", username != null ? username : "");
            entry.put("status", status);
            students.add(entry);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("assessmentId", assessmentId);
        response.put("assessmentName", assessment.getAssessmentName());
        response.put("students", students);

        Map<String, Integer> summary = new HashMap<>();
        summary.put("total", rows.size());
        summary.put("notStarted", notStarted);
        summary.put("ongoing", ongoing);
        summary.put("completed", completed);
        response.put("summary", summary);

        return ResponseEntity.ok(response);
    }

    /**
     * Single efficient endpoint for live tracking.
     * Returns assessment info, total questions, all student statuses, and answer counts
     * in one response — optimized for low-bandwidth polling.
     */
    // no scope arg: identifies by assessmentId; scope-filter narrows access
    @PreAuthorize("@auth.allows('live_tracking.read')")
    @GetMapping("/{assessmentId}/live-tracking")
    public ResponseEntity<?> getLiveTracking(@PathVariable Long assessmentId) {
        // 1. Get the assessment
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId)
            .orElseThrow(() -> new ResourceNotFoundException("AssessmentTable", "id", assessmentId));

        // 2. Get total question count from the linked questionnaire.
        // Use a proper COUNT query instead of loading full entities with JOIN FETCHes,
        // which is faster and avoids DISTINCT/fetch-join edge cases that can under- or
        // over-count (e.g. questions with no options dropped by a stricter join).
        int totalQuestions = 0;
        if (assessment.getQuestionnaire() != null) {
            Long count = questionnaireQuestionRepository
                    .countByQuestionnaireId(assessment.getQuestionnaire().getQuestionnaireId());
            totalQuestions = count != null ? count.intValue() : 0;
        }

        // 3. Get all student mappings for this assessment
        List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                .findAllByAssessmentId(assessmentId);

        // 3a. Batch the two per-student lookups that made this endpoint O(N)
        // round-trips per poll (one Redis GET + one COUNT query per student,
        // re-run every few seconds per admin viewer):
        //   - ONE Redis MGET for every student's heartbeat
        //   - ONE grouped COUNT(DISTINCT) query for every student's answers
        List<Long> studentIds = new ArrayList<>(mappings.size());
        for (StudentAssessmentMapping mapping : mappings) {
            if (mapping.getUserStudent() != null) {
                studentIds.add(mapping.getUserStudent().getUserStudentId());
            }
        }
        Map<Long, Map<String, Object>> heartbeats =
                assessmentSessionService.getHeartbeats(studentIds, assessmentId);
        Map<Long, Long> dbAnswerCounts = new HashMap<>();
        for (Object[] row : assessmentAnswerRepository
                .countDistinctQuestionsAnsweredGroupedByStudent(assessmentId)) {
            dbAnswerCounts.put((Long) row[0], (Long) row[1]);
        }

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

            // Student name and email from StudentInfo
            StudentInfo si = us.getStudentInfo();
            entry.put("studentName", si != null ? si.getName() : "Unknown");
            entry.put("email", si != null && si.getEmail() != null ? si.getEmail() : "");
            entry.put("username",
                    si != null && si.getUser() != null && si.getUser().getUsername() != null
                            ? si.getUser().getUsername()
                            : "");
            entry.put("instituteName",
                    us.getInstitute() != null ? us.getInstitute().getInstituteName() : "");

            // Hybrid progress: Redis heartbeat when active, DB when inactive
            Map<String, Object> heartbeat = heartbeats.get(us.getUserStudentId());
            if (heartbeat != null) {
                // Student is actively giving assessment — use live Redis data
                entry.put("currentPage", heartbeat.get("page"));
                entry.put("currentSection", heartbeat.get("sectionName"));
                entry.put("currentQuestionIndex", heartbeat.get("questionIndex"));
                entry.put("lastSeen", heartbeat.get("timestamp"));
                // Cap live count at totalQuestions. The student client populates this
                // field in the heartbeat; if it ever counts option-selections (for
                // multi-select questions) instead of distinct questions, the raw value
                // can exceed totalQuestions and produce >100% in the UI.
                Object liveCountObj = heartbeat.get("answeredCount");
                long liveCount = 0L;
                if (liveCountObj instanceof Number) {
                    liveCount = ((Number) liveCountObj).longValue();
                }
                // Floor at the DB count: heartbeats from non-question pages
                // (instructions, section select) carry answeredCount=0 — without
                // this, a student's progress visibly dropped to 0% every time
                // they navigated between sections.
                Long dbFloor = dbAnswerCounts.get(us.getUserStudentId());
                if (dbFloor != null && dbFloor > liveCount) {
                    liveCount = dbFloor;
                }
                if (totalQuestions > 0 && liveCount > totalQuestions) {
                    liveCount = totalQuestions;
                }
                entry.put("answeredCount", liveCount);
                entry.put("isLive", true);
            } else {
                // Student is NOT actively giving assessment — use DB count.
                // Count DISTINCT questions, not answer rows (multi-select would over-count).
                entry.put("currentPage", null);
                Long dbCount = dbAnswerCounts.get(us.getUserStudentId());
                // Cap at totalQuestions as a safety net so the UI never shows >100%.
                long safeCount = dbCount != null ? dbCount : 0L;
                if (totalQuestions > 0 && safeCount > totalQuestions) {
                    safeCount = totalQuestions;
                }
                entry.put("answeredCount", safeCount);
                entry.put("isLive", false);
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
