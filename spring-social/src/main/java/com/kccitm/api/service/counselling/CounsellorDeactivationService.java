package com.kccitm.api.service.counselling;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import com.kccitm.api.security.TokenProvider;
import com.kccitm.api.service.b2c.LinkBuilder;

/**
 * Deactivating a counsellor who still has sessions booked.
 *
 * <p>Suspension used to touch nothing but the two flags: the counsellor lost their login
 * while every booked session stayed exactly where it was, with nobody told. The student
 * kept a confirmed session in her portal, kept receiving its reminders, and found out on
 * the day, when nobody could check her in. Only then did the lifecycle sweep park it as a
 * counsellor no-show.
 *
 * <p>So deactivation now settles the diary in the same breath, taking one of two routes per
 * session depending on whether anyone else can take it:
 * <ul>
 *   <li><b>Another eligible counsellor exists</b> — the session is parked
 *       ({@code AWAITING_RESCHEDULE}) and the student is sent the no-login link to pick a
 *       new time. Parked rather than cancelled so her paid session stays attached to the
 *       appointment instead of passing through a window where it belongs to nobody.</li>
 *   <li><b>Nobody else covers her assessment</b> — the session is cancelled through the
 *       normal admin path, which credits the session back and tells her the team will be in
 *       touch. There is no honest link to offer when there is nobody to book.</li>
 * </ul>
 *
 * <p>Only sessions still ahead of the moment the button is pressed are touched; one already
 * under way is left to finish, and the past is history.
 *
 * <p>The counsellor gets a single suspension notice rather than one cancellation mail per
 * student (see {@code AppointmentService.cancel(..., notifyCounsellor)}), and the configured
 * admins get one summary naming every affected student.
 */
@Service
public class CounsellorDeactivationService {

    private static final Logger logger = LoggerFactory.getLogger(CounsellorDeactivationService.class);

    /** Statuses that still represent a session expected to happen. */
    private static final List<String> LIVE_STATUSES =
            Arrays.asList("PENDING", "ASSIGNED", "CONFIRMED", "AWAITING_RESCHEDULE");

    @Autowired private CounsellorRepository counsellorRepository;
    @Autowired private CounsellingAppointmentRepository appointmentRepository;
    @Autowired private CounsellingSlotRepository slotRepository;
    @Autowired private AppointmentService appointmentService;
    @Autowired private BookingService bookingService;
    @Autowired private CounsellorService counsellorService;
    @Autowired private CounsellingNotificationService notificationService;
    @Autowired private CounsellingClock clock;
    @Autowired private LinkBuilder linkBuilder;
    @Autowired private TokenProvider tokenProvider;

    /** One affected session, as the confirmation dialog and the admin email both need it. */
    public static class AffectedSession {
        public Long appointmentId;
        public String studentName;
        public String studentEmail;
        public String studentPhone;
        public String date;
        public String startTime;
        public String endTime;
        public String mode;
        public String status;
        /** True when somebody else can take it, i.e. the student gets a rebooking link. */
        public boolean hasAlternative;
        /** Filled after the run: PARKED or CANCELLED. */
        public String outcome;
    }

    /**
     * What deactivating this counsellor would do, without doing any of it. Drives the
     * confirmation dialog so the admin sees the students before pressing the button.
     */
    public List<AffectedSession> preview(Long counsellorId) {
        Counsellor counsellor = counsellorRepository.findById(counsellorId)
                .orElseThrow(() -> new ResourceNotFoundException("Counsellor", "id", counsellorId));
        List<AffectedSession> out = new ArrayList<>();
        for (CounsellingAppointment a : upcomingSessions(counsellor)) {
            out.add(describe(a, hasAlternativeCounsellor(a, counsellorId)));
        }
        return out;
    }

    /**
     * Suspend the counsellor and settle every session still ahead of them.
     *
     * @return counts plus the per-session outcomes, for the admin's confirmation screen
     */
    @Transactional
    public Map<String, Object> deactivate(Long counsellorId, User admin) {
        Counsellor counsellor = counsellorRepository.findById(counsellorId)
                .orElseThrow(() -> new ResourceNotFoundException("Counsellor", "id", counsellorId));

        List<CounsellingAppointment> affected = upcomingSessions(counsellor);
        List<AffectedSession> rows = new ArrayList<>();
        int parked = 0, cancelled = 0, failed = 0;

        for (CounsellingAppointment a : affected) {
            boolean alternative = hasAlternativeCounsellor(a, counsellorId);
            AffectedSession row = describe(a, alternative);
            try {
                if (alternative) {
                    parkForRebooking(a);
                    row.outcome = "PARKED";
                    parked++;
                } else {
                    // notifyCounsellor=false: they get the single suspension notice below
                    // instead of one "your session was cancelled" mail per student.
                    appointmentService.cancel(a.getId(), admin, AppointmentService.ROLE_ADMIN,
                            "COUNSELLOR_DEACTIVATED", "The counsellor's account has been deactivated.",
                            false);
                    row.outcome = "CANCELLED";
                    cancelled++;
                }
            } catch (Exception e) {
                // One session that will not settle must not strand the rest, nor stop the
                // suspension itself — the admin is told the count so it can be chased.
                row.outcome = "FAILED";
                failed++;
                logger.warn("Could not settle appointment {} while deactivating counsellor {}: {}",
                        a.getId(), counsellorId, e.getMessage());
            }
            rows.add(row);
        }

        // Flags last, so a failure above leaves the counsellor active and the state coherent.
        counsellorService.setActiveForCounsellor(counsellor, false);

        try {
            notificationService.sendCounsellorDeactivatedEmail(counsellor, parked + cancelled);
        } catch (Exception e) {
            logger.warn("Deactivation notice to counsellor {} failed: {}", counsellorId, e.getMessage());
        }
        try {
            notificationService.sendCounsellorDeactivatedAdminAlert(counsellor, rows, admin);
        } catch (Exception e) {
            logger.warn("Deactivation admin alert for counsellor {} failed: {}", counsellorId, e.getMessage());
        }

        logger.info("Counsellor {} deactivated: {} parked, {} cancelled, {} failed",
                counsellorId, parked, cancelled, failed);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("counsellorId", counsellorId);
        result.put("counsellorName", counsellor.getName());
        result.put("parked", parked);
        result.put("cancelled", cancelled);
        result.put("failed", failed);
        result.put("sessions", rows);
        return result;
    }

