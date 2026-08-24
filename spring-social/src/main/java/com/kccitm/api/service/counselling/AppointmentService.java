package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import com.kccitm.api.service.b2c.EntitlementService;

@Service
public class AppointmentService {

    private static final Logger logger = LoggerFactory.getLogger(AppointmentService.class);

    /** Who caused a cancellation. Drives the miss allowance, the slot outcome and the emails. */
    public static final String ROLE_STUDENT = "STUDENT";
    public static final String ROLE_COUNSELLOR = "COUNSELLOR";
    public static final String ROLE_ADMIN = "ADMIN";

    /**
     * Students get 2 hours, counsellors 4. Deliberately different: between 4 and 2 hours
     * before a session the student can still cancel but the counsellor cannot. Sessions run
     * in business hours, so a longer counsellor window would be unreachable for most of the
     * day and would produce silent no-shows instead of cancellations.
     */
    @Value("${app.counselling.student-cancellation-window-hours:2}")
    private int studentWindowHours;

    @Value("${app.counselling.counsellor-cancellation-window-hours:4}")
    private int counsellorWindowHours;

    /** Cancellations + no-shows she caused, before the next session must be paid for. */
    @Value("${app.counselling.miss-allowance:2}")
    private int missAllowance;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository studentEntitlementRepository;

    @Autowired
    private CounsellorRepository counsellorRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private MeetingLinkService meetingLinkService;

    @Autowired
    private CounsellingClock clock;

    @Autowired
    private EntitlementService entitlementService;

    // ─── Queries ─────────────────────────────────────────────────────────────────

    public List<CounsellingAppointment> getPendingQueue() {
        return appointmentRepository.findByStatus("PENDING");
    }

    public List<CounsellingAppointment> getByStudent(Long studentId) {
        return appointmentRepository.findByStudentIdOrdered(studentId);
    }

    /**
     * One counsellor's sessions, each stamped with whether its tier makes the report theirs to
     * release — which is what decides whether the row offers a "Send report" button.
     *
     * <p>Resolved here rather than in the view because it lives two hops away (appointment →
     * entitlement → the flag snapshotted at grant time), and a list that omitted it would have
     * the counsellor's own screen unable to tell a held report from a sent one.
     */
    public List<CounsellingAppointment> getByCounsellor(Long counsellorId) {
        List<CounsellingAppointment> appointments = appointmentRepository.findByCounsellorId(counsellorId);
        for (CounsellingAppointment a : appointments) {
            a.setCounsellorReleaseReport(isCounsellorReleased(a));
        }
        return appointments;
    }

    /**
     * Whether this booking's entitlement holds the report for counsellor release.
     *
     * <p>False for anything that cannot be resolved — an admin-created booking carries no
     * entitlement, and a session with no tier behind it has never held a report back. Failing
     * to false hides a button rather than offering one that would only error.
     */
    private boolean isCounsellorReleased(CounsellingAppointment a) {
        try {
            if (a.getEntitlementId() == null) return false;
            return studentEntitlementRepository.findById(a.getEntitlementId())
                    .map(e -> Boolean.TRUE.equals(e.getCounsellorReleaseReport()))
                    .orElse(false);
        } catch (Exception e) {
            logger.warn("Could not resolve report-release setting for appointment {}: {}",
                    a.getId(), e.getMessage());
            return false;
        }
    }

    public List<CounsellingAppointment> getByCounsellorAndDate(Long counsellorId, LocalDate date) {
        return appointmentRepository.findByCounsellorIdAndDate(counsellorId, date);
    }

