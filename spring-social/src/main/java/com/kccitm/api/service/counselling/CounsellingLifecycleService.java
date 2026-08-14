package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.service.b2c.EntitlementService;

/**
 * End-of-slot lifecycle sweep (Counselling Phase 2).
 *
 * <p>Counselling slots are fixed-length. When a session's slot end time passes, the
 * session is over — there is no explicit "end session" click. This scheduled job closes
 * each ended session and frees its slot so the counsellor dashboard reflects reality:
 * <ul>
 *   <li>the student checked in via OTP (status IN_PROGRESS / checkin verified) ->
 *       {@code COMPLETED}, {@code attended = true};</li>
 *   <li>the student never checked in ({@code CONFIRMED} at end time) -> {@code MISSED},
 *       {@code attended = false}, and a no-show notice inviting them to rebook.</li>
 * </ul>
 * In both cases the slot is marked {@code COMPLETED} so it no longer counts as booked.
 *
 * <p>The transition itself is the idempotency guard: the query only selects still-active
 * sessions, so a closed appointment is never reprocessed. Runs every 5 minutes (aligned
 * with the reminder sweep cadence).
 */
@Service
public class CounsellingLifecycleService {

    private static final Logger logger = LoggerFactory.getLogger(CounsellingLifecycleService.class);

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private EntitlementService entitlementService;

    @Autowired
    private CounsellingClock clock;

    @Autowired
    private AppointmentService appointmentService;

    @Autowired
    private com.kccitm.api.security.TokenProvider tokenProvider;

    @Autowired
    private com.kccitm.api.service.b2c.LinkBuilder linkBuilder;

    @Scheduled(cron = "0 */5 * * * *")
    public void closeEndedSessions() {
        LocalDate today = clock.today();
        List<CounsellingAppointment> candidates = appointmentRepository.findActiveUpToDate(today);
        if (candidates.isEmpty()) return;

        LocalDateTime now = clock.now();
        int completed = 0, studentMissed = 0, counsellorMissed = 0;
        for (CounsellingAppointment a : candidates) {
            CounsellingSlot slot = a.getSlot();
            if (slot == null || slot.getDate() == null || slot.getEndTime() == null) continue;

            LocalDateTime end = LocalDateTime.of(slot.getDate(), slot.getEndTime());
            if (now.isBefore(end)) continue; // session not over yet

            // Three-way verdict, decided by what the counsellor did (see
            // docs/COUNSELLING_CANCELLATION.md §7.3). The old two-way version treated the
            // absence of a check-in as the student's fault, so a counsellor who never turned
            // up — or who turned up and forgot the OTP — produced a MISSED row against HER.
            // Harmless when it was only a record; a charge for someone else's absence once a
            // miss costs money.
            boolean checkedIn = a.getCheckinVerifiedAt() != null || "IN_PROGRESS".equals(a.getStatus());
            boolean markedAbsent = a.getMarkedAbsentAt() != null;
            boolean counsellorNoShow = !checkedIn && !markedAbsent;

            if (checkedIn) {
                a.setStatus("COMPLETED");
                a.setAttended(Boolean.TRUE);
                completed++;
            } else if (markedAbsent) {
                a.setStatus("MISSED");
                a.setAttended(Boolean.FALSE);
                a.setMissedByRole("STUDENT");
                studentMissed++;
            } else {
                // Nobody recorded anything, and the counsellor is the one who could have.
                // Park the session rather than cancelling it: a parked appointment keeps its
                // entitlementId, so her paid session stays attached and cannot be lost in the
                // gap between crediting back and rebooking.
                a.setStatus("AWAITING_RESCHEDULE");
                a.setAttended(Boolean.FALSE);
                a.setMissedByRole("COUNSELLOR");
                counsellorMissed++;
            }

            // The slot's time has passed either way — mark it consumed, not AVAILABLE.
            try {
                slot.setStatus("COMPLETED");
                slotRepository.save(slot);
            } catch (Exception e) {
                logger.warn("Failed to free slot {} for appointment {}: {}", slot.getId(), a.getId(), e.getMessage());
            }

            appointmentRepository.save(a);

            if (markedAbsent) {
                creditBackIfWithinAllowance(a);
                // She was already told the moment the counsellor marked her, so nothing is
                // sent here — a second notice at slot end would only be confusing.
            } else if (counsellorNoShow) {
                handleCounsellorNoShow(a);
            }
        }

        if (completed > 0 || studentMissed > 0 || counsellorMissed > 0) {
            logger.info("Counselling lifecycle sweep: {} completed, {} student no-show, {} counsellor no-show",
                    completed, studentMissed, counsellorMissed);
        }
    }

