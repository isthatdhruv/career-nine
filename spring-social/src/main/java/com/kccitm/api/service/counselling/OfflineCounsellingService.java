package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.model.career9.counselling.StudentCounsellorMapping;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import com.kccitm.api.repository.Career9.counselling.StudentCounsellorMappingRepository;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.AuthAuditService;

/**
 * Offline counselling: schools that counsel their students themselves, through a counsellor an
 * admin has flagged offline. From one portal page that counsellor sees every student of their
 * school(s), takes students over with "Map to me", and records each in-person session with
 * "Mark done" (OTP and a photo of the paper sheet both optional).
 *
 * <p><b>How a session is stored.</b> As an ordinary {@link CounsellingAppointment}: COMPLETED,
 * mode OFFLINE, origin {@link CounsellingAppointment#ORIGIN_OFFLINE_RECORD}, the assessment
 * stamped on it, on a synthetic slot of its own (the slot is NOT NULL and some twenty queries
 * inner-join it). Photos, the audit log, the principal dashboard's "students counselled", admin
 * cards and report release then all work unchanged.
 *
 * <p><b>Every gate is enforced here, in code.</b> {@code @PreAuthorize} runs log-only in every
 * profile, so it stops nobody. The actor is always the logged-in user's own counsellor profile —
 * never an id from the request — and must be active and flagged offline; the schools are that
 * counsellor's active institute mappings, re-read on every call so revocation is immediate; and
 * each student's <i>own</i> {@code user_student.institute_id} must be one of them (a B2C student,
 * with none, never is). Students are read natively or by primary key, never by JPQL: the
 * Hibernate scope filter would hide every school student from a counsellor without scope rows.
 */
@Service
public class OfflineCounsellingService {

    private static final Logger logger = LoggerFactory.getLogger(OfflineCounsellingService.class);

    /** One "Map to me" request. The page chunks larger selections. */
    public static final int MAX_MAP_BATCH = 500;

    /** How far back a session may be recorded. Future dates are never allowed. */
    public static final int SESSION_DATE_MAX_DAYS_BACK = 30;

    static final String ROLE_SYSTEM = "SYSTEM";
    static final String REASON_COUNSELLED_OFFLINE = "COUNSELLED_OFFLINE";
    static final String REASON_OFFLINE_RECORD_REVERTED = "OFFLINE_RECORD_REVERTED";

    static final String PERM_REVERT = "counselling.appointment.delete";
    static final String PERM_OFFLINE_FLAG = "counsellor.create";

    /** Bookings still to happen: recording the session offline cancels these. */
    static final Set<String> LIVE_STATUSES = new HashSet<>(
            Arrays.asList("PENDING", "ASSIGNED", "CONFIRMED", "AWAITING_RESCHEDULE"));

    /** A session under way or being decided: recording over it would erase what happened. */
    static final Set<String> IN_SESSION_STATUSES = new HashSet<>(Arrays.asList("IN_PROGRESS", "UNDER_REVIEW"));

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter FEED_DATE = DateTimeFormatter.ofPattern("d MMM yyyy");
    private static final DateTimeFormatter LOCK_TIME = DateTimeFormatter.ofPattern("h:mm a");

    @Autowired
    private CounsellorRepository counsellorRepository;

    @Autowired
    private OfflineCounsellingQueries queries;

    @Autowired
    private StudentCounsellorMappingRepository mappingRepository;

    @Autowired
    private StudentCounsellorMappingService mappingService;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingSlotRepository slotRepository;

    @Autowired
    private AppointmentService appointmentService;

    @Autowired
    private StudentEntitlementRepository entitlementRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private CounsellingActivityLogService activityLogService;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private AuthAuditService authAuditService;

    @Autowired
    private CounsellingClock clock;

    // ─── Response bodies ─────────────────────────────────────────────────────────
    // Plain public-field POJOs, serialised field-for-field. Entities never leave this service.

    public static class OfflineContext {
        public boolean offline;
        public Long counsellorId;
        public String name;
        public List<InstituteOption> institutes = new ArrayList<>();
    }

    public static class InstituteOption {
        public Integer instituteCode;
        public String instituteName;
        public Boolean isSchool;
    }

    public static class AssessmentOption {
        public Long assessmentId;
        public String assessmentName;
        public long studentCount;
    }

    public static class LiveBooking {
        public Long appointmentId;
        public String date;
        public String startTime;
        public String counsellorName;
        public String status;
    }

    public static class StudentRow {
        public Long userStudentId;
        public String name;
        public String rollNumber;
        public String className;
        public String sectionName;
        public String assessmentStatus;
        public boolean hasDob;
        public Long mappedCounsellorId;
        public String mappedCounsellorName;
        public boolean mappedToMe;
        public boolean done;
        public Long doneAppointmentId;
        public String doneDate;
        public String doneByCounsellorName;
        public boolean doneByMe;
        public boolean doneOffline;
        public boolean otpVerified;
        public int photoCount;
        public boolean reportHeld;
        public List<LiveBooking> liveBookings = new ArrayList<>();
    }

