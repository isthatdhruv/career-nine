package com.kccitm.api.service.counselling;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingReminderSent;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingReminderSentRepository;

/**
 * Multi-offset counselling reminders + the 8pm day-before counsellor digest.
 *
 * Student reminders fire 12h / 4h / 2h / 15min before the session; counsellor
 * reminders fire 2h / 15min before. Each (appointment, audience, offset) is
 * recorded in {@code counselling_reminder_sent} so re-runs never double-send.
 *
 * The offset job runs every 5 minutes (needed for the 15-minute reminder). An
 * offset fires only while the time-to-start is inside a short window just below
 * the threshold, so a session booked late (e.g. 30 minutes out) is NOT spammed
 * with all the earlier reminders — it simply misses the ones whose window has
 * already passed.
 */
@Service
public class ReminderSchedulerService {

    private static final Logger logger = LoggerFactory.getLogger(ReminderSchedulerService.class);

    // Window (minutes) below each threshold in which the reminder is allowed to
    // fire. Must exceed the 5-minute cron interval so a threshold is never
    // skipped between runs; the idempotency ledger dedupes the overlap.
    private static final long WINDOW_MIN = 7;

    private static final String STUDENT = "STUDENT";
    private static final String COUNSELLOR = "COUNSELLOR";

    // offsetCode -> minutes before start
    private static final Map<String, Long> STUDENT_OFFSETS = new LinkedHashMap<>();
    private static final Map<String, Long> COUNSELLOR_OFFSETS = new LinkedHashMap<>();
    static {
        STUDENT_OFFSETS.put("T12H", 720L);
        STUDENT_OFFSETS.put("T4H", 240L);
        STUDENT_OFFSETS.put("T2H", 120L);
        STUDENT_OFFSETS.put("T15M", 15L);
        COUNSELLOR_OFFSETS.put("T2H", 120L);
        COUNSELLOR_OFFSETS.put("T15M", 15L);
    }

    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    static {
        LABELS.put("T12H", "in 12 hours");
        LABELS.put("T4H", "in 4 hours");
        LABELS.put("T2H", "in 2 hours");
        LABELS.put("T15M", "in 15 minutes");
    }

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingReminderSentRepository reminderSentRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private StudentEntitlementRepository entitlementRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    // Phase 3b: used to email the tokenized counselling booking link alongside the
    // WhatsApp/in-app nudge (the "slot selection link sent to the assessment email").
    @Autowired(required = false)
    private com.kccitm.api.service.b2c.EntitlementService entitlementService;

    /**
     * Runs every 5 minutes. Sends any due student/counsellor reminders that
     * haven't already been sent.
     */
    @Scheduled(cron = "0 */5 * * * *")
    public void sendDueReminders() {
        LocalDate today = LocalDate.now();
        // 12h offset can reach into tomorrow, so scan today + tomorrow.
        List<CounsellingAppointment> appts = appointmentRepository.findConfirmedBetween(today, today.plusDays(1));
        if (appts.isEmpty()) return;

        LocalDateTime now = LocalDateTime.now();
        int sent = 0;
        for (CounsellingAppointment a : appts) {
            if (a.getSlot() == null || a.getSlot().getDate() == null || a.getSlot().getStartTime() == null) continue;
            LocalDateTime start = LocalDateTime.of(a.getSlot().getDate(), a.getSlot().getStartTime());
            long minutesUntil = Duration.between(now, start).toMinutes();
            if (minutesUntil <= 0) continue;

            for (Map.Entry<String, Long> e : STUDENT_OFFSETS.entrySet()) {
                if (due(minutesUntil, e.getValue()) && record(a.getId(), STUDENT, e.getKey())) {
                    sendStudent(a, e.getKey());
                    sent++;
                }
            }
            for (Map.Entry<String, Long> e : COUNSELLOR_OFFSETS.entrySet()) {
                if (due(minutesUntil, e.getValue()) && record(a.getId(), COUNSELLOR, e.getKey())) {
                    sendCounsellor(a, e.getKey());
                    sent++;
                }
            }
        }
        if (sent > 0) logger.info("Counselling reminders: dispatched {} message(s)", sent);
    }

    /**
     * 8pm daily: emails each counsellor the list of their sessions for the next
     * day (plus a short WhatsApp summary).
     */
    @Scheduled(cron = "0 0 20 * * *")
    public void sendCounsellorDailyDigest() {
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        List<CounsellingAppointment> appts = appointmentRepository.findConfirmedOnDate(tomorrow);
        if (appts.isEmpty()) {
            logger.info("Daily counsellor digest: no sessions tomorrow ({})", tomorrow);
            return;
        }
        // Group by counsellor (appointments are ordered by counsellor id then time).
        Map<Long, List<CounsellingAppointment>> byCounsellor = new LinkedHashMap<>();
        Map<Long, Counsellor> counsellors = new LinkedHashMap<>();
        for (CounsellingAppointment a : appts) {
            if (a.getCounsellor() == null) continue;
            Long cid = a.getCounsellor().getId();
            byCounsellor.computeIfAbsent(cid, k -> new ArrayList<>()).add(a);
            counsellors.putIfAbsent(cid, a.getCounsellor());
        }
        String dateLabel = tomorrow.toString();
        for (Map.Entry<Long, List<CounsellingAppointment>> e : byCounsellor.entrySet()) {
            try {
                notificationService.sendCounsellorDailyDigest(
                        counsellors.get(e.getKey()), e.getValue(), dateLabel);
            } catch (Exception ex) {
                logger.warn("Daily digest failed for counsellor {}: {}", e.getKey(), ex.getMessage());
            }
        }
        logger.info("Daily counsellor digest sent to {} counsellor(s) for {}", byCounsellor.size(), tomorrow);
    }

