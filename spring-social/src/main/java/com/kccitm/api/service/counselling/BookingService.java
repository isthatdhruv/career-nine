package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.mail.MailEvent;
import com.kccitm.api.model.mail.MailEventContext;
import com.kccitm.api.model.mail.MailRecipientRole;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.service.counselling.CounsellorInstituteMappingService;
import com.kccitm.api.service.mail.MailEvents;

@Service
public class BookingService {

    private static final Logger logger = LoggerFactory.getLogger(BookingService.class);

    /** Soft-hold TTL (minutes) for a slot reserved during the pick-slot -> pay window. */
    private static final long SOFT_HOLD_MINUTES = 5;

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private MeetingLinkService meetingLinkService;

    @Autowired
    private CounsellingClock clock;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private CounsellorInstituteMappingService counsellorInstituteMappingService;

    @Autowired
    private com.kccitm.api.repository.Career9.counselling.CounsellorAssessmentAssignmentRepository assessmentAssignmentRepository;

    @Autowired
    private CounsellingActivityLogService activityLogService;

    @Autowired
    private com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository entitlementRepository;

    @Autowired
    private com.kccitm.api.repository.Career9.UserStudentRepository userStudentRepository;

    /** Mail-automation hook. Absent until the engine is wired; every publish is best-effort. */
    @Autowired(required = false)
    private MailEvents mailEvents;

    /**
     * Returns all available slots for the week starting at weekStart (inclusive)
     * through weekStart + 6 days (inclusive). Past dates are excluded.
     */
    public List<CounsellingSlot> getAvailableSlots(LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(6);
        LocalDate today = clock.today();
        LocalDate effectiveStart = weekStart.isBefore(today) ? today : weekStart;
        logger.info("Fetching available slots from {} to {}", effectiveStart, weekEnd);
        if (effectiveStart.isAfter(weekEnd)) return List.of();
        return filterOutPastSlots(slotRepository.findAvailableSlots(effectiveStart, weekEnd));
    }

    /**
     * Returns available slots filtered to only counsellors allocated to the given institute.
     * Students see only slots from counsellors assigned to their school. Past dates are excluded.
     */
    /**
     * Bookable slots for one student, resolved the same way the post-assessment picker does:
     * counsellors assigned to her assessment first, her institute's allocation only as a
     * fallback.
     *
     * <p>The student portal previously went through the institute-only overload below, which
     * silently showed a narrower set than the public booking flow — a student whose counsellor
     * is attached to her <em>assessment</em> rather than her institute saw "No slots" while
     * that counsellor sat there with a full diary. Same student, same counsellor, different
     * answer depending on which page she happened to be on.
     */
    public List<CounsellingSlot> getAvailableSlotsForStudent(LocalDate weekStart, Long userStudentId) {
        if (userStudentId == null) return List.of();

        Integer instituteCode = null;
        Long assessmentId = null;
        try {
            UserStudent student = userStudentRepository.findById(userStudentId).orElse(null);
            if (student != null && student.getInstitute() != null) {
                instituteCode = student.getInstitute().getInstituteCode();
            }
        } catch (Exception e) {
            logger.debug("Could not resolve institute for student {}: {}", userStudentId, e.getMessage());
        }
        // Her live counselling entitlement decides which assessment's counsellor pool applies.
        try {
            assessmentId = entitlementRepository.findByUserStudentIdOrderByCreatedAtDesc(userStudentId).stream()
                    .filter(e -> e.getAssessmentId() != null)
                    .map(com.kccitm.api.model.career9.b2c.StudentEntitlement::getAssessmentId)
                    .findFirst().orElse(null);
        } catch (Exception e) {
            logger.debug("Could not resolve assessment for student {}: {}", userStudentId, e.getMessage());
        }

        return getAvailableSlotsForInstitute(weekStart, instituteCode, assessmentId);
    }

