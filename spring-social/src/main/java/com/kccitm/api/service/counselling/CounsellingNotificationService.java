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
import com.kccitm.api.model.email.EmailDeliveryMode;
import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.model.email.EmailSendResult;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.service.email.EmailDispatchService;
import com.kccitm.api.service.email.EmailNotificationRecipientService;
import com.kccitm.api.service.email.mails.AccountMails;
import com.kccitm.api.service.email.mails.CounsellingMails;
import com.kccitm.api.service.email.mails.InternalMails;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import com.kccitm.api.service.email.theme.MailLinks;

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

    /** Campaign slug + link building for the post-session referral share link. */
    @Autowired
    private com.kccitm.api.repository.Career9.b2c.CampaignRepository campaignRepository;

    @Autowired
    private com.kccitm.api.service.b2c.LinkBuilder linkBuilder;

    @Autowired
    private com.kccitm.api.repository.Career9.AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private CounsellorReportNotificationService counsellorReportNotificationService;

    /** Optional so this still starts where the B2C entitlement stack is not wired. */
    @Autowired(required = false)
    private com.kccitm.api.service.b2c.ReportReleaseGate reportReleaseGate;

    @Autowired
    private EmailDispatchService emailDispatchService;

    /** Rule 1: every link in a counselling mail is built here, never inlined. */
    @Autowired
    private MailLinks mailLinks;

    /** Standing recipient lists (email_notification_recipient) for the internal alerts. */
    @Autowired
    private EmailNotificationRecipientService recipientService;

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
    public void sendAssignedToCounsellorEmail(CounsellingAppointment appointment) {
        try {
            String counsellorEmail = appointment.getCounsellor().getEmail();
            String counsellorName = appointment.getCounsellor().getName();

            Mail mail = CounsellingMails.assignedToCounsellor(
                    AccountMails.firstName(counsellorName),
                    appointment.getStudentReason(),
                    session(appointment),
                    mailLinks.of(counsellorPortalUrl(), "counsellor_portal"));

            sendMail(EmailType.COUNSELLING_NOTIFICATION, counsellorEmail, mail);
        } catch (Exception e) {
            logger.error("Failed to send assigned-to-counsellor email for appointment ID: {}. Error: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    @Async
    public void sendConfirmedToStudentEmail(CounsellingAppointment appointment) {
        try {
            String studentEmail = studentEmail(appointment);
            String studentName = studentName(appointment);

            Mail mail = CounsellingMails.confirmedToStudent(
                    AccountMails.firstName(studentName), session(appointment));

            sendMail(EmailType.COUNSELLING_NOTIFICATION, studentEmail, mail);
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

            // This one mail goes to whichever side did NOT do the cancelling, so the button has
            // to follow the reader: a counsellor wants their own diary, a student wants the page
            // where they can pick a new time.
            boolean toCounsellor = appointment.getCounsellor() != null
                    && appointment.getCounsellor().getEmail() != null
                    && appointment.getCounsellor().getEmail().equalsIgnoreCase(recipientEmail);
            MailLink sessions = toCounsellor
                    ? mailLinks.of(counsellorPortalUrl(), "counsellor_portal")
                    : mailLinks.of(portalCounsellingUrl(), "counselling_portal");

            Mail mail = CounsellingMails.cancelledNotice(
                    AccountMails.firstName(recipientName), session(appointment),
                    toCounsellor ? "the student" : cancelledByName, reason, sessions,
                    toCounsellor ? "Open my dashboard" : "View my sessions");

            sendMail(EmailType.COUNSELLING_NOTIFICATION, recipientEmail, mail);
        } catch (Exception e) {
            logger.error("Failed to send cancellation email for appointment ID: {}. Error: {}",
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
        deliverSelfRescheduleEmail(appointment, rescheduleUrl, null);
    }

    /**
     * Admin-initiated version of the same link: the counsellor has not dropped out, the admin
     * simply wants the student to choose a new time. It needs its own opening line — telling a
     * student their counsellor is unavailable when they are not is a mail we would have to
     * apologise for.
     *
     * @param reason optional note from the admin, shown to the student as the why
     */
    /**
     * Invite for students who completed an assessment but never booked: a tokenized, no-login
     * booking link. Sent by an admin from the Manage Students page.
     */
    @Async
    public void sendBookingInviteEmail(String studentName, String studentEmail, String bookingUrl) {
        try {
            if (studentEmail == null || studentEmail.isEmpty()) {
                logger.warn("No student email — cannot send counselling booking link");
                return;
            }

            Mail mail = CounsellingMails.bookingInvite(
                    AccountMails.firstName(studentName),
                    mailLinks.of(bookingUrl, "counselling_booking"));

            sendMail(EmailType.COUNSELLING_NOTIFICATION, studentEmail, mail);
        } catch (Exception e) {
            logger.error("Failed to send counselling booking invite to {}: {}", studentEmail, e.getMessage());
        }
    }

    @Async
    public void sendSelfRescheduleInviteEmail(CounsellingAppointment appointment, String rescheduleUrl,
            String reason) {
        deliverSelfRescheduleEmail(appointment, rescheduleUrl, reason == null ? "" : reason.trim());
    }

    /**
     * @param adminReason null for the counsellor-absence mail; non-null (possibly empty) for the
     *                    admin's "please pick a new time" invite
     */
    private void deliverSelfRescheduleEmail(CounsellingAppointment appointment, String rescheduleUrl,
            String adminReason) {
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

            String opening = adminReason == null
                    ? counsellorName + " is no longer available for your counselling session" + when + "."
                    : "Your counselling session" + when + " needs to be moved to another time.";

            Mail mail = CounsellingMails.selfReschedule(
                    AccountMails.firstName(studentName), opening, adminReason,
                    mailLinks.of(rescheduleUrl, "counselling_reschedule"));

            sendMail(EmailType.COUNSELLING_NOTIFICATION, studentEmail, mail);
        } catch (Exception e) {
            logger.error("Failed to send self-reschedule email for appointment ID: {}. Error: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    @Async
    public void sendRescheduleEmail(CounsellingAppointment oldAppointment, CounsellingAppointment newAppointment) {
        try {
            String studentEmail = studentEmail(newAppointment);
            String studentName = studentName(newAppointment);

            // The new session is described in full — counsellor, mode and the join link —
            // because a reschedule replaces the confirmation the student was working from.
            // The "Previously" row keeps the time that moved in view.
            CounsellingMails.Session was = session(oldAppointment);
            CounsellingMails.Session now = session(newAppointment);

            sendMail(EmailType.COUNSELLING_NOTIFICATION, studentEmail,
                    CounsellingMails.rescheduledStudent(
                            AccountMails.firstName(studentName), was, now));

            // The counsellor is on the new session too — they were told about the original
            // and would otherwise be left holding a time that has moved.
            if (newAppointment.getCounsellor() != null) {
                String counsellorEmail = newAppointment.getCounsellor().getEmail();
                if (counsellorEmail != null && !counsellorEmail.isBlank()) {
                    sendMail(EmailType.COUNSELLING_NOTIFICATION, counsellorEmail,
                            CounsellingMails.rescheduledCounsellor(
                                    AccountMails.firstName(newAppointment.getCounsellor().getName()),
                                    studentName, was, now));
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
            // The scheduler's label already carries the preposition ("in 12 hours"), so it is
            // used exactly once here. The old subject and title prepended another "in", which
            // read as "Reminder: Counselling Session in in 12 hours".
            CounsellingMails.Session s = session(appointment);

            // Student copy, plus the parent/guardian copy if one was given at booking. Both read
            // studentSession: a report held for counsellor release must not ride along on them.
            String studentEmail = studentEmail(appointment);
            String studentName = studentName(appointment);
            Mail studentMail = CounsellingMails.reminderStudent(
                    AccountMails.firstName(studentName), period, studentView(s, appointment));
            sendMail(EmailType.COUNSELLING_NOTIFICATION, studentEmail, studentMail);
            String parentEmail = appointment.getParentEmail();
            if (parentEmail != null && !parentEmail.isEmpty()) {
                sendMail(EmailType.COUNSELLING_NOTIFICATION, parentEmail, studentMail);
            }

            // Counsellor copy: same session, their own subject line and student row.
            if (appointment.getCounsellor() != null) {
                sendMail(EmailType.COUNSELLING_NOTIFICATION, appointment.getCounsellor().getEmail(),
                        CounsellingMails.reminderCounsellor(
                                AccountMails.firstName(appointment.getCounsellor().getName()),
                                studentName, period, s));
            }
        } catch (Exception e) {
            logger.error("Failed to send reminder email for appointment ID: {}. Error: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    @Async
    public void sendSessionCompleteEmail(CounsellingAppointment appointment) {
        try {
            String studentEmail = studentEmail(appointment);
            String studentName = studentName(appointment);

            // Post-session thank-you (approved design). Deliberately says nothing about
            // session notes or counsellor remarks — those stay in the portal.
            Mail mail = CounsellingMails.sessionComplete(
                    AccountMails.firstName(studentName),
                    mailLinks.of(referralShareUrl(appointment), "referral"));

            sendMail(EmailType.COUNSELLING_NOTIFICATION, studentEmail, mail);
        } catch (Exception e) {
            logger.error("Failed to send session-complete email for appointment ID: {}. Error: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    /**
     * Share link for the post-session mail's referral button: the campaign landing
     * page the student came through, or the assessment site root when they didn't
     * come via a campaign. There is no per-student referral tracking yet — this is
     * a share link, nothing more.
     */
    private String referralShareUrl(CounsellingAppointment appointment) {
        try {
            Long entitlementId = appointment != null ? appointment.getEntitlementId() : null;
            if (entitlementId != null) {
                com.kccitm.api.model.career9.b2c.StudentEntitlement ent =
                        studentEntitlementRepository.findById(entitlementId).orElse(null);
                if (ent != null && ent.getCampaignId() != null) {
                    com.kccitm.api.model.career9.b2c.Campaign c =
                            campaignRepository.findById(ent.getCampaignId()).orElse(null);
                    if (c != null && c.getSlug() != null && !c.getSlug().isBlank()) {
                        return linkBuilder.campaignLanding(c.getSlug());
                    }
                }
            }
        } catch (Exception ex) {
            logger.debug("Referral link fell back to assessment home: {}", ex.getMessage());
        }
        return linkBuilder.assessmentHome();
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

        // studentSession(), not session(): a report held for counsellor release must not travel
        // in a mail a student opens, and reportGuidance() says so in place of the link.
        Mail mail = CounsellingMails.summaryStudent(
                AccountMails.firstName(studentName(appointment)),
                studentSession(appointment),
                reportGuidance(appointment, false).trim());

        List<String> accepted = new java.util.ArrayList<>();
        String failure = null;
        for (String addr : recipients) {
            EmailSendResult result = sendMail(EmailType.COUNSELLING_NOTIFICATION, addr, mail);
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

        Mail mail = CounsellingMails.summaryCounsellor(
                AccountMails.firstName(counsellor.getName()),
                session(appointment),
                reportGuidance(appointment, true).trim());

        EmailSendResult result = sendMail(EmailType.COUNSELLING_NOTIFICATION, to, mail);
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
        if (!forCounsellor && isHeldForCounsellorRelease(appointment)) {
            return "Your assessment report will be shared with you by your counsellor after "
                 + "the session, so the results can be talked through rather than simply read.\n\n";
        }
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
    public Long assessmentIdFor(CounsellingAppointment appointment) {
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
    /**
     * Whether this booking's tier keeps the report back for the counsellor to release.
     *
     * <p>Asked of the entitlement the session was booked against rather than of the student's
     * reports, because that is where the setting was snapshotted at purchase. A booking with
     * no entitlement -- an admin-created one -- was never on a tier at all, and is not held.
     */
    private boolean isHeldForCounsellorRelease(CounsellingAppointment appointment) {
        if (reportReleaseGate == null || appointment == null) return false;
        return reportReleaseGate.isHeldForEntitlement(appointment.getEntitlementId());
    }

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

            // Phase 6: one-click "Add to Google Calendar" link (no API/OAuth needed) in
            // addition to the attached .ics invite.
            String gcal = googleCalendarLink(appointment);
            // One email reaches the student, the parent and the counsellor, so it names the
            // student — the counsellor's copy is useless without it, and the other two are
            // not confused by seeing it.
            // One mail carries everything the student gets at booking: the confirmation,
            // the calendar invite, and the report guidance the Manage Sessions summary
            // used to send separately — two near-identical mails taught students to skim.
            Mail mail = CounsellingMails.bookingConfirmation(
                    AccountMails.firstName(studentName), session(appointment),
                    mailLinks.of(gcal, "gcal"));

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

            // This is the only mail the student gets at booking, so it must actually go out.
            // Up to three rounds with a pause between them: the full message (.ics attached)
            // to everyone first, then a plain-text send per address that has not been accepted
            // yet — and unlike before, "accepted" means the dispatcher REPORTED success, not
            // merely that the call returned. The rounds stop once the student's address is
            // accepted (or any address, when the student has none on record — the parent's
            // copy is then the only copy there is). Per-address tracking means a retry never
            // re-mails an address that already got its copy.
            byte[] ics = icsService.buildInvite(appointment);
            String mustReach = (studentEmail != null && !studentEmail.isEmpty())
                    ? studentEmail : (emailTo.isEmpty() ? null : emailTo.get(0));
            java.util.Set<String> acceptedAddrs = new java.util.LinkedHashSet<>();
            if (emailTo.isEmpty()) {
                logger.error("Booking confirmation for appointment {} has no email recipients at all "
                        + "— no student, parent or counsellor address on record", appointment.getId());
            }
            boolean delivered = emailTo.isEmpty();
            for (int round = 1; !delivered && round <= 3; round++) {
                if (round > 1) {
                    try {
                        Thread.sleep(round == 2 ? 5_000 : 15_000);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
                // Full message with the calendar invite — only while nobody has a copy yet,
                // so a partial fallback success is never followed by a duplicate to everyone.
                // The branded HTML is what the reader sees; the plain text rides alongside it
                // in the same message for gateways that strip HTML, so a retry never arrives
                // looking worse than the mail it is retrying.
                if (acceptedAddrs.isEmpty() && ics != null) {
                    try {
                        EmailSendRequest req = EmailSendRequest.mail(
                                EmailType.COUNSELLING_BOOKING, null, mail);
                        req.setTo(new java.util.ArrayList<>(emailTo));
                        req.getAttachments().add(new SmtpEmailRequest.EmailAttachment(
                                icsService.fileName(appointment), ics, "text/calendar"));
                        // Synchronous, so "accepted" means the message actually went out —
                        // a queued hand-off would let the retry rounds below stop too early.
                        req.setDeliveryModeOverride(EmailDeliveryMode.SYNC);
                        EmailSendResult full = emailDispatchService.send(req);
                        if (full != null && full.isSuccess()) acceptedAddrs.addAll(emailTo);
                    } catch (Exception e) {
                        logger.warn("ICS confirmation email failed for appointment {} (round {}): {}",
                                appointment.getId(), round, e.getMessage());
                    }
                }
                // Fallback, one send per address still without a copy: the same branded mail,
                // just without the .ics attachment. The Google Calendar link in the body
                // survives, so the reader can still put this on a calendar.
                for (String addr : emailTo) {
                    if (acceptedAddrs.contains(addr)) continue;
                    try {
                        EmailSendResult r = sendMail(EmailType.COUNSELLING_BOOKING, addr, mail);
                        if (r != null && r.isSuccess()) acceptedAddrs.add(addr);
                    } catch (Exception e) {
                        logger.warn("Branded confirmation email to {} failed for appointment {} (round {}): {}",
                                addr, appointment.getId(), round, e.getMessage());
                    }
                }
                delivered = mustReach == null ? !acceptedAddrs.isEmpty()
                                              : acceptedAddrs.contains(mustReach);
            }
            if (!delivered && !emailTo.isEmpty()) {
                logger.error("Booking confirmation could NOT be emailed to the student for appointment {} "
                        + "after 3 rounds (accepted so far: {}) — re-send it from Manage Sessions",
                        appointment.getId(), acceptedAddrs);
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
            // whenLabel already reads "in 2 hours"; nothing here adds a second "in".
            sendMail(EmailType.COUNSELLING_NOTIFICATION, appointment.getCounsellor().getEmail(),
                    CounsellingMails.reminderCounsellor(
                            AccountMails.firstName(appointment.getCounsellor().getName()),
                            studentName(appointment), whenLabel, session(appointment)));
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
        // One row per session: the time is the column the counsellor scans down, the student
        // and the mode say who they are meeting and where.
        List<String[]> rows = new java.util.ArrayList<>();
        for (CounsellingAppointment a : appointments) {
            rows.add(new String[]{
                    a.getSlot().getStartTime().format(TIME_FMT),
                    studentName(a),
                    "OFFLINE".equals(a.getMode()) ? "In-person" : "Online"});
        }

        sendMail(EmailType.COUNSELLING_NOTIFICATION, counsellor.getEmail(),
                CounsellingMails.dailyDigest(AccountMails.firstName(counsellor.getName()), dateLabel, rows,
                        mailLinks.of(counsellorPortalUrl(), "counsellor_portal")));
        whatsAppService.sendTemplate(counsellor.getPhone(), whatsAppService.counsellorDigestCampaign(),
                Arrays.asList(counsellor.getName(), dateLabel, String.valueOf(appointments.size())));
    }

    /**
     * "You still have counselling session(s) to book" nudge — WhatsApp primary,
     * email fallback, plus an in-app notification when a userId is available.
     *
     * @param bookingUrl the tokenized booking link for this entitlement, so the mail opens the
     *                   booking page with no login; the plain portal URL is the fallback when it
     *                   could not be built.
     */
    @Async
    public void sendCounsellingBookingNudge(String name, String email, String phone,
            Long userId, int sessionsRemaining, String bookingUrl) {
        String safeName = (name != null && !name.isEmpty()) ? name : "there";
        boolean sent = whatsAppService.sendTemplate(phone, whatsAppService.bookingNudgeCampaign(),
                Arrays.asList(safeName, String.valueOf(sessionsRemaining)));
        if (!sent && email != null && !email.isEmpty()) {
            sendMail(EmailType.COUNSELLING_NOTIFICATION, email,
                    CounsellingMails.bookingNudge(AccountMails.firstName(safeName), sessionsRemaining,
                            bookingUrl != null
                                    ? mailLinks.of(bookingUrl, "counselling_book")
                                    : mailLinks.of(portalCounsellingUrl(), "counselling_portal")));
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
            Mail mail = CounsellingMails.studentCancellationConfirmation(
                    AccountMails.firstName(studentName(appointment)), session(appointment),
                    missesRemaining, creditedBack,
                    mailLinks.of(portalCounsellingUrl(), "counselling_portal"));

            sendWithCancelledInvite(appointment, mail);
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
        sendAdminCancellationEmail(appointment, true);
    }

    /**
     * As above, but the counsellor's copy can be withheld.
     *
     * <p>Used when a whole diary is cancelled at once: deactivating a counsellor with
     * sessions booked would otherwise send them one "your session was cancelled" mail per
     * student on top of the single suspension notice, which reads as a series of faults
     * rather than as the one thing that happened to their account.
     */
    @Async
    public void sendAdminCancellationEmail(CounsellingAppointment appointment, boolean includeCounsellor) {
        try {
            CounsellingMails.Session s = session(appointment);

            sendWithCancelledInvite(appointment, CounsellingMails.adminCancellationStudent(
                    AccountMails.firstName(studentName(appointment)), s,
                    mailLinks.of(portalCounsellingUrl(), "counselling_portal")));

            Counsellor counsellor = includeCounsellor ? appointment.getCounsellor() : null;
            if (counsellor != null && counsellor.getEmail() != null && !counsellor.getEmail().isEmpty()) {
                sendMail(EmailType.COUNSELLING_NOTIFICATION, counsellor.getEmail(),
                        CounsellingMails.adminCancellationCounsellor(
                                AccountMails.firstName(counsellor.getName()),
                                studentName(appointment), s,
                                mailLinks.of(counsellorPortalUrl(), "counsellor_portal")));
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
            Mail mail = CounsellingMails.counsellorSwapped(
                    AccountMails.firstName(studentName(appointment)), session(appointment),
                    appointment.getCounsellor() != null ? appointment.getCounsellor().getName() : null);

            sendMailToStudentAndParent(appointment, mail);
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
            Mail mail = CounsellingMails.sessionShifted(
                    AccountMails.firstName(studentName(appointment)), session(appointment),
                    originalTimeLabel, mailLinks.of(rescheduleUrl, "counselling_reschedule"));

            sendMailToStudentAndParent(appointment, mail);
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
     * Sends the student their four-digit check-in code on demand — the counsellor's
     * "Send code to student" button on the session row.
     *
     * <p>The code is not generated here and nothing new is stored: it is the same
     * DOB-derived {@link CounsellingOtpService} value printed on the student's report and
     * recomputed by {@link CheckinOtpService#verify}. This method only carries it to the
     * student who has mislaid the report or never opened it.
     *
     * <p>Both channels are attempted independently — a student with a number but no address
     * still gets it, and vice versa. Returns the channels that actually accepted the message
     * so the counsellor is told what happened rather than a blanket "sent": WhatsApp is a
     * no-op until {@code AISENSY_API_KEY} and the {@code counselling_otp} campaign exist, and
     * silently reporting success there would leave the counsellor waiting on a message that
     * was never sent.
     *
     * <p>Deliberately not {@code @Async} — the counsellor is standing at the button waiting
     * to be told whether the student has the code.
     */
    public List<String> sendCheckinCodeToStudent(CounsellingAppointment appointment, String code) {
        List<String> delivered = new java.util.ArrayList<>();
        String name = studentName(appointment);

        // WhatsApp first: it is where the student is likeliest to be looking mid-session.
        String phone = studentPhone(appointment);
        if (phone != null && !phone.trim().isEmpty()) {
            // Positional template params for the AiSensy `counselling_otp` campaign.
            if (whatsAppService.sendTemplate(phone, whatsAppService.otpCampaign(),
                    Arrays.asList(name, code))) {
                delivered.add("WhatsApp");
            }
        }

        String email = studentEmail(appointment);
        if (email != null && !email.trim().isEmpty()) {
            try {
                // The code is the whole point of this mail — it goes above the explanation,
                // set large, with nothing else in the panel. A student opening this on a phone
                // with the counsellor already waiting should not have to read a paragraph to
                // find four digits.
                Mail mail = CounsellingMails.checkinCode(
                        AccountMails.firstName(name), code, session(appointment));

                // Only counted as delivered if the dispatcher actually took it. A skipped send
                // — no email account configured — used to be reported to the counsellor as
                // "sent to the student", who then waited for a mail that was never queued.
                EmailSendResult result = sendMail(
                        EmailType.COUNSELLING_NOTIFICATION, email, mail);
                if (result != null && result.isSuccess()) {
                    delivered.add("email");
                } else {
                    logger.warn("Check-in code email not accepted for appointment {}: {}",
                            appointment.getId(),
                            result != null ? result.getError() : "no result from dispatcher");
                }
            } catch (Exception e) {
                logger.warn("Check-in code email failed for appointment {}: {}",
                        appointment.getId(), e.getMessage());
            }
        }

        logger.info("Check-in code for appointment {} delivered via {}", appointment.getId(),
                delivered.isEmpty() ? "nothing" : String.join(" + ", delivered));
        return delivered;
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

            Mail mail = CounsellingMails.checkinPromptStudent(
                    AccountMails.firstName(studentName(appointment)), session(appointment),
                    mailLinks.of(portalCounsellingUrl(), "counselling_portal"));

            sendMail(EmailType.COUNSELLING_NOTIFICATION, email, mail);
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

            Mail mail = CounsellingMails.checkinPromptCounsellor(
                    AccountMails.firstName(counsellor.getName()), studentName(appointment), time,
                    mailLinks.of(counsellorPortalUrl(), "counsellor_portal"));

            if (counsellor.getEmail() != null && !counsellor.getEmail().isEmpty()) {
                sendMail(EmailType.COUNSELLING_NOTIFICATION, counsellor.getEmail(), mail);
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

            Mail mail = CounsellingMails.markedAbsent(
                    AccountMails.firstName(name), session(appointment), missesRemaining,
                    mailLinks.of(portalCounsellingUrl(), "counselling_portal"));

            if (email != null && !email.isEmpty()) {
                sendMail(EmailType.COUNSELLING_NOTIFICATION, email, mail);
            }

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
            // The date carries the preheader and the opening sentence, so a mail without one
            // would read "Your session on  is now recorded as attended". Nothing to say means
            // nothing sent — which is what happened before, by way of a caught NPE.
            if (appointment.getSlot() == null || appointment.getSlot().getDate() == null) {
                logger.warn("Dispute outcome not sent for appointment {}: the session has no date",
                        appointment.getId());
                return;
            }
            String date = appointment.getSlot().getDate().format(DATE_FMT);

            Mail mail = CounsellingMails.disputeOutcome(
                    AccountMails.firstName(studentName(appointment)), date, upheld, note,
                    mailLinks.of(portalCounsellingUrl(), "counselling_portal"));

            sendMail(EmailType.COUNSELLING_NOTIFICATION, email, mail);
        } catch (Exception e) {
            logger.warn("Failed to send dispute outcome for appointment {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    // ─── Cancellation/no-show helpers ────────────────────────────────────────────

    /** The student's counselling page — where every "book a new time" link should land. */
    private String portalCounsellingUrl() {
        return portalBase() + "/student/dashboard/counselling";
    }

    /** Trailing slashes off once, so the three helpers below read as one thing. */
    private String portalBase() {
        return frontendUrl == null ? "" : frontendUrl.replaceAll("/+$", "");
    }

    /** Where a counsellor lands: their own sessions, availability and notes. */
    private String counsellorPortalUrl() {
        return portalBase() + "/counsellor/dashboard";
    }

    /** Manage Sessions — the admin screen these operational alerts are about. */
    private String adminSessionsUrl() {
        return portalBase() + "/admin/counselling-sessions";
    }

    // ─── Themed mail (service/email/theme) ───────────────────────────────────────

    /** The session facts every counselling mail shows, from the appointment. */
    CounsellingMails.Session session(CounsellingAppointment a) {
        String date = a.getSlot() != null && a.getSlot().getDate() != null
                ? a.getSlot().getDate().format(DATE_FMT) : null;
        String time = null;
        if (a.getSlot() != null && a.getSlot().getStartTime() != null) {
            time = a.getSlot().getStartTime().format(TIME_FMT);
            if (a.getSlot().getEndTime() != null) time += " \u2013 " + a.getSlot().getEndTime().format(TIME_FMT);
            time += " IST";
        }
        String duration = a.getSlot() != null && a.getSlot().getDurationMinutes() != null
                ? String.valueOf(a.getSlot().getDurationMinutes()) : null;
        boolean offline = "OFFLINE".equals(a.getMode());
        String mode = offline
                ? "In-person" + (a.getLocation() != null && !a.getLocation().isEmpty() ? " \u00b7 " + a.getLocation() : "")
                : "Online (Google Meet)";
        MailLink join = offline || a.getMeetingLink() == null || a.getMeetingLink().isEmpty()
                ? null : mailLinks.of(a.getMeetingLink(), "meeting");
        String reportUrl = bookingReportLink(a);
        MailLink report = reportUrl == null ? null : mailLinks.of(reportUrl, "report");
        return new CounsellingMails.Session(date, time, duration,
                a.getCounsellor() != null ? a.getCounsellor().getName() : null, mode,
                instituteNameFor(a), assessmentNameFor(a), studentName(a), join, report);
    }

    /**
     * The same session facts, but safe to put in front of a student.
     *
     * <p>A report held for counsellor release is meant to be talked through in the session, not
     * read beforehand, so every copy a student can open has always suppressed it.
     * {@link #session} cannot: the counsellor's mails need that link. So the student-facing
     * mails take the session through here, which blanks the report and leaves everything else
     * alone. Without it a reminder would hand the student a direct link to the very report the
     * gate is holding back.
     */
    CounsellingMails.Session studentSession(CounsellingAppointment a) {
        return studentView(session(a), a);
    }

    /**
     * The same gate applied to a session that has already been built, so a mail sending both a
     * student and a counsellor copy pays for {@link #session} once rather than twice — it reaches
     * the report repository, and the reminders run over every appointment four times a session.
     */
    private CounsellingMails.Session studentView(CounsellingMails.Session s, CounsellingAppointment a) {
        if (s.report == null || !isHeldForCounsellorRelease(a)) return s;
        return new CounsellingMails.Session(s.date, s.time, s.duration, s.counsellor, s.mode,
                s.school, s.assessment, s.student, s.join, null);
    }

    /**
     * One themed mail to one address. A blank address is named in this service's log and
     * still handed to the dispatcher, so the miss lands in the Email Logs screen rather than
     * only in the server log.
     */
    private EmailSendResult sendMail(EmailType type, String to, Mail mail) {
        noteBlankAddress(to, mail != null ? mail.getSubject() : null);
        return emailDispatchService.sendMail(type, to, mail);
    }

    /** Student plus parent/guardian, matching the confirmation email's recipient list. */
    private void sendMailToStudentAndParent(CounsellingAppointment appointment, Mail mail) {
        for (String addr : studentAndParentEmails(appointment)) {
            sendMail(EmailType.COUNSELLING_NOTIFICATION, addr, mail);
        }
    }

    /**
     * Student plus parent/guardian with a {@code METHOD:CANCEL} invite attached, so the original
     * event disappears from their calendars instead of sitting there with a live meeting link.
     * The invite rides on the rendered message, so the plain-text part travels with it instead
     * of being dropped whenever the .ics is attached.
     */
    private void sendWithCancelledInvite(CounsellingAppointment appointment, Mail mail) {
        List<String> to = studentAndParentEmails(appointment);
        if (to.isEmpty()) return;

        byte[] ics = icsService.buildCancellation(appointment);
        if (ics != null) {
            try {
                EmailSendRequest req = EmailSendRequest.mail(
                        EmailType.COUNSELLING_NOTIFICATION, null, mail);
                req.setTo(new java.util.ArrayList<>(to));
                req.getAttachments().add(new SmtpEmailRequest.EmailAttachment(
                        icsService.cancellationFileName(appointment), ics, "text/calendar"));
                emailDispatchService.send(req);
                return;
            } catch (Exception e) {
                logger.warn("Cancellation invite email failed for appointment {}, falling back to text: {}",
                        appointment.getId(), e.getMessage());
            }
        }
        for (String addr : to) sendMail(EmailType.COUNSELLING_NOTIFICATION, addr, mail);
    }

    private List<String> studentAndParentEmails(CounsellingAppointment appointment) {
        List<String> to = new java.util.ArrayList<>();
        String student = studentEmail(appointment);
        String parent = appointment.getParentEmail();
        if (student != null && !student.isEmpty()) to.add(student);
        if (parent != null && !parent.isEmpty()) to.add(parent);
        return to;
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

    // ─── Counsellor deactivation (Manage Counsellors → Deactivate) ────────────────

    /**
     * The counsellor's single suspension notice. Deliberately one message covering the whole
     * diary: the per-session cancellation copies are withheld for this flow, because a stack
     * of "your session was cancelled" mails reads as a series of faults rather than as the
     * one thing that actually happened to them.
     */
    @Async
    public void sendCounsellorDeactivatedEmail(Counsellor counsellor, int sessionsAffected) {
        try {
            if (counsellor == null || counsellor.getEmail() == null || counsellor.getEmail().isEmpty()) return;
            // The one sentence this mail exists to vary: what happened to the diary they leave behind.
            String sessions = sessionsAffected > 0
                    ? "Your " + sessionsAffected
                      + (sessionsAffected == 1 ? " upcoming session has" : " upcoming sessions have")
                      + " been taken off your calendar and the students have been contacted "
                      + "directly. Nothing is recorded against you and no action is needed "
                      + "from your side."
                    : "You had no upcoming sessions booked, so no student has been affected.";

            sendMail(EmailType.COUNSELLING_NOTIFICATION, counsellor.getEmail(),
                    CounsellingMails.counsellorDeactivated(
                            AccountMails.firstName(counsellor.getName()), sessions));
        } catch (Exception e) {
            logger.error("Failed to send deactivation notice to counsellor {}: {}",
                    counsellor != null ? counsellor.getId() : "null", e.getMessage());
        }
    }

    /**
     * The student, when somebody else can take her session: it is off, and here is the link
     * to pick a new time. The counsellor is never named as deactivated — that is between the
     * team and them.
     */
    @Async
    public void sendCounsellorDeactivatedStudentEmail(CounsellingAppointment appointment, String rescheduleUrl) {
        try {
            Mail mail = CounsellingMails.counsellorDeactivatedStudent(
                    AccountMails.firstName(studentName(appointment)), session(appointment),
                    mailLinks.of(rescheduleUrl, "counselling_reschedule"));

            sendWithCancelledInvite(appointment, mail);
        } catch (Exception e) {
            logger.error("Failed to send counsellor-deactivated student email for appointment {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
        }
    }

    /**
     * The internal summary: who was deactivated and every student left needing attention.
     *
     * <p>Recipients are configured, not passed — they come from
     * {@code email_notification_recipient} keyed by {@code COUNSELLOR_DEACTIVATED_ALERT}, so
     * the list is changed on the Notification Recipients screen rather than in a deploy.
     * Nothing is sent when the list is empty, which is the honest outcome of nobody being
     * configured to receive it.
     */
    @Async
    public void sendCounsellorDeactivatedAdminAlert(
            Counsellor counsellor,
            java.util.List<CounsellorDeactivationService.AffectedSession> sessions,
            User admin) {
        try {
            EmailNotificationRecipientService.Resolved who =
                    recipientService.resolve(EmailType.COUNSELLOR_DEACTIVATED_ALERT, null, null);
            if (who.isEmpty()) {
                logger.warn("Counsellor {} deactivated but no COUNSELLOR_DEACTIVATED_ALERT recipients "
                        + "are configured — no admin alert sent.",
                        counsellor != null ? counsellor.getId() : "null");
                return;
            }

            // Sentence case, and the same two labels the explanatory paragraph names in bold —
            // the mail is read by a person deciding who to ring, not by a machine.
            List<String[]> rows = new java.util.ArrayList<>();
            if (sessions != null) {
                for (CounsellorDeactivationService.AffectedSession row : sessions) {
                    String outcome = "PARKED".equals(row.outcome) ? "Rebooking link sent"
                            : "CANCELLED".equals(row.outcome) ? "Needs follow-up"
                            : "Could not be settled \u2014 check manually";
                    String contact = (row.studentEmail == null ? "-" : row.studentEmail)
                            + (row.studentPhone != null && !row.studentPhone.isEmpty()
                                    ? " \u00b7 " + row.studentPhone : "");
                    rows.add(new String[]{
                            row.studentName == null ? "Student" : row.studentName,
                            row.date + " " + (row.startTime == null ? "" : row.startTime),
                            contact,
                            outcome});
                }
            }

            Mail mail = InternalMails.counsellorDeactivatedAlert(
                    counsellor != null ? counsellor.getName() : "unknown",
                    counsellor != null ? counsellor.getEmail() : "-",
                    admin != null && admin.getName() != null ? admin.getName() : "Career-9 admin",
                    rows,
                    mailLinks.of(adminSessionsUrl(), "admin_sessions"));

            // Its own type, not COUNSELLING_NOTIFICATION: the alert is resolved, throttled and
            // read back in the Email Logs under the type it was configured against.
            for (String to : who.to) sendMail(EmailType.COUNSELLOR_DEACTIVATED_ALERT, to, mail);
            for (String cc : who.cc) sendMail(EmailType.COUNSELLOR_DEACTIVATED_ALERT, cc, mail);
            for (String bcc : who.bcc) sendMail(EmailType.COUNSELLOR_DEACTIVATED_ALERT, bcc, mail);
        } catch (Exception e) {
            logger.error("Failed to send counsellor-deactivated admin alert for counsellor {}: {}",
                    counsellor != null ? counsellor.getId() : "null", e.getMessage());
        }
    }

    // ─── Private helper ───────────────────────────────────────────────────────────

    /**
     * Names a missing address in this service's own log — and then lets the send proceed to the
     * dispatcher anyway, which records it as SKIPPED / "No recipient".
     *
     * <p>This used to return early. The reasoning was that a skip row is indistinguishable from
     * a mail nobody was supposed to get, so the slf4j line carried more meaning. That had it
     * backwards: every caller here does mean to reach someone, so the row is the whole point.
     * Stopping short of the dispatcher left a student who never got their booking link with no
     * trace anywhere an admin can see — the Email Logs screen reads {@code email_send_log}, not
     * the server log, and "did this student ever get written to?" is exactly the question that
     * screen exists to answer. Now it is answered, with the reason attached.
     *
     * <p>The dispatcher handles the empty recipient itself and returns a failed result, so
     * callers that check {@code isSuccess()} behave as they did before.
     */
    private void noteBlankAddress(String toEmail, String subject) {
        if (toEmail != null && !toEmail.isBlank()) return;
        logger.error("No address on record to send \"{}\" to — this mail was NOT sent", subject);
    }
}
