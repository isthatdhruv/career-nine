package com.kccitm.api.service.counselling;

import java.time.format.DateTimeFormatter;
import java.util.List;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.Arrays;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.Notification;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;
import com.kccitm.api.repository.Career9.counselling.NotificationRepository;
import com.kccitm.api.service.SmtpEmailService;
import com.kccitm.api.model.email.EmailSendResult;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.service.email.EmailDispatchService;

@Service
public class CounsellingNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(CounsellingNotificationService.class);

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MMMM d, yyyy");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("h:mm a");

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private WhatsAppService whatsAppService;

    @Autowired
    private IcsService icsService;

    @Autowired
    private com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository studentEntitlementRepository;

    @Autowired
    private com.kccitm.api.repository.Career9.AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private CounsellorReportNotificationService counsellorReportNotificationService;

    @Autowired
    private EmailDispatchService emailDispatchService;

    /**
     * Base URL of the student-facing app, used to build absolute links in emails. Resolves
     * per profile (localhost in dev, the staging/production dashboards elsewhere), so no
     * host is ever hardcoded into a template.
     */
    @org.springframework.beans.factory.annotation.Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    /**
     * Operational counselling alerts — an unplaced session, a counsellor no-show, a disputed
     * attendance mark — go to the counselling activity feed, which is what the admin
     * Counselling Notifications page reads. No email: those alerts are for whoever is
     * watching the queue, not for a named person's inbox.
     */
    @Autowired
    private CounsellingActivityLogService activityLogService;

    // ─── In-app Notifications ────────────────────────────────────────────────────

    public void createInAppNotification(User user, String type, String title, String message,
            Long referenceId, String referenceType) {
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setReferenceId(referenceId);
        notification.setReferenceType(referenceType);
        notification.setIsRead(false);
        notificationRepository.save(notification);
    }

    public List<Notification> getNotificationsForUser(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public Long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    public void markAsRead(Long notificationId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setIsRead(true);
            notificationRepository.save(n);
        });
    }

    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.markAllReadByUserId(userId);
    }

    // ─── Email Methods ────────────────────────────────────────────────────────────

    @Async
    public void sendBookingReceivedEmail(CounsellingAppointment appointment) {
        try {
            String studentEmail = appointment.getStudent().getStudentInfo().getEmail();
            String studentName = appointment.getStudent().getStudentInfo().getName();
            String date = appointment.getSlot().getDate().format(DATE_FMT);
            String time = appointment.getSlot().getStartTime().format(TIME_FMT);
            int duration = appointment.getSlot().getDurationMinutes();

            String subject = "Counselling Request Received";
            String body = "Dear " + studentName + ",\n\n"
                    + "Your counselling request has been received and is being reviewed.\n\n"
                    + "Appointment Details:\n"
                    + "  Date: " + date + "\n"
                    + "  Time: " + time + "\n"
                    + "  Duration: " + duration + " minutes\n\n"
                    + "You will be notified once your session is confirmed.\n\n"
                    + "Regards,\nCareer-Nine Team";

            sendEmail(studentEmail, subject, body);
        } catch (Exception e) {
            logger.error("Failed to send booking received email for appointment ID: {}. Error: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    @Async
    public void sendAssignedToCounsellorEmail(CounsellingAppointment appointment) {
        try {
            String counsellorEmail = appointment.getCounsellor().getEmail();
            String counsellorName = appointment.getCounsellor().getName();
            String reason = appointment.getStudentReason();

            String subject = "New Counselling Session Assigned to You";
            String body = "Dear " + counsellorName + ",\n\n"
                    + "A new counselling session has been assigned to you.\n\n"
                    + "Session Details:\n"
                    + (reason != null && !reason.isEmpty() ? "  Reason: " + reason + "\n" : "")
                    + sessionDetailsBlock(appointment, true)
                    + "\nPlease review and confirm the appointment.\n\n"
                    + "Regards,\nCareer-Nine Team";

            sendEmail(counsellorEmail, subject, body);
        } catch (Exception e) {
            logger.error("Failed to send assigned-to-counsellor email for appointment ID: {}. Error: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    @Async
    public void sendConfirmedToStudentEmail(CounsellingAppointment appointment) {
        try {
            String studentEmail = appointment.getStudent().getStudentInfo().getEmail();
            String studentName = appointment.getStudent().getStudentInfo().getName();
            String date = appointment.getSlot().getDate().format(DATE_FMT);
            String time = appointment.getSlot().getStartTime().format(TIME_FMT);
            int duration = appointment.getSlot().getDurationMinutes();

            // Mode-aware channel line: ONLINE sessions carry the meeting link,
            // OFFLINE sessions carry the counsellor's office address.
            boolean isOffline = "OFFLINE".equals(appointment.getMode());
            String modeLine;
            String channelLine;
            if (isOffline) {
                String address = appointment.getLocation();
                modeLine = "  Mode: In-person (Offline)\n";
                channelLine = (address != null && !address.isEmpty())
                        ? "  Venue: " + address + "\n"
                        : "  Venue: Your counsellor will share the address shortly.\n";
            } else {
                String meetingLink = appointment.getMeetingLink();
                modeLine = "  Mode: Online\n";
                channelLine = (meetingLink != null && !meetingLink.isEmpty())
                        ? "  Meeting Link: " + meetingLink + "\n"
                        : "";
            }

            String subject = "Counselling Session Confirmed";
            String body = "Dear " + studentName + ",\n\n"
                    + "Your counselling session has been confirmed.\n\n"
                    + "Session Details:\n"
                    + "  Date: " + date + "\n"
                    + "  Time: " + time + "\n"
                    + "  Duration: " + duration + " minutes\n"
                    + modeLine
                    + channelLine
                    + "\nPlease be on time for your session.\n\n"
                    + "Regards,\nCareer-Nine Team";

            sendEmail(studentEmail, subject, body);
        } catch (Exception e) {
            logger.error("Failed to send confirmed-to-student email for appointment ID: {}. Error: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    @Async
    public void sendCancellationEmail(CounsellingAppointment appointment, String cancelledByName,
            String recipientEmail, String recipientName) {
        sendCancellationEmail(appointment, cancelledByName, recipientEmail, recipientName, null);
    }

    /**
     * Cancellation notice to the other party.
     *
     * <p>The {@code reason} overload exists because the reason was previously accepted by
     * {@code cancel()} and then dropped on the floor — the counsellor was told only that
     * "the session was cancelled", which tells them nothing. "Schedule clash" and "no longer
     * need the session" mean quite different things to whoever had the hour blocked out.
     */
    @Async
    public void sendCancellationEmail(CounsellingAppointment appointment, String cancelledByName,
            String recipientEmail, String recipientName, String reason) {
        try {
            if (recipientEmail == null || recipientEmail.isEmpty()) return;
            String date = appointment.getSlot().getDate().format(DATE_FMT);
            String time = appointment.getSlot().getStartTime().format(TIME_FMT);

            String subject = "Counselling Session Cancelled";
            String body = "Dear " + recipientName + ",\n\n"
                    + "Your counselling session scheduled on " + date + " at " + time
                    + " has been cancelled by " + cancelledByName + ".\n\n"
                    + (reason != null && !reason.isEmpty() ? "Reason given: " + reason + "\n\n" : "")
                    + "If you have any questions, please contact us.\n\n"
                    + "Regards,\nCareer-Nine Team";

            sendEmail(recipientEmail, subject, body);
        } catch (Exception e) {
            logger.error("Failed to send cancellation email for appointment ID: {}. Error: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    /**
     * Sent when a counsellor goes on leave and no replacement was available, so
     * the student's session has been cancelled. Asks the student to rebook.
     * Used by the block-date-request approval flow (item 6 fallback path).
     */
    @Async
    public void sendCounsellorLeaveCancellationEmail(CounsellingAppointment appointment) {
        try {
            String studentEmail = appointment.getStudent().getStudentInfo().getEmail();
            String studentName = appointment.getStudent().getStudentInfo().getName();
            String date = appointment.getSlot().getDate().format(DATE_FMT);
            String time = appointment.getSlot().getStartTime().format(TIME_FMT);
            String counsellorName = appointment.getCounsellor() != null
                    ? appointment.getCounsellor().getName()
                    : "your counsellor";

            String subject = "Counselling Session Cancelled — Please Rebook";
            String body = "Dear " + studentName + ",\n\n"
                    + "Unfortunately, " + counsellorName + " is on leave on "
                    + date + ", and no other counsellor was available at "
                    + time + ".\n\n"
                    + "Your session has been cancelled.\n\n"
                    // Nothing here is the student's doing, so this never touches her free
                    // changes and rescheduling is always open to her — no allowance check.
                    + "Pick a new time at no cost — open Counselling, go to Past Sessions and "
                    + "press Reschedule:\n" + portalCounsellingUrl() + "\n\n"
                    + "This cancellation does not count against your free changes.\n\n"
                    + "We apologise for the inconvenience.\n\n"
                    + "Regards,\nCareer-Nine Team";

            sendEmail(studentEmail, subject, body);
        } catch (Exception e) {
            logger.error("Failed to send counsellor-leave cancellation email for appointment ID: {}. Error: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    /**
     * Counsellor-absence self-reschedule: the student's counsellor is unavailable, so instead of a
     * dead-end cancellation we email a tokenized link to a no-login page where the student picks a
     * new slot with any available counsellor. Sent via Gmail like all counselling mail.
     */
    @Async
    public void sendSelfRescheduleEmail(CounsellingAppointment appointment, String rescheduleUrl) {
        try {
            String studentName = studentName(appointment);
            String studentEmail = studentEmail(appointment);
            if (studentEmail == null || studentEmail.isEmpty()) {
                logger.warn("No student email for appointment {} — cannot send self-reschedule link",
                        appointment != null ? appointment.getId() : "null");
                return;
            }
            String counsellorName = appointment.getCounsellor() != null
                    && appointment.getCounsellor().getName() != null
                    ? appointment.getCounsellor().getName() : "Your counsellor";
            String when = "";
            if (appointment.getSlot() != null) {
                when = " on " + appointment.getSlot().getDate().format(DATE_FMT)
                        + " at " + appointment.getSlot().getStartTime().format(TIME_FMT);
            }

            String subject = "Reschedule your counselling session";
            String body = "Dear " + studentName + ",\n\n"
                    + counsellorName + " is no longer available for your counselling session" + when + ".\n\n"
                    + "Your session has NOT been cancelled — please pick a new slot that suits you here:\n"
                    + rescheduleUrl + "\n\n"
                    + "Once you choose a time, your session is confirmed instantly and you'll get a "
                    + "confirmation with the meeting details.\n\n"
                    + "We're sorry for the inconvenience.\n\n"
                    + "Regards,\nCareer-Nine Team";

            sendEmail(studentEmail, subject, body);
        } catch (Exception e) {
            logger.error("Failed to send self-reschedule email for appointment ID: {}. Error: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    @Async
    public void sendRescheduleEmail(CounsellingAppointment oldAppointment, CounsellingAppointment newAppointment) {
        try {
            String studentEmail = newAppointment.getStudent().getStudentInfo().getEmail();
            String studentName = newAppointment.getStudent().getStudentInfo().getName();

            String oldDate = oldAppointment.getSlot().getDate().format(DATE_FMT);
            String oldTime = oldAppointment.getSlot().getStartTime().format(TIME_FMT);

            String subject = "Counselling Session Rescheduled";
            // The new session is described in full — school, assessment, venue/link and the
            // report — because a reschedule replaces the confirmation the student was working
            // from. Telling them only the new date and time would leave the report link
            // stranded in a mail about a session that no longer happens.
            String body = "Dear " + studentName + ",\n\n"
                    + "Your counselling session has been rescheduled.\n\n"
                    + "Previous Schedule:\n"
                    + "  Date: " + oldDate + "\n"
                    + "  Time: " + oldTime + "\n\n"
                    + "New Schedule:\n"
                    + sessionDetailsBlock(newAppointment, false)
                    + "\nPlease update your calendar accordingly.\n\n"
                    + "Regards,\nCareer-Nine Team";

            sendEmail(studentEmail, subject, body);
            // The counsellor is on the new session too — they were told about the original
            // and would otherwise be left holding a time that has moved.
            if (newAppointment.getCounsellor() != null) {
                String counsellorEmail = newAppointment.getCounsellor().getEmail();
                if (counsellorEmail != null && !counsellorEmail.isBlank()) {
                    sendEmail(counsellorEmail, subject,
                            "Dear " + newAppointment.getCounsellor().getName() + ",\n\n"
                            + "A counselling session has been rescheduled.\n\n"
                            + "Previous Schedule:\n"
                            + "  Date: " + oldDate + "\n"
                            + "  Time: " + oldTime + "\n\n"
                            + "New Schedule:\n"
                            + sessionDetailsBlock(newAppointment, true)
                            + "\nRegards,\nCareer-Nine Team");
                }
            }
        } catch (Exception e) {
            logger.error("Failed to send reschedule email for appointment ID: {}. Error: {}",
                    newAppointment != null ? newAppointment.getId() : "null", e.getMessage());
        }
    }

    @Async
    public void sendReminderEmail(CounsellingAppointment appointment, String period) {
        try {
            // Date, time, duration and the mode-aware venue/meeting line all come from
            // sessionDetailsBlock, which both copies below share.

            // Send to student
            String studentEmail = appointment.getStudent().getStudentInfo().getEmail();
            String studentName = appointment.getStudent().getStudentInfo().getName();
            String studentSubject = "Reminder: Counselling Session in " + period;
            // The reminder is the last email before the session, so it is the one that most
            // needs the report link — this is the moment either side would actually open it.
            String studentBody = "Dear " + studentName + ",\n\n"
                    + "This is a reminder that your counselling session is scheduled in " + period + ".\n\n"
                    + "Session Details:\n"
                    + sessionDetailsBlock(appointment, false)
                    + "\nPlease be prepared for your session.\n\n"
                    + "Regards,\nCareer-Nine Team";
            sendEmail(studentEmail, studentSubject, studentBody);
            // Parent/guardian copy, if one was provided at booking.
            String parentEmail = appointment.getParentEmail();
            if (parentEmail != null && !parentEmail.isEmpty()) {
                sendEmail(parentEmail, studentSubject, studentBody);
            }

            // Send to counsellor
            if (appointment.getCounsellor() != null) {
                String counsellorEmail = appointment.getCounsellor().getEmail();
                String counsellorName = appointment.getCounsellor().getName();
                String counsellorSubject = "Reminder: Counselling Session in " + period;
                String counsellorBody = "Dear " + counsellorName + ",\n\n"
                        + "This is a reminder that you have a counselling session in " + period + ".\n\n"
                        + "Session Details:\n"
                        + sessionDetailsBlock(appointment, true)
                        + "\nRegards,\nCareer-Nine Team";
                sendEmail(counsellorEmail, counsellorSubject, counsellorBody);
            }
        } catch (Exception e) {
            logger.error("Failed to send reminder email for appointment ID: {}. Error: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    @Async
    public void sendSessionCompleteEmail(CounsellingAppointment appointment) {
        try {
            String studentEmail = appointment.getStudent().getStudentInfo().getEmail();
            String studentName = appointment.getStudent().getStudentInfo().getName();
            String date = appointment.getSlot().getDate().format(DATE_FMT);

            String subject = "Session Complete \u2014 View Counsellor Remarks";
            String body = "Dear " + studentName + ",\n\n"
                    + "Your counselling session on " + date + " has been completed.\n\n"
                    + "Your counsellor has added remarks for this session. Please log in to Career-Nine "
                    + "to view your session notes and any recommendations.\n\n"
                    + "Regards,\nCareer-Nine Team";

            sendEmail(studentEmail, subject, body);
        } catch (Exception e) {
            logger.error("Failed to send session-complete email for appointment ID: {}. Error: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    // ─── Admin-triggered session emails (Manage Sessions) ────────────────────────
    //
    // Every other email in this class fires off the back of an event. These two are sent
    // because an admin pressed a button — a student who lost the confirmation, a counsellor
    // who wants the report in front of them again. They are therefore SYNCHRONOUS and they
    // throw: the admin is watching the result, and "sent" printed over a silent failure is
    // worse than an error. Both draw on the same session description as the automatic mail,
    // so a resend says exactly what the original did, report link included.
    //
    // What they can promise is acceptance, not delivery: COUNSELLING_NOTIFICATION is an ASYNC
    // type, so the dispatcher queues the message and the terminal status lands in
    // email_send_log. A rejected send — no configured account, no recipient — comes back
    // unsuccessful here and is raised; the dialog says "queued" rather than "delivered".

    /**
     * Send one session's details, with the student's assessment report, to the student and
     * their parent/guardian.
     *
     * @return the addresses written to
     * @throws IllegalStateException when no address is on record
     */
    public List<String> sendSessionSummaryToStudent(CounsellingAppointment appointment) {
        List<String> recipients = studentAndParentEmails(appointment);
        if (recipients.isEmpty()) {
            throw new IllegalStateException("No email address is on record for this student.");
        }

        String counsellorName = appointment.getCounsellor() != null
                ? appointment.getCounsellor().getName() : null;
        String subject = "Your counselling session — details and assessment report";
        String body = "Dear " + studentName(appointment) + ",\n\n"
                + "Please find below the details of your counselling session"
                + (counsellorName != null && !counsellorName.isBlank() ? " with " + counsellorName : "")
                + ".\n\n"
                + sessionDetailsBlock(appointment, false)
                + "\n"
                + reportGuidance(appointment, false)
                + "If any of the above is incorrect, please write to us before the session so we can "
                + "put it right.\n\n"
                + "Regards,\nCareer-Nine Team";

        List<String> accepted = new java.util.ArrayList<>();
        String failure = null;
        for (String addr : recipients) {
            EmailSendResult result = emailDispatchService.sendText(
                    EmailType.COUNSELLING_NOTIFICATION, addr, subject, body);
            if (result != null && result.isSuccess()) accepted.add(addr);
            else if (failure == null && result != null) failure = result.getError();
        }
        if (accepted.isEmpty()) {
            throw new IllegalStateException("The email could not be sent: "
                    + (failure != null && !failure.isBlank() ? failure : "no email account is configured."));
        }
        logger.info("Manage Sessions: session summary queued to student for appointment {}", appointment.getId());
        return accepted;
    }

    /**
     * Send one session's details, with the student's assessment report, to the counsellor
     * taking it.
     *
     * @return the address written to
     * @throws IllegalStateException when the session has no counsellor, or none with an address
     */
    public String sendSessionSummaryToCounsellor(CounsellingAppointment appointment) {
        Counsellor counsellor = appointment.getCounsellor();
        if (counsellor == null) {
            throw new IllegalStateException("No counsellor is assigned to this session.");
        }
        String to = counsellor.getEmail();
        if (to == null || to.isBlank()) {
            throw new IllegalStateException("No email address is on record for this counsellor.");
        }

        String subject = "Counselling session — " + studentName(appointment);
        String body = "Dear " + counsellor.getName() + ",\n\n"
                + "Please find below the details of your counselling session with "
                + studentName(appointment) + ".\n\n"
                + sessionDetailsBlock(appointment, true)
                + "\n"
                + reportGuidance(appointment, true)
                + "Regards,\nCareer-Nine Team";

        EmailSendResult result = emailDispatchService.sendText(
                EmailType.COUNSELLING_NOTIFICATION, to, subject, body);
        if (result == null || !result.isSuccess()) {
            String failure = result != null ? result.getError() : null;
            throw new IllegalStateException("The email could not be sent: "
                    + (failure != null && !failure.isBlank() ? failure : "no email account is configured."));
        }
        logger.info("Manage Sessions: session summary queued to counsellor for appointment {}", appointment.getId());
        return to;
    }

    /**
     * The paragraph that follows the details block, which depends on whether there is a report
     * to point at. Saying "the report is attached above" when the line is absent — because the
     * student has not finished the assessment, or generation has not completed — would send the
     * reader looking for something that is not there.
     */
    private String reportGuidance(CounsellingAppointment appointment, boolean forCounsellor) {
        boolean hasReport = bookingReportLink(appointment) != null;
        if (!hasReport) {
            return forCounsellor
                    ? "The assessment report is not available yet. It will be sent to you as soon as it is ready.\n\n"
                    : "Your assessment report is not available yet. We will send it to you as soon as it is ready.\n\n";
        }
        return forCounsellor
                ? "The assessment report is linked above. Please read it before the session so the "
                  + "time can be spent on what matters most to the student.\n\n"
                : "Your assessment report is linked above. Please read it before the session so you "
                  + "can bring any questions with you.\n\n";
    }

    // ─── Block Date Request Email ────────────────────────────────────────────────

    @Async
    public void sendBlockDateRequestEmail(com.kccitm.api.model.career9.counselling.Counsellor counsellor, String date, String reason) {
        String adminEmail = "admin@career-9.net";
        String subject = "Block Date Request — " + counsellor.getName();

        String body = "Dear Admin,\n\n"
                + "A counsellor has requested to block a date.\n\n"
                + "────────────────────────────\n"
                + "Counsellor: " + counsellor.getName() + "\n"
                + "Email: " + counsellor.getEmail() + "\n"
                + "Date to Block: " + date + "\n"
                + "Reason: " + (reason != null && !reason.isEmpty() ? reason : "Not specified") + "\n"
                + "────────────────────────────\n\n"
                + "Please log in to the Career-9 admin panel to approve or reject this request.\n"
                + "Go to: Manage Counsellors → Block Date Requests\n\n"
                + "Regards,\n"
                + "Career-9 System";

        sendEmail(adminEmail, subject, body);
        logger.info("Block date request email sent to admin for counsellor {} on date {}", counsellor.getName(), date);
    }

    /**
     * The school this student belongs to, or null when we cannot read it.
     *
     * <p>Worth stating in a session email: a counsellor covering several schools needs it to
     * place the student, and a student receiving mail from a platform they used once needs it
     * to recognise what the mail is even about.
     */
    public String instituteNameFor(CounsellingAppointment appointment) {
        try {
            if (appointment.getStudent() == null || appointment.getStudent().getInstitute() == null) {
                return null;
            }
            String name = appointment.getStudent().getInstitute().getInstituteName();
            return (name != null && !name.isBlank()) ? name : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** The assessment this session was booked against, resolved through the entitlement. */
    private Long assessmentIdFor(CounsellingAppointment appointment) {
        try {
            if (appointment.getEntitlementId() == null) return null;
            return studentEntitlementRepository.findById(appointment.getEntitlementId())
                    .map(e -> e.getAssessmentId())
                    .orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    public String assessmentNameFor(CounsellingAppointment appointment) {
        try {
            Long assessmentId = assessmentIdFor(appointment);
            if (assessmentId == null) return null;
            return assessmentTableRepository.findById(assessmentId)
                    .map(a -> a.getAssessmentName())
                    .filter(n -> n != null && !n.isBlank())
                    .orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * The full picture of one session, as indented "  Label: value" lines.
     *
     * <p>Every counselling email used to carry its own hand-built subset — one had the date
     * and time, another added the venue, none named the school or the assessment — so what a
     * recipient was told depended on which email happened to reach them. This is the single
     * description they all draw from, so a reminder says as much as a confirmation does.
     *
     * <p>Lines whose value cannot be resolved are left out rather than printed empty: an
     * appointment created by an admin may have no entitlement, and therefore no assessment.
     *
     * @param includeStudent true for the counsellor's copy, which needs to know who is coming;
     *                       false for the student's own, where naming them back at themselves
     *                       adds nothing
     */
    private String sessionDetailsBlock(CounsellingAppointment appointment, boolean includeStudent) {
        StringBuilder sb = new StringBuilder();
        try {
            if (includeStudent && appointment.getStudent() != null
                    && appointment.getStudent().getStudentInfo() != null) {
                String name = appointment.getStudent().getStudentInfo().getName();
                if (name != null && !name.isBlank()) sb.append("  Student: ").append(name).append("\n");
            }
            String school = instituteNameFor(appointment);
            if (school != null) sb.append("  School: ").append(school).append("\n");

            String assessment = assessmentNameFor(appointment);
            if (assessment != null) sb.append("  Assessment: ").append(assessment).append("\n");

            if (appointment.getSlot() != null) {
                if (appointment.getSlot().getDate() != null) {
                    sb.append("  Date: ").append(appointment.getSlot().getDate().format(DATE_FMT)).append("\n");
                }
                if (appointment.getSlot().getStartTime() != null) {
                    sb.append("  Time: ").append(appointment.getSlot().getStartTime().format(TIME_FMT)).append("\n");
                }
                if (appointment.getSlot().getDurationMinutes() > 0) {
                    sb.append("  Duration: ").append(appointment.getSlot().getDurationMinutes())
                      .append(" minutes\n");
                }
            }
            if (!includeStudent && appointment.getCounsellor() != null
                    && appointment.getCounsellor().getName() != null) {
                sb.append("  Counsellor: ").append(appointment.getCounsellor().getName()).append("\n");
            }
            sb.append("  Mode: ").append("OFFLINE".equals(appointment.getMode()) ? "In-person" : "Online").append("\n");
            sb.append("  ").append(attendanceLine(appointment)).append("\n");

            // Always stated, never dropped. A silently missing report line reads as "there is
            // no report to see" to a student and as "nobody sent me one" to a counsellor, and
            // both then go looking. Saying it is still being prepared answers the question.
            String report = bookingReportLink(appointment);
            sb.append("  Assessment report: ")
              .append(report != null ? report : "being prepared — we will email it as soon as it is ready")
              .append("\n");
        } catch (Exception e) {
            logger.warn("Could not build session details for appointment {}: {}",
                    appointment != null ? appointment.getId() : null, e.getMessage());
        }
        return sb.toString();
    }

    /**
     * One activity-feed entry, as labelled lines: who and when first, then whatever the
     * event itself needs to add.
     *
     * <p>The feed is scanned rather than read. Prose put the student in a different position
     * on every row and buried the date mid-sentence, so finding "the Greenwood booking on
     * Tuesday" meant reading every entry in full. Fixed labels let the eye run down one
     * column. Lines that cannot be resolved are dropped rather than printed empty.
     */
    private String feedLines(CounsellingAppointment appointment, String... extra) {
        StringBuilder sb = new StringBuilder();
        try {
            String student = studentName(appointment);
            if (student != null && !student.isBlank()) sb.append("Student: ").append(student).append("\n");

            String school = instituteNameFor(appointment);
            if (school != null) sb.append("Institute: ").append(school).append("\n");

            if (appointment != null && appointment.getSlot() != null) {
                if (appointment.getSlot().getDate() != null) {
                    sb.append("Date: ").append(appointment.getSlot().getDate().format(DATE_FMT)).append("\n");
                }
                if (appointment.getSlot().getStartTime() != null) {
                    sb.append("Time: ").append(appointment.getSlot().getStartTime().format(TIME_FMT)).append("\n");
                }
            }
        } catch (Exception e) {
            logger.warn("Could not build feed lines for appointment {}: {}",
                    appointment != null ? appointment.getId() : null, e.getMessage());
        }
        if (extra != null) {
            for (String line : extra) {
                if (line != null && !line.isBlank()) sb.append(line).append("\n");
            }
        }
        return sb.toString().trim();
    }

    /**
     * The student's report for the assessment this session was booked against, or null.
     *
     * <p>The appointment does not carry an assessment id — it carries the entitlement the
     * booking was paid for, and the entitlement is what names the assessment. Anything
     * missing along that chain (no entitlement on a manually created appointment, report not
     * generated yet) simply means no link, and the invite goes out without that line rather
     * than not at all.
     *
     * <p>Public so the Manage Sessions list can tell the admin, per session, whether there is a
     * report to send before they press the button — resolved the one way, here, rather than by
     * a second implementation that could drift from what the emails actually carry.
     */
    public String bookingReportLink(CounsellingAppointment appointment) {
        try {
            if (appointment.getStudent() == null) return null;
            Long studentId = appointment.getStudent().getUserStudentId();

            Long assessmentId = assessmentIdFor(appointment);
            if (assessmentId != null) {
                // The assessment is known, so its report is the only correct one. If it has not
                // generated yet the answer is "not yet" — substituting another assessment's
                // report would put the wrong results in front of the counsellor.
                return counsellorReportNotificationService.reportLink(studentId, assessmentId)
                        .orElse(null);
            }

            // No entitlement, so nothing names the assessment — an admin-created booking never
            // has one, and would otherwise never carry a link at all. Fall back to whatever
            // report this student does have.
            return counsellorReportNotificationService.latestReportLink(studentId).orElse(null);
        } catch (Exception e) {
            logger.warn("Could not resolve report link for appointment {}: {}",
                    appointment.getId(), e.getMessage());
            return null;
        }
    }

    // ─── Channel-aware dispatch (WhatsApp primary, email fallback) ─────────────────

    /**
     * Confirmation to the student: always emails (so the .ics calendar invite
     * lands on their calendar) and additionally attempts a WhatsApp confirmation.
     * Used at booking time in place of {@link #sendConfirmedToStudentEmail}.
     */
    @Async
    public void sendConfirmationWithCalendar(CounsellingAppointment appointment) {
        try {
            String studentName = studentName(appointment);
            String studentEmail = studentEmail(appointment);

            // Date, time, venue/meeting link and the report link all come from
            // sessionDetailsBlock now, so this method no longer formats its own.
            String subject = "Counselling Session Confirmed";
            // Phase 6: one-click "Add to Google Calendar" link (no API/OAuth needed) in
            // addition to the attached .ics invite.
            String gcal = googleCalendarLink(appointment);
            // One email reaches the student, the parent and the counsellor, so it names the
            // student — the counsellor's copy is useless without it, and the other two are
            // not confused by seeing it.
            String body = "Dear " + studentName + ",\n\n"
                    + "Your counselling session has been confirmed.\n\n"
                    + "Session Details:\n"
                    + sessionDetailsBlock(appointment, true)
                    + "\n"
                    + (gcal != null ? "Add to Google Calendar: " + gcal + "\n\n" : "")
                    + "A calendar invite is also attached so you can add this to any calendar.\n\n"
                    + "Regards,\nCareer-Nine Team";

            // Recipients: the student, the parent/guardian if one was given, and the
            // counsellor taking the session — they need the same calendar entry on their own
            // calendar, and the report link above.
            String parentEmail = appointment.getParentEmail();
            java.util.List<String> emailTo = new java.util.ArrayList<>();
            if (studentEmail != null && !studentEmail.isEmpty()) emailTo.add(studentEmail);
            if (parentEmail != null && !parentEmail.isEmpty()) emailTo.add(parentEmail);
            String counsellorEmail = appointment.getCounsellor() != null
                    ? appointment.getCounsellor().getEmail() : null;
            if (counsellorEmail != null && !counsellorEmail.isBlank()) {
                if (!emailTo.contains(counsellorEmail.trim())) emailTo.add(counsellorEmail.trim());
            } else {
                // The counsellor is a required recipient of this email, so failing to reach one
                // is worth a line in the log rather than a silent short list. Nothing else can
                // be done here: an appointment with no counsellor, or a counsellor with no
                // address, is a data problem for an admin to fix.
                logger.warn("Booking confirmation for appointment {} has no counsellor address to send to",
                        appointment.getId());
            }

            // Email with .ics attachment (falls back to plain text if
            // the Gmail sender or the invite isn't available).
            byte[] ics = icsService.buildInvite(appointment);
            boolean emailed = false;
            if (!emailTo.isEmpty() && ics != null) {
                try {
                    SmtpEmailRequest req = new SmtpEmailRequest();
                    req.setTo(emailTo);
                    req.setSubject(subject);
                    req.setHtmlContent("<pre style=\"font-family:inherit\">" + body + "</pre>");
                    req.setFromName("Career-9");
                    req.setFromEmail("notifications@career-9.net");
                    req.setAttachments(Arrays.asList(
                            new SmtpEmailRequest.EmailAttachment(
                                    icsService.fileName(appointment), ics, "text/calendar")));
                    emailDispatchService.send(EmailType.COUNSELLING_BOOKING, req, null);
                    emailed = true;
                } catch (Exception e) {
                    logger.warn("ICS confirmation email failed for appointment {}: {}", appointment.getId(), e.getMessage());
                }
            }
            if (!emailed) {
                for (String addr : emailTo) sendEmail(addr, subject, body); // plain fallback, no attachment
            }

            // Best-effort WhatsApp confirmation in addition to the email — to the
            // student and, if provided, the parent/guardian number.
            // WhatsApp templates take positional parameters, so these stay formatted here
            // rather than coming from the email block.
            String waWhen = appointment.getSlot().getDate().format(DATE_FMT)
                    + " " + appointment.getSlot().getStartTime().format(TIME_FMT);
            java.util.List<String> waParams = Arrays.asList(studentName, waWhen,
                    "OFFLINE".equals(appointment.getMode()) ? "In-person" : "Online");
            whatsAppService.sendTemplate(studentPhone(appointment), whatsAppService.confirmationCampaign(), waParams);
            String parentPhone = appointment.getParentPhone();
            if (parentPhone != null && !parentPhone.isEmpty()) {
                whatsAppService.sendTemplate(parentPhone, whatsAppService.confirmationCampaign(), waParams);
            }
        } catch (Exception e) {
            logger.error("Failed to send confirmation for appointment {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    /**
     * Reminder to the student via WhatsApp; falls back to email if WhatsApp
     * isn't configured or the send fails. {@code whenLabel} is e.g. "in 12 hours".
     */
    @Async
    public void notifyStudentReminder(CounsellingAppointment appointment, String whenLabel) {
        String date = appointment.getSlot().getDate().format(DATE_FMT);
        String time = appointment.getSlot().getStartTime().format(TIME_FMT);
        // Phase 5: mode-aware — append the meeting link (online) or venue (offline)
        // to the date/time parameter so the reminder tells the student how to attend.
        java.util.List<String> waParams = Arrays.asList(studentName(appointment), whenLabel,
                date + " " + time + " — " + attendanceLine(appointment));
        boolean sent = whatsAppService.sendTemplate(
                studentPhone(appointment), whatsAppService.reminderCampaign(), waParams);
        // Parent/guardian WhatsApp reminder, if a number was provided at booking.
        String parentPhone = appointment.getParentPhone();
        if (parentPhone != null && !parentPhone.isEmpty()) {
            whatsAppService.sendTemplate(parentPhone, whatsAppService.reminderCampaign(), waParams);
        }
        if (!sent) {
            sendReminderEmail(appointment, whenLabel);
        }
    }

    /** Reminder to the counsellor via WhatsApp; email fallback. */
    @Async
    public void notifyCounsellorReminder(CounsellingAppointment appointment, String whenLabel) {
        if (appointment.getCounsellor() == null) return;
        String date = appointment.getSlot().getDate().format(DATE_FMT);
        String time = appointment.getSlot().getStartTime().format(TIME_FMT);
        boolean sent = whatsAppService.sendTemplate(
                appointment.getCounsellor().getPhone(), whatsAppService.reminderCampaign(),
                Arrays.asList(appointment.getCounsellor().getName(), whenLabel,
                        date + " " + time + " — " + attendanceLine(appointment)));
        if (!sent) {
            String subject = "Reminder: Counselling Session " + whenLabel;
            String body = "Dear " + appointment.getCounsellor().getName() + ",\n\n"
                    + "You have a counselling session " + whenLabel + " with "
                    + studentName(appointment) + ".\n\n"
                    + "  Date: " + date + "\n"
                    + "  Time: " + time + "\n"
                    + "  " + attendanceLine(appointment) + "\n\n"
                    + "Regards,\nCareer-Nine Team";
            sendEmail(appointment.getCounsellor().getEmail(), subject, body);
        }
    }

    /**
     * Phase 6: build a one-click "Add to Google Calendar" template URL (no API/OAuth).
     * Times are converted from IST (Asia/Kolkata) to the UTC instants Google expects.
     * Returns null if the slot data is incomplete.
     */
    private String googleCalendarLink(CounsellingAppointment a) {
        try {
            if (a.getSlot() == null || a.getSlot().getDate() == null
                    || a.getSlot().getStartTime() == null || a.getSlot().getEndTime() == null) return null;
            java.time.ZoneId ist = java.time.ZoneId.of("Asia/Kolkata");
            java.time.format.DateTimeFormatter f =
                    java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");
            String start = java.time.ZonedDateTime.of(a.getSlot().getDate(), a.getSlot().getStartTime(), ist)
                    .withZoneSameInstant(java.time.ZoneOffset.UTC).format(f);
            String end = java.time.ZonedDateTime.of(a.getSlot().getDate(), a.getSlot().getEndTime(), ist)
                    .withZoneSameInstant(java.time.ZoneOffset.UTC).format(f);
            boolean offline = "OFFLINE".equals(a.getMode());
            String location = offline
                    ? (a.getLocation() != null ? a.getLocation() : "")
                    : (a.getMeetingLink() != null ? a.getMeetingLink() : "");
            return "https://calendar.google.com/calendar/render?action=TEMPLATE"
                    + "&text=" + java.net.URLEncoder.encode("Career-9 Counselling Session", "UTF-8")
                    + "&dates=" + start + "/" + end
                    + "&details=" + java.net.URLEncoder.encode(attendanceLine(a), "UTF-8")
                    + "&location=" + java.net.URLEncoder.encode(location, "UTF-8");
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Phase 5: mode-aware "how to attend" line for reminders — the meeting link for
     * ONLINE sessions, the venue/office address for OFFLINE ones, with safe fallbacks.
     */
    private String attendanceLine(CounsellingAppointment a) {
        if ("OFFLINE".equals(a.getMode())) {
            String loc = a.getLocation();
            return (loc != null && !loc.isEmpty())
                    ? "Venue: " + loc
                    : "Venue: your counsellor will share the address shortly";
        }
        String link = a.getMeetingLink();
        return (link != null && !link.isEmpty())
                ? "Join online: " + link
                : "Join online: the meeting link will be shared before the session";
    }

    /**
     * 8pm day-before digest to a counsellor listing the next day's sessions.
     * Emails the full list and sends a short WhatsApp summary.
     */
    @Async
    public void sendCounsellorDailyDigest(Counsellor counsellor, List<CounsellingAppointment> appointments, String dateLabel) {
        if (counsellor == null || appointments == null || appointments.isEmpty()) return;
        StringBuilder list = new StringBuilder();
        int i = 1;
        for (CounsellingAppointment a : appointments) {
            String time = a.getSlot().getStartTime().format(TIME_FMT);
            String mode = "OFFLINE".equals(a.getMode()) ? "In-person" : "Online";
            list.append("  ").append(i++).append(". ").append(time)
                    .append(" — ").append(studentName(a))
                    .append(" (").append(mode).append(")\n");
        }
        String subject = "Your counselling sessions for " + dateLabel + " (" + appointments.size() + ")";
        String body = "Dear " + counsellor.getName() + ",\n\n"
                + "Here are your counselling sessions scheduled for " + dateLabel + ":\n\n"
                + list + "\nPlease be available on time.\n\nRegards,\nCareer-Nine Team";
        sendEmail(counsellor.getEmail(), subject, body);
        whatsAppService.sendTemplate(counsellor.getPhone(), whatsAppService.counsellorDigestCampaign(),
                Arrays.asList(counsellor.getName(), dateLabel, String.valueOf(appointments.size())));
    }

    /**
     * "You still have counselling session(s) to book" nudge — WhatsApp primary,
     * email fallback, plus an in-app notification when a userId is available.
     */
    @Async
    public void sendCounsellingBookingNudge(String name, String email, String phone,
            Long userId, int sessionsRemaining) {
        String safeName = (name != null && !name.isEmpty()) ? name : "there";
        boolean sent = whatsAppService.sendTemplate(phone, whatsAppService.bookingNudgeCampaign(),
                Arrays.asList(safeName, String.valueOf(sessionsRemaining)));
        if (!sent && email != null && !email.isEmpty()) {
            String subject = "You have a counselling session waiting to be booked";
            String body = "Dear " + safeName + ",\n\n"
                    + "You have " + sessionsRemaining + " counselling session"
                    + (sessionsRemaining == 1 ? "" : "s")
                    + " included in your plan that "
                    + (sessionsRemaining == 1 ? "hasn't" : "haven't") + " been booked yet.\n\n"
                    + "Log in to Career-9 and pick a time that works for you to speak with a counsellor.\n\n"
                    + "Regards,\nCareer-Nine Team";
            sendEmail(email, subject, body);
        }
        if (userId != null) {
            try {
                User u = new User();
                u.setId(userId);
                createInAppNotification(u, "COUNSELLING_NUDGE",
                        "Book your counselling session",
                        "You have " + sessionsRemaining + " counselling session"
                                + (sessionsRemaining == 1 ? "" : "s") + " left to book.",
                        null, "ENTITLEMENT");
            } catch (Exception e) {
                logger.warn("Failed to create counselling-nudge in-app notification for user {}: {}", userId, e.getMessage());
            }
        }
    }

    /**
     * No-show notice (Counselling Phase 2): sent when a session's slot end time passes
     * without the student ever checking in via OTP. Emails the student that they didn't
     * attend and invites them to book a new session, plus an in-app notification.
     * WhatsApp is attempted best-effort via the booking-nudge campaign.
     */
    @Async
    public void notifyStudentNoShow(CounsellingAppointment appointment) {
        try {
            String name = studentName(appointment);
            String email = studentEmail(appointment);
            String date = appointment.getSlot().getDate().format(DATE_FMT);
            String time = appointment.getSlot().getStartTime().format(TIME_FMT);

            // Best-effort WhatsApp (re-uses the booking-nudge template: name + a "1" count).
            whatsAppService.sendTemplate(studentPhone(appointment), whatsAppService.bookingNudgeCampaign(),
                    Arrays.asList(name, "1"));

            if (email != null && !email.isEmpty()) {
                String subject = "You missed your counselling session";
                String body = "Dear " + name + ",\n\n"
                        + "We noticed you didn't attend your counselling session scheduled on "
                        + date + " at " + time + ".\n\n"
                        + "If you'd still like to speak with a counsellor, log in to Career-9 and book "
                        + "a new session at a time that works for you.\n\n"
                        + "Regards,\nCareer-Nine Team";
                sendEmail(email, subject, body);
            }

            try {
                Long userId = appointment.getStudent() != null ? appointment.getStudent().getUserId() : null;
                if (userId != null) {
                    User u = new User();
                    u.setId(userId);
                    createInAppNotification(u, "COUNSELLING_NO_SHOW", "Missed counselling session",
                            "You didn't attend your session on " + date + ". Book a new time if you'd still like counselling.",
                            appointment.getId(), "APPOINTMENT");
                }
            } catch (Exception e) {
                logger.warn("Failed to create no-show in-app notification for appointment {}: {}",
                        appointment.getId(), e.getMessage());
            }
        } catch (Exception e) {
            logger.error("Failed to send no-show notice for appointment {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    // ─── Recipient accessors ───────────────────────────────────────────────────────

    // ═══ Cancellation and no-show (docs/COUNSELLING_CANCELLATION.md §10) ═════════
    //
    // Recipients are the student AND the parent/guardian where one was given at booking.
    // The confirmation email already does this; cancellation notices did not, so a parent
    // who was told about the session never heard it was called off — despite quite possibly
    // having paid for it.

    /** Public accessors so callers can address the student without duplicating the fallbacks. */
    public String recipientStudentEmail(CounsellingAppointment a) {
        return studentEmail(a);
    }

    public String recipientStudentName(CounsellingAppointment a) {
        return studentName(a);
    }

    /**
     * The student's own confirmation that her cancellation went through.
     *
     * <p>{@code cancel()} deliberately skips notifying whoever performed the cancellation —
     * right for the counsellor-cancels case, wrong here: without this she has no evidence it
     * worked. Carries the misses she has left, so the point at which the next session becomes
     * chargeable is never a surprise.
     */
    @Async
    public void sendStudentCancellationConfirmation(CounsellingAppointment appointment,
                                                    int missesRemaining, boolean creditedBack) {
        try {
            String name = studentName(appointment);
            String date = appointment.getSlot().getDate().format(DATE_FMT);
            String time = appointment.getSlot().getStartTime().format(TIME_FMT);

            String consequence = creditedBack
                    ? "Your session has been returned to your account, so it costs you nothing."
                    : "This was your last free change.";
            String allowance = missesRemaining > 0
                    ? "You have " + missesRemaining + " free change" + (missesRemaining == 1 ? "" : "s") + " remaining."
                    : "You have no free changes remaining.";

            String subject = "Your counselling session has been cancelled";
            String body = "Dear " + name + ",\n\n"
                    + "Your counselling session on " + date + " at " + time + " has been cancelled "
                    + "as you requested.\n\n"
                    + consequence + "\n"
                    + allowance + "\n\n"
                    + nextStepLine(missesRemaining) + "\n\n"
                    + "Regards,\nCareer-Nine Team";

            sendWithCancelledInvite(appointment, subject, body);
        } catch (Exception e) {
            logger.error("Failed to send student cancellation confirmation for appointment {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    /**
     * Admin cancelled the session — so <b>both</b> sides are told, because neither of them
     * chose it. Deliberately carries no self-reschedule link: the follow-up is human.
     */
    @Async
    public void sendAdminCancellationEmail(CounsellingAppointment appointment) {
        try {
            String date = appointment.getSlot().getDate().format(DATE_FMT);
            String time = appointment.getSlot().getStartTime().format(TIME_FMT);

            String subject = "Your counselling session has been cancelled";
            String studentBody = "Dear " + studentName(appointment) + ",\n\n"
                    + "Your counselling session scheduled on " + date + " at " + time
                    + " has been cancelled by the Career-9 team.\n\n"
                    + "This does not affect your counselling entitlement in any way — our team will "
                    + "be in touch shortly to arrange a new time.\n\n"
                    + "We apologise for the inconvenience.\n\n"
                    + "Regards,\nCareer-Nine Team";

            sendWithCancelledInvite(appointment, subject, studentBody);

            Counsellor counsellor = appointment.getCounsellor();
            if (counsellor != null && counsellor.getEmail() != null && !counsellor.getEmail().isEmpty()) {
                String counsellorBody = "Dear " + counsellor.getName() + ",\n\n"
                        + "The counselling session with " + studentName(appointment) + " on "
                        + date + " at " + time + " has been cancelled by the Career-9 team.\n\n"
                        + "Nothing is recorded against you and your slot has been reopened. "
                        + "The team will be in touch with the student to arrange a new time.\n\n"
                        + "Regards,\nCareer-Nine Team";
                sendEmail(counsellor.getEmail(), subject, counsellorBody);
            }
        } catch (Exception e) {
            logger.error("Failed to send admin cancellation emails for appointment {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    /**
     * Rung 1 — a different counsellor picked the session up at the same time. Her plans are
     * unchanged; what actually changed is the joining detail, which is the reason to write
     * at all.
     */
    @Async
    public void sendCounsellorSwappedEmail(CounsellingAppointment appointment) {
        try {
            String date = appointment.getSlot().getDate().format(DATE_FMT);
            String time = appointment.getSlot().getStartTime().format(TIME_FMT);
            boolean offline = "OFFLINE".equals(appointment.getMode());

            String subject = "Your counselling session is confirmed — updated details";
            String body = "Dear " + studentName(appointment) + ",\n\n"
                    + "Your counselling session on " + date + " at " + time
                    + " is going ahead exactly as planned — the time has not changed.\n\n"
                    + "A different counsellor will now be taking it, so please use the updated "
                    + (offline ? "venue" : "joining link") + " below:\n"
                    + "  " + attendanceLine(appointment) + "\n\n"
                    + (offline
                        ? "Please note the venue has changed — do check it before you set out.\n\n"
                        : "")
                    + "Regards,\nCareer-Nine Team";

            sendToStudentAndParent(appointment, subject, body);
        } catch (Exception e) {
            logger.error("Failed to send counsellor-swap email for appointment {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    /**
     * Rung 2 — no one was free at her time, so the session moved later the same day. This
     * changes her day, unlike rung 1, which is why it is a separate template.
     */
    @Async
    public void sendSessionShiftedEmail(CounsellingAppointment appointment,
                                        String originalTimeLabel, String rescheduleUrl) {
        try {
            String date = appointment.getSlot().getDate().format(DATE_FMT);
            String time = appointment.getSlot().getStartTime().format(TIME_FMT);

            String subject = "Your counselling session has moved to " + time;
            String body = "Dear " + studentName(appointment) + ",\n\n"
                    + "Your counsellor is no longer available at " + originalTimeLabel
                    + ", so we have moved your session to " + time + " on " + date + ".\n\n"
                    + "  " + attendanceLine(appointment) + "\n\n"
                    + "If that new time does not suit you, you can pick another one here — "
                    + "choosing your own time uses one of your free changes:\n" + rescheduleUrl + "\n\n"
                    + "We are sorry for the disruption.\n\n"
                    + "Regards,\nCareer-Nine Team";

            sendToStudentAndParent(appointment, subject, body);
        } catch (Exception e) {
            logger.error("Failed to send session-shifted email for appointment {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    /**
     * Admin alert — a counsellor cancellation that nobody could cover. Needs a human.
     *
     * <p>Written to the counselling <b>activity log</b>, which is what the admin Counselling
     * Notifications page reads. Deliberately not emailed: resolving recipients by "every super
     * admin" fans each alert out to the whole admin team, and the operational feed is where an
     * admin is already looking for exactly this kind of thing.
     */
    @Async
    public void notifyAdminNoReplacement(CounsellingAppointment appointment, String cause) {
        try {
            // Date and time now come from feedLines, which formats them the same way for
            // every entry in the feed.
            Counsellor counsellor = appointment.getCounsellor();
            String counsellorName = counsellor != null ? counsellor.getName() : "A counsellor";

            activityLogService.log(
                    "COUNSELLING_NEEDS_ATTENTION",
                    "Session needs attention",
                    feedLines(appointment,
                            "Counsellor: " + counsellorName,
                            "Cause: " + cause,
                            "Outcome: no replacement counsellor was available",
                            "Action: student sent a self-reschedule link"),
                    counsellor, counsellorName);
        } catch (Exception e) {
            logger.warn("Failed to log unplaced appointment {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    /**
     * Ten minutes in with no check-in — prompt the student to hand over her code.
     * She is otherwise sitting in a call with no idea what is happening.
     */
    @Async
    public void sendCheckinPromptToStudent(CounsellingAppointment appointment) {
        try {
            String email = studentEmail(appointment);
            if (email == null || email.isEmpty()) return;
            String subject = "Your counselling session is waiting to start";
            String body = "Dear " + studentName(appointment) + ",\n\n"
                    + "Your session has not been started yet. Please read out the 4-digit check-in "
                    + "code from your Career-9 report so your counsellor can begin.\n\n"
                    + "If nobody has joined, you do not need to do anything else — your session will "
                    + "be preserved and we will send you a link to pick a new time.\n\n"
                    + "Regards,\nCareer-Nine Team";
            sendEmail(email, subject, body);
        } catch (Exception e) {
            logger.warn("Check-in prompt to student failed for appointment {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    /**
     * The matching prompt to the counsellor — and the one that keeps the rule fair.
     *
     * <p>Doing nothing is what records the session as <i>their</i> no-show, so a counsellor
     * who is present but distracted would otherwise be marked absent for a session they
     * actually ran. This is the warning that stops that happening.
     */
    @Async
    public void sendCheckinPromptToCounsellor(CounsellingAppointment appointment) {
        try {
            Counsellor counsellor = appointment.getCounsellor();
            if (counsellor == null) return;
            String time = appointment.getSlot().getStartTime().format(TIME_FMT);

            String subject = "Action needed: session with " + studentName(appointment) + " not started";
            String body = "Dear " + counsellor.getName() + ",\n\n"
                    + "Your " + time + " session with " + studentName(appointment)
                    + " has not been checked in.\n\n"
                    + "Please either enter the student's check-in code, or mark the student absent "
                    + "if they have not appeared.\n\n"
                    + "If neither is recorded before the session ends, it will be logged as YOUR "
                    + "no-show rather than the student's.\n\n"
                    + "Regards,\nCareer-Nine Team";

            if (counsellor.getEmail() != null && !counsellor.getEmail().isEmpty()) {
                sendEmail(counsellor.getEmail(), subject, body);
            }
            if (counsellor.getUser() != null) {
                createInAppNotification(counsellor.getUser(), "CHECKIN_REQUIRED",
                        "Session not checked in",
                        "Enter the check-in code or mark the student absent — otherwise this is "
                                + "recorded as your no-show.",
                        appointment.getId(), "APPOINTMENT");
            }
        } catch (Exception e) {
            logger.warn("Check-in prompt to counsellor failed for appointment {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    /**
     * The counsellor marked her absent. Sent <b>immediately</b>, not at slot end, because it
     * costs her one of her two free changes and she is entitled to know at once — and to
     * contest it while she still remembers the session.
     */
    @Async
    public void sendMarkedAbsentEmail(CounsellingAppointment appointment, int missesRemaining) {
        try {
            String name = studentName(appointment);
            String email = studentEmail(appointment);
            String date = appointment.getSlot().getDate().format(DATE_FMT);
            String time = appointment.getSlot().getStartTime().format(TIME_FMT);

            String consequence = (missesRemaining > 0
                        ? "You have " + missesRemaining + " free change" + (missesRemaining == 1 ? "" : "s")
                          + " remaining.\n\n"
                        : "")
                    + nextStepLine(missesRemaining);

            String subject = "You were marked absent from your counselling session";
            String body = "Dear " + name + ",\n\n"
                    + "Your counsellor has recorded that you did not attend your session on "
                    + date + " at " + time + ".\n\n"
                    + consequence + "\n\n"
                    + "If you were present and believe this is a mistake, reply to this email or "
                    + "raise it from your Career-9 dashboard — the session will be reviewed and "
                    + "nothing will count against you until it is settled.\n\n"
                    + "Regards,\nCareer-Nine Team";

            if (email != null && !email.isEmpty()) sendEmail(email, subject, body);

            Long userId = appointment.getStudent() != null ? appointment.getStudent().getUserId() : null;
            if (userId != null) {
                User u = new User();
                u.setId(userId);
                createInAppNotification(u, "COUNSELLING_NO_SHOW", "Marked absent",
                        "You were marked absent from your session on " + date
                                + ". If that is wrong, you can dispute it.",
                        appointment.getId(), "APPOINTMENT");
            }
        } catch (Exception e) {
            logger.error("Failed to send marked-absent email for appointment {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    /**
     * Admin alert — a counsellor did not appear. A management signal, not a student matter,
     * so it lands in the counselling activity feed rather than anyone's inbox.
     */
    @Async
    public void notifyAdminCounsellorNoShow(CounsellingAppointment appointment) {
        try {
            Counsellor counsellor = appointment.getCounsellor();
            String counsellorName = counsellor != null ? counsellor.getName() : "Unassigned";

            activityLogService.log(
                    "COUNSELLOR_NO_SHOW",
                    "Counsellor no-show",
                    feedLines(appointment,
                            "Counsellor: " + counsellorName,
                            "Outcome: counsellor did not check in",
                            "Action: student sent a rebooking link; not penalised"),
                    counsellor, counsellorName);
        } catch (Exception e) {
            logger.warn("Failed to log counsellor no-show on appointment {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    /**
     * Admin alert — a student has contested an absent mark, so her strike is suspended until
     * someone decides. Surfaced in the counselling activity feed alongside the other
     * operational items.
     */
    @Async
    public void notifyAdminDisputeRaised(CounsellingAppointment appointment) {
        try {
            Counsellor counsellor = appointment.getCounsellor();
            activityLogService.log(
                    "ATTENDANCE_DISPUTE",
                    "Attendance disputed",
                    feedLines(appointment,
                            "Counsellor: " + (counsellor != null ? counsellor.getName() : "Unassigned"),
                            "Raised: student disputes being marked absent",
                            "Status: nothing counts against the student until this is decided"),
                    counsellor, studentName(appointment));
        } catch (Exception e) {
            logger.warn("Failed to log dispute on appointment {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    /** Tells the student how her dispute went. */
    @Async
    public void sendDisputeOutcomeEmail(CounsellingAppointment appointment, boolean upheld, String note) {
        try {
            String email = studentEmail(appointment);
            if (email == null || email.isEmpty()) return;
            String date = appointment.getSlot().getDate().format(DATE_FMT);

            String subject = upheld
                    ? "Your counselling attendance review — outcome"
                    : "Good news — your counselling session has been corrected";
            String body = "Dear " + studentName(appointment) + ",\n\n"
                    + (upheld
                        ? "We have reviewed your session on " + date + " and the record that you did "
                          + "not attend stands. It counts as one of your changes."
                        : "We have reviewed your session on " + date + " and corrected it — it is now "
                          + "recorded as attended, and nothing has been counted against you.")
                    + (note != null && !note.isEmpty() ? "\n\nNote from our team: " + note : "")
                    + "\n\nRegards,\nCareer-Nine Team";
            sendEmail(email, subject, body);
        } catch (Exception e) {
            logger.warn("Failed to send dispute outcome for appointment {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    // ─── Cancellation/no-show helpers ────────────────────────────────────────────

    /** The student's counselling page — where every "book a new time" link should land. */
    private String portalCounsellingUrl() {
        String base = frontendUrl == null ? "" : frontendUrl.replaceAll("/+$", "");
        return base + "/student/dashboard/counselling";
    }

    /**
     * What the student can do next, given how many free changes she has left.
     *
     * <p>The two outcomes are genuinely different actions, and calling both "book a new
     * session" — as every one of these emails used to — misled in both directions. With a
     * change left she does not book anything: she reschedules the session she already paid
     * for, from Past Sessions, and it costs her nothing. With none left rescheduling is not
     * offered to her at all, and a fresh booking is chargeable. The wording now matches the
     * button she will actually find when she gets there.
     */
    private String nextStepLine(int missesRemaining) {
        if (missesRemaining > 0) {
            return "Reschedule it yourself at no extra cost — open Counselling, go to "
                    + "Past Sessions and press Reschedule to pick a new slot:\n"
                    + portalCounsellingUrl();
        }
        return "You have no free changes left, so this session can no longer be moved. "
                + "You can book a new session here:\n" + portalCounsellingUrl();
    }

    /** Student plus parent/guardian, matching the confirmation email's recipient list. */
    private void sendToStudentAndParent(CounsellingAppointment appointment, String subject, String body) {
        for (String addr : studentAndParentEmails(appointment)) {
            sendEmail(addr, subject, body);
        }
    }

    private List<String> studentAndParentEmails(CounsellingAppointment appointment) {
        List<String> to = new java.util.ArrayList<>();
        String student = studentEmail(appointment);
        String parent = appointment.getParentEmail();
        if (student != null && !student.isEmpty()) to.add(student);
        if (parent != null && !parent.isEmpty()) to.add(parent);
        return to;
    }

    /**
     * Sends to student + parent with a {@code METHOD:CANCEL} invite attached, so the original
     * event disappears from their calendars instead of sitting there with a live meeting link.
     * Falls back to plain text if the attachment cannot be built or sent.
     */
    private void sendWithCancelledInvite(CounsellingAppointment appointment, String subject, String body) {
        List<String> to = studentAndParentEmails(appointment);
        if (to.isEmpty()) return;

        byte[] ics = icsService.buildCancellation(appointment);
        if (ics != null) {
            try {
                SmtpEmailRequest req = new SmtpEmailRequest();
                req.setTo(to);
                req.setSubject(subject);
                req.setHtmlContent("<pre style=\"font-family:inherit\">" + body + "</pre>");
                req.setFromName("Career-9");
                req.setFromEmail("notifications@career-9.net");
                req.setAttachments(Arrays.asList(new SmtpEmailRequest.EmailAttachment(
                        icsService.cancellationFileName(appointment), ics, "text/calendar")));
                emailDispatchService.send(EmailType.COUNSELLING_NOTIFICATION, req, null);
                return;
            } catch (Exception e) {
                logger.warn("Cancellation invite email failed for appointment {}, falling back to text: {}",
                        appointment.getId(), e.getMessage());
            }
        }
        for (String addr : to) sendEmail(addr, subject, body);
    }

    public String studentName(CounsellingAppointment a) {
        if (a.getStudentContactName() != null && !a.getStudentContactName().isEmpty()) {
            return a.getStudentContactName();
        }
        try { return a.getStudent().getStudentInfo().getName(); } catch (Exception e) { return "Student"; }
    }

    public String studentEmail(CounsellingAppointment a) {
        if (a.getStudentContactEmail() != null && !a.getStudentContactEmail().isEmpty()) {
            return a.getStudentContactEmail();
        }
        try { return a.getStudent().getStudentInfo().getEmail(); } catch (Exception e) { return null; }
    }

    private String studentPhone(CounsellingAppointment a) {
        if (a.getStudentContactPhone() != null && !a.getStudentContactPhone().isEmpty()) {
            return a.getStudentContactPhone();
        }
        try { return a.getStudent().getStudentInfo().getPhoneNumber(); } catch (Exception e) { return null; }
    }

    // ─── Private Helper ───────────────────────────────────────────────────────────

    private void sendEmail(String toEmail, String subject, String body) {
        // Routed through the central dispatcher (logged + account-routed); legacy provider retired.
        emailDispatchService.sendText(EmailType.COUNSELLING_NOTIFICATION, toEmail, subject, body);
    }
}
