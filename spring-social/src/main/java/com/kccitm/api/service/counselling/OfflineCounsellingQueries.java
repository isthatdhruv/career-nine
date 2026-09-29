package com.kccitm.api.service.counselling;

import java.math.BigInteger;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;

import org.springframework.stereotype.Component;

/**
 * The offline-counselling page's reads, all native SQL.
 *
 * <p><b>Why native.</b> {@code UserStudent}, {@code StudentInfo} and {@code InstituteDetail} carry
 * the Hibernate {@code scopeFilter}, which is enabled per request with a "match nothing"
 * sentinel for callers who hold no scope rows — and counsellors typically hold none. Any JPQL
 * over those entities would show an offline counsellor an empty school. Native SQL is not
 * filtered; the school boundary is enforced by {@link OfflineCounsellingService} instead,
 * against each student's own {@code user_student.institute_id}.
 *
 * <p>Native reads also bypass the request's persistence context (open-in-view keeps one for the
 * whole request), so the mark-done checks see the database as it is, not an entity loaded
 * earlier in the same request. Kept in one small bean so the service's rules can be unit-tested
 * with this mocked.
 */
@Component
public class OfflineCounsellingQueries {

    @PersistenceContext
    private EntityManager em;

    // ─── Row types ───────────────────────────────────────────────────────────────

    /** A student's mapping as stored: whose, and whether it is live (NULL is_active is not). */
    public static class MappingState {
        public Long counsellorId;
        public String counsellorName;
        public boolean active;
    }

    /** The latest completed session that makes a student "done" for an assessment. */
    public static class DoneInfo {
        public Long studentId;
        public Long appointmentId;
        public LocalDate date;
        public Long counsellorId;
        public String counsellorName;
        public boolean otpVerified;
        public String origin;
        public boolean reportHeld;
        public int photoCount;
    }

    /** A booking that has not been held yet (or is being held right now). */
    public static class LiveBookingRow {
        public Long studentId;
        public Long appointmentId;
        public String status;
        public LocalDate date;
        public LocalTime startTime;
        public Long counsellorId;
        public String counsellorName;
        public Long entitlementId;
    }

    // ─── Scope ───────────────────────────────────────────────────────────────────

    /** The counsellor's active schools: the offline page's whole world. */
    @SuppressWarnings("unchecked")
    public List<OfflineCounsellingService.InstituteOption> activeInstitutes(Long counsellorId) {
        List<Object[]> rows = em.createNativeQuery(
                "SELECT i.institute_code, i.institute_name, i.is_school "
                + "FROM counsellor_institute_mapping m "
                + "JOIN institute_detail_new i ON i.institute_code = m.institute_code "
                + "WHERE m.counsellor_id = :cid AND m.is_active = 1 "
                + "ORDER BY i.institute_name")
                .setParameter("cid", counsellorId)
                .getResultList();
        List<OfflineCounsellingService.InstituteOption> out = new ArrayList<>();
        for (Object[] r : rows) {
            OfflineCounsellingService.InstituteOption o = new OfflineCounsellingService.InstituteOption();
            o.instituteCode = toInt(r[0]);
            o.instituteName = (String) r[1];
            o.isSchool = r[2] == null ? null : toBool(r[2]);
            out.add(o);
        }
        return out;
    }

    /**
     * Each student's {@code user_student.institute_id}. A student that does not exist is absent
     * from the map; one with no institute (B2C) maps to null — callers treat both as out of scope.
     */
    @SuppressWarnings("unchecked")
    public Map<Long, Integer> institutesOfStudents(Collection<Long> userStudentIds) {
        Map<Long, Integer> out = new HashMap<>();
        if (userStudentIds == null || userStudentIds.isEmpty()) return out;
        List<Object[]> rows = em.createNativeQuery(
                "SELECT us.user_student_id, us.institute_id FROM user_student us "
                + "WHERE us.user_student_id IN (:ids)")
                .setParameter("ids", userStudentIds)
                .getResultList();
        for (Object[] r : rows) out.put(toLong(r[0]), r[1] == null ? null : toInt(r[1]));
        return out;
    }