    public List<CounsellingSlot> getAvailableSlotsForInstitute(LocalDate weekStart, Integer instituteCode) {
        LocalDate weekEnd = weekStart.plusDays(6);
        LocalDate today = clock.today();
        LocalDate effectiveStart = weekStart.isBefore(today) ? today : weekStart;

        if (effectiveStart.isAfter(weekEnd)) return List.of();

        List<Long> counsellorIds = counsellorInstituteMappingService.getActiveCounsellorIdsForInstitute(instituteCode);

        if (counsellorIds.isEmpty()) {
            logger.info("No counsellors allocated to institute {} — returning empty slots", instituteCode);
            return List.of();
        }

        logger.info("Fetching available slots from {} to {} for institute {} ({} counsellors)",
                effectiveStart, weekEnd, instituteCode, counsellorIds.size());
        return filterOutPastSlots(
                slotRepository.findAvailableSlotsForCounsellors(counsellorIds, effectiveStart, weekEnd));
    }

    /**
     * Counselling Phase 4: available slots for the counsellor(s) the admin assigned to
     * {@code assessmentId}. Counsellors are mapped to ASSESSMENTS, not institutes — so the
     * assignment is the primary (and usually only) driver of which slots a student sees,
     * regardless of their institute. The institute mapping is only a fallback for
     * assessments that have no explicit counsellor assignment (keeps legacy flows working).
     */
    public List<CounsellingSlot> getAvailableSlotsForInstitute(LocalDate weekStart, Integer instituteCode,
                                                               Long assessmentId) {
        // Return a wide upcoming horizon (12 weeks) rather than a single week, so the
        // student's picker shows slots starting from the FIRST available date instead of
        // landing on an empty current week. The picker groups by date and omits empty days.
        LocalDate weekEnd = weekStart.plusDays(83);
        LocalDate today = clock.today();
        LocalDate effectiveStart = weekStart.isBefore(today) ? today : weekStart;
        if (effectiveStart.isAfter(weekEnd)) return List.of();

        // Primary: counsellors assigned to this assessment (institute-independent).
        List<Long> counsellorIds = assessmentId != null
                ? assessmentAssignmentRepository.findActiveCounsellorIdsForAssessment(assessmentId)
                : List.of();

        // Fallback: only when no counsellor is assigned to the assessment, fall back to
        // the institute's allocated counsellors so legacy (unassigned) flows still work.
        if (counsellorIds.isEmpty()) {
            counsellorIds = counsellorInstituteMappingService.getActiveCounsellorIdsForInstitute(instituteCode);
            if (counsellorIds.isEmpty()) {
                logger.info("No counsellor assigned to assessment {} and none mapped to institute {} — empty slots",
                        assessmentId, instituteCode);
                return List.of();
            }
        }
        return filterOutPastSlots(
                slotRepository.findAvailableSlotsForCounsellors(counsellorIds, effectiveStart, weekEnd));
    }

    /**
     * Like {@link #getAvailableSlotsForInstitute(LocalDate, Integer, Long)} but ALSO returns
     * already-taken slots (REQUESTED/BOOKED/CONFIRMED), so the student picker can show them
     * greyed-out with a "Booked" badge. Booking still only succeeds on AVAILABLE slots.
     */
    public List<CounsellingSlot> getBookableSlotsForInstitute(LocalDate weekStart, Integer instituteCode,
                                                              Long assessmentId) {
        LocalDate weekEnd = weekStart.plusDays(83);
        LocalDate today = clock.today();
        LocalDate effectiveStart = weekStart.isBefore(today) ? today : weekStart;
        if (effectiveStart.isAfter(weekEnd)) return List.of();

        List<Long> counsellorIds = assessmentId != null
                ? assessmentAssignmentRepository.findActiveCounsellorIdsForAssessment(assessmentId)
                : List.of();
        if (counsellorIds.isEmpty()) {
            counsellorIds = counsellorInstituteMappingService.getActiveCounsellorIdsForInstitute(instituteCode);
            if (counsellorIds.isEmpty()) return List.of();
        }
        return filterOutPastSlots(
                slotRepository.findActiveSlotsForCounsellors(counsellorIds, effectiveStart, weekEnd));
    }