    public static class MapToMeResult {
        public Long userStudentId;
        public String status;
        public String previousCounsellorName;
        public String reason;

        MapToMeResult(Long userStudentId, String status, String previousCounsellorName, String reason) {
            this.userStudentId = userStudentId;
            this.status = status;
            this.previousCounsellorName = previousCounsellorName;
            this.reason = reason;
        }
    }

    public static class MapToMeResponse {
        public List<MapToMeResult> results = new ArrayList<>();
        public int mappedCount;
        public int takenOverCount;
        public int alreadyMineCount;
        public int skippedCount;
    }

    public static class MarkDoneResult {
        public Long appointmentId;
        public boolean otpVerified;
        public String otpResult;
        public List<Long> cancelledBookingIds = new ArrayList<>();
    }

    public static class RevertResult {
        public Long appointmentId;
        public String status;
    }

    public static class OfflineFlagResult {
        public Long counsellorId;
        public Boolean isOffline;
    }

    /** The calling offline counsellor and the schools they may act in (code → school). */
    static class Actor {
        final Counsellor counsellor;
        final Map<Integer, InstituteOption> institutes = new LinkedHashMap<>();

        Actor(Counsellor counsellor, List<InstituteOption> schools) {
            this.counsellor = counsellor;
            for (InstituteOption o : schools) {
                if (o != null && o.instituteCode != null) institutes.put(o.instituteCode, o);
            }
        }

        Long id() { return counsellor.getId(); }

        boolean allows(Integer instituteCode) {
            return instituteCode != null && institutes.containsKey(instituteCode);
        }
    }

    // ─── Context ─────────────────────────────────────────────────────────────────

    /**
     * Whether the caller gets the offline page, and their schools. Always answers (never a 403):
     * the sidebar, the login landing and the super-admin menu all ask on every load, and most
     * callers are simply not offline counsellors.
     */
    public OfflineContext context(UserPrincipal principal) {
        OfflineContext ctx = new OfflineContext();
        if (principal == null || principal.getId() == null) return ctx;
        try {
            Counsellor c = counsellorRepository.findByUserId(principal.getId()).orElse(null);
            if (!isActiveOffline(c)) return ctx;
            ctx.offline = true;
            ctx.counsellorId = c.getId();
            ctx.name = c.getName();
            ctx.institutes = queries.activeInstitutes(c.getId());
            return ctx;
        } catch (RuntimeException e) {
            logger.warn("Offline counselling context failed for user {}: {}", principal.getId(), e.getMessage());
            return new OfflineContext();
        }
    }

    // ─── Lists ───────────────────────────────────────────────────────────────────

    /** Assessments allotted in one of my schools, for the page's assessment picker. */
    public List<AssessmentOption> assessments(UserPrincipal principal, Integer instituteCode) {
        Actor me = requireOfflineCounsellor(principal);
        requireSchool(me, instituteCode);
        return queries.assessmentsForInstitute(instituteCode);
    }

    /**
     * Every student of the school allotted the assessment, with mapping, "done" state, photo
     * count and any live online bookings. Filtering and paging happen on the page.
     */
    public List<StudentRow> students(UserPrincipal principal, Integer instituteCode, Long assessmentId) {
        Actor me = requireOfflineCounsellor(principal);
        requireSchool(me, instituteCode);
        if (assessmentId == null) {
            throw OfflineCounsellingException.badRequest("BAD_REQUEST", "Pick an assessment first.");
        }

        List<StudentRow> rows = queries.studentRows(instituteCode, assessmentId);
        Map<Long, OfflineCounsellingQueries.DoneInfo> done = queries.doneForInstitute(instituteCode, assessmentId);
        Map<Long, List<OfflineCounsellingQueries.LiveBookingRow>> live =
                queries.liveBookingsForInstitute(instituteCode, assessmentId);

        for (StudentRow row : rows) {
            row.mappedToMe = me.id().equals(row.mappedCounsellorId);
            OfflineCounsellingQueries.DoneInfo d = done.get(row.userStudentId);
            if (d != null) {
                row.done = true;
                row.doneAppointmentId = d.appointmentId;
                row.doneDate = d.date != null ? d.date.format(ISO_DATE) : null;
                row.doneByCounsellorName = d.counsellorName;
                row.doneByMe = me.id().equals(d.counsellorId);
                row.doneOffline = CounsellingAppointment.ORIGIN_OFFLINE_RECORD.equals(d.origin);
                row.otpVerified = d.otpVerified;
                row.photoCount = d.photoCount;
                row.reportHeld = d.reportHeld;
            }
            for (OfflineCounsellingQueries.LiveBookingRow b : live.getOrDefault(row.userStudentId,
                    Collections.<OfflineCounsellingQueries.LiveBookingRow>emptyList())) {
                LiveBooking lb = new LiveBooking();
                lb.appointmentId = b.appointmentId;
                lb.date = b.date != null ? b.date.format(ISO_DATE) : null;
                lb.startTime = b.startTime != null ? b.startTime.toString() : null;
                lb.counsellorName = b.counsellorName;
                lb.status = b.status;
                row.liveBookings.add(lb);
            }
        }
        return rows;
    }

