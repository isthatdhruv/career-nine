package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;

/**
 * Admin-driven counselling booking — the admin books sessions on students' behalf, either
 * one student at a time or in bulk for everyone who completed an assessment.
 *
 * <p>This is a thin orchestration layer over the existing {@link BookingService}: it decides
 * <em>who</em> to book and <em>into which</em> slot, then delegates the actual booking (slot
 * transition, meeting-link generation, contact snapshot, confirmation hook) to {@code bookSlot}.
 * It deliberately adds no email/notification logic of its own.
 */
@Service
public class AdminCounsellingBookingService {

    private static final Logger logger = LoggerFactory.getLogger(AdminCounsellingBookingService.class);

    /** How far ahead (days) we look for AVAILABLE slots — matches the student picker's horizon. */
    private static final int SLOT_HORIZON_DAYS = 84; // 12 weeks

    @Autowired
    private StudentAssessmentMappingRepository mappingRepository;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingClock clock;

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private BookingService bookingService;

    @Autowired
    private AppointmentService appointmentService;

    // ---- Students who completed an assessment -------------------------------

    /**
     * Students who COMPLETED the given assessment, each tagged with whether they already have
     * an upcoming counselling appointment. Powers both the single-student picker and the
     * bulk-allotment preview.
     */
    public List<Map<String, Object>> getCompletedStudents(Long assessmentId) {
        List<StudentRow> rows = completedStudentRows(assessmentId);
        Set<Long> booked = upcomingBookedIds(rows);

        List<Map<String, Object>> out = new ArrayList<>();
        for (StudentRow r : rows) {
            Map<String, Object> m = studentBrief(r);
            m.put("hasUpcomingAppointment", booked.contains(r.id));
            out.add(m);
        }
        return out;
    }

    /** Distinct completed students for an assessment, as lightweight rows (id, name, email). */
    private List<StudentRow> completedStudentRows(Long assessmentId) {
        List<Object[]> lite = mappingRepository.findLiteByAssessmentId(assessmentId);
        Map<Long, StudentRow> byId = new LinkedHashMap<>();
        for (Object[] row : lite) {
            // [userStudentId, name, email, status, username]
            String status = row[3] == null ? "" : row[3].toString();
            if (!"completed".equalsIgnoreCase(status)) continue;
            Long id = row[0] == null ? null : ((Number) row[0]).longValue();
            if (id == null || byId.containsKey(id)) continue;
            byId.put(id, new StudentRow(id,
                    row[1] == null ? null : row[1].toString(),
                    row[2] == null ? null : row[2].toString()));
        }
        return new ArrayList<>(byId.values());
    }

    /** Of these students, the ids that already have an upcoming, still-active appointment. */
    private Set<Long> upcomingBookedIds(List<StudentRow> rows) {
        if (rows.isEmpty()) return Set.of();
        List<Long> ids = new ArrayList<>(rows.size());
        for (StudentRow r : rows) ids.add(r.id);
        return new HashSet<>(
                appointmentRepository.findStudentIdsWithUpcomingAppointment(ids, clock.today()));
    }

    /**
     * Maps each student to their EARLIEST upcoming, still-active appointment (slot + counsellor
     * loaded). Drives the "already booked" list: which students are booked, with whom, and when.
     * The query is ordered earliest-first, so the first row seen per student is kept.
     */
    private Map<Long, CounsellingAppointment> upcomingApptByStudent(List<StudentRow> rows) {
        if (rows.isEmpty()) return Map.of();
        List<Long> ids = new ArrayList<>(rows.size());
        for (StudentRow r : rows) ids.add(r.id);
        Map<Long, CounsellingAppointment> byStudent = new LinkedHashMap<>();
        for (CounsellingAppointment a :
                appointmentRepository.findUpcomingAppointmentsForStudents(ids, clock.today())) {
            Long sid = a.getStudent() != null ? a.getStudent().getUserStudentId() : null;
            if (sid != null) byStudent.putIfAbsent(sid, a);
        }
        return byStudent;
    }