    /**
     * Counselling is "offered" for an assessment when the admin has assigned at least one
     * active counsellor to it. This is the single switch that decides whether a student is
     * shown the optional slot-booking after finishing the assessment — independent of the
     * tier's counselling toggle, session count, or the student's institute.
     */
    public boolean hasCounsellorForAssessment(Long assessmentId) {
        if (assessmentId == null) return false;
        return !assessmentAssignmentRepository.findActiveCounsellorIdsForAssessment(assessmentId).isEmpty();
    }

    /**
     * The student's existing non-cancelled counselling appointment for this entitlement,
     * if any — used to suppress the "book counselling" offer once they've already booked.
     * Returns null when there is no active booking.
     */
    public CounsellingAppointment findActiveAppointment(Long userStudentId, Long entitlementId) {
        if (userStudentId == null) return null;
        java.util.Set<String> dead = java.util.Set.of("CANCELLED", "MISSED", "RESCHEDULED", "DECLINED");
        for (CounsellingAppointment a : appointmentRepository.findByStudentUserStudentId(userStudentId)) {
            String st = a.getStatus() == null ? "" : a.getStatus().toUpperCase();
            boolean active = !dead.contains(st);
            boolean sameEntitlement = entitlementId == null || entitlementId.equals(a.getEntitlementId());
            if (active && sameEntitlement) return a;
        }
        return null;
    }

    /**
     * The counsellors permitted to take a given appointment — the same resolution the student
     * picker uses, exposed so re-placement after a counsellor cancellation draws from exactly
     * the same pool.
     *
     * <p>Counsellors are not interchangeable. Assignment is per assessment, falling back to
     * the institute's allocation only when the assessment has none. Handing a session to
     * whoever happens to be free would put a student in front of a counsellor who does not
     * handle their assessment type.
     *
     * <p>Returns an empty list when nothing can be resolved, which the caller should treat as
     * "no replacement available" rather than "anyone will do".
     */
    public List<Long> eligibleCounsellorIdsFor(CounsellingAppointment appointment) {
        if (appointment == null) return List.of();

        Long assessmentId = resolveAssessmentId(appointment);
        List<Long> byAssessment = assessmentId != null
                ? assessmentAssignmentRepository.findActiveCounsellorIdsForAssessment(assessmentId)
                : List.of();
        if (!byAssessment.isEmpty()) return byAssessment;

        Integer instituteCode = null;
        try {
            UserStudent student = appointment.getStudent();
            if (student != null && student.getInstitute() != null) {
                instituteCode = student.getInstitute().getInstituteCode();
            }
        } catch (Exception e) {
            logger.debug("Could not resolve institute for appointment {}: {}",
                    appointment.getId(), e.getMessage());
        }
        if (instituteCode == null) return List.of();
        return counsellorInstituteMappingService.getActiveCounsellorIdsForInstitute(instituteCode);
    }

    /** The assessment behind this booking, via the entitlement it was drawn from. */
    private Long resolveAssessmentId(CounsellingAppointment appointment) {
        if (appointment.getEntitlementId() == null) return null;
        try {
            return entitlementRepository.findById(appointment.getEntitlementId())
                    .map(com.kccitm.api.model.career9.b2c.StudentEntitlement::getAssessmentId)
                    .orElse(null);
        } catch (Exception e) {
            logger.debug("Could not resolve assessment for appointment {}: {}",
                    appointment.getId(), e.getMessage());
            return null;
        }
    }

    private List<CounsellingSlot> filterOutPastSlots(List<CounsellingSlot> slots) {
        // Slot times are IST wall-clock; the JVM has no timezone configured and runs UTC in a
        // container. Asking the raw clock for "now" therefore reads 5h30m early and leaves
        // this morning's slots on the picker all afternoon. CounsellingClock answers in the
        // counselling timezone, so both sides of the comparison mean the same thing.
        LocalDate today = clock.today();
        LocalTime now = clock.timeNow();
        return slots.stream()
                .filter(s -> !s.getDate().equals(today) || s.getStartTime().isAfter(now))
                .collect(Collectors.toList());
    }

