package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.mail.MailEvent;
import com.kccitm.api.model.mail.MailEventContext;
import com.kccitm.api.model.mail.MailRecipientRole;
import com.kccitm.api.repository.Career9.counselling.BlockDateRequestRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.security.TokenProvider;
import com.kccitm.api.service.b2c.LinkBuilder;
import com.kccitm.api.service.mail.MailEvents;

/**
 * A counsellor dropping one booked session, and the automatic re-placement of the student.
 *
 * <p>Distinct from the block-date/leave flow, which stays exactly as it is for planned
 * whole-day absence and still needs admin approval. That flow deliberately rejected
 * auto-reassignment, and for a whole day it is right to — every session would need moving at
 * once. For a single session with a same-time replacement available, auto-assignment is
 * better, because nothing about the student's plans changes.
 *
 * <p>The ladder, in order (docs/COUNSELLING_CANCELLATION.md §6):
 * <ol>
 *   <li><b>Same time, different counsellor.</b> Her plans are untouched.</li>
 *   <li><b>Later the same day.</b> Her day changes, so she can decline it for free.</li>
 *   <li><b>Nobody available.</b> Park the session and let her pick; tell an admin.</li>
 * </ol>
 *
 * <p>Whatever the outcome, the student is never charged and never loses an allowance —
 * none of this was her doing.
 */
@Service
public class CounsellorCancellationService {

    private static final Logger logger = LoggerFactory.getLogger(CounsellorCancellationService.class);
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("h:mm a");

    /** Leave in either state disqualifies a counsellor from receiving a re-placement. */
    private static final List<String> BLOCKING_LEAVE_STATUSES = Arrays.asList("APPROVED", "PENDING");

    @Value("${app.counselling.counsellor-cancellation-window-hours:4}")
    private int windowHours;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private BlockDateRequestRepository blockDateRequestRepository;

    @Autowired
    private BookingService bookingService;

    @Autowired
    private AppointmentService appointmentService;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private MeetingLinkService meetingLinkService;

    @Autowired
    private CounsellingClock clock;

    @Autowired
    private TokenProvider tokenProvider;

    @Autowired
    private LinkBuilder linkBuilder;

    /** Mail-automation hook. Absent until the engine is wired; every publish is best-effort. */
    @Autowired(required = false)
    private MailEvents mailEvents;

    /** How the session was re-placed, echoed back so the caller can say what happened. */
    public enum Outcome { REASSIGNED_SAME_TIME, SHIFTED_LATER, PARKED }

    /**
     * Cancels one session on behalf of its counsellor and re-places the student.
     *
     * @param appointmentId the session being dropped
     * @param actor         the cancelling counsellor's user account
     * @param reasonCode    dropdown value (UNWELL / PERSONAL_EMERGENCY / DOUBLE_BOOKED / OTHER)
     * @param note          free text, required by the caller when the reason is OTHER
     */
    @Transactional
    public Map<String, Object> cancelAndReplace(Long appointmentId, User actor,
                                                String reasonCode, String note) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        CounsellingSlot oldSlot = appointment.getSlot();
        if (oldSlot == null || oldSlot.getDate() == null || oldSlot.getStartTime() == null) {
            throw new BadRequestException("This session has no scheduled time and cannot be cancelled here.");
        }
        guardStatus(appointment);
        enforceWindow(oldSlot);

        LocalDate date = oldSlot.getDate();
        LocalTime originalStart = oldSlot.getStartTime();
        String originalTimeLabel = originalStart.format(TIME_FMT);
        String mode = appointment.getMode();
        Long droppingCounsellorId = appointment.getCounsellor() != null
                ? appointment.getCounsellor().getId() : null;

        // Record the attribution on the row being left behind, before anything moves it.
        appointment.setCancelledByRole(AppointmentService.ROLE_COUNSELLOR);
        appointment.setCancelledByUserId(actor != null ? actor.getId() : null);
        appointment.setCancellationReason(reasonCode);
        appointment.setCancellationNote(note);
        appointment.setCancelledAt(clock.now());
        appointmentRepository.save(appointment);

        CounsellingSlot replacement = findReplacementSlot(appointment, date, originalStart, mode,
                droppingCounsellorId);

        Map<String, Object> result = new LinkedHashMap<>();
        if (replacement == null) {
            park(appointment, oldSlot, "cancelled");
            result.put("outcome", Outcome.PARKED.name());
            result.put("message", "No counsellor was available. The student has been sent a link to pick a new time.");
            return result;
        }

        boolean sameTime = replacement.getStartTime().equals(originalStart);
        CounsellingAppointment moved = moveTo(appointment, replacement, originalStart, sameTime);

