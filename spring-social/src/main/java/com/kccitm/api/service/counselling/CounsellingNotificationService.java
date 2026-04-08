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

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.Notification;
import com.kccitm.api.repository.Career9.counselling.NotificationRepository;
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
            String meetingLink = appointment.getMeetingLink();

            String subject = "Counselling Session Confirmed";
            String body = "Dear " + studentName + ",\n\n"
                    + "Your counselling session has been confirmed.\n\n"
                    + "Session Details:\n"
                    + "  Date: " + date + "\n"
                    + "  Time: " + time + "\n"
                    + "  Duration: " + duration + " minutes\n"
                    + (meetingLink != null && !meetingLink.isEmpty()
                            ? "  Meeting Link: " + meetingLink + "\n"
                            : "")
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
            String meetingLink = appointment.getMeetingLink();

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
                    + (meetingLink != null && !meetingLink.isEmpty()
                            ? "  Meeting Link: " + meetingLink + "\n"
                            : "")
                    + "\nPlease be prepared for your session.\n\n"
                    + "Regards,\nCareer-Nine Team";
            sendEmail(studentEmail, studentSubject, studentBody);

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
                        + "  Duration: " + duration + " minutes\n\n"
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
