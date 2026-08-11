package com.kccitm.api.service.counselling;

import java.time.LocalDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;

/**
 * Attendance: who actually turned up, and what follows from it.
 *
 * <p>Presence is proved by one thing — the counsellor entering the OTP that was issued to the
 * student. She reads it out, he types it in; only a student who is genuinely there can supply
 * the code, so a verified OTP proves <i>both</i> of them attended.
 *
 * <p>That gives the counsellor exactly two actions, and the outcome follows from which one
 * they take (docs/COUNSELLING_CANCELLATION.md §7):
 *
 * <table><caption>Outcomes</caption>
 *   <tr><td>Enters the OTP</td><td>Session happened</td></tr>
 *   <tr><td>Marks the student absent</td><td>Student no-show — costs her a miss</td></tr>
 *   <tr><td>Neither</td><td><b>Counsellor</b> no-show — costs her nothing</td></tr>
 * </table>
 *
 * <p>The default falling on the counsellor is deliberate: they hold both tools, so silence
 * from them means they were not there. It also makes every ordinary session decidable without
 * an admin having to investigate — admin sees only disputes.
 *
 * <p>Two timing rules keep that fair. The OTP stays valid for the <b>whole session</b>, so a
 * late entry at minute 12 or minute 30 is simply accepted — locking it to the first ten
 * minutes would record a session that genuinely happened as a no-show. And the absent mark is
 * available only <b>from the alarm point until the slot ends</b>: not before, because she
 * deserves a few minutes' grace, and not afterwards at all.
 */
@Service
public class CheckinReviewService {

    private static final Logger logger = LoggerFactory.getLogger(CheckinReviewService.class);

    @Value("${app.counselling.checkin-alarm-minutes:10}")
    private int alarmMinutes;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private AppointmentService appointmentService;

    @Autowired
    private CounsellingClock clock;

    @Autowired
    private AuditLogService auditLogService;

    /**
     * Prompts both sides when a session is under way with nobody checked in.
     *
     * <p>Runs every 5 minutes, so a session is prompted somewhere between the alarm point and
     * five minutes after it. {@code reminder1hSent} is not reused as the "already prompted"
     * marker — {@code sessionStartedAt} is set here instead, which is otherwise untouched
     * until check-in and so cannot collide with the reminder pipeline.
     *
     * <p>The counsellor prompt matters as much as the student's. Doing nothing is what records
     * the session as <i>their</i> no-show, so a counsellor who is present but distracted would
     * otherwise be marked absent for a session they actually ran.
     */
    @Scheduled(cron = "0 */5 * * * *")
    public void promptUncheckedSessions() {
        List<CounsellingAppointment> candidates = appointmentRepository.findAwaitingCheckinOnDate(clock.today());
        if (candidates.isEmpty()) return;

        int prompted = 0;
        for (CounsellingAppointment a : candidates) {
            CounsellingSlot slot = a.getSlot();
            if (slot == null || slot.getStartTime() == null || slot.getEndTime() == null) continue;
            if (a.getSessionStartedAt() != null) continue; // already prompted

            LocalDateTime start = clock.sessionStart(slot.getDate(), slot.getStartTime());
            LocalDateTime end = clock.sessionStart(slot.getDate(), slot.getEndTime());
            LocalDateTime now = clock.now();

            if (clock.minutesSince(start) < alarmMinutes) continue; // not yet
            if (now.isAfter(end)) continue;                          // over; the sweep will close it

            try {
                notificationService.sendCheckinPromptToStudent(a);
                notificationService.sendCheckinPromptToCounsellor(a);
                a.setSessionStartedAt(now); // marker: prompted once, do not repeat
                appointmentRepository.save(a);
                prompted++;
            } catch (Exception e) {
                logger.warn("Check-in prompt failed for appointment {}: {}", a.getId(), e.getMessage());
            }
        }
        if (prompted > 0) logger.info("Counselling check-in alarm: prompted {} session(s)", prompted);
    }

    /**
     * The counsellor records that the student did not appear.
     *
     * <p>Confined to the session window and notified immediately, because it is a single click
     * that costs her one of her two free changes and eventually real money. A counsellor who
     * arrived late, or who has simply forgotten she was there, could otherwise clear the case
     * with it and leave no counter-evidence at all.
     */
    @Transactional
    public CounsellingAppointment markStudentAbsent(Long appointmentId, User actor) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        CounsellingSlot slot = appointment.getSlot();
        if (slot == null || slot.getDate() == null || slot.getStartTime() == null || slot.getEndTime() == null) {
            throw new BadRequestException("This session has no scheduled time.");
        }
        if (appointment.getCheckinVerifiedAt() != null) {
            throw new BadRequestException("This session has already been checked in — the student was present.");
        }
        if (appointment.getMarkedAbsentAt() != null) {
            throw new BadRequestException("The student is already marked absent for this session.");
        }