    // ---- Bulk allotment -----------------------------------------------------

    /**
     * Dry-run for bulk allotment: how many students completed, who is already booked, how many
     * free slots exist, how many will fit, and how many won't. No bookings are made.
     *
     * <p>Students already counselled for this assessment (a completed online session, or one an
     * offline counsellor recorded at school) get a bucket of their own and are never offered for
     * booking. That bucket wins over "already booked": a booking left over for a student who has
     * been counselled is not one to rebook, and {@link #confirmBulk} drops these students anyway,
     * so listing them as tickable would only produce a booking the server then refuses. The
     * three lists are disjoint and add up to {@code totalCompleted}.
     */
    public Map<String, Object> previewBulk(Long assessmentId) {
        List<StudentRow> rows = completedStudentRows(assessmentId);
        Set<Long> counselled = counselledIds(rows, assessmentId);
        Map<Long, CounsellingAppointment> upcoming = upcomingApptByStudent(rows);

        List<Map<String, Object>> alreadyBooked = new ArrayList<>();
        List<Map<String, Object>> alreadyCounselled = new ArrayList<>();
        List<Map<String, Object>> toBook = new ArrayList<>();
        for (StudentRow r : rows) {
            CounsellingAppointment appt = upcoming.get(r.id);
            if (counselled.contains(r.id)) alreadyCounselled.add(studentBrief(r));
            else if (appt != null) alreadyBooked.add(bookedBrief(r, appt));
            else toBook.add(studentBrief(r));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("assessmentId", assessmentId);
        out.put("totalCompleted", rows.size());
        out.put("toBook", toBook);
        out.put("toBookCount", toBook.size());
        out.put("alreadyBooked", alreadyBooked);
        out.put("alreadyBookedCount", alreadyBooked.size());
        out.put("alreadyCounselled", alreadyCounselled);
        out.put("alreadyCounselledCount", alreadyCounselled.size());
        out.put("availableSlotCount", availableSlots().size());
        return out;
    }

    /**
     * Performs bulk allotment for an explicit set of students the admin selected in the preview
     * ({@code studentIds} — the union of ticked rows from the "to book" and "already booked"
     * lists). Ids are restricted to students who actually completed the assessment. Each is
     * greedily assigned to the earliest AVAILABLE slot across all counsellors; we book what fits
     * and report the rest.
     *
     * <p>Students already counselled for this assessment are dropped here, whatever the client
     * sent: the preview shows them read-only, but it can be stale (an offline counsellor may
     * mark a student done in between) and the request body is the admin's to edit. They come
     * back under {@code unbooked} with the reason, so booked + unbooked still equals requested.
     * Every booking made is stamped with {@code assessmentId}, so it counts as counselling for
     * this assessment once it completes.
     *
     * <p>Intentionally NOT {@code @Transactional}: each {@code bookSlot} commits in its own
     * transaction, so one failure (e.g. a slot taken concurrently, a missing student record)
     * never rolls back the students already booked in the same run.
     */
    public Map<String, Object> confirmBulk(Long assessmentId, List<Long> studentIds) {
        // Restrict to students who completed this assessment — the admin can only book within
        // the cohort the preview showed.
        Map<Long, StudentRow> completedById = new LinkedHashMap<>();
        for (StudentRow r : completedStudentRows(assessmentId)) completedById.put(r.id, r);

        // Keep the requested order, de-dupe, drop anything not in the completed set.
        List<StudentRow> targets = new ArrayList<>();
        if (studentIds != null) {
            Set<Long> seen = new HashSet<>();
            for (Long id : studentIds) {
                if (id == null || !seen.add(id)) continue;
                StudentRow r = completedById.get(id);
                if (r != null) targets.add(r);
            }
        }

        Set<Long> counselled = counselledIds(targets, assessmentId);

        // Earliest-first pool of available slots; each successful booking consumes one.
        Deque<CounsellingSlot> pool = new ArrayDeque<>(availableSlots());

        List<Map<String, Object>> bookedResult = new ArrayList<>();
        List<Map<String, Object>> unbooked = new ArrayList<>();

        for (StudentRow r : targets) {
            if (counselled.contains(r.id)) {
                unbooked.add(briefWithReason(r, "Already counselled for this assessment"));
                continue;
            }
            UserStudent student = userStudentRepository.findByIdWithStudentInfo(r.id).orElse(null);
            if (student == null) {
                unbooked.add(briefWithReason(r, "Student record not found"));
                continue;
            }
            boolean poolWasEmpty = pool.isEmpty();
            CounsellingAppointment appt = tryBook(student, pool, "Allotted by admin (bulk)");
            if (appt != null) {
                appt = stampAssessment(appt, assessmentId);
                Map<String, Object> b = studentBrief(r);
                b.putAll(appointmentSnapshot(appt));
                bookedResult.add(b);
            } else {
                unbooked.add(briefWithReason(r, poolWasEmpty ? "No available slots" : "Booking failed"));
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("assessmentId", assessmentId);
        out.put("requestedCount", targets.size());
        out.put("bookedCount", bookedResult.size());
        out.put("booked", bookedResult);
        out.put("unbookedCount", unbooked.size());
        out.put("unbooked", unbooked);
        logger.info("Bulk allotment for assessment {}: requested={}, booked={}, unbooked={}",
                assessmentId, targets.size(), bookedResult.size(), unbooked.size());
        return out;
    }

    /**
     * Pops slots from the pool until one books successfully (covers the rare race where a pooled
     * slot was taken between fetch and booking) or the pool is empty.
     */
    private CounsellingAppointment tryBook(UserStudent student, Deque<CounsellingSlot> pool, String reason) {
        while (!pool.isEmpty()) {
            CounsellingSlot slot = pool.pollFirst();
            try {
                return bookingService.bookSlot(slot.getId(), student, reason, contactFor(student), null);
            } catch (RuntimeException e) {
                logger.warn("Bulk booking: slot {} failed for student {} ({}); trying next slot",
                        slot.getId(), student.getUserStudentId(), e.getMessage());
            }
        }
        return null;
    }

    /**
     * Records which assessment a bulk booking is for. {@code bookSlot} derives it only from an
     * entitlement, and a bulk booking has none, so without this a session held for the cohort
     * would never count as "counselled for this assessment" (the done check reads
     * {@code assessment_id} first, then the entitlement's). The booking has already committed
     * and is valid without the stamp, so a failure here is logged rather than reported as
     * unbooked.
     */
    private CounsellingAppointment stampAssessment(CounsellingAppointment appt, Long assessmentId) {
        if (assessmentId == null || appt.getAssessmentId() != null) return appt;
        try {
            appt.setAssessmentId(assessmentId);
            return appointmentRepository.save(appt);
        } catch (RuntimeException e) {
            logger.warn("Bulk booking: could not stamp assessment {} on appointment {} ({})",
                    assessmentId, appt.getId(), e.getMessage());
            return appt;
        }
    }

    // ---- Single-student booking --------------------------------------------

    /**
     * Books one specific AVAILABLE slot for one student on the admin's behalf. Reuses the same
     * booking engine as the student flow (meeting link, mode snapshot, confirmation hook).
     */
    public CounsellingAppointment bookForStudent(Long studentId, Long slotId, String reason) {
        UserStudent student = userStudentRepository.findByIdWithStudentInfo(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("UserStudent", "id", studentId));
        String why = (reason == null || reason.isBlank()) ? "Booked by admin" : reason;
        return bookingService.bookSlot(slotId, student, why, contactFor(student), null);
    }

    // ---- Change counsellor & rebook ----------------------------------------

    /**
     * Admin "change counsellor & rebook": moves a student's existing upcoming appointment onto the
     * EARLIEST available future slot of the chosen counsellor.
     *
     * <p>Reuses {@link AppointmentService#reschedule} (admin flag set) so the old slot is freed and
     * the standard reschedule audit/notification hooks fire — then re-points the new appointment's
     * counsellor to the new slot's owner. {@code reschedule} carries the OLD counsellor forward
     * (correct for a same-counsellor time change, wrong for a counsellor swap), so the fix-up is
     * what actually changes the counsellor.
     *
     * @return a snapshot of the new booking (appointmentId, counsellor, slot timing).
     */
    public Map<String, Object> rebookWithCounsellor(Long appointmentId, Long counsellorId, User actor) {
        CounsellingAppointment existing = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        // A held session is done, not missed: "rebooking" it would flip it to RESCHEDULED and
        // un-counsel the student. An offline record is refused in any state — its slot is a
        // synthetic marker, never a bookable hour. (reschedule refuses both too; checking here
        // first gives the admin the reason instead of the time-window message below.)
        if ("COMPLETED".equalsIgnoreCase(existing.getStatus()) || existing.isOfflineRecord()) {
            throw new IllegalStateException(
                    "This session has already taken place, so it can't be moved to another counsellor.");
        }

        // Rebook is only for sessions whose scheduled time has already passed (e.g. missed/finished).
        // Still-upcoming sessions are left alone — the admin can't yank a confirmed future session around.
        CounsellingSlot oldSlot = existing.getSlot();
        LocalDateTime sessionEnd = (oldSlot != null && oldSlot.getDate() != null && oldSlot.getEndTime() != null)
                ? LocalDateTime.of(oldSlot.getDate(), oldSlot.getEndTime()) : null;
        if (sessionEnd == null || !sessionEnd.isBefore(clock.now())) {
            throw new IllegalStateException(
                    "This session's time hasn't passed yet — rebook is available only after the scheduled session has ended.");
        }

        CounsellingSlot target = earliestAvailableSlotForCounsellor(counsellorId);
        if (target == null) {
            throw new IllegalStateException("No available slots for the selected counsellor.");
        }

        // Past session: bypass the 4-hour reschedule window (it always rejects a past start time);
        // the admin flag bypasses the student reschedule cap.
        CounsellingAppointment appt = appointmentService.reschedule(appointmentId, target.getId(), actor, true, true);

        Counsellor slotCounsellor = target.getCounsellor();
        if (slotCounsellor != null
                && (appt.getCounsellor() == null
                        || !slotCounsellor.getId().equals(appt.getCounsellor().getId()))) {
            appt.setCounsellor(slotCounsellor);
            appt = appointmentRepository.save(appt);
        }

        logger.info("Rebooked appointment {} -> new appointment {} onto counsellor {} slot {}",
                appointmentId, appt.getId(), counsellorId, target.getId());

        Map<String, Object> out = new LinkedHashMap<>();
        UserStudent stu = appt.getStudent();
        out.put("studentId", stu != null ? stu.getUserStudentId() : null);
        out.putAll(appointmentSnapshot(appt));
        return out;
    }

    /** Earliest AVAILABLE, future slot for one counsellor (same horizon/past-cutoff as bulk allotment). */
    private CounsellingSlot earliestAvailableSlotForCounsellor(Long counsellorId) {
        // Counselling timezone, not the JVM's — see CounsellingClock.
        LocalDate today = clock.today();
        LocalDate end = today.plusDays(SLOT_HORIZON_DAYS);
        LocalTime now = clock.timeNow();
        // The query is ordered by date, startTime — the first slot that isn't already-past is the earliest.
        for (CounsellingSlot s : slotRepository.findAvailableSlotsForCounsellors(List.of(counsellorId), today, end)) {
            if (s.getDate().equals(today) && !s.getStartTime().isAfter(now)) continue;
            return s;
        }
        return null;
    }

    // ---- helpers ------------------------------------------------------------

    /** Snapshot the student's profile contact so the appointment record (and any later
     *  confirmation the email service sends) has a recipient — plus the parent/guardian
     *  contact from an earlier booking, the only place one is kept, so the parent hears
     *  about an admin-made booking too. */
    private BookingService.BookingContact contactFor(UserStudent student) {
        return BookingService.BookingContact.fromProfile(student, priorWithParentContact(student));
    }

    /** The student's newest booking that carries a parent contact, else her newest one, else null. */
    private CounsellingAppointment priorWithParentContact(UserStudent student) {
        if (student == null || student.getUserStudentId() == null) return null;
        List<CounsellingAppointment> history = appointmentRepository.findByStudentIdOrdered(student.getUserStudentId());
        if (history == null || history.isEmpty()) return null;
        for (CounsellingAppointment a : history) {
            if (notBlank(a.getParentEmail()) || notBlank(a.getParentPhone())) return a;
        }
        return history.get(0);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }

    /**
     * Of these students, the ones already counselled for the assessment: a COMPLETED session tied
     * to it directly or through the entitlement it was booked on. Same native query as the
     * offline page's mark-done check (its list applies the same predicate per school), so the
     * two screens agree on who is done.
     */
    private Set<Long> counselledIds(List<StudentRow> rows, Long assessmentId) {
        if (rows.isEmpty() || assessmentId == null) return Set.of();
        List<Long> ids = new ArrayList<>(rows.size());
        for (StudentRow r : rows) ids.add(r.id);
        Set<Long> out = new HashSet<>();
        for (Object[] row : appointmentRepository.findLatestCompletedForAssessment(ids, assessmentId)) {
            if (row != null && row.length > 0 && row[0] != null) out.add(((Number) row[0]).longValue());
        }
        return out;
    }

    /** AVAILABLE, non-blocked, future slots across all counsellors, earliest first. */
    private List<CounsellingSlot> availableSlots() {
        // Counselling timezone, not the JVM's — see CounsellingClock.
        LocalDate today = clock.today();
        LocalDate end = today.plusDays(SLOT_HORIZON_DAYS);
        List<CounsellingSlot> slots = slotRepository.findAvailableSlots(today, end);
        LocalTime now = clock.timeNow();
        List<CounsellingSlot> out = new ArrayList<>(slots.size());
        for (CounsellingSlot s : slots) {
            // Skip today's slots whose start time has already passed.
            if (s.getDate().equals(today) && !s.getStartTime().isAfter(now)) continue;
            out.add(s);
        }
        return out;
    }

    private Map<String, Object> studentBrief(StudentRow r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("studentId", r.id);
        m.put("name", r.name);
        m.put("email", r.email);
        return m;
    }

    /** Student brief enriched with their current upcoming booking — counsellor + slot timing.
     *  Shown in the "already booked" list so the admin sees with whom and when, and can rebook. */
    private Map<String, Object> bookedBrief(StudentRow r, CounsellingAppointment appt) {
        Map<String, Object> m = studentBrief(r);
        m.putAll(appointmentSnapshot(appt));
        return m;
    }

    /** The counsellor + slot timing fields of an appointment, as a flat map. Shared by the
     *  already-booked list, the bulk-confirm result, and the rebook response. */
    private Map<String, Object> appointmentSnapshot(CounsellingAppointment appt) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("appointmentId", appt.getId());
        Counsellor c = appt.getCounsellor();
        m.put("counsellorId", c != null ? c.getId() : null);
        m.put("counsellorName", c != null ? c.getName() : null);
        CounsellingSlot s = appt.getSlot();
        m.put("slotId", s != null ? s.getId() : null);
        m.put("date", s != null ? String.valueOf(s.getDate()) : null);
        m.put("startTime", s != null ? String.valueOf(s.getStartTime()) : null);
        m.put("endTime", s != null ? String.valueOf(s.getEndTime()) : null);
        return m;
    }

    private Map<String, Object> briefWithReason(StudentRow r, String reason) {
        Map<String, Object> m = studentBrief(r);
        m.put("reason", reason);
        return m;
    }

    private static final class StudentRow {
        final Long id;
        final String name;
        final String email;

        StudentRow(Long id, String name, String email) {
            this.id = id;
            this.name = name;
            this.email = email;
        }
    }
}