    // ─── Map to me ───────────────────────────────────────────────────────────────

    /**
     * Maps each student to the caller, taking them from another counsellor if need be.
     *
     * <p>Not one transaction: each student is its own upsert (see
     * {@link StudentCounsellorMappingService#upsertActiveMapping}), so one failure is reported
     * for that student and the rest still go through. The previous counsellors are read first
     * so the response — and the audit trail — can say whom each student was taken from.
     */
    public MapToMeResponse mapToMe(UserPrincipal principal, List<Long> userStudentIds) {
        Actor me = requireOfflineCounsellor(principal);
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        if (userStudentIds != null) {
            for (Long id : userStudentIds) if (id != null) ids.add(id);
        }
        if (ids.isEmpty()) {
            throw OfflineCounsellingException.badRequest("BAD_REQUEST", "Pick at least one student.");
        }
        if (ids.size() > MAX_MAP_BATCH) {
            throw OfflineCounsellingException.badRequest("TOO_MANY",
                    "Map at most " + MAX_MAP_BATCH + " students at a time.")
                    .with("max", MAX_MAP_BATCH);
        }

        Map<Long, Integer> instituteOf = queries.institutesOfStudents(ids);
        Map<Long, OfflineCounsellingQueries.MappingState> before = queries.mappingsOf(ids);

        MapToMeResponse res = new MapToMeResponse();
        // previous counsellor id -> [name, count], for the audit line and their activity feed
        Map<Long, String> takenFromNames = new LinkedHashMap<>();
        Map<Long, Integer> takenFromCounts = new LinkedHashMap<>();

        for (Long sid : ids) {
            if (!me.allows(instituteOf.get(sid))) {
                res.results.add(new MapToMeResult(sid, "SKIPPED", null, "NOT_IN_SCOPE"));
                res.skippedCount++;
                continue;
            }
            OfflineCounsellingQueries.MappingState prev = before.get(sid);
            boolean activeElsewhere = prev != null && prev.active && prev.counsellorId != null
                    && !prev.counsellorId.equals(me.id());
            if (prev != null && prev.active && me.id().equals(prev.counsellorId)) {
                res.results.add(new MapToMeResult(sid, "ALREADY_MINE", null, null));
                res.alreadyMineCount++;
                continue;
            }
            try {
                mappingService.upsertActiveMapping(sid, me.id(), principal.getId());
            } catch (RuntimeException e) {
                logger.warn("Map-to-me failed for student {} by counsellor {}: {}", sid, me.id(), e.getMessage());
                res.results.add(new MapToMeResult(sid, "SKIPPED", null, "ERROR"));
                res.skippedCount++;
                continue;
            }
            if (activeElsewhere) {
                res.results.add(new MapToMeResult(sid, "TAKEN_OVER", prev.counsellorName, null));
                res.takenOverCount++;
                takenFromNames.put(prev.counsellorId, prev.counsellorName);
                takenFromCounts.merge(prev.counsellorId, 1, Integer::sum);
            } else {
                res.results.add(new MapToMeResult(sid, "MAPPED", null, null));
                res.mappedCount++;
            }
        }

        recordMapToMe(me, principal, res, takenFromNames, takenFromCounts);
        return res;
    }

    private void recordMapToMe(Actor me, UserPrincipal principal, MapToMeResponse res,
                               Map<Long, String> takenFromNames, Map<Long, Integer> takenFromCounts) {
        if (res.mappedCount == 0 && res.takenOverCount == 0) return;
        StringBuilder from = new StringBuilder();
        for (Map.Entry<Long, Integer> e : takenFromCounts.entrySet()) {
            if (from.length() > 0) from.append(", ");
            from.append(takenFromNames.get(e.getKey())).append(" (#").append(e.getKey()).append(") x").append(e.getValue());
        }
        audit(principal, "counselling.appointment.update", "OFFLINE_MAP_TO_ME counsellor=" + me.id()
                + " mapped=" + res.mappedCount + " takenOver=" + res.takenOverCount
                + (from.length() > 0 ? " from=" + from : ""));
        try {
            activityLogService.log("STUDENTS_MAPPED_OFFLINE", "Students mapped",
                    "Newly mapped: " + res.mappedCount
                            + "\nTaken over: " + res.takenOverCount
                            + (from.length() > 0 ? "\nTaken from: " + from : ""),
                    me.counsellor, me.counsellor.getName());
            // The counsellor who lost students hears it in their own feed, with who took them.
            for (Map.Entry<Long, Integer> e : takenFromCounts.entrySet()) {
                Counsellor previous = counsellorRepository.findById(e.getKey()).orElse(null);
                if (previous == null) continue;
                activityLogService.log("STUDENTS_TAKEN_OVER", "Students moved to another counsellor",
                        "Students: " + e.getValue() + "\nMoved to: " + me.counsellor.getName(),
                        previous, me.counsellor.getName());
            }
        } catch (RuntimeException e) {
            logger.warn("Map-to-me activity log failed for counsellor {}: {}", me.id(), e.getMessage());
        }
    }

