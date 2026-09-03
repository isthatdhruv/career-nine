package com.kccitm.api.service.counselling;

import java.time.LocalDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.model.email.EmailSendResult;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.service.b2c.ReportReleaseGate;
import com.kccitm.api.service.email.EmailDispatchService;

/**
 * The counsellor's "Send report" button.
 *
 * <p>On a tier bought with counsellor release on, nothing about the finished report is mailed
 * automatically — see {@link ReportReleaseGate}. The report is generated and stored as always,
 * and sits there until the counsellor who ran the session decides the student is ready to read
 * it. This is that decision being carried out: one email, to the student, carrying the link.
 *
 * <p>Releasing is not one-shot. A student who loses the mail, or asks for it again after the
 * session, should get it again without an admin having to intervene — so a second press
 * re-sends. {@code reportReleasedAt} records the most recent send, which is what the button
 * reads to say "Sent" rather than to lock itself.
 */
@Service
public class CounsellorReportReleaseService {

    private static final Logger logger = LoggerFactory.getLogger(CounsellorReportReleaseService.class);

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private EmailDispatchService emailDispatchService;

    /** What the counsellor is told after pressing the button. */
    public static class ReleaseOutcome {
        private final List<String> recipients;
        private final String reportLink;
        private final LocalDateTime releasedAt;

        ReleaseOutcome(List<String> recipients, String reportLink, LocalDateTime releasedAt) {
            this.recipients = recipients;
            this.reportLink = reportLink;
            this.releasedAt = releasedAt;
        }

        public List<String> getRecipients() { return recipients; }
        public String getReportLink() { return reportLink; }
        public LocalDateTime getReleasedAt() { return releasedAt; }
    }

    /**
     * Mail this session's student their assessment report.
     *
     * @throws IllegalStateException when the session is gone, the report has not generated yet,
     *                               or there is no address to write to — each said in words the
     *                               counsellor can act on, since all three are recoverable
     */
    @Transactional
    public ReleaseOutcome releaseToStudent(Long appointmentId) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new IllegalStateException("This session no longer exists."));

        String link = notificationService.bookingReportLink(appointment);
        if (link == null) {
            throw new IllegalStateException(
                    "The report is not ready yet, so there is nothing to send. Try again once it has generated.");
        }

        // The student, and nobody else. The setting exists so that results reach the student
        // only once they have been talked through, and a copy to a parent inbox at the same
        // moment would work around exactly that.
        String to = notificationService.recipientStudentEmail(appointment);
        if (to == null || to.isBlank()) {
            throw new IllegalStateException("No email address is on record for this student.");
        }

        String studentName = notificationService.recipientStudentName(appointment);
        String counsellorName = appointment.getCounsellor() != null
                ? appointment.getCounsellor().getName() : null;

        String subject = "Your assessment report is ready";
        String lead = "Your assessment report has been released"
                + (counsellorName != null && !counsellorName.isBlank() ? " by " + counsellorName : "")
                + " following your counselling session.";
        String closing = "Take your time with it, and do come back to your counsellor with anything "
                + "you would like explained further.";

        String html = CounsellingEmailHtml.page(
                "Your assessment report has been released.",
                "Your assessment report is ready",
                CounsellingEmailHtml.p("Dear " + studentName + ",")
                + CounsellingEmailHtml.p(lead)
                + CounsellingEmailHtml.actionBlock(link, "Your report", "Open my report", null)
                + CounsellingEmailHtml.small(closing)
                + CounsellingEmailHtml.signature());

        String body = "Dear " + studentName + ",\n\n"
                + lead + "\n\n"
                + "  Report: " + link + "\n\n"
                + closing + "\n\n"
                + "Regards,\nCareer-9 Team";

        EmailSendRequest req = new EmailSendRequest();
        req.setEmailType(EmailType.REPORT_READY);
        req.getTo().add(to);
        req.setSubject(subject);
        req.setHtmlContent(html);
        req.setTextContent(body);
        EmailSendResult result = emailDispatchService.send(req);
        if (result == null || !result.isSuccess()) {
            String failure = result != null ? result.getError() : null;
            throw new IllegalStateException("The email could not be sent: "
                    + (failure != null && !failure.isBlank() ? failure : "no email account is configured."));
        }

        LocalDateTime releasedAt = LocalDateTime.now();
        appointment.setReportReleasedAt(releasedAt);
        appointmentRepository.save(appointment);

        logger.info("Report released to student for appointment {} by counsellor {}",
                appointmentId, appointment.getCounsellor() != null ? appointment.getCounsellor().getId() : null);
        return new ReleaseOutcome(List.of(to), link, releasedAt);
    }
}