    public Map<String, Long> getStats() {
        LocalDate weekStart = LocalDate.now().with(java.time.DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(6);

        Long pending = appointmentRepository.countByStatus("PENDING");
        Long assigned = appointmentRepository.countByStatus("ASSIGNED");
        Long confirmed = appointmentRepository.countByStatus("CONFIRMED");
        Long thisWeek = appointmentRepository.countActiveInWeek(weekStart, weekEnd);

        Map<String, Long> stats = new HashMap<>();
        stats.put("pending", pending != null ? pending : 0L);
        stats.put("assigned", assigned != null ? assigned : 0L);
        stats.put("confirmed", confirmed != null ? confirmed : 0L);
        stats.put("thisWeek", thisWeek != null ? thisWeek : 0L);
        return stats;
    }

    // ─── State Transitions ────────────────────────────────────────────────────────

    /**
     * Assigns a counsellor to a PENDING appointment.
     * Transitions appointment → ASSIGNED, slot → ASSIGNED.
     */
    @Transactional
    public CounsellingAppointment assign(Long appointmentId, Long counsellorId, User admin) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        Counsellor counsellor = counsellorRepository.findById(counsellorId)
                .orElseThrow(() -> new ResourceNotFoundException("Counsellor", "id", counsellorId));

        appointment.setCounsellor(counsellor);
        appointment.setAssignedBy(admin);
        appointment.setStatus("ASSIGNED");

        CounsellingSlot slot = appointment.getSlot();
        slot.setStatus("ASSIGNED");
        slotRepository.save(slot);

        appointment = appointmentRepository.save(appointment);

        logger.info("Appointment {} assigned to counsellor {} by admin {}",
                appointmentId, counsellorId, admin != null ? admin.getId() : "unknown");

        // Notify counsellor by email
        notificationService.sendAssignedToCounsellorEmail(appointment);

        // In-app notification to counsellor (if linked to a User account)
        if (counsellor.getUser() != null) {
            notificationService.createInAppNotification(
                    counsellor.getUser(),
                    "APPOINTMENT_ASSIGNED",
                    "New Counselling Session Assigned",
                    "A new counselling session has been assigned to you. Please review and confirm.",
                    appointment.getId(),
                    "APPOINTMENT");
        }

        Map<String, Object> newValues = new HashMap<>();
        newValues.put("status", "ASSIGNED");
        newValues.put("counsellorId", counsellorId);
        auditLogService.log(appointment, "ASSIGNED", admin, null, null, newValues);

        return appointment;
    }

    /**
     * Counsellor confirms an ASSIGNED appointment.
     * Generates a meeting link and transitions both appointment and slot to CONFIRMED.
     */
    @Transactional
    public CounsellingAppointment confirm(Long appointmentId, User counsellorUser) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        appointment.setStatus("CONFIRMED");

        CounsellingSlot slot = appointment.getSlot();
        slot.setStatus("CONFIRMED");
        slotRepository.save(slot);

        // Generate meeting link
        try {
            String meetLink = meetingLinkService.generateMeetLink(appointment);
            appointment.setMeetingLink(meetLink);
        } catch (Exception e) {
            logger.warn("Failed to generate meeting link for appointment {}: {}", appointmentId, e.getMessage());
        }

        appointment = appointmentRepository.save(appointment);

        logger.info("Appointment {} confirmed by counsellor user {}", appointmentId,
                counsellorUser != null ? counsellorUser.getId() : "unknown");

        // Notify student
        notificationService.sendConfirmedToStudentEmail(appointment);

        // In-app notification to student
        try {
            User studentUser = new User();
            studentUser.setId(appointment.getStudent().getUserId());
            notificationService.createInAppNotification(
                    studentUser,
                    "APPOINTMENT_CONFIRMED",
                    "Counselling Session Confirmed",
                    "Your counselling session has been confirmed. Check your email for details.",
                    appointment.getId(),
                    "APPOINTMENT");
        } catch (Exception e) {
            logger.warn("Failed to create in-app notification for student on confirm: {}", e.getMessage());
        }

        auditLogService.logSimple(appointment, "CONFIRMED", counsellorUser, null);