    /** Current mapping rows for these students (at most one each since uk_scm_student). */
    @SuppressWarnings("unchecked")
    public Map<Long, MappingState> mappingsOf(Collection<Long> userStudentIds) {
        Map<Long, MappingState> out = new HashMap<>();
        if (userStudentIds == null || userStudentIds.isEmpty()) return out;
        List<Object[]> rows = em.createNativeQuery(
                "SELECT scm.student_id, scm.counsellor_id, c.name, scm.is_active "
                + "FROM student_counsellor_mapping scm "
                + "LEFT JOIN counsellors c ON c.id = scm.counsellor_id "
                + "WHERE scm.student_id IN (:ids)")
                .setParameter("ids", userStudentIds)
                .getResultList();
        for (Object[] r : rows) {
            MappingState m = new MappingState();
            m.counsellorId = toLong(r[1]);
            m.counsellorName = (String) r[2];
            // NULL is_active counts as inactive, the same rule as the student list's join
            // (is_active = 1), markDone's lock check and the repository's IsActiveTrue finders.
            // Treating it as active here let preflight pass a student markDone then refused as
            // NOT_MAPPED — after the OTP check had already spent one of the student's attempts —
            // and made "Map to me" answer ALREADY_MINE without the upsert that normalises it.
            m.active = toBool(r[3]);
            out.put(toLong(r[0]), m);
        }
        return out;
    }

    /** True when the student has been allotted the assessment (any status). */
    public boolean isAllotted(Long userStudentId, Long assessmentId) {
        List<?> rows = em.createNativeQuery(
                "SELECT 1 FROM student_assessment_mapping "
                + "WHERE user_student_id = :sid AND assessment_id = :aid LIMIT 1")
                .setParameter("sid", userStudentId)
                .setParameter("aid", assessmentId)
                .getResultList();
        return !rows.isEmpty();
    }

    // ─── Page lists ──────────────────────────────────────────────────────────────

    /**
     * Assessments allotted in the school, with how many of its students have each. Drawn from
     * the allotments rather than {@code counsellor_assessment_assignment}: an offline counsellor
     * publishes no slots and so can never be assigned to an assessment.
     */
    @SuppressWarnings("unchecked")
    public List<OfflineCounsellingService.AssessmentOption> assessmentsForInstitute(Integer instituteCode) {
        List<Object[]> rows = em.createNativeQuery(
                "SELECT sam.assessment_id, atb.assessment_name, COUNT(*) "
                + "FROM student_assessment_mapping sam "
                + "JOIN user_student us ON us.user_student_id = sam.user_student_id "
                + "JOIN assessment_table atb ON atb.assessment_id = sam.assessment_id "
                + "WHERE us.institute_id = :code AND (atb.is_deleted IS NULL OR atb.is_deleted = 0) "
                + "GROUP BY sam.assessment_id, atb.assessment_name "
                + "ORDER BY atb.assessment_name")
                .setParameter("code", instituteCode)
                .getResultList();
        List<OfflineCounsellingService.AssessmentOption> out = new ArrayList<>();
        for (Object[] r : rows) {
            OfflineCounsellingService.AssessmentOption o = new OfflineCounsellingService.AssessmentOption();
            o.assessmentId = toLong(r[0]);
            o.assessmentName = (String) r[1];
            o.studentCount = toLong(r[2]);
            out.add(o);
        }
        return out;
    }

    /**
     * The school's students allotted the assessment, with class, section and current mapping.
     * Class prefers the section's class name and falls back to the free-text {@code student_class}.
     * Deliberately no DOB, phone or email: only whether a DOB exists (for the OTP field).
     */
    @SuppressWarnings("unchecked")
    public List<OfflineCounsellingService.StudentRow> studentRows(Integer instituteCode, Long assessmentId) {
        List<Object[]> rows = em.createNativeQuery(
                "SELECT us.user_student_id, si.name, si.school_roll_number, "
                + "COALESCE(sc.class_name, si.student_class) AS class_name, ss.section_name, "
                + "sam.status, (si.student_dob IS NOT NULL) AS has_dob, scm.counsellor_id, c.name AS counsellor_name "
                + "FROM student_assessment_mapping sam "
                + "JOIN user_student us ON us.user_student_id = sam.user_student_id "
                + "JOIN student_info si ON si.id = us.id "
                + "LEFT JOIN school_sections ss ON ss.id = si.school_section_id "
                + "LEFT JOIN school_classes sc ON sc.id = ss.school_classes_id "
                + "LEFT JOIN student_counsellor_mapping scm ON scm.student_id = us.user_student_id AND scm.is_active = 1 "
                + "LEFT JOIN counsellors c ON c.id = scm.counsellor_id "
                + "WHERE sam.assessment_id = :aid AND us.institute_id = :code "
                + "ORDER BY si.name")
                .setParameter("aid", assessmentId)
                .setParameter("code", instituteCode)
                .getResultList();
        List<OfflineCounsellingService.StudentRow> out = new ArrayList<>();
        for (Object[] r : rows) {
            OfflineCounsellingService.StudentRow s = new OfflineCounsellingService.StudentRow();
            s.userStudentId = toLong(r[0]);
            s.name = (String) r[1];
            s.rollNumber = (String) r[2];
            s.className = (String) r[3];
            s.sectionName = (String) r[4];
            s.assessmentStatus = (String) r[5];
            s.hasDob = toBool(r[6]);
            s.mappedCounsellorId = toLong(r[7]);
            s.mappedCounsellorName = (String) r[8];
            out.add(s);
        }
        return out;
    }