        LocalDateTime start = clock.sessionStart(slot.getDate(), slot.getStartTime());
        LocalDateTime end = clock.sessionStart(slot.getDate(), slot.getEndTime());
        LocalDateTime now = clock.now();

        if (now.isBefore(start.plusMinutes(alarmMinutes))) {
            throw new BadRequestException("Too early — please wait until " + alarmMinutes
                    + " minutes after the start time before marking the student absent.");
        }
        if (now.isAfter(end)) {
            throw new BadRequestException(
                    "This session has ended and can no longer be marked. It will be recorded as a "
                            + "counsellor no-show.");
        }

        appointment.setMissedByRole("STUDENT");
        appointment.setMarkedAbsentAt(now);
        appointment.setMarkedAbsentBy(actor != null ? actor.getId() : null);
        appointment = appointmentRepository.save(appointment);

        // Tell her now, not at slot end, and with the count so the point at which the next
        // session becomes chargeable is never sprung on her.
        int remaining = appointmentService.remainingMisses(appointment.getEntitlementId());
        notificationService.sendMarkedAbsentEmail(appointment, remaining);

        auditLogService.logSimple(appointment, "STUDENT_MARKED_ABSENT", actor, null);
        logger.info("Appointment {} — student marked absent by user {}; {} miss(es) remaining",
                appointmentId, actor != null ? actor.getId() : "unknown", remaining);
        return appointment;
    }

    /**
     * The student contests an absent mark.
     *
     * <p>Raising it suspends the strike immediately: the allowance query skips a no-show whose
     * dispute is open, so nothing counts against her while the question is unsettled. If it is
     * never resolved the default stays "no strike" — an open dispute is not evidence.
     */
    @Transactional
    public CounsellingAppointment raiseDispute(Long appointmentId, User actor, String note) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        if (!"STUDENT".equals(appointment.getMissedByRole())) {
            throw new BadRequestException("There is nothing to dispute on this session.");
        }
        if (appointment.getDisputeRaisedAt() != null) {
            throw new BadRequestException("You have already raised this with us — we are looking into it.");
        }

        appointment.setDisputeRaisedAt(clock.now());
        appointment.setStatus("UNDER_REVIEW");
        appointment = appointmentRepository.save(appointment);

        notificationService.notifyAdminDisputeRaised(appointment);
        auditLogService.logSimple(appointment, "ATTENDANCE_DISPUTED", actor, note);
        logger.info("Appointment {} attendance disputed by user {}", appointmentId,
                actor != null ? actor.getId() : "unknown");
        return appointment;
    }

    /**
     * Admin settles a dispute.
     *
     * <p>Upheld leaves it {@code MISSED} against her. Overturned records it as {@code
     * COMPLETED} and clears the attribution entirely, so the allowance query stops counting
     * it — the session is treated as having happened, which is what she said all along.
     */
    @Transactional
    public CounsellingAppointment resolveDispute(Long appointmentId, User admin, boolean upheld, String note) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        if (appointment.getDisputeRaisedAt() == null) {
            throw new BadRequestException("No dispute has been raised on this session.");
        }
        if (appointment.getDisputeResolvedAt() != null) {
            throw new BadRequestException("This dispute has already been settled.");
        }

        appointment.setDisputeResolvedAt(clock.now());
        appointment.setDisputeResolvedBy(admin != null ? admin.getId() : null);

        if (upheld) {
            appointment.setStatus("MISSED");
            appointment.setAttended(Boolean.FALSE);
        } else {
            appointment.setStatus("COMPLETED");
            appointment.setAttended(Boolean.TRUE);
            // Clearing the attribution is what actually removes the strike; leaving
            // missedByRole set would keep it counted despite the session being restored.
            appointment.setMissedByRole(null);
            appointment.setMarkedAbsentAt(null);
        }
        appointment = appointmentRepository.save(appointment);

        notificationService.sendDisputeOutcomeEmail(appointment, upheld, note);
        auditLogService.logSimple(appointment,
                upheld ? "DISPUTE_UPHELD" : "DISPUTE_OVERTURNED", admin, note);
        logger.info("Appointment {} dispute {} by admin {}", appointmentId,
                upheld ? "upheld" : "overturned", admin != null ? admin.getId() : "unknown");
        return appointment;
    }

    /** Open disputes — the only cases needing an admin decision. */
    public List<CounsellingAppointment> getOpenDisputes() {
        return appointmentRepository.findOpenDisputes();
    }

    public int getAlarmMinutes() {
        return alarmMinutes;
    }
}
