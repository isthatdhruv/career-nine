package com.kccitm.api.service.counselling;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellorAssessmentAssignment;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
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

    private static final DateTimeFormatter SESSION_DATE = DateTimeFormatter.ofPattern("d MMMM yyyy");
    private static final DateTimeFormatter SESSION_TIME = DateTimeFormatter.ofPattern("h:mm a");

    @Autowired
    private GeneratedReportRepository generatedReportRepository;

    @Autowired
    private CounsellorAssessmentAssignmentRepository assignmentRepository;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private EmailDispatchService emailDispatchService;

    /**
     * The best link to this student's report for this assessment, or empty if none exists.
     *
     * <p>PDF first: it is the thing a counsellor can save, print and read on a phone before a
     * session. The hosted HTML page is the fallback — it always exists once generation
     * succeeds, whereas the PDF render can fail on its own and leave the row link-only.
     *
     * <p>The two status columns have different vocabularies and mixing them costs the link
     * entirely: {@code report_status} is notGenerated | queued | generated | failed, while it is
     * {@code pdf_status} that reaches "ready". Testing the report row for "ready" — as this did
     * — matches no row ever written, so every counselling email quietly went out without the
     * link it was meant to carry. Each column is now read against its own vocabulary.
     */
    public Optional<String> reportLink(Long userStudentId, Long assessmentId) {
        if (userStudentId == null || assessmentId == null) return Optional.empty();
        try {
            return bestLink(generatedReportRepository
                    .findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId));
        } catch (Exception e) {
            logger.warn("Could not resolve report link student={} assessment={}: {}",
                    userStudentId, assessmentId, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * The best link to any report this student has, whatever assessment produced it.
     *
     * <p>A last resort for a session whose assessment cannot be identified — an appointment
     * booked by an admin carries no entitlement, and the entitlement is what names the
     * assessment. A student who has sat one assessment has one report, and sending it beats
     * sending a counsellor into a session with nothing.
     */
    public Optional<String> latestReportLink(Long userStudentId) {
        if (userStudentId == null) return Optional.empty();
        try {
            List<GeneratedReport> rows =
                    generatedReportRepository.findByUserStudentUserStudentId(userStudentId);
            // Newest first, so a student who has sat several assessments gets the current one.
            rows.sort(Comparator.comparing(GeneratedReport::getCreatedAt,
                    Comparator.nullsLast(Comparator.reverseOrder())));
            return bestLink(rows);
        } catch (Exception e) {
            logger.warn("Could not resolve any report link for student={}: {}", userStudentId, e.getMessage());
            return Optional.empty();
        }
    }

    /** Prefer a rendered PDF; fall back to the hosted page. Ignores rows that never generated. */
    private Optional<String> bestLink(List<GeneratedReport> rows) {
        String html = null;
        for (GeneratedReport r : rows) {
            if (!"generated".equalsIgnoreCase(r.getReportStatus())) continue;
            if ("ready".equalsIgnoreCase(r.getPdfStatus())
                    && r.getPdfUrl() != null && !r.getPdfUrl().isBlank()) {
                return Optional.of(r.getPdfUrl());
            }
            if (html == null && r.getReportUrl() != null && !r.getReportUrl().isBlank()) {
                html = r.getReportUrl();
            }
        }
        return Optional.ofNullable(html);
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
            // The link is resolved first because both notifications below need it, and they are
            // independent of each other: a student can have a session booked with a counsellor
            // who is not appointed to this assessment, and an assessment can have appointed
            // counsellors while the student has booked nothing. Returning early on either
            // condition — as this did on the first — silently dropped the other.
            String link = (pdfUrl != null && !pdfUrl.isBlank()) ? pdfUrl : reportUrl;
            if (link == null || link.isBlank()) {
                link = reportLink(userStudentId, assessmentId).orElse(null);
            }
            if (link == null) {
                logger.warn("Report ready but no link available student={} assessment={} — nothing sent",
                        userStudentId, assessmentId);
                return;
            }

            notifyAppointedCounsellors(userStudentId, assessmentId, link);
            notifyBookedSessions(userStudentId, link);
        } catch (Exception e) {
            // Never let this break report generation.
            logger.warn("Counsellor report-ready notification failed student={} assessment={}: {}",
                    userStudentId, assessmentId, e.getMessage());
        }
    }

    /** "A student you counsel for has finished" — to everyone appointed to this assessment. */
    private void notifyAppointedCounsellors(Long userStudentId, Long assessmentId, String link) {
        List<String> recipients = counsellorEmailsFor(assessmentId);
        if (recipients.isEmpty()) {
            logger.debug("Report ready but no counsellor appointed to assessment {}", assessmentId);
            return;
        }

        String studentName = studentName(userStudentId);
        String subject = "Report ready — " + studentName;
        String body = "Hello,\n\n"
                + studentName + " has completed " + assessmentName(assessmentId)
                + ", and the report is ready.\n\n"
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
    }

    /**
     * Deliver the link to any session this student already has booked — to the student, their
     * parent/guardian, and the counsellor taking it.
     *
     * <p>The booking confirmation carries the report, but only the one that existed when the
     * booking was made. A student who books before their report finishes generating — the
     * common order, since booking is the step straight after the assessment — would otherwise
     * never receive it against that session, and the counsellor appointed to a <em>different</em>
     * assessment would not be reached by the loop above at all. This closes both gaps, so a
     * booked session always ends up with its report in front of both parties.
     *
     * <p>Distinct from the block above: that one tells every counsellor appointed to the
     * assessment that a report exists, this one tells the two people with a session in the diary
     * where to find it. A counsellor who is both gets two mails, and the second is the one that
     * names the session.
     */
    private void notifyBookedSessions(Long userStudentId, String link) {
        List<CounsellingAppointment> appointments;
        try {
            appointments = appointmentRepository.findActiveByStudent(userStudentId);
        } catch (Exception e) {
            logger.warn("Could not look up booked sessions for student={}: {}", userStudentId, e.getMessage());
            return;
        }

        for (CounsellingAppointment a : appointments) {
            try {
                List<String> to = new ArrayList<>();
                String student = contactEmail(a);
                if (student != null && !student.isBlank()) to.add(student);
                if (a.getParentEmail() != null && !a.getParentEmail().isBlank()) to.add(a.getParentEmail());
                if (a.getCounsellor() != null && a.getCounsellor().getEmail() != null
                        && !a.getCounsellor().getEmail().isBlank()) {
                    to.add(a.getCounsellor().getEmail().trim());
                }
                if (to.isEmpty()) continue;

                String when = sessionWhen(a);
                String subject = "Assessment report ready for your counselling session";
                String body = "Hello,\n\n"
                        + "The assessment report for " + studentName(userStudentId)
                        + " is now ready, ahead of the counselling session"
                        + (when != null ? " on " + when : "") + ".\n\n"
                        + "  Report: " + link + "\n\n"
                        + "Please read it before the session so the time can be spent on what matters most.\n\n"
                        + "Regards,\nCareer-Nine Team";

                for (String addr : to) {
                    emailDispatchService.sendText(EmailType.REPORT_READY, addr, subject, body);
                }
                logger.info("Report link delivered to {} recipient(s) for booked session {}", to.size(), a.getId());
            } catch (Exception e) {
                // One session's email must not stop the next, nor report generation.
                logger.warn("Could not send report link for booked session {}: {}", a.getId(), e.getMessage());
            }
        }
    }

    /** The address the student gave when booking, falling back to their profile. */
    private String contactEmail(CounsellingAppointment a) {
        if (a.getStudentContactEmail() != null && !a.getStudentContactEmail().isBlank()) {
            return a.getStudentContactEmail();
        }
        try {
            return a.getStudent().getStudentInfo().getEmail();
        } catch (Exception e) {
            return null;
        }
    }

    /** "14 August 2026 at 10:30 AM", or null when the slot cannot be read. */
    private String sessionWhen(CounsellingAppointment a) {
        try {
            if (a.getSlot() == null || a.getSlot().getDate() == null) return null;
            String date = a.getSlot().getDate().format(SESSION_DATE);
            return a.getSlot().getStartTime() != null
                    ? date + " at " + a.getSlot().getStartTime().format(SESSION_TIME)
                    : date;
        } catch (Exception e) {
            return null;
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