    /**
     * Per student of the school, the latest session that counts as "counselled" for the
     * assessment — the same rule as
     * {@code CounsellingAppointmentRepository.findLatestCompletedForAssessment}, scoped by school
     * instead of an id list so a large school is one query.
     */
    @SuppressWarnings("unchecked")
    public Map<Long, DoneInfo> doneForInstitute(Integer instituteCode, Long assessmentId) {
        List<Object[]> rows = em.createNativeQuery(
                DONE_SELECT
                + "FROM (SELECT ca2.student_id, MAX(ca2.id) AS appt_id "
                + "      FROM counselling_appointment ca2 "
                + "      JOIN user_student us ON us.user_student_id = ca2.student_id "
                + "      LEFT JOIN student_entitlements se2 ON se2.entitlement_id = ca2.entitlement_id "
                + "      WHERE us.institute_id = :code AND ca2.status = 'COMPLETED' "
                + "        AND (ca2.assessment_id = :aid OR se2.assessment_id = :aid) "
                + "      GROUP BY ca2.student_id) d "
                + DONE_JOINS)
                .setParameter("code", instituteCode)
                .setParameter("aid", assessmentId)
                .getResultList();
        Map<Long, DoneInfo> out = new HashMap<>();
        for (Object[] r : rows) {
            DoneInfo d = toDoneInfo(r);
            out.put(d.studentId, d);
        }
        return out;
    }

    /** The same details for one known appointment; null when it does not exist. */
    @SuppressWarnings("unchecked")
    public DoneInfo doneInfo(Long appointmentId) {
        List<Object[]> rows = em.createNativeQuery(
                DONE_SELECT
                + "FROM (SELECT ca2.student_id, ca2.id AS appt_id FROM counselling_appointment ca2 "
                + "      WHERE ca2.id = :id) d "
                + DONE_JOINS)
                .setParameter("id", appointmentId)
                .getResultList();
        return rows.isEmpty() ? null : toDoneInfo(rows.get(0));
    }

    private static final String DONE_SELECT =
            "SELECT d.student_id, ca.id, cs.date, ca.counsellor_id, c.name, "
            + "(ca.checkin_verified_at IS NOT NULL) AS otp_verified, ca.origin, "
            + "(COALESCE(se.counsellor_release_report, 0) = 1 AND ca.report_released_at IS NULL) AS report_held, "
            + "(SELECT COUNT(*) FROM session_notes_photo p WHERE p.appointment_id = ca.id) AS photo_count ";

    private static final String DONE_JOINS =
            "JOIN counselling_appointment ca ON ca.id = d.appt_id "
            + "JOIN counselling_slot cs ON cs.id = ca.slot_id "
            + "LEFT JOIN counsellors c ON c.id = ca.counsellor_id "
            + "LEFT JOIN student_entitlements se ON se.entitlement_id = ca.entitlement_id";

    private static DoneInfo toDoneInfo(Object[] r) {
        DoneInfo d = new DoneInfo();
        d.studentId = toLong(r[0]);
        d.appointmentId = toLong(r[1]);
        d.date = toLocalDate(r[2]);
        d.counsellorId = toLong(r[3]);
        d.counsellorName = (String) r[4];
        d.otpVerified = toBool(r[5]);
        d.origin = (String) r[6];
        d.reportHeld = toBool(r[7]);
        Long photos = toLong(r[8]);
        d.photoCount = photos == null ? 0 : photos.intValue();
        return d;
    }