        // The counsellor's own hour is gone — they are not there, so it must not be resold.
        // (reschedule() releases the vacated slot back to AVAILABLE, which is right when a
        // student moves but wrong here; re-block it afterwards.)
        blockVacatedSlot(oldSlot, reasonCode);

        String rescheduleUrl = null;
        if (sameTime) {
            notificationService.sendCounsellorSwappedEmail(moved);
            result.put("outcome", Outcome.REASSIGNED_SAME_TIME.name());
            result.put("message", "Reassigned to another counsellor at the same time.");
        } else {
            rescheduleUrl = selfRescheduleUrl(moved);
            notificationService.sendSessionShiftedEmail(moved, originalTimeLabel, rescheduleUrl);
            result.put("outcome", Outcome.SHIFTED_LATER.name());
            result.put("message", "Moved to " + replacement.getStartTime().format(TIME_FMT)
                    + ". The student can change it at no cost.");
        }
        if (mailEvents != null) {
            try {
                mailEvents.publish(rescheduledEvent(moved, appointmentId, date, originalTimeLabel,
                        reasonCode, note, rescheduleUrl));
            } catch (Exception e) {
                logger.warn("Mail event publish failed for appointment {}: {}", moved.getId(), e.getMessage());
            }
        }
        result.put("appointmentId", moved.getId());
        result.put("newSlotId", replacement.getId());
        return result;
    }

    /**
     * Parks a session nobody can cover: status {@code AWAITING_RESCHEDULE}, self-service link
     * to the student, admin told. Also the landing point for a counsellor no-show.
     *
     * <p>Parked rather than cancelled so the appointment keeps its {@code entitlementId} —
     * her paid session stays attached instead of passing through a window where it belongs to
     * nobody.
     */
    @Transactional
    public void park(CounsellingAppointment appointment, CounsellingSlot slot, String cause) {
        appointment.setStatus("AWAITING_RESCHEDULE");
        appointmentRepository.save(appointment);

        if (slot != null) {
            slot.setStatus("CANCELLED");
            slot.setIsBlocked(true);
            // Residue marker — the availability panels hide cancellation-blocked rows.
            slot.setBlockReason("Counsellor unavailable — awaiting reschedule");
            slotRepository.save(slot);
        }

        try {
            notificationService.sendSelfRescheduleEmail(appointment, selfRescheduleUrl(appointment));
        } catch (Exception e) {
            logger.warn("Self-reschedule email failed for parked appointment {}: {}",
                    appointment.getId(), e.getMessage());
        }
        try {
            notificationService.notifyAdminNoReplacement(appointment, cause);
        } catch (Exception e) {
            logger.warn("Admin alert failed for parked appointment {}: {}", appointment.getId(), e.getMessage());
        }
        logger.info("Appointment {} parked ({}) — no replacement counsellor available",
                appointment.getId(), cause);
    }

    // ─── The ladder ──────────────────────────────────────────────────────────────

    /**
     * Rung 1 then rung 2: an eligible counsellor free at the same time, else one free later
     * the same day. Never earlier — she planned around the original time, and a session that
     * has moved backwards may already have passed.
     */
    private CounsellingSlot findReplacementSlot(CounsellingAppointment appointment, LocalDate date,
                                                LocalTime originalStart, String mode,
                                                Long droppingCounsellorId) {
        List<Long> pool = bookingService.eligibleCounsellorIdsFor(appointment);
        if (pool.isEmpty()) return null;

        Set<Long> excluded = new HashSet<>(
                blockDateRequestRepository.findCounsellorIdsBlockedOn(date, BLOCKING_LEAVE_STATUSES));
        if (droppingCounsellorId != null) excluded.add(droppingCounsellorId);

        List<Long> candidates = new ArrayList<>();
        for (Long id : pool) {
            if (!excluded.contains(id)) candidates.add(id);
        }
        if (candidates.isEmpty()) return null;

        List<CounsellingSlot> free = slotRepository.findAvailableSlotsForCounsellors(candidates, date, date);

        List<CounsellingSlot> sameTime = new ArrayList<>();
        List<CounsellingSlot> later = new ArrayList<>();
        for (CounsellingSlot s : free) {
            if (!sameMode(s, mode)) continue;                 // never silently flip online <-> in-person
            if (!isActiveCounsellor(s)) continue;
            if (s.getStartTime().equals(originalStart)) sameTime.add(s);
            else if (s.getStartTime().isAfter(originalStart)) later.add(s);
        }

        CounsellingSlot pick = lightestLoaded(sameTime, date);
        if (pick != null) return pick;
        return lightestLoaded(later, date);
    }

    /**
     * Of the eligible slots, the one belonging to whoever is carrying least that day. Without
     * an explicit rule the query order decides, which in practice means the same counsellor
     * absorbs every reassignment. Ties break on the earlier start time.
     */
    private CounsellingSlot lightestLoaded(List<CounsellingSlot> slots, LocalDate date) {
        CounsellingSlot best = null;
        long bestLoad = Long.MAX_VALUE;
        for (CounsellingSlot s : slots) {
            Long load = appointmentRepository.countActiveForCounsellorOnDate(s.getCounsellor().getId(), date);
            long n = load == null ? 0 : load;
            if (n < bestLoad || (n == bestLoad && best != null && s.getStartTime().isBefore(best.getStartTime()))) {
                best = s;
                bestLoad = n;
            }
        }
        return best;
    }

    /**
     * Moves the appointment onto the replacement slot.
     *
     * <p>Three things have to be fixed up afterwards, each of which is silently wrong if
     * missed:
     * <ul>
     *   <li>{@code reschedule()} copies the <i>old</i> appointment's counsellor onto the new
     *       row, so the session would move to counsellor B's slot while still recording
     *       counsellor A. Nothing looks wrong until someone checks.</li>
     *   <li>{@code location} is a snapshot of the counsellor's office taken at booking time.
     *       Left alone, an in-person student travels to the previous counsellor's address.</li>
     *   <li>The meeting link is per-appointment and must be regenerated, not inherited.</li>
     * </ul>
     *
     * <p>The admin flag is passed so this does not consume the student's one reschedule —
     * she did not ask for any of this.
     */
    private CounsellingAppointment moveTo(CounsellingAppointment appointment, CounsellingSlot target,
                                          LocalTime originalStart, boolean sameTime) {
        LocalDate originalDate = appointment.getSlot().getDate();

        CounsellingAppointment moved = appointmentService.reschedule(
                appointment.getId(), target.getId(), null, true, true);

        Counsellor newCounsellor = target.getCounsellor();
        if (newCounsellor != null) {
            moved.setCounsellor(newCounsellor);
            // Re-snapshot the venue from whoever is actually taking the session.
            if ("OFFLINE".equals(moved.getMode())) {
                moved.setLocation(newCounsellor.getOfficeAddress());
            }
        }
        moved.setMode(target.getMode() != null ? target.getMode() : moved.getMode());

        if (!"OFFLINE".equals(moved.getMode())) {
            try {
                moved.setMeetingLink(meetingLinkService.generateMeetLink(moved));
            } catch (Exception e) {
                logger.warn("Meeting link regeneration failed for reassigned appointment {}: {}",
                        moved.getId(), e.getMessage());
            }
        }

        // Marks the session as one she did not choose: exempts it from her 2-hour window and
        // from the miss count if the new time does not suit and she cancels.
        moved.setForceShifted(true);
        moved.setShiftedFromStart(LocalDateTime.of(originalDate, originalStart));
        // A moved session must remind again — a 24-hour notice already sent for the original
        // time is stale the moment it shifts.
        if (!sameTime) {
            moved.setReminder24hSent(false);
            moved.setReminder1hSent(false);
        }

        return appointmentRepository.save(moved);
    }

    // ─── Guards and helpers ──────────────────────────────────────────────────────

    private void guardStatus(CounsellingAppointment appointment) {
        String status = appointment.getStatus() == null ? "" : appointment.getStatus().toUpperCase();
        if (!"CONFIRMED".equals(status) && !"ASSIGNED".equals(status) && !"PENDING".equals(status)) {
            throw new BadRequestException("This session is " + status + " and can no longer be cancelled.");
        }
    }

    /**
     * Four hours, not the student's two. Uses {@link CounsellingClock} because slot times are
     * IST wall-clock while the JVM runs UTC — the raw clock under-restricts by 5h30m and would
     * accept a cancellation well after the session had finished.
     */
    private void enforceWindow(CounsellingSlot slot) {
        LocalDateTime start = clock.sessionStart(slot.getDate(), slot.getStartTime());
        if (clock.isWithinHoursOfNow(start, windowHours)) {
            throw new BadRequestException(
                    "Too late to cancel here — the session starts within " + windowHours
                            + " hours. Please contact the office so the student can be told.");
        }
    }

    /** Re-block the vacated hour after {@code reschedule()} has handed it back to AVAILABLE. */
    private void blockVacatedSlot(CounsellingSlot oldSlot, String reasonCode) {
        try {
            CounsellingSlot fresh = slotRepository.findById(oldSlot.getId()).orElse(oldSlot);
            fresh.setStatus("CANCELLED");
            fresh.setIsBlocked(true);
            fresh.setBlockReason("Counsellor cancelled" + (reasonCode != null ? ": " + reasonCode : ""));
            slotRepository.save(fresh);
        } catch (Exception e) {
            logger.warn("Failed to block vacated slot {}: {}", oldSlot.getId(), e.getMessage());
        }
    }

    private boolean sameMode(CounsellingSlot slot, String appointmentMode) {
        if (appointmentMode == null) return true;
        String slotMode = slot.getMode() == null ? "ONLINE" : slot.getMode();
        return slotMode.equalsIgnoreCase(appointmentMode);
    }

    private boolean isActiveCounsellor(CounsellingSlot slot) {
        Counsellor c = slot.getCounsellor();
        return c != null && !Boolean.FALSE.equals(c.getIsActive());
    }

    private String selfRescheduleUrl(CounsellingAppointment appointment) {
        return linkBuilder.counsellingReschedule(
                tokenProvider.createCounsellingRescheduleToken(appointment.getId()));
    }

    // ─── Mail events ─────────────────────────────────────────────────────────────

    /**
     * The re-placement as a mail event: from the student's side a swap or a shift is a
     * reschedule. Same readers as the swapped/shifted mails (student plus parent). Nothing is
     * sent from here — the engine decides after commit.
     *
     * <p>Note that {@code moveTo} runs through {@code AppointmentService.reschedule}, which
     * publishes its own APPOINTMENT_RESCHEDULED for the same new row (as it also sends its own
     * reschedule mail); this one carries the re-placed counsellor, the reason and the link.
     */
    private MailEventContext rescheduledEvent(CounsellingAppointment moved, Long oldAppointmentId,
                                              LocalDate oldDate, String oldTimeLabel,
                                              String reasonCode, String note, String rescheduleUrl) {
        CounsellingSlot slot = moved.getSlot();
        Counsellor c = moved.getCounsellor();
        Long userStudentId = moved.getStudent() != null ? moved.getStudent().getUserStudentId() : null;
        String studentName = notificationService.recipientStudentName(moved);
        String reason = reasonCode == null || reasonCode.isBlank() ? note
                : (note == null || note.isBlank() ? reasonCode : reasonCode + ": " + note);
        MailEventContext.Builder b = MailEventContext.of(MailEvent.APPOINTMENT_RESCHEDULED)
                .subject("appointment", moved.getId())
                .subject("appointment", oldAppointmentId)
                .subject("entitlement", moved.getEntitlementId())
                .subject("student", userStudentId)
                .recipient(MailRecipientRole.STUDENT, notificationService.recipientStudentEmail(moved), studentName)
                .recipient(MailRecipientRole.PARENT, moved.getParentEmail(), null)
                .field("student_name", studentName)
                .field("first_name", firstName(studentName))
                .field("counsellor_name", c != null ? c.getName() : null)
                .field("counsellor_email", c != null ? c.getEmail() : null)
                .field("old_session_date", oldDate != null ? oldDate.format(CounsellingNotificationService.DATE_FMT) : null)
                .field("old_session_time", oldTimeLabel)
                .field("meeting_link", moved.getMeetingLink())
                .field("venue", moved.getLocation())
                .field("reschedule_link", rescheduleUrl)
                .field("reschedule_reason", reason)
                .ref("appointmentId", moved.getId())
                .ref("entitlementId", moved.getEntitlementId())
                .ref("userStudentId", userStudentId)
                .ref("counsellorId", c != null ? c.getId() : null)
                .student(userStudentId);
        if (moved.getStudent() != null && moved.getStudent().getInstitute() != null) {
            b.institute(moved.getStudent().getInstitute().getInstituteCode());
        }
        if (slot != null) {
            b.field("duration_minutes", slot.getDurationMinutes());
            if (slot.getDate() != null && slot.getStartTime() != null) {
                String date = slot.getDate().format(CounsellingNotificationService.DATE_FMT);
                String time = slot.getStartTime().format(CounsellingNotificationService.TIME_FMT);
                b.field("session_date", date)
                 .field("session_time", time)
                 .field("session_datetime", date + " at " + time)
                 .date("session_start", Date.from(
                         ZonedDateTime.of(slot.getDate(), slot.getStartTime(), clock.zone()).toInstant()));
            }
            if (slot.getDate() != null && slot.getEndTime() != null) {
                b.date("session_end", Date.from(
                        ZonedDateTime.of(slot.getDate(), slot.getEndTime(), clock.zone()).toInstant()));
            }
        }
        return b.build();
    }

    private static String firstName(String name) {
        if (name == null) return null;
        String t = name.trim();
        int sp = t.indexOf(' ');
        return sp > 0 ? t.substring(0, sp) : t;
    }
}