    // ─── Mark done ───────────────────────────────────────────────────────────────

    /**
     * Every check {@link #markDone} makes, read-only, run BEFORE the OTP is checked so that a
     * request bound to fail anyway (not mine, not allotted, already done, bad date) does not
     * spend one of the student's OTP attempts. {@code markDone} repeats them under the lock.
     *
     * <p>Reads natively on purpose: open-in-view keeps one persistence context for the request,
     * and a mapping entity loaded here would be handed back — stale — by markDone's locking
     * query, which does not refresh an entity the context already holds.
     *
     * @return the caller's counsellor id, for the OTP audit trail
     */
    public Long preflight(UserPrincipal principal, Long userStudentId, Long assessmentId, LocalDate sessionDate) {
        Actor me = requireOfflineCounsellor(principal);
        requireIds(userStudentId, assessmentId);
        requireStudentInScope(me, userStudentId);
        requireSessionDate(sessionDate);
        OfflineCounsellingQueries.MappingState m =
                queries.mappingsOf(Collections.singleton(userStudentId)).get(userStudentId);
        if (m == null || !m.active || !me.id().equals(m.counsellorId)) throw notMapped();
        requireAllotted(userStudentId, assessmentId);
        requireNotDone(me, userStudentId, assessmentId);
        for (OfflineCounsellingQueries.LiveBookingRow b : queries.liveBookingsForStudent(userStudentId, assessmentId)) {
            if (IN_SESSION_STATUSES.contains(b.status)) throw sessionInProgress();
        }
        return me.id();
    }

    /**
     * Turns the OTP guard's verdict into "verified" or the error the page shows. Wrong, locked
     * and no-DOB all refuse the save: a counsellor who typed a code meant it to be checked, and
     * can clear the field to save the session as unverified instead.
     */
    public static boolean otpVerifiedOrThrow(OtpGuardService.Result result) {
        switch (result.getStatus()) {
            case VERIFIED:
                return true;
            case WRONG:
                Integer left = result.getAttemptsLeft();
                throw OfflineCounsellingException.badRequest("OTP_WRONG",
                        "That code is not right. " + left + (left != null && left == 1 ? " attempt" : " attempts")
                                + " left.")
                        .with("attemptsLeft", left);
            case LOCKED:
                throw OfflineCounsellingException.locked("OTP_LOCKED", result.isPermanent()
                                ? "Too many wrong codes for this student, so the code can no longer be checked. "
                                        + "Clear it to save the session as not verified."
                                : "Too many wrong codes. Try again after "
                                        + result.getLockedUntil().format(LOCK_TIME)
                                        + ", or clear the code to save the session as not verified.")
                        .with("lockedUntil", result.getLockedUntil() != null ? result.getLockedUntil().toString() : null)
                        .with("permanent", result.isPermanent());
            case NO_DOB:
            default:
                throw OfflineCounsellingException.badRequest("OTP_NO_DOB",
                        "This student has no date of birth on record, so the code cannot be checked. "
                                + "Clear it to save the session as not verified.");
        }
    }

