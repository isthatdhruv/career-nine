package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.CounsellingPayment;
import com.kccitm.api.model.career9.counselling.CounsellingPlan;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingPaymentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingPlanRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

/**
 * Resolves which counselling track a student belongs to.
 *
 * Priority order:
 *   1. EVENT  — student's institute has an active, date-valid CounsellingPlan with sessions remaining
 *   2. PAID   — student has a confirmed (status=PAID) CounsellingPayment with sessions remaining
 *   3. REPORT — fallback: student completed an assessment but has no counselling access
 *
 * Returns a response map with: { track, action, payload }
 *   - track:   "EVENT" | "PAID" | "REPORT" | "REPORT_PENDING" | "NO_ASSESSMENT"
 *   - action:  "BOOK_COUNSELLING" | "PAY_FOR_COUNSELLING" | "WAIT_FOR_REPORT" | "TAKE_ASSESSMENT"
 *   - payload: track-specific data (plan details, sessions remaining, payment info, etc.)
 */
@Service
public class CounsellingEligibilityService {

    private static final Logger logger = LoggerFactory.getLogger(CounsellingEligibilityService.class);

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private CounsellingPlanRepository counsellingPlanRepository;

    @Autowired
    private CounsellingPaymentRepository counsellingPaymentRepository;

    @Autowired
    private GeneratedReportRepository generatedReportRepository;

    /**
     * Resolve the counselling eligibility track for a student.
     *
     * Assessment + report generation is a hard prerequisite for ALL tracks.
     * Even if a school has an EVENT plan, the student must first complete
     * the assessment and have a report generated before counselling is available.
     *
     * Priority: assessment check → report check → EVENT → PAID → REPORT
     *
     * @param userStudentId the student's ID
     * @return a map with { track, action, payload }
     */
    public Map<String, Object> resolveEligibility(Long userStudentId) {
        Map<String, Object> result = new HashMap<>();

        // 1. Validate student exists
        UserStudent student = userStudentRepository.findById(userStudentId).orElse(null);
        if (student == null) {
            result.put("track", "NO_ASSESSMENT");
            result.put("action", "TAKE_ASSESSMENT");
            result.put("payload", Map.of("message", "Student not found"));
            return result;
        }

        // Admin override — counsellingAllowed flag set via Manage Students page.
        // Must run before the assessment/report gates so admins can unblock
        // students who haven't completed the assessment flow yet.
        if (Boolean.TRUE.equals(student.getCounsellingAllowed())) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("message", "Counselling access granted by administrator.");
            result.put("track", "EVENT");
            result.put("action", "BOOK_COUNSELLING");
            result.put("payload", payload);
            logger.info("Student {} eligible via admin-granted counsellingAllowed flag", userStudentId);
            return result;
        }

        // 2. Check if student has completed at least one assessment
        List<StudentAssessmentMapping> mappings =
                studentAssessmentMappingRepository.findByUserStudentUserStudentId(userStudentId);

        boolean hasCompletedAssessment = mappings.stream()
                .anyMatch(m -> "completed".equalsIgnoreCase(m.getStatus()));

        if (!hasCompletedAssessment) {
            result.put("track", "NO_ASSESSMENT");
            result.put("action", "TAKE_ASSESSMENT");
            result.put("payload", Map.of("message", "No completed assessment found. Complete an assessment first."));
            return result;
        }

        // 3. Check if at least one report has been generated for this student
        List<GeneratedReport> reports =
                generatedReportRepository.findByUserStudentUserStudentId(userStudentId);

        if (reports.isEmpty()) {
            result.put("track", "REPORT_PENDING");
            result.put("action", "WAIT_FOR_REPORT");
            result.put("payload", Map.of(
                    "message", "Your assessment is complete. Report is being generated, please check back shortly."));
            return result;
        }

        // 4. Check EVENT track — does the student's institute have an active counselling plan?
        if (student.getInstitute() != null) {
            Integer instituteCode = student.getInstitute().getInstituteCode();
            List<CounsellingPlan> activePlans =
                    counsellingPlanRepository.findActivePlansForInstitute(instituteCode, LocalDate.now());

            if (!activePlans.isEmpty()) {
                CounsellingPlan plan = activePlans.get(0); // use the first active plan
                int sessionsRemaining = plan.getTotalSessions() - plan.getSessionsUsed();

                Map<String, Object> payload = new HashMap<>();
                payload.put("planId", plan.getId());
                payload.put("planName", plan.getPlanName());
                payload.put("sessionsRemaining", sessionsRemaining);
                payload.put("endDate", plan.getEndDate().toString());
                payload.put("instituteName", student.getInstitute().getInstituteName());

                result.put("track", "EVENT");
                result.put("action", "BOOK_COUNSELLING");
                result.put("payload", payload);

                logger.info("Student {} eligible via EVENT track (plan={})", userStudentId, plan.getId());
                return result;
            }
        }

        // 5. Check PAID track — does the student have a confirmed counselling payment with sessions left?
        List<CounsellingPayment> paidPayments =
                counsellingPaymentRepository.findByStudentUserStudentIdAndStatus(userStudentId, "PAID");

        for (CounsellingPayment payment : paidPayments) {
            if (payment.getSessionsUsed() < payment.getSessionsPurchased()) {
                int sessionsRemaining = payment.getSessionsPurchased() - payment.getSessionsUsed();

                Map<String, Object> payload = new HashMap<>();
                payload.put("paymentId", payment.getId());
                payload.put("sessionsPurchased", payment.getSessionsPurchased());
                payload.put("sessionsRemaining", sessionsRemaining);
                payload.put("paidAt", payment.getPaidAt() != null ? payment.getPaidAt().toString() : null);

                result.put("track", "PAID");
                result.put("action", "BOOK_COUNSELLING");
                result.put("payload", payload);

                logger.info("Student {} eligible via PAID track (payment={})", userStudentId, payment.getId());
                return result;
            }
        }

        // 6. Fallback — REPORT track: student has a completed assessment + report but no counselling access
        Map<String, Object> payload = new HashMap<>();
        payload.put("message", "You have access to your assessment report. Pay for a counselling session to get expert guidance.");
        payload.put("hasReport", true);

        result.put("track", "REPORT");
        result.put("action", "PAY_FOR_COUNSELLING");
        result.put("payload", payload);

        logger.info("Student {} on REPORT track (no counselling payment)", userStudentId);
        return result;
    }
}