    /** True once a slot's start time has passed — nothing may be booked into it. */
    /**
     * A suspended/inactive counsellor takes no new appointments, ever. Thrown at
     * book/hold time as the last line of defence — the listing queries hide their
     * slots, but a picker can be open across the moment of suspension.
     */
    private void guardCounsellorActive(CounsellingSlot slot) {
        if (slot.getCounsellor() != null && Boolean.FALSE.equals(slot.getCounsellor().getIsActive())) {
            throw new BadRequestException(
                    "This counsellor is no longer available. Please pick a different time slot.");
        }
    }

    private boolean hasStarted(CounsellingSlot slot) {
        if (slot == null || slot.getDate() == null || slot.getStartTime() == null) return false;
        return !clock.sessionStart(slot.getDate(), slot.getStartTime()).isAfter(clock.now());
    }

    /**
     * Basic contact details the student supplies when booking. All fields are
     * optional at the service layer; the controller decides what is required.
     */
    public static class BookingContact {
        public String name;
        public String email;
        public String phone;
        public String preferredContactMethod; // EMAIL | PHONE | WHATSAPP
        // Optional parent/guardian contact — confirmation + reminders go here too.
        public String parentEmail;
        public String parentPhone;

        public BookingContact() {}

        public BookingContact(String name, String email, String phone, String preferredContactMethod) {
            this.name = name;
            this.email = email;
            this.phone = phone;
            this.preferredContactMethod = preferredContactMethod;
        }
    }

    /** Backwards-compatible overload — books with no extra contact details. */
    @Transactional
    public CounsellingAppointment bookSlot(Long slotId, UserStudent student, String reason) {
        return bookSlot(slotId, student, reason, null);
    }

    /**
     * Books a slot for the given student.
     * Verifies the slot is AVAILABLE, transitions it to REQUESTED,
     * creates an appointment with the counsellor auto-assigned from the slot,
     * snapshots the delivery mode (ONLINE/OFFLINE) and the corresponding
     * meeting link or office address, stores the student's contact details,
     * and fires a mode-aware confirmation notification.
     */
    @Transactional
    public CounsellingAppointment bookSlot(Long slotId, UserStudent student, String reason, BookingContact contact) {
        return bookSlot(slotId, student, reason, contact, null);
    }

    /**
     * As {@link #bookSlot(Long, UserStudent, String, BookingContact)} but records the
     * entitlement the session is drawn from, so a later no-show can credit it back.
     */
    @Transactional
    public CounsellingAppointment bookSlot(Long slotId, UserStudent student, String reason,
                                           BookingContact contact, Long entitlementId) {
        logger.info("Student {} attempting to book slot {}", student.getUserStudentId(), slotId);

        CounsellingSlot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException("Slot", "id", slotId));

        if (!"AVAILABLE".equals(slot.getStatus())) {
            throw new BadRequestException(
                    "Slot " + slotId + " is not available for booking. Current status: " + slot.getStatus());
        }
        // Suspended counsellors take no new appointments — full stop. The listing
        // queries already hide their slots, but this is the backstop for a picker
        // opened before the suspension (or any path that bypasses the listing).
        guardCounsellorActive(slot);

        // Counselling-timezone comparison: the raw JVM clock runs UTC in a container and would
        // wave through anything that started in the last 5h30m — including from a picker left
        // open while the slot expired.
        if (hasStarted(slot)) {
            throw new BadRequestException("Slot " + slotId + " is in the past and cannot be booked.");
        }

        // Transition slot to REQUESTED
        slot.setStatus("REQUESTED");
        slotRepository.save(slot);