    /**
     * Bookings of the school's students that are still to happen (or happening) for this
     * assessment — tied to it directly or through their entitlement, or tied to no assessment at
     * all (a plain student booking could be for anything, so it is assumed to be for this one).
     * The page warns about them before "Mark done", which cancels them.
     */
    @SuppressWarnings("unchecked")
    public Map<Long, List<LiveBookingRow>> liveBookingsForInstitute(Integer instituteCode, Long assessmentId) {
        List<Object[]> rows = em.createNativeQuery(
                LIVE_SELECT
                + "JOIN user_student us ON us.user_student_id = ca.student_id "
                + "WHERE us.institute_id = :code AND " + LIVE_WHERE)
                .setParameter("code", instituteCode)
                .setParameter("aid", assessmentId)
                .getResultList();
        Map<Long, List<LiveBookingRow>> out = new LinkedHashMap<>();
        for (Object[] r : rows) {
            LiveBookingRow b = toLiveBooking(r);
            out.computeIfAbsent(b.studentId, k -> new ArrayList<>()).add(b);
        }
        return out;
    }

    /** {@link #liveBookingsForInstitute} for one student. */
    @SuppressWarnings("unchecked")
    public List<LiveBookingRow> liveBookingsForStudent(Long userStudentId, Long assessmentId) {
        List<Object[]> rows = em.createNativeQuery(
                LIVE_SELECT + "WHERE ca.student_id = :sid AND " + LIVE_WHERE)
                .setParameter("sid", userStudentId)
                .setParameter("aid", assessmentId)
                .getResultList();
        if (rows.isEmpty()) return Collections.emptyList();
        List<LiveBookingRow> out = new ArrayList<>();
        for (Object[] r : rows) out.add(toLiveBooking(r));
        return out;
    }

    private static final String LIVE_SELECT =
            "SELECT ca.student_id, ca.id, ca.status, cs.date, cs.start_time, ca.counsellor_id, c.name, ca.entitlement_id "
            + "FROM counselling_appointment ca "
            + "JOIN counselling_slot cs ON cs.id = ca.slot_id "
            + "LEFT JOIN counsellors c ON c.id = ca.counsellor_id "
            + "LEFT JOIN student_entitlements se ON se.entitlement_id = ca.entitlement_id ";

    private static final String LIVE_WHERE =
            "ca.status IN ('PENDING', 'ASSIGNED', 'CONFIRMED', 'AWAITING_RESCHEDULE', 'IN_PROGRESS', 'UNDER_REVIEW') "
            + "AND (COALESCE(ca.assessment_id, se.assessment_id) IS NULL "
            + "     OR COALESCE(ca.assessment_id, se.assessment_id) = :aid) "
            + "ORDER BY cs.date, cs.start_time";

    private static LiveBookingRow toLiveBooking(Object[] r) {
        LiveBookingRow b = new LiveBookingRow();
        b.studentId = toLong(r[0]);
        b.appointmentId = toLong(r[1]);
        b.status = (String) r[2];
        b.date = toLocalDate(r[3]);
        b.startTime = toLocalTime(r[4]);
        b.counsellorId = toLong(r[5]);
        b.counsellorName = (String) r[6];
        b.entitlementId = toLong(r[7]);
        return b;
    }

    // ─── JDBC value coercion ─────────────────────────────────────────────────────
    // Native results arrive as whatever the driver picked: BIGINT as BigInteger, COUNT and
    // boolean expressions as Long/BigInteger/Integer, BIT(1)/TINYINT(1) as Boolean, dates as
    // java.sql types.

    static Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof BigInteger) return ((BigInteger) v).longValue();
        if (v instanceof Number) return ((Number) v).longValue();
        return Long.valueOf(v.toString());
    }

    static Integer toInt(Object v) {
        Long l = toLong(v);
        return l == null ? null : l.intValue();
    }

    static boolean toBool(Object v) {
        if (v == null) return false;
        if (v instanceof Boolean) return (Boolean) v;
        if (v instanceof Number) return ((Number) v).intValue() != 0;
        if (v instanceof byte[]) {
            for (byte b : (byte[]) v) if (b != 0) return true;
            return false;
        }
        String s = v.toString().trim();
        return "1".equals(s) || "true".equalsIgnoreCase(s);
    }

    static LocalDate toLocalDate(Object v) {
        if (v == null) return null;
        if (v instanceof LocalDate) return (LocalDate) v;
        if (v instanceof java.sql.Date) return ((java.sql.Date) v).toLocalDate();
        if (v instanceof java.sql.Timestamp) return ((java.sql.Timestamp) v).toLocalDateTime().toLocalDate();
        return LocalDate.parse(v.toString().substring(0, 10));
    }

    static LocalTime toLocalTime(Object v) {
        if (v == null) return null;
        if (v instanceof LocalTime) return (LocalTime) v;
        if (v instanceof java.sql.Time) return ((java.sql.Time) v).toLocalTime();
        return LocalTime.parse(v.toString());
    }
}
