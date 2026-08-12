package com.kccitm.api.service.counselling;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellorAssessmentAssignment;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorAssessmentAssignmentRepository;
import com.kccitm.api.service.email.EmailDispatchService;

/**
 * Puts a student's finished report in front of the counsellor who will discuss it.
 *
 * <p>The report has always been generated and stored on completion, but only the student was
 * ever told. A counsellor walked into the session with no idea what the results said unless
 * they went hunting for them, which is the wrong way round: the report is the entire subject
 * of the conversation.
 *
 * <p>Two moments call in here, and they answer different questions:
 * <ul>
 *   <li><b>Report ready</b> — "a student you counsel for has finished; here are the results."
 *       Goes to every counsellor appointed to that assessment.</li>
 *   <li><b>Session booked</b> — handled by {@link CounsellingNotificationService}, which asks
 *       this class only for the link so it can put it in the invite.</li>
 * </ul>
 *
 * <p>Everything here is best-effort. A report email that fails must never take down report
 * generation or a booking — the student's session still stands either way.
 */
@Service
public class CounsellorReportNotificationService {

    private static final Logger logger =
            LoggerFactory.getLogger(CounsellorReportNotificationService.class);

    @Autowired
    private GeneratedReportRepository generatedReportRepository;

    @Autowired
    private CounsellorAssessmentAssignmentRepository assignmentRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private EmailDispatchService emailDispatchService;

    /**
     * The best link to this student's report for this assessment, or empty if none is ready.
     *
     * <p>PDF first: it is the thing a counsellor can save, print and read on a phone before a
     * session. The hosted HTML page is the fallback — it always exists once generation
     * succeeds, whereas the PDF render can fail on its own and leave the row link-only.
     */
    public Optional<String> reportLink(Long userStudentId, Long assessmentId) {
        if (userStudentId == null || assessmentId == null) return Optional.empty();
        try {
            List<GeneratedReport> rows = generatedReportRepository
                    .findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
            String html = null;
            for (GeneratedReport r : rows) {
                if (!"ready".equalsIgnoreCase(r.getReportStatus())) continue;
                if (r.getPdfUrl() != null && !r.getPdfUrl().isBlank()) return Optional.of(r.getPdfUrl());
                if (html == null && r.getReportUrl() != null && !r.getReportUrl().isBlank()) {
                    html = r.getReportUrl();
                }
            }
            return Optional.ofNullable(html);
        } catch (Exception e) {
            logger.warn("Could not resolve report link student={} assessment={}: {}",
                    userStudentId, assessmentId, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Tell the counsellors appointed to this assessment that a student's report is ready.
     *
     * <p>Deliberately independent of whether the STUDENT was emailed: that is governed by
     * white-labelling and a per-assessment toggle, both of which are about what the student's
     * school wants sent to the student. Neither says anything about what the counsellor
     * needs to do their job.
     *
     * @param reportUrl the hosted report link (CDN/Spaces), used in preference to a lookup
     *                  because the caller has just produced it
     */
    public void notifyCounsellorsReportReady(Long userStudentId, Long assessmentId,
                                             String reportUrl, String pdfUrl) {
        if (userStudentId == null || assessmentId == null) return;
        try {
            List<String> recipients = counsellorEmailsFor(assessmentId);
            if (recipients.isEmpty()) {
                logger.debug("Report ready but no counsellor appointed to assessment {} — nothing sent",
                        assessmentId);
                return;
            }

            String link = (pdfUrl != null && !pdfUrl.isBlank()) ? pdfUrl : reportUrl;
            if (link == null || link.isBlank()) {
                link = reportLink(userStudentId, assessmentId).orElse(null);
            }
            if (link == null) {
                logger.warn("Report ready but no link available student={} assessment={} — not mailing counsellors",
                        userStudentId, assessmentId);
                return;
            }

            String studentName = studentName(userStudentId);
            String assessmentName = assessmentName(assessmentId);

            String subject = "Report ready — " + studentName;
            String body = "Hello,\n\n"
                    + studentName + " has completed " + assessmentName + ", and the report is ready.\n\n"
                    + "  Report: " + link + "\n\n"
                    + "Please look through it before your session so you can go straight to what matters.\n\n"
                    + "Regards,\nCareer-Nine Team";

            for (String to : recipients) {
                try {
                    emailDispatchService.sendText(EmailType.REPORT_READY, to, subject, body);
                } catch (Exception e) {
                    logger.warn("Report-ready email to counsellor {} failed for student={} assessment={}: {}",
                            to, userStudentId, assessmentId, e.getMessage());
                }
            }
            logger.info("Report-ready emailed to {} counsellor(s) student={} assessment={}",
                    recipients.size(), userStudentId, assessmentId);
        } catch (Exception e) {
            // Never let this break report generation.
            logger.warn("Counsellor report-ready notification failed student={} assessment={}: {}",
                    userStudentId, assessmentId, e.getMessage());
        }
    }

    /** Active counsellor addresses for an assessment, de-duplicated. */
    public List<String> counsellorEmailsFor(Long assessmentId) {
        List<String> out = new ArrayList<>();
        if (assessmentId == null) return out;
        for (CounsellorAssessmentAssignment a : assignmentRepository.findByAssessmentId(assessmentId)) {
            if (!Boolean.TRUE.equals(a.getIsActive())) continue;
            Counsellor c = a.getCounsellor();
            if (c == null || !Boolean.TRUE.equals(c.getIsActive())) continue;
            String email = c.getEmail();
            if (email != null && !email.isBlank() && !out.contains(email.trim())) {
                out.add(email.trim());
            }
        }
        return out;
    }

    private String studentName(Long userStudentId) {
        try {
            UserStudent us = userStudentRepository.findById(userStudentId).orElse(null);
            if (us != null && us.getStudentInfo() != null && us.getStudentInfo().getName() != null) {
                return us.getStudentInfo().getName();
            }
        } catch (Exception ignored) {
            // Fall through to the id — a name we cannot read is not worth failing the email over.
        }
        return "Student " + userStudentId;
    }

    private String assessmentName(Long assessmentId) {
        try {
            return assessmentTableRepository.findById(assessmentId)
                    .map(a -> a.getAssessmentName())
                    .filter(n -> n != null && !n.isBlank())
                    .orElse("their assessment");
        } catch (Exception e) {
            return "their assessment";
        }
    }
}