    // ── Internals ────────────────────────────────────────────────────────────

    /**
     * Sessions still to come. A session already in progress is excluded — it is being taken
     * right now, and pulling it out from under both of them helps nobody.
     */
    private List<CounsellingAppointment> upcomingSessions(Counsellor counsellor) {
        LocalDateTime now = clock.now();
        List<CounsellingAppointment> out = new ArrayList<>();
        for (CounsellingAppointment a : appointmentRepository.findByCounsellorId(counsellor.getId())) {
            String status = a.getStatus() == null ? "" : a.getStatus().toUpperCase();
            if (!LIVE_STATUSES.contains(status)) continue;
            CounsellingSlot slot = a.getSlot();
            if (slot == null || slot.getDate() == null || slot.getStartTime() == null) continue;
            if (LocalDateTime.of(slot.getDate(), slot.getStartTime()).isBefore(now)) continue;
            out.add(a);
        }
        out.sort((x, y) -> {
            CounsellingSlot sx = x.getSlot(), sy = y.getSlot();
            int byDate = sx.getDate().compareTo(sy.getDate());
            return byDate != 0 ? byDate : sx.getStartTime().compareTo(sy.getStartTime());
        });
        return out;
    }

    /**
     * Is there anyone else who could take this session?
     *
     * <p>The pool is the same one the booking flow uses — counsellors assigned to the
     * student's assessment, falling back to her institute — minus the counsellor being
     * suspended. The assessment query filters on the *assignment* being active rather than
     * the counsellor, so already-suspended counsellors are dropped here too; offering a
     * rebooking link into a pool of people who cannot sign in would be worse than no link.
     */
    private boolean hasAlternativeCounsellor(CounsellingAppointment appointment, Long excludeCounsellorId) {
        try {
            for (Long id : bookingService.eligibleCounsellorIdsFor(appointment)) {
                if (id == null || id.equals(excludeCounsellorId)) continue;
                Counsellor other = counsellorRepository.findById(id).orElse(null);
                if (other != null && !Boolean.FALSE.equals(other.getIsActive())) return true;
            }
        } catch (Exception e) {
            logger.debug("Could not resolve alternative counsellors for appointment {}: {}",
                    appointment.getId(), e.getMessage());
        }
        return false;
    }

    /**
     * Park the session and hand the student the self-service link.
     *
     * <p>Same landing state as a counsellor no-show, reached deliberately rather than by the
     * lifecycle sweep noticing afterwards. The slot is closed, not reopened: the counsellor
     * is suspended, so that hour must not be sold to anybody else.
     */
    private void parkForRebooking(CounsellingAppointment appointment) {
        appointment.setStatus("AWAITING_RESCHEDULE");
        // Not a no-show by anybody — the session never got the chance to happen.
        appointment.setMissedByRole(null);
        // Stamped so the reason survives the status: "awaiting a new time" alone cannot say
        // whether the counsellor failed to appear or had their account suspended, and the
        // dashboard's needs-attention list has to tell an admin which it was.
        appointment.setCancellationReason("COUNSELLOR_DEACTIVATED");
        appointmentRepository.save(appointment);

        CounsellingSlot slot = appointment.getSlot();
        if (slot != null) {
            slot.setStatus("CANCELLED");
            slot.setIsBlocked(true);
            slotRepository.save(slot);
        }

        notificationService.sendCounsellorDeactivatedStudentEmail(
                appointment, linkBuilder.counsellingReschedule(
                        tokenProvider.createCounsellingRescheduleToken(appointment.getId())));
    }

    private AffectedSession describe(CounsellingAppointment a, boolean hasAlternative) {
        AffectedSession row = new AffectedSession();
        row.appointmentId = a.getId();
        row.studentName = notificationService.recipientStudentName(a);
        row.studentEmail = notificationService.recipientStudentEmail(a);
        row.studentPhone = a.getStudentContactPhone();
        CounsellingSlot slot = a.getSlot();
        row.date = slot != null && slot.getDate() != null ? slot.getDate().toString() : null;
        row.startTime = slot != null && slot.getStartTime() != null ? slot.getStartTime().toString() : null;
        row.endTime = slot != null && slot.getEndTime() != null ? slot.getEndTime().toString() : null;
        row.mode = a.getMode();
        row.status = a.getStatus();
        row.hasAlternative = hasAlternative;
        return row;
    }
}