    /**
     * Daily at 10:30am: nudges students who have an active entitlement that
     * includes counselling, still have unused sessions, and haven't booked yet
     * (granted more than 24h ago). Sent at most once per entitlement.
     */
    @Scheduled(cron = "0 30 10 * * *")
    public void sendCounsellingBookingNudges() {
        Date before = new Date(System.currentTimeMillis() - 24L * 60 * 60 * 1000);
        List<StudentEntitlement> due = entitlementRepository.findCounsellingNudgeDue(before);
        if (due.isEmpty()) return;

        int sent = 0;
        for (StudentEntitlement e : due) {
            try {
                int remaining = (e.getCounsellingSessionsTotal() == null ? 0 : e.getCounsellingSessionsTotal())
                        - (e.getCounsellingSessionsUsed() == null ? 0 : e.getCounsellingSessionsUsed());
                if (remaining <= 0) continue;

                Optional<UserStudent> usOpt = userStudentRepository.findById(e.getUserStudentId());
                String name = null, email = null, phone = null;
                Long userId = null;
                if (usOpt.isPresent()) {
                    UserStudent us = usOpt.get();
                    userId = us.getUserId();
                    if (us.getStudentInfo() != null) {
                        name = us.getStudentInfo().getName();
                        email = us.getStudentInfo().getEmail();
                        phone = us.getStudentInfo().getPhoneNumber();
                    }
                }

                notificationService.sendCounsellingBookingNudge(name, email, phone, userId, remaining);
                // Phase 3b: also email the tokenized slot-selection link to the address the
                // student used for the assessment (resendServiceLink resolves it internally).
                if (entitlementService != null && email != null) {
                    try {
                        entitlementService.resendServiceLink(e.getEntitlementId(), "counselling_book", email);
                    } catch (Exception mailEx) {
                        logger.warn("Counselling booking-link email failed for entitlement {}: {}",
                                e.getEntitlementId(), mailEx.getMessage());
                    }
                }
                e.setCounsellingNudgeSentAt(new Date());
                entitlementRepository.save(e);
                sent++;
            } catch (Exception ex) {
                logger.warn("Counselling nudge failed for entitlement {}: {}", e.getEntitlementId(), ex.getMessage());
            }
        }
        logger.info("Counselling booking nudges sent: {}", sent);
    }

    private boolean due(long minutesUntil, long offset) {
        return minutesUntil <= offset && minutesUntil > offset - WINDOW_MIN;
    }

    /** Records a send; returns false if it was already recorded (idempotent). */
    private boolean record(Long appointmentId, String audience, String offsetCode) {
        if (reminderSentRepository.existsByAppointmentIdAndAudienceAndOffsetCode(appointmentId, audience, offsetCode)) {
            return false;
        }
        try {
            reminderSentRepository.save(new CounsellingReminderSent(appointmentId, audience, offsetCode));
            return true;
        } catch (Exception e) {
            // Unique-constraint race with a concurrent run — treat as already sent.
            return false;
        }
    }

    private void sendStudent(CounsellingAppointment a, String offsetCode) {
        String label = LABELS.getOrDefault(offsetCode, "soon");
        notificationService.notifyStudentReminder(a, label);
        createInApp(a, true, offsetCode, label);
    }

    private void sendCounsellor(CounsellingAppointment a, String offsetCode) {
        String label = LABELS.getOrDefault(offsetCode, "soon");
        notificationService.notifyCounsellorReminder(a, label);
        createInApp(a, false, offsetCode, label);
    }

    private void createInApp(CounsellingAppointment a, boolean forStudent, String offsetCode, String label) {
        try {
            User target;
            if (forStudent) {
                target = new User();
                target.setId(a.getStudent().getUserId());
            } else {
                if (a.getCounsellor() == null || a.getCounsellor().getUser() == null) return;
                target = a.getCounsellor().getUser();
            }
            notificationService.createInAppNotification(
                    target,
                    "REMINDER_" + offsetCode,
                    "Counselling Session " + label,
                    "Reminder: your counselling session is " + label + ".",
                    a.getId(),
                    "APPOINTMENT");
        } catch (Exception e) {
            logger.warn("In-app reminder failed for appointment {} ({}): {}", a.getId(), offsetCode, e.getMessage());
        }
    }
}