    /**
     * Records that the caller counselled the student in person for the assessment.
     *
     * <p><b>The lock comes first, before any other read.</b> MySQL's REPEATABLE READ fixes a
     * transaction's snapshot at its first plain read. Were the guard's lookups to run before the
     * lock, a second tap waiting on the lock would, once through, still be reading the snapshot
     * from before the first tap committed — see no record, and write a duplicate. Taken first,
     * the lock makes every later read see the other request's work. The same lock serialises
     * this with another counsellor's "Map to me" of the same student.
     *
     * <p>Then, under the lock: the guard; my school; the date; still mapped to me; allotted; not
     * already done (by me → 409 with the id, which the page treats as success, so a retry after
     * a dropped response is safe); no session under way. Live bookings for this assessment (or
     * for no known assessment) are cancelled silently — the student already had her session —
     * with the slot released and nothing credited back. The synthetic slot is saved before the
     * appointment (no cascade), the entitlement is linked and never consumed (a cancelled
     * booking already consumed the session that was delivered), and the student's thank-you
     * mail is sent only once all of this has committed.
     */
    @Transactional
    public MarkDoneResult markDone(UserPrincipal principal, Long userStudentId, Long assessmentId,
                                   LocalDate sessionDate, boolean otpVerified) {
        StudentCounsellorMapping mapping = userStudentId == null ? null
                : mappingRepository.lockByStudent(userStudentId).orElse(null);

        Actor me = requireOfflineCounsellor(principal);
        requireIds(userStudentId, assessmentId);
        Integer instituteCode = requireStudentInScope(me, userStudentId);
        requireSessionDate(sessionDate);
        if (mapping == null || !Boolean.TRUE.equals(mapping.getIsActive()) || mapping.getCounsellor() == null
                || !me.id().equals(mapping.getCounsellor().getId())) {
            throw notMapped();
        }
        requireAllotted(userStudentId, assessmentId);
        requireNotDone(me, userStudentId, assessmentId);

        List<OfflineCounsellingQueries.LiveBookingRow> live = queries.liveBookingsForStudent(userStudentId, assessmentId);
        for (OfflineCounsellingQueries.LiveBookingRow b : live) {
            if (IN_SESSION_STATUSES.contains(b.status)) throw sessionInProgress();
        }

        UserStudent student = userStudentRepository.findById(userStudentId)
                .orElseThrow(() -> OfflineCounsellingException.notFound("STUDENT_NOT_IN_SCOPE",
                        "This student is not in any of your schools."));
        User actorUser = userRepository.findById(principal.getId()).orElse(null);
        String counsellorName = me.counsellor.getName();
        String studentName = studentNameOf(student);
        LocalDateTime now = clock.now();

        // Live bookings for this assessment: the student has now been counselled, so they go —
        // silently, the slot back on sale, no session credited back.
        MarkDoneResult result = new MarkDoneResult();
        Long cancelledEntitlementId = null;
        for (OfflineCounsellingQueries.LiveBookingRow b : live) {
            if (!LIVE_STATUSES.contains(b.status)) continue;
            CounsellingAppointment cancelled = appointmentService.cancelSilently(b.appointmentId, actorUser,
                    ROLE_SYSTEM, REASON_COUNSELLED_OFFLINE,
                    "Counselled in person at school by " + counsellorName + " on " + sessionDate.format(FEED_DATE));
            result.cancelledBookingIds.add(b.appointmentId);
            if (cancelledEntitlementId == null && b.entitlementId != null) cancelledEntitlementId = b.entitlementId;
            Counsellor bookingCounsellor = cancelled != null ? cancelled.getCounsellor() : null;
            if (bookingCounsellor != null) {
                logActivity("SESSION_CANCELLED_COUNSELLED_OFFLINE", "Session cancelled — counselled offline",
                        "Student: " + studentName
                                + (b.date != null ? "\nSession date: " + b.date.format(FEED_DATE) : "")
                                + "\nCounselled by: " + counsellorName + " (in person, " + sessionDate.format(FEED_DATE) + ")",
                        bookingCounsellor, counsellorName);
            }
        }

        // The entitlement is only linked, so report release and the referral link can find it.
        // The cancelled booking's is preferred: that is the session the student actually spent.
        Long entitlementId = cancelledEntitlementId != null ? cancelledEntitlementId
                : activeEntitlementId(userStudentId, assessmentId);

        CounsellingSlot slot = new CounsellingSlot();
        slot.setCounsellor(me.counsellor);
        slot.setDate(sessionDate);
        slot.setStartTime(LocalTime.MIDNIGHT);
        slot.setEndTime(LocalTime.MIDNIGHT);
        slot.setDurationMinutes(0);
        slot.setMode("OFFLINE");
        slot.setStatus("COMPLETED");
        slot.setIsBlocked(true);
        slot.setIsManuallyCreated(true);
        slot.setBlockReason(CounsellingAppointment.ORIGIN_OFFLINE_RECORD);
        slot = slotRepository.save(slot);

        CounsellingAppointment appt = new CounsellingAppointment();
        appt.setSlot(slot);
        appt.setStudent(student);
        appt.setCounsellor(me.counsellor);
        appt.setAssignedBy(actorUser);
        appt.setStatus("COMPLETED");
        appt.setMode("OFFLINE");
        appt.setOrigin(CounsellingAppointment.ORIGIN_OFFLINE_RECORD);
        appt.setAssessmentId(assessmentId);
        appt.setEntitlementId(entitlementId);
        appt.setAttended(true);
        appt.setSessionStartedAt(now);
        // Only a code the guard verified counts; everything else is "OTP not verified".
        appt.setCheckinVerifiedAt(otpVerified ? now : null);
        InstituteOption school = me.institutes.get(instituteCode);
        appt.setLocation(school != null ? school.instituteName : null);
        // Filled now because the thank-you mail runs on another thread with a detached row and
        // cannot reach the student's LAZY profile.
        BookingService.BookingContact contact =
                BookingService.BookingContact.fromProfile(student, priorWithParentContact(userStudentId));
        appt.setStudentContactName(contact.name);
        appt.setStudentContactEmail(contact.email);
        appt.setStudentContactPhone(contact.phone);
        appt.setParentEmail(contact.parentEmail);
        appt.setParentPhone(contact.parentPhone);
        appt.setPreferredContactMethod(contact.preferredContactMethod);
        appt = appointmentRepository.save(appt);

        String otpResult = otpVerified ? "VERIFIED" : "NOT_PROVIDED";
        Map<String, Object> newValues = new HashMap<>();
        newValues.put("status", "COMPLETED");
        newValues.put("origin", CounsellingAppointment.ORIGIN_OFFLINE_RECORD);
        newValues.put("sessionDate", sessionDate.format(ISO_DATE));
        newValues.put("assessmentId", assessmentId);
        newValues.put("entitlementId", entitlementId);
        newValues.put("otpResult", otpResult);
        newValues.put("cancelledBookingIds", result.cancelledBookingIds);
        auditLogService.log(appt, "OFFLINE_SESSION_RECORDED", actorUser,
                "Counselled in person at school", null, newValues);
        logActivity("OFFLINE_SESSION_RECORDED", "Offline session recorded",
                "Student: " + studentName
                        + (school != null ? "\nInstitute: " + school.instituteName : "")
                        + "\nDate: " + sessionDate.format(FEED_DATE)
                        + "\nOTP: " + (otpVerified ? "verified" : "not verified")
                        + (result.cancelledBookingIds.isEmpty() ? ""
                                : "\nOnline bookings cancelled: " + result.cancelledBookingIds.size()),
                me.counsellor, counsellorName);

        sendCompletionMailAfterCommit(appt);

        result.appointmentId = appt.getId();
        result.otpVerified = otpVerified;
        result.otpResult = otpResult;
        return result;
    }