        return appointment;
    }

    /**
     * Counsellor declines an ASSIGNED appointment, sending it back to PENDING.
     * Clears counsellor and assignedBy fields; slot reverts to REQUESTED.
     */
    @Transactional
    public CounsellingAppointment decline(Long appointmentId, User counsellorUser, String reason) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        appointment.setStatus("PENDING");
        appointment.setCounsellor(null);
        appointment.setAssignedBy(null);

        CounsellingSlot slot = appointment.getSlot();
        slot.setStatus("REQUESTED");
        slotRepository.save(slot);

        appointment = appointmentRepository.save(appointment);

        logger.info("Appointment {} declined by counsellor user {}, reason: {}",
                appointmentId, counsellorUser != null ? counsellorUser.getId() : "unknown", reason);

        auditLogService.logSimple(appointment, "DECLINED", counsellorUser, reason);

        return appointment;
    }

    // ─── Miss allowance ──────────────────────────────────────────────────────────

    /**
     * Cancellations and no-shows the student caused on this entitlement, counted together.
     * One shared counter rather than two ladders: separate counters would give four free
     * misses and invite cancelling twice then no-showing twice.
     */
    public int countStudentMisses(Long entitlementId) {
        if (entitlementId == null) return 0;
        Long n = appointmentRepository.countStudentMissesForEntitlement(entitlementId);
        return n == null ? 0 : n.intValue();
    }

    /**
     * Her misses that came before {@code appointmentId} — the count the credit-back decision
     * needs, since it is asking "is this her first?" and must not see itself or anything
     * later. See {@code countStudentMissesBefore} for why plain counting is not safe here.
     */
    public int countStudentMissesBefore(Long entitlementId, Long appointmentId) {
        if (entitlementId == null || appointmentId == null) return 0;
        Long n = appointmentRepository.countStudentMissesBefore(entitlementId, appointmentId);
        return n == null ? 0 : n.intValue();
    }

    /** Misses she has left before the next session has to be paid for. Never negative. */
    public int remainingMisses(Long entitlementId) {
        return Math.max(0, missAllowance - countStudentMisses(entitlementId));
    }

    /** True when the next booking on this entitlement is free rather than chargeable. */
    public boolean hasMissAllowanceRemaining(Long entitlementId) {
        return remainingMisses(entitlementId) > 0;
    }

    public int getMissAllowance() {
        return missAllowance;
    }

    public int getStudentWindowHours() {
        return studentWindowHours;
    }

    public int getCounsellorWindowHours() {
        return counsellorWindowHours;
    }

    // ─── Cancellation ────────────────────────────────────────────────────────────

    /**
     * Legacy 3-arg entry point, kept for the existing {@code PUT /cancel/{id}} route.
     *
     * <p>Attribution is inferred rather than guessed at random: if the caller is the
     * appointment's own counsellor it is a counsellor cancellation, otherwise an admin one.
     * Critically it can never resolve to {@code STUDENT}, so this path cannot consume a
     * student's miss allowance — a student cancellation must come through the dedicated
     * student endpoint, which proves ownership first.
     */
    @Transactional
    public CounsellingAppointment cancel(Long appointmentId, User cancelledBy, String reason) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        Long callerId = cancelledBy != null ? cancelledBy.getId() : null;
        Counsellor own = appointment.getCounsellor();
        boolean callerIsTheCounsellor = own != null && own.getUser() != null && callerId != null
                && callerId.equals(own.getUser().getId());

        return cancel(appointmentId, cancelledBy,
                callerIsTheCounsellor ? ROLE_COUNSELLOR : ROLE_ADMIN, null, reason);
    }

    /**
     * Cancels an appointment, with the consequences that follow from <b>who</b> cancelled.
     *
     * <p>Three things branch on the role, and getting any of them wrong penalises the wrong
     * person (see docs/COUNSELLING_CANCELLATION.md §2):
     *
     * <ul>
     *   <li><b>The window.</b> Students are held to 2 hours, counsellors to 4, and admins to
     *       none — an admin cancellation is an operational decision, not a request.</li>
     *   <li><b>The slot.</b> A student or admin cancellation returns the hour to
     *       {@code AVAILABLE} so someone else can take it. A counsellor cancellation blocks
     *       it: the counsellor is not there, so it must not be resold. The old behaviour set
     *       every cancelled slot to {@code CANCELLED}, which
     *       {@code SlotMaterializationService} then skips forever — quietly destroying an
     *       hour of capacity on every cancellation.</li>
     *   <li><b>The allowance.</b> Only a student cancellation counts against her two misses,
     *       and only the first one credits the session back. Skipping the credit on the
     *       second is precisely what makes her next booking chargeable.</li>
     * </ul>
     *
     * @param cancellerRole one of {@link #ROLE_STUDENT}, {@link #ROLE_COUNSELLOR}, {@link #ROLE_ADMIN}
     * @param reasonCode    dropdown value, stored for reporting
     * @param note          free text; required by the caller when the reason is {@code OTHER}
     */
    @Transactional
    public CounsellingAppointment cancel(Long appointmentId, User cancelledBy, String cancellerRole,
                                         String reasonCode, String note) {
        return cancel(appointmentId, cancelledBy, cancellerRole, reasonCode, note, true);
    }

    /**
     * As above, but the counsellor's own copy of an admin cancellation can be withheld.
     *
     * <p>For the one case where a whole diary is cancelled at once — a counsellor being
     * deactivated — the per-session notices are replaced by a single message telling them
     * their account has been suspended. Every other caller keeps both mails.
     */
    @Transactional
    public CounsellingAppointment cancel(Long appointmentId, User cancelledBy, String cancellerRole,
                                         String reasonCode, String note, boolean notifyCounsellor) {
        CounsellingAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        String role = cancellerRole == null ? ROLE_ADMIN : cancellerRole.toUpperCase();
        CounsellingSlot slot = appointment.getSlot();
        String reason = buildReasonText(reasonCode, note);

        guardCancellableStatus(appointment);
        enforceCancellationWindow(appointment, slot, role);

        String oldStatus = appointment.getStatus();
        Counsellor assignedCounsellor = appointment.getCounsellor();

        // Only a student's own cancellation costs her an allowance, and only when the system
        // actually had a session to give her. A parked session is the one exception: the
        // counsellor dropped out and nothing was offered in return, so walking away from it
        // is not a choice she made. Being moved to another counsellor IS a session — declining
        // that time is her choice and spends an allowance.
        boolean parked = "AWAITING_RESCHEDULE".equals(oldStatus);
        boolean countsAsMiss = ROLE_STUDENT.equals(role) && !parked;
        // Misses already used BEFORE this one. Zero means this is her first, which is still free.
        int priorMisses = countsAsMiss ? countStudentMisses(appointment.getEntitlementId()) : 0;
        boolean creditBack = !countsAsMiss || priorMisses < (missAllowance - 1);

        appointment.setStatus("CANCELLED");
        appointment.setCancelledByRole(role);
        appointment.setCancelledByUserId(cancelledBy != null ? cancelledBy.getId() : null);
        appointment.setCancellationReason(reasonCode);
        appointment.setCancellationNote(note);
        appointment.setCancelledAt(clock.now());

        releaseSlot(slot, role);
        appointment = appointmentRepository.save(appointment);

        if (creditBack && appointment.getEntitlementId() != null) {
            try {
                entitlementService.creditBackCounsellingSession(appointment.getEntitlementId());
            } catch (Exception e) {
                logger.warn("Session credit-back failed for appointment {} (entitlement {}): {}",
                        appointmentId, appointment.getEntitlementId(), e.getMessage());
            }
        }

        logger.info("Appointment {} cancelled by {} (user {}), reason: {}, slot -> {}, creditBack={}",
                appointmentId, role, cancelledBy != null ? cancelledBy.getId() : "unknown",
                reasonCode, slot != null ? slot.getStatus() : "n/a", creditBack);

        notifyOnCancellation(appointment, assignedCounsellor, cancelledBy, role, reason, creditBack, notifyCounsellor);

        Map<String, Object> oldValues = new HashMap<>();
        oldValues.put("status", oldStatus);

        Map<String, Object> newValues = new HashMap<>();
        newValues.put("status", "CANCELLED");
        newValues.put("cancelledByRole", role);
        newValues.put("cancellationReason", reasonCode);
        newValues.put("creditedBack", creditBack);

        auditLogService.log(appointment, "CANCELLED", cancelledBy, reason, oldValues, newValues);

        return appointment;
    }

    // ─── Cancellation helpers ────────────────────────────────────────────────────

    /**
     * A session that has started or finished cannot be cancelled. The window check catches
     * most of this incidentally (a past start time is always inside any window), but an
     * admin bypasses the window entirely, so the status guard has to stand on its own.
     */
    private void guardCancellableStatus(CounsellingAppointment appointment) {
        String status = appointment.getStatus() == null ? "" : appointment.getStatus().toUpperCase();
        if ("IN_PROGRESS".equals(status) || "COMPLETED".equals(status)
                || "CANCELLED".equals(status) || "MISSED".equals(status)
                || "RESCHEDULED".equals(status)) {
            throw new BadRequestException("This session is " + status + " and can no longer be cancelled.");
        }
    }

    /**
     * The cutoff, by role. Admins have none — an admin cancellation is an operational
     * decision that costs nobody anything, so there is nothing to protect against.
     *
     * <p>A force-shifted session is exempt for the student too: the counsellor moved her to
     * this time, and the window exists to protect the counsellor's diary from late student
     * changes, not to trap her in an hour she never chose.
     *
     * <p>Uses {@link CounsellingClock}, not {@code LocalDateTime.now()} — slot times are IST
     * wall-clock while the JVM runs UTC, so the raw clock under-restricts by 5h30m and would
     * happily permit a cancellation hours after the session had ended.
     */
    private void enforceCancellationWindow(CounsellingAppointment appointment,
                                           CounsellingSlot slot, String role) {
        if (ROLE_ADMIN.equals(role)) return;
        if (slot == null || slot.getDate() == null || slot.getStartTime() == null) return;
        // The counsellor put her at this time, so the notice period cannot be held against
        // her. It still costs an allowance — the window and the allowance are separate rules.
        if (ROLE_STUDENT.equals(role) && appointment.getForceShifted()) return;

        int hours = ROLE_COUNSELLOR.equals(role) ? counsellorWindowHours : studentWindowHours;
        LocalDateTime sessionTime = clock.sessionStart(slot.getDate(), slot.getStartTime());
        if (clock.isWithinHoursOfNow(sessionTime, hours)) {
            throw new BadRequestException(
                    "Cannot cancel: the session starts within " + hours
                            + " hours. Please contact support directly.");
        }
    }

    /**
     * What happens to the vacated hour, which depends entirely on who walked away.
     *
     * <p>A student or admin cancellation frees the slot — the counsellor is still there and
     * someone else can take the time. A counsellor cancellation blocks it, because they are
     * not. The previous behaviour marked every cancelled slot {@code CANCELLED}, a status
     * {@code SlotMaterializationService} skips permanently, so each cancellation silently
     * destroyed an hour of capacity that nothing ever restored.
     */
    private void releaseSlot(CounsellingSlot slot, String role) {
        if (slot == null) return;
        if (ROLE_COUNSELLOR.equals(role)) {
            slot.setStatus("CANCELLED");
            slot.setIsBlocked(true);
            // Marks this as session-cancellation residue, not a deliberate date block —
            // the availability panels hide these rows (the story lives on the appointment).
            if (slot.getBlockReason() == null || slot.getBlockReason().isEmpty()) {
                slot.setBlockReason("Counsellor cancelled");
            }
        } else {
            slot.setStatus("AVAILABLE");
            slot.setIsBlocked(false);
        }
        slotRepository.save(slot);
    }

    private String buildReasonText(String reasonCode, String note) {
        if (reasonCode == null || reasonCode.isEmpty()) return note;
        if (note == null || note.isEmpty()) return reasonCode;
        return reasonCode + ": " + note;
    }

    /**
     * Who hears about it, which again turns on the role.
     *
     * <ul>
     *   <li><b>Student cancelled</b> — she gets her own confirmation with the misses she has
     *       left; the counsellor is told, with the reason (previously passed in and then
     *       discarded).</li>
     *   <li><b>Counsellor cancelled</b> — the student is told. The counsellor is not: they
     *       initiated it and already know.</li>
     *   <li><b>Admin cancelled</b> — <i>both</i> are told, because neither of them did it.</li>
     * </ul>
     */
    private void notifyOnCancellation(CounsellingAppointment appointment, Counsellor counsellor,
                                      User cancelledBy, String role, String reason, boolean creditBack,
                                      boolean notifyCounsellor) {
        String cancellerName = cancelledBy != null && cancelledBy.getName() != null
                ? cancelledBy.getName() : "Career-9";
        Long studentUserId = appointment.getStudent() != null ? appointment.getStudent().getUserId() : null;

        try {
            if (ROLE_STUDENT.equals(role)) {
                notificationService.sendStudentCancellationConfirmation(
                        appointment, remainingMisses(appointment.getEntitlementId()), creditBack);
                if (counsellor != null) {
                    notificationService.sendCancellationEmail(appointment, cancellerName,
                            counsellor.getEmail(), counsellor.getName(), reason);
                    notifyCounsellorInApp(counsellor, appointment, reason);
                }
            } else if (ROLE_COUNSELLOR.equals(role)) {
                notificationService.sendCancellationEmail(appointment, cancellerName,
                        notificationService.recipientStudentEmail(appointment),
                        notificationService.recipientStudentName(appointment), reason);
                notifyStudentInApp(studentUserId, appointment, reason);
            } else {
                // Admin: nobody involved chose this, so tell both sides and promise a follow-up.
                notificationService.sendAdminCancellationEmail(appointment, notifyCounsellor);
                notifyStudentInApp(studentUserId, appointment, reason);
                if (counsellor != null && notifyCounsellor) notifyCounsellorInApp(counsellor, appointment, reason);
            }
        } catch (Exception e) {
            logger.warn("Cancellation notifications failed for appointment {}: {}",
                    appointment.getId(), e.getMessage());
        }
    }

    private void notifyStudentInApp(Long studentUserId, CounsellingAppointment appointment, String reason) {
        if (studentUserId == null) return;
        try {
            User studentUser = new User();
            studentUser.setId(studentUserId);
            notificationService.createInAppNotification(studentUser, "APPOINTMENT_CANCELLED",
                    "Counselling Session Cancelled",
                    "Your counselling session has been cancelled. Reason: " + (reason != null ? reason : "N/A"),
                    appointment.getId(), "APPOINTMENT");
        } catch (Exception e) {
            logger.warn("Failed to create in-app cancellation notification for student: {}", e.getMessage());
        }
    }

    private void notifyCounsellorInApp(Counsellor counsellor, CounsellingAppointment appointment, String reason) {
        if (counsellor == null || counsellor.getUser() == null) return;
        try {
            notificationService.createInAppNotification(counsellor.getUser(), "APPOINTMENT_CANCELLED",
                    "Counselling Session Cancelled",
                    "A session assigned to you has been cancelled. Reason: " + (reason != null ? reason : "N/A"),
                    appointment.getId(), "APPOINTMENT");
        } catch (Exception e) {
            logger.warn("Failed to create in-app cancellation notification for counsellor: {}", e.getMessage());
        }
    }

    /**
     * Reschedules an appointment to a new slot.
     * Enforces the student cancellation window on the old slot, verifies the new slot is
     * AVAILABLE, marks the old appointment RESCHEDULED, and creates a new CONFIRMED
     * appointment on the new slot.
     *
     * Backwards-compatible overload that defaults to student behaviour
     * (counts toward the student cap of 1).
     */
    @Transactional
    public CounsellingAppointment reschedule(Long appointmentId, Long newSlotId, User counsellorUser) {
        return reschedule(appointmentId, newSlotId, counsellorUser, false);
    }

    /**
     * Reschedule with an explicit admin flag. When {@code isAdmin} is true the
     * student-side cap of one reschedule per booking chain is bypassed and the
     * counter is NOT incremented, so the student still has their one chance
     * regardless of how many times an admin moves the session (item 7).
     */
    @Transactional
    public CounsellingAppointment reschedule(Long appointmentId, Long newSlotId, User counsellorUser, boolean isAdmin) {
        return reschedule(appointmentId, newSlotId, counsellorUser, isAdmin, false);
    }

    /**
     * As {@link #reschedule(Long, Long, User, boolean)} but can bypass the cancellation
     * window. The admin "change counsellor &amp; rebook" of a session whose time has already
     * passed sets this true — the window check would otherwise reject every past session
     * outright (now + window is always after a past start time).
     */
    @Transactional
    public CounsellingAppointment reschedule(Long appointmentId, Long newSlotId, User counsellorUser,
                                             boolean isAdmin, boolean bypassCancellationWindow) {
        CounsellingAppointment oldAppointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        CounsellingSlot oldSlot = oldAppointment.getSlot();

        // A PARKED session is exempt from every timing and quota rule below. Its old slot time
        // is meaningless — the counsellor dropped out, and picking a new time is the only
        // action left to the student. Enforcing the window against the slot she lost would
        // lock her out of replacing it, and counting it against her reschedule quota would
        // charge her for someone else's cancellation.
        boolean parked = "AWAITING_RESCHEDULE".equals(oldAppointment.getStatus());

        // A session she failed to attend is rescheduled from her history, so its start time is
        // necessarily in the past. The window exists to protect the counsellor's diary from a
        // late change to an IMMINENT session; applied to one that has already been and gone it
        // rejects every attempt, since a past time is always "within 2 hours of now".
        boolean missed = "MISSED".equals(oldAppointment.getStatus());

        // Student window on the old slot. It exists to stop HER changing a session at the last
        // minute; an admin moving it is doing so on purpose and on someone's behalf, so it does
        // not apply to them — an admin must be able to move any session, however many times and
        // however close to its start. Also skipped for an already-passed session being rebooked
        // and for one the counsellor force-shifted her into: she did not choose that time, so
        // the window has no business holding her to it.
        if (!isAdmin && !bypassCancellationWindow && !parked && !missed && !oldAppointment.getForceShifted()) {
            LocalDateTime oldSessionTime = clock.sessionStart(oldSlot.getDate(), oldSlot.getStartTime());
            if (clock.isWithinHoursOfNow(oldSessionTime, studentWindowHours)) {
                throw new BadRequestException(
                        "Cannot reschedule: the session starts within " + studentWindowHours
                                + " hours. Please contact support directly.");
            }
        }

        // Allowances, not a separate reschedule cap, govern how often she can change a session:
        // moving a session to a time that suits her spends one, exactly as cancelling does.
        // Admins bypass via the isAdmin flag; a parked session is not her doing and is free.
        int existingStudentReschedules = oldAppointment.getStudentRescheduleCount();
        if (!isAdmin && !parked && remainingMisses(oldAppointment.getEntitlementId()) <= 0) {
            throw new BadRequestException(
                    "You have no free changes left, so this session cannot be moved. "
                            + "Please attend it or contact your administrator.");
        }

        CounsellingSlot newSlot = slotRepository.findById(newSlotId)
                .orElseThrow(() -> new ResourceNotFoundException("Slot", "id", newSlotId));

        if (!"AVAILABLE".equals(newSlot.getStatus())) {
            throw new BadRequestException(
                    "New slot " + newSlotId + " is not available. Current status: " + newSlot.getStatus());
        }

        // Mark old appointment as rescheduled and release the old slot so
        // other students can book it again. Blocked/manual slots stay bookable
        // exactly as they were; only the status flips back to AVAILABLE.
        oldAppointment.setStatus("RESCHEDULED");
        // Attribute the abandoned row to her when she chose the move, so it spends an
        // allowance exactly as a cancellation does — the allowance query counts attribution,
        // not status. Admin rebooks and parked sessions stay unattributed and therefore free.
        if (!isAdmin && !parked) {
            oldAppointment.setCancelledByRole(ROLE_STUDENT);
            oldAppointment.setCancelledAt(clock.now());
        }
        oldSlot.setStatus("AVAILABLE");
        oldSlot.setIsBlocked(false);
        slotRepository.save(oldSlot);
        appointmentRepository.save(oldAppointment);

        // Create new appointment copying relevant fields from old
        CounsellingAppointment newAppointment = new CounsellingAppointment();
        newAppointment.setSlot(newSlot);
        newAppointment.setStudent(oldAppointment.getStudent());
        // The session belongs to whoever owns the NEW slot — a student rescheduling after a
        // block-date can land on a different counsellor entirely. Carrying the old counsellor
        // over used to be invisible (links were generated per appointment); with each
        // counsellor having their own permanent Teams room it would send the student to the
        // wrong room while the new counsellor waits in theirs.
        newAppointment.setCounsellor(
                newSlot.getCounsellor() != null ? newSlot.getCounsellor() : oldAppointment.getCounsellor());
        newAppointment.setAssignedBy(oldAppointment.getAssignedBy());
        newAppointment.setStudentReason(oldAppointment.getStudentReason());
        newAppointment.setStatus("CONFIRMED");
        newAppointment.setRescheduledFromAppointmentId(appointmentId);
        // Carry the count forward across the chain. Only student-initiated
        // reschedules increment it; admin reschedules preserve the existing value.
        newAppointment.setStudentRescheduleCount(
                isAdmin ? existingStudentReschedules : existingStudentReschedules + 1);

        // The entitlement the session was drawn from. Previously dropped, which orphaned
        // every rescheduled appointment from the thing that paid for it: the miss allowance
        // counts per entitlement and so silently read zero, credit-back became a no-op on
        // its null guard, and a parked session lost the very link that parking exists to
        // protect. Must survive the whole reschedule chain.
        newAppointment.setEntitlementId(oldAppointment.getEntitlementId());

        // Delivery details and the contacts given at booking. Also previously dropped, so a
        // rescheduled session lost the parent/guardian address and the preferred channel —
        // the parent would be told about the booking and then never hear about anything
        // again. Mode/location follow the new slot where it has them, else carry over.
        newAppointment.setMode(newSlot.getMode() != null ? newSlot.getMode() : oldAppointment.getMode());
        newAppointment.setLocation(
                "OFFLINE".equals(newAppointment.getMode()) && newSlot.getCounsellor() != null
                        ? newSlot.getCounsellor().getOfficeAddress()
                        : oldAppointment.getLocation());
        newAppointment.setStudentContactName(oldAppointment.getStudentContactName());
        newAppointment.setStudentContactEmail(oldAppointment.getStudentContactEmail());
        newAppointment.setStudentContactPhone(oldAppointment.getStudentContactPhone());
        newAppointment.setParentEmail(oldAppointment.getParentEmail());
        newAppointment.setParentPhone(oldAppointment.getParentPhone());
        newAppointment.setPreferredContactMethod(oldAppointment.getPreferredContactMethod());

        // Transition new slot to CONFIRMED
        newSlot.setStatus("CONFIRMED");
        slotRepository.save(newSlot);

        // Generate meet link for the new appointment
        try {
            String meetLink = meetingLinkService.generateMeetLink(newAppointment);
            newAppointment.setMeetingLink(meetLink);
        } catch (Exception e) {
            logger.warn("Failed to generate meeting link during reschedule for new slot {}: {}",
                    newSlotId, e.getMessage());
        }

        newAppointment = appointmentRepository.save(newAppointment);

        logger.info("Appointment {} rescheduled to new appointment {} on slot {} by counsellor user {}",
                appointmentId, newAppointment.getId(), newSlotId,
                counsellorUser != null ? counsellorUser.getId() : "unknown");

        // Notify student of reschedule
        notificationService.sendRescheduleEmail(oldAppointment, newAppointment);

        // In-app notification to student — UserStudent stores userId (Long),
        // not a User entity. Build a lightweight User reference using the stored userId.
        try {
            User studentUser = new User();
            studentUser.setId(newAppointment.getStudent().getUserId());
            notificationService.createInAppNotification(
                    studentUser,
                    "APPOINTMENT_RESCHEDULED",
                    "Counselling Rescheduled",
                    "Your counselling session has been rescheduled. Check your email for the updated schedule.",
                    newAppointment.getId(),
                    "APPOINTMENT");
        } catch (Exception e) {
            logger.warn("Failed to create in-app reschedule notification for student: {}", e.getMessage());
        }

        // Audit log for old appointment
        Map<String, Object> oldAuditValues = new HashMap<>();
        oldAuditValues.put("status", "RESCHEDULED");
        oldAuditValues.put("originalSlotId", oldSlot.getId());
        auditLogService.log(oldAppointment, "RESCHEDULED", counsellorUser,
                "Rescheduled to appointment " + newAppointment.getId(), null, oldAuditValues);

        // Audit log for new appointment
        Map<String, Object> newAuditValues = new HashMap<>();
        newAuditValues.put("status", "CONFIRMED");
        newAuditValues.put("newSlotId", newSlotId);
        newAuditValues.put("rescheduledFromAppointmentId", appointmentId);
        auditLogService.log(newAppointment, "CREATED_VIA_RESCHEDULE", counsellorUser,
                "Rescheduled from appointment " + appointmentId, null, newAuditValues);

        return newAppointment;
    }
}