        return createAppointmentForSlot(slot, student, reason, contact, entitlementId);
    }

    /**
     * Holds an AVAILABLE slot (AVAILABLE -> REQUESTED) WITHOUT creating an
     * appointment. Used by the PAY_LATER flow to reserve the slot while the
     * student completes payment; {@link #confirmHeldSlot} finalises it on the
     * webhook, or it is released back to AVAILABLE if payment fails/expires.
     */
    @Transactional
    public CounsellingSlot holdSlot(Long slotId) {
        return holdSlot(slotId, SOFT_HOLD_MINUTES);
    }

    /**
     * As {@link #holdSlot(Long)} but with an explicit hold TTL in minutes. Used by the
     * pay-before-book flow, which needs a longer window than the default soft-hold so the
     * student has time to complete the Razorpay payment before the slot is auto-released.
     */
    public CounsellingSlot holdSlot(Long slotId, long ttlMinutes) {
        CounsellingSlot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException("Slot", "id", slotId));
        if (!"AVAILABLE".equals(slot.getStatus())) {
            throw new BadRequestException(
                    "Slot " + slotId + " is not available. Current status: " + slot.getStatus());
        }
        // Same backstop as bookSlot: a suspended counsellor's hour cannot be held either.
        guardCounsellorActive(slot);
        if (hasStarted(slot)) {
            throw new BadRequestException("Slot " + slotId + " is in the past and cannot be held.");
        }
        slot.setStatus("REQUESTED");
        // Soft-hold TTL: the slot is reserved only for the payment window. A sweep
        // (CounsellingLifecycleService.releaseExpiredHolds) frees it if the student
        // abandons payment without it ever becoming a confirmed appointment.
        slot.setHeldUntil(LocalDateTime.now().plusMinutes(ttlMinutes));
        return slotRepository.save(slot);
    }

    /** Releases a held (REQUESTED) slot back to AVAILABLE — payment failed/expired. */
    @Transactional
    public void releaseHeldSlot(Long slotId) {
        slotRepository.findById(slotId).ifPresent(slot -> {
            if ("REQUESTED".equals(slot.getStatus())) {
                slot.setStatus("AVAILABLE");
                slotRepository.save(slot);
            }
        });
    }

    /**
     * Finalises a previously {@link #holdSlot held} slot into a confirmed
     * appointment (PAY_LATER, after payment succeeds). The slot is expected to be
     * in REQUESTED state already.
     */
    @Transactional
    public CounsellingAppointment confirmHeldSlot(Long slotId, UserStudent student, String reason,
                                                  BookingContact contact) {
        return confirmHeldSlot(slotId, student, reason, contact, null);
    }

    /**
     * As {@link #confirmHeldSlot(Long, UserStudent, String, BookingContact)} but records
     * the entitlement the session is drawn from (PAY flow, post-payment).
     */
    @Transactional
    public CounsellingAppointment confirmHeldSlot(Long slotId, UserStudent student, String reason,
                                                  BookingContact contact, Long entitlementId) {
        CounsellingSlot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException("Slot", "id", slotId));
        if (!"REQUESTED".equals(slot.getStatus())) {
            throw new BadRequestException(
                    "Held slot " + slotId + " is not in REQUESTED state (was " + slot.getStatus() + ")");
        }
        return createAppointmentForSlot(slot, student, reason, contact, entitlementId);
    }

    /** Shared appointment creation for an already-reserved (REQUESTED) slot. */
    private CounsellingAppointment createAppointmentForSlot(CounsellingSlot slot, UserStudent student,
                                                            String reason, BookingContact contact,
                                                            Long entitlementId) {
        Long slotId = slot.getId();
        // Create appointment — auto-assign counsellor from the slot
        CounsellingAppointment appointment = new CounsellingAppointment();
        appointment.setSlot(slot);
        appointment.setStudent(student);
        appointment.setCounsellor(slot.getCounsellor());
        appointment.setStudentReason(reason);
        appointment.setStatus("CONFIRMED");
        appointment.setEntitlementId(entitlementId);

        // The slot is now a confirmed booking, not an open hold — clear any soft-hold TTL
        // so the release sweep never reclaims it.
        slot.setHeldUntil(null);
        slotRepository.save(slot);

        // Snapshot the delivery mode from the slot, then attach the channel the
        // student needs: an auto-generated meeting link for ONLINE, the
        // counsellor's office address for OFFLINE.
        String mode = slot.getMode() != null ? slot.getMode() : "ONLINE";
        appointment.setMode(mode);
        if ("OFFLINE".equals(mode)) {
            String address = slot.getCounsellor() != null ? slot.getCounsellor().getOfficeAddress() : null;
            appointment.setLocation(address);
        } else {
            String link = meetingLinkService.generateMeetLink(appointment);
            appointment.setMeetingLink(link);
            appointment.setMeetingLinkSource("AUTO");
        }

        // Store the contact details the student filled in at booking.
        if (contact != null) {
            appointment.setStudentContactName(contact.name);
            appointment.setStudentContactEmail(contact.email);
            appointment.setStudentContactPhone(contact.phone);
            appointment.setPreferredContactMethod(contact.preferredContactMethod);
            appointment.setParentEmail(contact.parentEmail);
            appointment.setParentPhone(contact.parentPhone);
        }

        appointment = appointmentRepository.save(appointment);

        logger.info("Created appointment {} for student {} on slot {} (mode={})",
                appointment.getId(), student.getUserStudentId(), slotId, mode);

        // Auto-confirmed at booking — send the confirmation mail: session details,
        // assessment-report guidance (what Manage Sessions re-sends), the calendar
        // (.ics) invite, plus a best-effort WhatsApp confirmation. The mail retries
        // until the student's copy is accepted; a total failure is logged, never thrown.
        notificationService.sendConfirmationWithCalendar(appointment);
        if (mailEvents != null) {
            try {
                mailEvents.publish(confirmedEvent(appointment));
            } catch (Exception e) {
                logger.warn("Mail event publish failed for appointment {}: {}", appointment.getId(), e.getMessage());
            }
        }

        // Send in-app notification to student — UserStudent stores userId (Long),
        // not a User entity. We build a lightweight User reference using the stored userId.
        try {
            com.kccitm.api.model.User studentUser = new com.kccitm.api.model.User();
            studentUser.setId(student.getUserId());
            notificationService.createInAppNotification(
                    studentUser,
                    "BOOKING_CONFIRMED",
                    "Counselling Session Confirmed",
                    "Your counselling session has been booked. Check your email for the "
                            + ("OFFLINE".equals(mode) ? "venue address." : "meeting link."),
                    appointment.getId(),
                    "APPOINTMENT");
        } catch (Exception e) {
            logger.warn("Failed to create in-app notification for student {}: {}",
                    student.getUserStudentId(), e.getMessage());
        }

        // Audit log — no actor User is available at booking time; pass null
        Map<String, Object> newValues = new HashMap<>();
        newValues.put("status", "PENDING");
        newValues.put("slotId", slotId);
        newValues.put("studentId", student.getUserStudentId());
        auditLogService.log(appointment, "BOOKING_CREATED", null, reason, null, newValues);

        // Labelled lines rather than a sentence. The feed is scanned, not read: an admin is
        // looking down it for a school or a time, and a prose line buries both mid-sentence
        // in a different position on every row. "Student 2217" was worse still — an id the
        // reader had to go and look up before the entry told them anything at all.
        activityLogService.log("SLOT_BOOKED", "Session Booked",
                bookingSummary(student, slot, mode),
                slot.getCounsellor(), "Student");

        return appointment;
    }

    private static final java.time.format.DateTimeFormatter FEED_DATE =
            java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy");
    private static final java.time.format.DateTimeFormatter FEED_TIME =
            java.time.format.DateTimeFormatter.ofPattern("hh:mm a");

    /**
     * One booking, as labelled lines for the activity feed.
     *
     * <pre>
     * Student:    Riya Sharma
     * Institute:  Greenwood School
     * Counsellor: hiba
     * Date:       11 Aug 2026
     * Time:       01:15 PM (15 min, Online)
     * </pre>
     *
     * <p>Each fact sits at a fixed place on every row, so the feed can be scanned down a
     * column instead of read sentence by sentence. Any line that cannot be resolved is left
     * out rather than printed empty — a student with an incomplete profile still produces a
     * usable entry, falling back to the id only when there is genuinely no name.
     */
    private String bookingSummary(UserStudent student, CounsellingSlot slot, String mode) {
        StringBuilder sb = new StringBuilder();
        String name = null;
        String school = null;
        try {
            if (student != null && student.getStudentInfo() != null) {
                name = student.getStudentInfo().getName();
            }
            if (student != null && student.getInstitute() != null) {
                school = student.getInstitute().getInstituteName();
            }
        } catch (Exception ignored) {
            // A lazy association we cannot read is not worth failing a log line over.
        }
        if (name == null || name.isBlank()) {
            name = student != null ? "Student " + student.getUserStudentId() : "Unknown student";
        }

        sb.append("Student: ").append(name).append("\n");
        if (school != null && !school.isBlank()) sb.append("Institute: ").append(school).append("\n");
        if (slot != null && slot.getCounsellor() != null && slot.getCounsellor().getName() != null) {
            sb.append("Counsellor: ").append(slot.getCounsellor().getName()).append("\n");
        }
        if (slot != null && slot.getDate() != null) {
            sb.append("Date: ").append(slot.getDate().format(FEED_DATE)).append("\n");
        }
        if (slot != null && slot.getStartTime() != null) {
            sb.append("Time: ").append(slot.getStartTime().format(FEED_TIME))
              .append(" (").append(slot.getDurationMinutes()).append(" min, ")
              .append("OFFLINE".equals(mode) ? "In-person" : "Online").append(")");
        }
        return sb.toString().trim();
    }

    // ─── Mail events ─────────────────────────────────────────────────────────────

    /**
     * The booking as a mail event, snapshotted as the confirmation goes out. Nothing is sent
     * from here: the mail-automation engine matches it against admin automations once the
     * transaction commits. Date/time text is formatted exactly as the inline mail formats it;
     * the start/end instants are the slot's wall-clock times in the counselling zone, for
     * automations scheduled relative to the session.
     */
    private MailEventContext confirmedEvent(CounsellingAppointment a) {
        CounsellingSlot slot = a.getSlot();
        Counsellor c = a.getCounsellor();
        UserStudent s = a.getStudent();
        Long userStudentId = s != null ? s.getUserStudentId() : null;
        String studentName = notificationService.studentName(a);
        String studentEmail = notificationService.studentEmail(a);
        MailEventContext.Builder b = MailEventContext.of(MailEvent.APPOINTMENT_CONFIRMED)
                .subject("appointment", a.getId())
                .subject("entitlement", a.getEntitlementId())
                .subject("student", userStudentId)
                // The same three readers sendConfirmationWithCalendar addresses.
                .recipient(MailRecipientRole.STUDENT, studentEmail, studentName)
                .recipient(MailRecipientRole.PARENT, a.getParentEmail(), null)
                .recipient(MailRecipientRole.COUNSELLOR, c != null ? c.getEmail() : null,
                        c != null ? c.getName() : null)
                .field("student_name", studentName)
                .field("first_name", firstName(studentName))
                .field("student_email", studentEmail)
                .field("counsellor_name", c != null ? c.getName() : null)
                .field("counsellor_email", c != null ? c.getEmail() : null)
                .field("meeting_link", a.getMeetingLink())
                .field("venue", a.getLocation())
                .field("reschedule_link", notificationService.portalCounsellingUrl())
                .field("calendar_link", notificationService.googleCalendarLink(a))
                .ref("appointmentId", a.getId())
                .ref("entitlementId", a.getEntitlementId())
                .ref("userStudentId", userStudentId)
                .ref("counsellorId", c != null ? c.getId() : null)
                .student(userStudentId);
        if (s != null && s.getInstitute() != null) {
            b.institute(s.getInstitute().getInstituteCode());
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
                b.field("session_end_time", slot.getEndTime().format(CounsellingNotificationService.TIME_FMT))
                 .date("session_end", Date.from(
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