    /**
     * The thank-you mail, once the record has committed: a mail about a session that then rolled
     * back would be worse than none. Sent at once when there is no transaction to wait for.
     */
    private void sendCompletionMailAfterCommit(CounsellingAppointment appt) {
        Runnable send = () -> notificationService.sendOfflineSessionCompleteEmail(appt);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
    }

    // ─── Admin ───────────────────────────────────────────────────────────────────

    /**
     * Admin undo of an offline record (e.g. recorded against the wrong student). The row stays,
     * CANCELLED and attributed, with its photos; the student's history hides it. Nothing is
     * credited back because the record never consumed a session.
     */
    @Transactional
    public RevertResult revert(UserPrincipal principal, Long appointmentId, String note) {
        requirePermission(principal, PERM_REVERT);
        CounsellingAppointment appt = appointmentId == null ? null
                : appointmentRepository.findById(appointmentId).orElse(null);
        if (appt == null) throw OfflineCounsellingException.notFound("NOT_FOUND", "That session does not exist.");
        if (!appt.isOfflineRecord() || !"COMPLETED".equals(appt.getStatus())) {
            throw OfflineCounsellingException.conflict("NOT_REVERTIBLE",
                    "Only a completed offline record can be reverted.");
        }

        appt.setStatus("CANCELLED");
        appt.setCancelledByRole(AppointmentService.ROLE_ADMIN);
        appt.setCancelledByUserId(principal.getId());
        appt.setCancellationReason(REASON_OFFLINE_RECORD_REVERTED);
        appt.setCancellationNote(note);
        appt.setCancelledAt(clock.now());
        CounsellingSlot slot = appt.getSlot();
        if (slot != null) {
            slot.setStatus("CANCELLED");
            slotRepository.save(slot);
        }
        appt = appointmentRepository.save(appt);

        User admin = userRepository.findById(principal.getId()).orElse(null);
        Map<String, Object> oldValues = new HashMap<>();
        oldValues.put("status", "COMPLETED");
        Map<String, Object> newValues = new HashMap<>();
        newValues.put("status", "CANCELLED");
        newValues.put("cancelledByRole", AppointmentService.ROLE_ADMIN);
        newValues.put("cancellationReason", REASON_OFFLINE_RECORD_REVERTED);
        auditLogService.log(appt, "OFFLINE_RECORD_REVERTED", admin, note, oldValues, newValues);
        if (appt.getCounsellor() != null) {
            logActivity("OFFLINE_RECORD_REVERTED", "Offline session reverted",
                    "Student: " + studentNameOf(appt.getStudent())
                            + (slot != null && slot.getDate() != null ? "\nDate: " + slot.getDate().format(FEED_DATE) : "")
                            + (note != null && !note.isBlank() ? "\nNote: " + note : ""),
                    appt.getCounsellor(), admin != null ? admin.getName() : "Admin");
        }

        RevertResult r = new RevertResult();
        r.appointmentId = appt.getId();
        r.status = appt.getStatus();
        return r;
    }

