package com.kccitm.api.service.counselling;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
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
import com.microtripit.mandrillapp.lutung.MandrillApi;
import com.microtripit.mandrillapp.lutung.view.MandrillMessage;
import com.microtripit.mandrillapp.lutung.view.MandrillMessage.Recipient;
import com.microtripit.mandrillapp.lutung.view.MandrillMessageStatus;

@Service
public class CounsellingNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(CounsellingNotificationService.class);

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MMMM d, yyyy");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("h:mm a");

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private MandrillApi mandrillApi;

    @Autowired
    private WhatsAppService whatsAppService;

    @Autowired
    private IcsService icsService;

    @Autowired(required = false)
    private SmtpEmailService smtpEmailService;

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
            String studentName = appointment.getStudent().getStudentInfo().getName();
            String reason = appointment.getStudentReason();
            String date = appointment.getSlot().getDate().format(DATE_FMT);
            String time = appointment.getSlot().getStartTime().format(TIME_FMT);
            int duration = appointment.getSlot().getDurationMinutes();

            String subject = "New Counselling Session Assigned to You";
            String body = "Dear " + counsellorName + ",\n\n"
                    + "A new counselling session has been assigned to you.\n\n"
                    + "Session Details:\n"
                    + "  Student: " + studentName + "\n"
                    + (reason != null && !reason.isEmpty() ? "  Reason: " + reason + "\n" : "")
                    + "  Date: " + date + "\n"
                    + "  Time: " + time + "\n"
                    + "  Duration: " + duration + " minutes\n\n"
                    + "Please review and confirm the appointment.\n\n"
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
        try {
            String date = appointment.getSlot().getDate().format(DATE_FMT);
            String time = appointment.getSlot().getStartTime().format(TIME_FMT);

            String subject = "Counselling Session Cancelled";
            String body = "Dear " + recipientName + ",\n\n"
                    + "Your counselling session scheduled on " + date + " at " + time
                    + " has been cancelled by " + cancelledByName + ".\n\n"
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
                    + "Your session has been cancelled. Please log in to the student portal "
                    + "and book a new session at a time that works for you.\n\n"
                    + "We apologise for the inconvenience.\n\n"
                    + "Regards,\nCareer-Nine Team";

            sendEmail(studentEmail, subject, body);
        } catch (Exception e) {
            logger.error("Failed to send counsellor-leave cancellation email for appointment ID: {}. Error: {}",
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
            String newDate = newAppointment.getSlot().getDate().format(DATE_FMT);
            String newTime = newAppointment.getSlot().getStartTime().format(TIME_FMT);
            int newDuration = newAppointment.getSlot().getDurationMinutes();

            String subject = "Counselling Session Rescheduled";
            String body = "Dear " + studentName + ",\n\n"
                    + "Your counselling session has been rescheduled.\n\n"
                    + "Previous Schedule:\n"
                    + "  Date: " + oldDate + "\n"
                    + "  Time: " + oldTime + "\n\n"
                    + "New Schedule:\n"
                    + "  Date: " + newDate + "\n"
                    + "  Time: " + newTime + "\n"
                    + "  Duration: " + newDuration + " minutes\n\n"
                    + "Please update your calendar accordingly.\n\n"
                    + "Regards,\nCareer-Nine Team";

            sendEmail(studentEmail, subject, body);
        } catch (Exception e) {
            logger.error("Failed to send reschedule email for appointment ID: {}. Error: {}",
                    newAppointment != null ? newAppointment.getId() : "null", e.getMessage());
        }
    }

    @Async
    public void sendReminderEmail(CounsellingAppointment appointment, String period) {
        try {
            String date = appointment.getSlot().getDate().format(DATE_FMT);
            String time = appointment.getSlot().getStartTime().format(TIME_FMT);
            int duration = appointment.getSlot().getDurationMinutes();
            // Phase 5: mode-aware — online shows the meeting link, offline shows the venue.
            String attend = attendanceLine(appointment);

            // Send to student
            String studentEmail = appointment.getStudent().getStudentInfo().getEmail();
            String studentName = appointment.getStudent().getStudentInfo().getName();
            String studentSubject = "Reminder: Counselling Session in " + period;
            String studentBody = "Dear " + studentName + ",\n\n"
                    + "This is a reminder that your counselling session is scheduled in " + period + ".\n\n"
                    + "Session Details:\n"
                    + "  Date: " + date + "\n"
                    + "  Time: " + time + "\n"
                    + "  Duration: " + duration + " minutes\n"
                    + "  " + attend + "\n"
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
                        + "  Student: " + studentName + "\n"
                        + "  Date: " + date + "\n"
                        + "  Time: " + time + "\n"
                        + "  Duration: " + duration + " minutes\n"
                        + "  " + attend + "\n\n"
                        + "Regards,\nCareer-Nine Team";
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
            String date = appointment.getSlot().getDate().format(DATE_FMT);
            String time = appointment.getSlot().getStartTime().format(TIME_FMT);
            boolean offline = "OFFLINE".equals(appointment.getMode());
            String channelLabel = offline
                    ? (appointment.getLocation() != null && !appointment.getLocation().isEmpty()
                            ? "Venue: " + appointment.getLocation()
                            : "Venue: your counsellor will share the address shortly")
                    : (appointment.getMeetingLink() != null && !appointment.getMeetingLink().isEmpty()
                            ? "Meeting link: " + appointment.getMeetingLink()
                            : "Meeting link: to be shared");

            String subject = "Counselling Session Confirmed";
            // Phase 6: one-click "Add to Google Calendar" link (no API/OAuth needed) in
            // addition to the attached .ics invite.
            String gcal = googleCalendarLink(appointment);
            String body = "Dear " + studentName + ",\n\n"
                    + "Your counselling session has been confirmed.\n\n"
                    + "  Date: " + date + "\n"
                    + "  Time: " + time + "\n"
                    + "  Mode: " + (offline ? "In-person" : "Online") + "\n"
                    + "  " + channelLabel + "\n\n"
                    + (gcal != null ? "Add to Google Calendar: " + gcal + "\n\n" : "")
                    + "A calendar invite is also attached so you can add this to any calendar.\n\n"
                    + "Regards,\nCareer-Nine Team";

            // Recipients: the student, plus the parent/guardian email if one was given.
            String parentEmail = appointment.getParentEmail();
            java.util.List<String> emailTo = new java.util.ArrayList<>();
            if (studentEmail != null && !studentEmail.isEmpty()) emailTo.add(studentEmail);
            if (parentEmail != null && !parentEmail.isEmpty()) emailTo.add(parentEmail);

            // Email with .ics attachment (falls back to plain Mandrill text if
            // the Gmail sender or the invite isn't available).
            byte[] ics = icsService.buildInvite(appointment);
            boolean emailed = false;
            if (!emailTo.isEmpty() && smtpEmailService != null && ics != null) {
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
                    smtpEmailService.sendEmail(req);
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
            java.util.List<String> waParams =
                    Arrays.asList(studentName, date + " " + time, offline ? "In-person" : "Online");
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

    /** Sends the check-in OTP to the student via WhatsApp; email fallback. */
    @Async
    public void sendCheckinOtpToStudent(CounsellingAppointment appointment, String code) {
        boolean sent = whatsAppService.sendTemplate(
                studentPhone(appointment), whatsAppService.otpCampaign(),
                Arrays.asList(studentName(appointment), code));
        if (!sent) {
            String email = studentEmail(appointment);
            if (email != null && !email.isEmpty()) {
                String subject = "Your counselling check-in code";
                String body = "Dear " + studentName(appointment) + ",\n\n"
                        + "Share this code with your counsellor to start your session: " + code + "\n\n"
                        + "This code expires in 15 minutes.\n\n"
                        + "Regards,\nCareer-Nine Team";
                sendEmail(email, subject, body);
            }
        }
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

    private String studentName(CounsellingAppointment a) {
        if (a.getStudentContactName() != null && !a.getStudentContactName().isEmpty()) {
            return a.getStudentContactName();
        }
        try { return a.getStudent().getStudentInfo().getName(); } catch (Exception e) { return "Student"; }
    }

    private String studentEmail(CounsellingAppointment a) {
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
        try {
            MandrillMessage message = new MandrillMessage();
            message.setSubject(subject);
            message.setText(body);
            message.setAutoText(true);
            message.setFromEmail("noreply@kccitm.edu.in");
            message.setFromName("Career-Nine");

            List<Recipient> recipients = new ArrayList<>();
            Recipient recipient = new Recipient();
            recipient.setEmail(toEmail);
            recipients.add(recipient);
            message.setTo(recipients);

            MandrillMessageStatus[] statuses = mandrillApi.messages().send(message, false);
            if (statuses != null && statuses.length > 0) {
                logger.info("Email sent to {}: status={}", toEmail, statuses[0].getStatus());
            }
        } catch (Exception e) {
            logger.error("Failed to send email to {}. Subject: {}. Error: {}", toEmail, subject, e.getMessage());
        }
    }
}
