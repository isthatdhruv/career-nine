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

    @Scheduled(cron = "0 */5 * * * *")
    public void closeEndedSessions() {
        LocalDate today = LocalDate.now();
        List<CounsellingAppointment> candidates = appointmentRepository.findActiveUpToDate(today);
        if (candidates.isEmpty()) return;

        LocalDateTime now = LocalDateTime.now();
        int completed = 0, missed = 0;
        for (CounsellingAppointment a : candidates) {
            CounsellingSlot slot = a.getSlot();
            if (slot == null || slot.getDate() == null || slot.getEndTime() == null) continue;

            LocalDateTime end = LocalDateTime.of(slot.getDate(), slot.getEndTime());
            if (now.isBefore(end)) continue; // session not over yet

            boolean attended = a.getCheckinVerifiedAt() != null || "IN_PROGRESS".equals(a.getStatus());
            if (attended) {
                a.setStatus("COMPLETED");
                a.setAttended(Boolean.TRUE);
                completed++;
            } else {
                a.setStatus("MISSED");
                a.setAttended(Boolean.FALSE);
                missed++;
            }

            // Free the slot — it's in the past, so mark it consumed rather than AVAILABLE.
            try {
                slot.setStatus("COMPLETED");
                slotRepository.save(slot);
            } catch (Exception e) {
                logger.warn("Failed to free slot {} for appointment {}: {}", slot.getId(), a.getId(), e.getMessage());
            }

            appointmentRepository.save(a);

            if (!attended) {
                // Always rebookable, no forfeit: a session is only truly consumed on
                // COMPLETED, so credit the seat back to the entitlement on a no-show.
                if (a.getEntitlementId() != null) {
                    try {
                        entitlementService.creditBackCounsellingSession(a.getEntitlementId());
                    } catch (Exception e) {
                        logger.warn("Session credit-back failed for appointment {} (entitlement {}): {}",
                                a.getId(), a.getEntitlementId(), e.getMessage());
                    }
                }
                try {
                    notificationService.notifyStudentNoShow(a);
                } catch (Exception e) {
                    logger.warn("No-show notice failed for appointment {}: {}", a.getId(), e.getMessage());
                }
            }
        }

        if (completed > 0 || missed > 0) {
            logger.info("Counselling lifecycle sweep: {} completed, {} missed", completed, missed);
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