    /**
     * Flags a counsellor offline (or back). Gated on {@code counsellor.create}, which only admins
     * hold: counsellors hold {@code counsellor.update}, and could otherwise grant themselves the
     * offline page. This is the flag's only writer (JSON cannot bind it).
     */
    @Transactional
    public OfflineFlagResult setOffline(UserPrincipal principal, Long counsellorId, boolean offline) {
        requirePermission(principal, PERM_OFFLINE_FLAG);
        Counsellor c = counsellorId == null ? null : counsellorRepository.findById(counsellorId).orElse(null);
        if (c == null) throw OfflineCounsellingException.notFound("NOT_FOUND", "That counsellor does not exist.");

        boolean before = Boolean.TRUE.equals(c.getIsOffline());
        c.setIsOffline(offline);
        counsellorRepository.save(c);

        if (before != offline) {
            audit(principal, PERM_OFFLINE_FLAG, "OFFLINE_FLAG counsellor=" + c.getId() + " " + before + "->" + offline);
            String adminName = userRepository.findById(principal.getId()).map(User::getName).orElse("Admin");
            logActivity("COUNSELLOR_OFFLINE_FLAG", offline ? "Offline counselling enabled" : "Offline counselling disabled",
                    "Counsellor: " + c.getName() + "\nOffline: " + (offline ? "yes" : "no"), c, adminName);
        }

        OfflineFlagResult r = new OfflineFlagResult();
        r.counsellorId = c.getId();
        r.isOffline = c.getIsOffline();
        return r;
    }

    // ─── Guards ──────────────────────────────────────────────────────────────────

    /** The caller as an active, offline counsellor with their schools — or a 403. */
    Actor requireOfflineCounsellor(UserPrincipal principal) {
        Counsellor c = principal == null || principal.getId() == null ? null
                : counsellorRepository.findByUserId(principal.getId()).orElse(null);
        if (!isActiveOffline(c)) {
            throw OfflineCounsellingException.forbidden("NOT_OFFLINE_COUNSELLOR",
                    "Offline counselling isn't enabled for your account.");
        }
        return new Actor(c, queries.activeInstitutes(c.getId()));
    }

    private static boolean isActiveOffline(Counsellor c) {
        return c != null && Boolean.TRUE.equals(c.getIsActive()) && Boolean.TRUE.equals(c.getIsOffline());
    }

    private static void requireSchool(Actor me, Integer instituteCode) {
        if (instituteCode == null) {
            throw OfflineCounsellingException.badRequest("BAD_REQUEST", "Pick a school first.");
        }
        if (!me.allows(instituteCode)) {
            throw OfflineCounsellingException.forbidden("FORBIDDEN", "This school is not assigned to you.");
        }
    }

    private static void requireIds(Long userStudentId, Long assessmentId) {
        if (userStudentId == null || assessmentId == null) {
            throw OfflineCounsellingException.badRequest("BAD_REQUEST", "Student and assessment are required.");
        }
    }

    /**
     * The student's own institute must be one of mine — checked per student, never trusted from
     * the request. A missing student and a B2C one (no institute) get the same answer.
     */
    private Integer requireStudentInScope(Actor me, Long userStudentId) {
        Integer code = queries.institutesOfStudents(Collections.singleton(userStudentId)).get(userStudentId);
        if (!me.allows(code)) {
            throw OfflineCounsellingException.notFound("STUDENT_NOT_IN_SCOPE",
                    "This student is not in any of your schools.");
        }
        return code;
    }

    /** Today back to {@value #SESSION_DATE_MAX_DAYS_BACK} days, in counselling (IST) days. */
    private void requireSessionDate(LocalDate sessionDate) {
        if (sessionDate == null) {
            throw OfflineCounsellingException.badRequest("BAD_DATE", "Pick the date of the session.");
        }
        LocalDate today = clock.today();
        if (sessionDate.isAfter(today)) {
            throw OfflineCounsellingException.badRequest("BAD_DATE", "The session date cannot be in the future.");
        }
        if (sessionDate.isBefore(today.minusDays(SESSION_DATE_MAX_DAYS_BACK))) {
            throw OfflineCounsellingException.badRequest("BAD_DATE",
                    "The session date can be at most " + SESSION_DATE_MAX_DAYS_BACK + " days ago.");
        }
    }

    private void requireAllotted(Long userStudentId, Long assessmentId) {
        if (!queries.isAllotted(userStudentId, assessmentId)) {
            throw OfflineCounsellingException.badRequest("NOT_ALLOTTED",
                    "This student has not been given this assessment.");
        }
    }

