package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;

@Service
public class ReminderSchedulerService {

    private static final Logger logger = LoggerFactory.getLogger(ReminderSchedulerService.class);

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    /**
     * Runs every hour. Dispatches both 24-hour and 1-hour reminder checks.
     */
    @Scheduled(cron = "0 0 * * * *")
    public void sendReminders() {
        logger.info("Running scheduled reminder check");
        send24hReminders();
        send1hReminders();
    }

    /**
     * Finds confirmed appointments scheduled for tomorrow that haven't had a
     * 24-hour reminder sent yet, sends emails and in-app notifications to both
     * student and counsellor, then marks the flag.
     */
    private void send24hReminders() {
        LocalDate targetDate = LocalDate.now().plusDays(1);
        List<CounsellingAppointment> appointments = appointmentRepository.findNeedingReminder24h(targetDate);

        logger.info("Sending 24h reminders for {} appointment(s) on {}", appointments.size(), targetDate);

        for (CounsellingAppointment appointment : appointments) {
            try {
                // Send reminder email to student and counsellor
                notificationService.sendReminderEmail(appointment, "Tomorrow");

                // In-app notification to student
                try {
                    Long studentUserId = appointment.getStudent().getUserId();
                    User studentUser = new User();
                    studentUser.setId(studentUserId);
                    notificationService.createInAppNotification(
                            studentUser,
                            "REMINDER_24H",
                            "Counselling Session Tomorrow",
                            "Reminder: You have a counselling session scheduled for tomorrow.",
                            appointment.getId(),
                            "APPOINTMENT");
                } catch (Exception e) {
                    logger.warn("Failed to create 24h in-app notification for student on appointment {}: {}",
                            appointment.getId(), e.getMessage());
                }

                // In-app notification to counsellor
                try {
                    if (appointment.getCounsellor() != null && appointment.getCounsellor().getUser() != null) {
                        User counsellorUser = appointment.getCounsellor().getUser();
                        notificationService.createInAppNotification(
                                counsellorUser,
                                "REMINDER_24H",
                                "Counselling Session Tomorrow",
                                "Reminder: You have a counselling session scheduled for tomorrow.",
                                appointment.getId(),
                                "APPOINTMENT");
                    }
                } catch (Exception e) {
                    logger.warn("Failed to create 24h in-app notification for counsellor on appointment {}: {}",
                            appointment.getId(), e.getMessage());
                }

                appointment.setReminder24hSent(true);
                appointmentRepository.save(appointment);
                logger.info("24h reminder sent for appointment ID {}", appointment.getId());

            } catch (Exception e) {
                logger.error("Error sending 24h reminder for appointment ID {}: {}",
                        appointment.getId(), e.getMessage());
            }
        }
    }

    /**
     * Finds confirmed appointments starting within the next hour that haven't had a
     * 1-hour reminder sent yet, sends emails and in-app notifications to both
     * student and counsellor, then marks the flag.
     */
    private void send1hReminders() {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();
        LocalTime oneHourLater = now.plusHours(1);

        List<CounsellingAppointment> appointments =
                appointmentRepository.findNeedingReminder1h(today, now, oneHourLater);

        logger.info("Sending 1h reminders for {} appointment(s) between {} and {}", appointments.size(), now, oneHourLater);

        for (CounsellingAppointment appointment : appointments) {
            try {
                // Send reminder email to student and counsellor
                notificationService.sendReminderEmail(appointment, "in 1 Hour");

                // In-app notification to student
                try {
                    Long studentUserId = appointment.getStudent().getUserId();
                    User studentUser = new User();
                    studentUser.setId(studentUserId);
                    notificationService.createInAppNotification(
                            studentUser,
                            "REMINDER_1H",
                            "Counselling Session in 1 Hour",
                            "Reminder: Your counselling session starts in 1 hour.",
                            appointment.getId(),
                            "APPOINTMENT");
                } catch (Exception e) {
                    logger.warn("Failed to create 1h in-app notification for student on appointment {}: {}",
                            appointment.getId(), e.getMessage());
                }

                // In-app notification to counsellor
                try {
                    if (appointment.getCounsellor() != null && appointment.getCounsellor().getUser() != null) {
                        User counsellorUser = appointment.getCounsellor().getUser();
                        notificationService.createInAppNotification(
                                counsellorUser,
                                "REMINDER_1H",
                                "Counselling Session in 1 Hour",
                                "Reminder: You have a counselling session starting in 1 hour.",
                                appointment.getId(),
                                "APPOINTMENT");
                    }
                } catch (Exception e) {
                    logger.warn("Failed to create 1h in-app notification for counsellor on appointment {}: {}",
                            appointment.getId(), e.getMessage());
                }

                appointment.setReminder1hSent(true);
                appointmentRepository.save(appointment);
                logger.info("1h reminder sent for appointment ID {}", appointment.getId());

            } catch (Exception e) {
                logger.error("Error sending 1h reminder for appointment ID {}: {}",
                        appointment.getId(), e.getMessage());
            }
        }
    }
}