    /**
     * Credit the session back only while she is still inside her allowance.
     *
     * <p>Previously unconditional, with a comment reading "always rebookable, no forfeit".
     * Left that way she would always have a free session sitting in her entitlement and the
     * pay-for-the-next-one rule could never fire: {@code sessionsRemaining} is exactly what
     * the booking flow reads to decide free versus paid.
     */
    private void creditBackIfWithinAllowance(CounsellingAppointment a) {
        if (a.getEntitlementId() == null) return;
        // Count only misses that came BEFORE this one. Counting every attributed row instead
        // breaks when two sessions settle in the same sweep — each sees the other, both
        // conclude they are the second, and she loses both credits when she was owed one.
        int priorMisses = appointmentService.countStudentMissesBefore(a.getEntitlementId(), a.getId());
        if (priorMisses > appointmentService.getMissAllowance() - 2) {
            logger.info("Appointment {} is miss {} of {} — session not credited back, next booking is chargeable",
                    a.getId(), priorMisses + 1, appointmentService.getMissAllowance());
            return;
        }
        try {
            entitlementService.creditBackCounsellingSession(a.getEntitlementId());
        } catch (Exception e) {
            logger.warn("Session credit-back failed for appointment {} (entitlement {}): {}",
                    a.getId(), a.getEntitlementId(), e.getMessage());
        }
    }

    /**
     * The counsellor did not appear. She loses nothing: the session stays attached to her
     * entitlement, she gets a link to pick a new time herself, and admin is told separately
     * because a counsellor missing a session is a management signal, not a student matter.
     */
    private void handleCounsellorNoShow(CounsellingAppointment a) {
        try {
            String url = linkBuilder.counsellingReschedule(
                    tokenProvider.createCounsellingRescheduleToken(a.getId()));
            notificationService.sendSelfRescheduleEmail(a, url);
        } catch (Exception e) {
            logger.warn("Self-reschedule email failed for counsellor no-show on appointment {}: {}",
                    a.getId(), e.getMessage());
        }
        try {
            notificationService.notifyAdminCounsellorNoShow(a);
        } catch (Exception e) {
            logger.warn("Admin counsellor-no-show alert failed for appointment {}: {}", a.getId(), e.getMessage());
        }
    }

    /**
     * Soft-hold release sweep (Counselling Phase 3). Frees slots that were held for the
     * pick-slot -> pay window but whose TTL expired without the payment ever confirming
     * (no appointment was created). Runs every minute so an abandoned hold reopens quickly.
     */
    @Scheduled(cron = "0 * * * * *")
    public void releaseExpiredHolds() {
        List<CounsellingSlot> expired = slotRepository
                .findByStatusAndHeldUntilBefore("REQUESTED", LocalDateTime.now());
        if (expired.isEmpty()) return;

        int released = 0;
        for (CounsellingSlot slot : expired) {
            // A hold that became a confirmed booking has an appointment — never reclaim it.
            if (appointmentRepository.existsBySlot_Id(slot.getId())) continue;
            try {
                slot.setStatus("AVAILABLE");
                slot.setHeldUntil(null);
                slotRepository.save(slot);
                released++;
            } catch (Exception e) {
                logger.warn("Failed to release expired hold on slot {}: {}", slot.getId(), e.getMessage());
            }
        }
        if (released > 0) logger.info("Counselling hold sweep: released {} expired slot hold(s)", released);
    }
}