    /**
     * Refuses when the student already counts as counselled for the assessment. Mine → the id
     * and OTP state, so a retried request lands as success; someone else's → who and when.
     */
    private void requireNotDone(Actor me, Long userStudentId, Long assessmentId) {
        List<Object[]> rows = appointmentRepository.findLatestCompletedForAssessment(
                Collections.singletonList(userStudentId), assessmentId);
        if (rows == null || rows.isEmpty()) return;
        Long doneId = OfflineCounsellingQueries.toLong(rows.get(0)[1]);
        OfflineCounsellingQueries.DoneInfo d = doneId == null ? null : queries.doneInfo(doneId);
        if (d != null && me.id().equals(d.counsellorId)) {
            throw OfflineCounsellingException.conflict("ALREADY_DONE_BY_ME",
                    "You have already marked this student done for this assessment.")
                    .with("appointmentId", doneId)
                    .with("otpVerified", d.otpVerified);
        }
        String who = d != null && d.counsellorName != null ? d.counsellorName : "another counsellor";
        String when = d != null && d.date != null ? d.date.format(ISO_DATE) : null;
        throw OfflineCounsellingException.conflict("ALREADY_DONE",
                "Already counselled by " + who + (d != null && d.date != null ? " on " + d.date.format(FEED_DATE) : "") + ".")
                .with("doneByCounsellorName", d != null ? d.counsellorName : null)
                .with("doneDate", when);
    }

    private static OfflineCounsellingException notMapped() {
        return OfflineCounsellingException.conflict("NOT_MAPPED", "Map this student to yourself first.");
    }

    private static OfflineCounsellingException sessionInProgress() {
        return OfflineCounsellingException.conflict("SESSION_IN_PROGRESS",
                "This student has an online session in progress or under review for this assessment.");
    }

    /** Hard admin check, independent of the log-only {@code @PreAuthorize}. */
    private static void requirePermission(UserPrincipal principal, String code) {
        boolean ok = principal != null && (principal.isSuperAdmin()
                || (principal.getPermissions() != null && principal.getPermissions().contains(code)));
        if (!ok) {
            throw OfflineCounsellingException.forbidden("FORBIDDEN", "You are not allowed to do this.");
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    /** The student's live entitlement for the assessment (newest first), or null. */
    private Long activeEntitlementId(Long userStudentId, Long assessmentId) {
        try {
            for (StudentEntitlement e : entitlementRepository
                    .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(userStudentId, assessmentId)) {
                String s = e.getStatus() == null ? "" : e.getStatus().toLowerCase();
                if ("active".equals(s) || "pending".equals(s)) return e.getEntitlementId();
            }
        } catch (RuntimeException e) {
            logger.warn("Entitlement lookup failed for student {} / assessment {}: {}",
                    userStudentId, assessmentId, e.getMessage());
        }
        return null;
    }

    /**
     * The newest earlier booking that carries a parent/guardian contact — the only place one is
     * ever kept — so the parent hears about this session too. Else the newest booking at all.
     */
    private CounsellingAppointment priorWithParentContact(Long userStudentId) {
        List<CounsellingAppointment> history = appointmentRepository.findByStudentIdOrdered(userStudentId);
        if (history == null || history.isEmpty()) return null;
        for (CounsellingAppointment a : history) {
            if (notBlank(a.getParentEmail()) || notBlank(a.getParentPhone())) return a;
        }
        return history.get(0);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }

    private static String studentNameOf(UserStudent student) {
        try {
            if (student != null && student.getStudentInfo() != null && notBlank(student.getStudentInfo().getName())) {
                return student.getStudentInfo().getName();
            }
        } catch (RuntimeException ignored) {
            // A profile we cannot read is not worth failing a log line over.
        }
        return student != null ? "Student " + student.getUserStudentId() : "Unknown student";
    }

    /** Activity-feed entries are a courtesy; one that fails must not undo the action. */
    private void logActivity(String type, String title, String description, Counsellor counsellor, String actorName) {
        try {
            activityLogService.log(type, title, description, counsellor, actorName);
        } catch (RuntimeException e) {
            logger.warn("Activity log '{}' failed: {}", type, e.getMessage());
        }
    }

    /** One row in auth_audit (the sensitive-operation log); never breaks the action. */
    private void audit(UserPrincipal principal, String permission, String detail) {
        try {
            String reason = detail.length() > 255 ? detail.substring(0, 252) + "..." : detail;
            authAuditService.recordSensitiveOp(principal != null ? principal.getId() : null,
                    permission, "ALLOW", reason, MDC.get("requestId"));
        } catch (RuntimeException e) {
            logger.warn("Audit write failed for {}: {}", permission, e.getMessage());
        }
    }
}
