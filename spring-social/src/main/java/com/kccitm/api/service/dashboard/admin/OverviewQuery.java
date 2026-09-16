package com.kccitm.api.service.dashboard.admin;

import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.persistence.EntityManager;
import javax.persistence.TypedQuery;

import com.kccitm.api.security.access.AccessScopeJpqlBuilder;
import com.kccitm.api.security.access.AccessScopeJpqlBuilder.Fields;

/**
 * Tiny JPQL builder shared by the admin overview card counts
 * ({@link AdminOverviewService}) and the per-card student lists
 * ({@link AdminOverviewDetailService}), so a card and its drill-down are
 * guaranteed to apply exactly the same predicates.
 *
 * <p>A query is a {@code FROM ... JOIN ...} clause plus accumulated {@code AND}
 * predicates and named parameters. {@link #count()} prepends a {@code COUNT}
 * select; {@link #list(String, Class, int, int)} prepends whatever select the
 * caller wants and pages the result. The three {@code xxxRange} helpers cover
 * the three kinds of date column this dashboard meets.
 *
 * <p>The static factories ({@link #signups}, {@link #mappings}, {@link #reports},
 * {@link #appointments}) are the four base shapes, already scoped and
 * view-filtered from an {@link AdminOverviewFilter}. Every one of them joins the
 * student's {@code StudentInfo} as alias {@code si} and the {@code UserStudent}
 * as alias {@code us}.
 *
 * <p>Every shape also drops <em>test data</em>: any row whose student (name,
 * email, school name, login, institute), assessment, counsellor, payer or lead
 * has "test" anywhere in its name or email — see {@link #notTestStudent}.
 */
final class OverviewQuery {

    private final EntityManager em;
    private final ZoneId zone;
    private final String fromClause;
    private final StringBuilder where = new StringBuilder();
    private final Map<String, Object> params = new HashMap<>();
    private String orderBy;
    private String groupBy;
    private int seq;

    /** Substring (case-insensitive) that marks a record as test data. */
    static final String TEST_MARKER = "%test%";

    OverviewQuery(EntityManager em, ZoneId zone, String fromClause) {
        this.em = em;
        this.zone = zone;
        this.fromClause = fromClause;
    }

    // ─── Base shapes ─────────────────────────────────────────────────────

    /** Registered student accounts. Assessment filter = "assigned to at least one of them". */
    static OverviewQuery signups(EntityManager em, ZoneId zone, AdminOverviewFilter f) {
        OverviewQuery q = new OverviewQuery(em, zone, "FROM UserStudent us JOIN us.studentInfo si")
                .scope(f, "si").institute(f, "si").notTestStudent("si");
        if (f.hasAssessments()) {
            q.and("EXISTS (SELECT m2.studentAssessmentId FROM StudentAssessmentMapping m2 "
                    + "WHERE m2.userStudent = us AND m2.assessmentId IN :aids)")
             .param("aids", f.getAssessmentIds());
        }
        return q;
    }

    /** Assessment attempts ({@code StudentAssessmentMapping m}). */
    static OverviewQuery mappings(EntityManager em, ZoneId zone, AdminOverviewFilter f) {
        return new OverviewQuery(em, zone, "FROM StudentAssessmentMapping m JOIN m.userStudent us JOIN us.studentInfo si")
                .scope(f, "si").institute(f, "si").assessments(f, "m.assessmentId")
                .notTestStudent("si").notTestAssessment("m.assessmentId");
    }

    /** Generated reports ({@code GeneratedReport r}). */
    static OverviewQuery reports(EntityManager em, ZoneId zone, AdminOverviewFilter f) {
        return new OverviewQuery(em, zone, "FROM GeneratedReport r JOIN r.userStudent us JOIN us.studentInfo si")
                .scope(f, "si").institute(f, "si").assessments(f, "r.assessmentId")
                .notTestStudent("si").notTestAssessment("r.assessmentId");
    }

    /**
     * Counselling appointments ({@code CounsellingAppointment a}). The assessment
     * filter is deliberately not applied: an appointment is not tied to an
     * assessment, so narrowing by it would silently zero every counselling card.
     */
    static OverviewQuery appointments(EntityManager em, ZoneId zone, AdminOverviewFilter f) {
        return new OverviewQuery(em, zone, "FROM CounsellingAppointment a JOIN a.student us JOIN us.studentInfo si")
                .scope(f, "si").institute(f, "si").notTestStudent("si").notTestCounsellor("a.counsellor");
    }

    /**
     * Assessment purchases ({@code PaymentTransaction p}). The row carries the
     * institute code and assessment id directly, so scope / institute / assessment
     * filters apply to those columns (institute dimension only for scope — the
     * transaction has no session/class/section).
     */
    static OverviewQuery payments(EntityManager em, ZoneId zone, AdminOverviewFilter f) {
        OverviewQuery q = new OverviewQuery(em, zone, "FROM PaymentTransaction p");
        if (f.getScope().isPresent()) {
            StringBuilder p = new StringBuilder();
            AccessScopeJpqlBuilder.appendScopePredicate(p, q.params, "sc", f.getScope().get(),
                    Fields.instituteOnly("p.instituteCode"));
            q.and(p.toString());
        }
        if (f.hasInstitute()) q.and("p.instituteCode IN :inst").param("inst", f.getInstituteCodes());
        return q.assessments(f, "p.assessmentId")
                .and(notLike("p.studentName")).and(notLike("p.studentEmail")).param("test", TEST_MARKER)
                .notTestAssessment("p.assessmentId");
    }

    /** Counselling purchases ({@code CounsellingPayment cp}), scoped through the student. */
    static OverviewQuery counsellingPayments(EntityManager em, ZoneId zone, AdminOverviewFilter f) {
        return new OverviewQuery(em, zone, "FROM CounsellingPayment cp JOIN cp.student us JOIN us.studentInfo si")
                .scope(f, "si").institute(f, "si").notTestStudent("si");
    }

    /**
     * Website registrations ({@code Lead l}) — every sign-up / pop-up submission on
     * career-9.com lands in {@code leads}. A lead belongs to no institute or
     * assessment, so the view pickers do not apply; and because a school-scoped
     * viewer has no natural claim on them, anyone with a scope sees zero.
     */
    static OverviewQuery leads(EntityManager em, ZoneId zone, AdminOverviewFilter f) {
        OverviewQuery q = new OverviewQuery(em, zone, "FROM Lead l")
                .and(notLike("l.fullName")).and(notLike("l.email")).and(notLike("l.schoolName")).param("test", TEST_MARKER);
        if (f.getScope().isPresent()) q.and("1 = 0");
        return q;
    }

    /**
     * Assessments ({@code AssessmentTable a}), soft-deleted ones excluded. For a
     * scoped viewer or an institute filter, only assessments at least one of
     * their students is assigned to.
     */
    static OverviewQuery assessments(EntityManager em, ZoneId zone, AdminOverviewFilter f) {
        OverviewQuery q = new OverviewQuery(em, zone, "FROM AssessmentTable a")
                .and("(a.isDeleted = FALSE OR a.isDeleted IS NULL)")
                .and(notLike("a.AssessmentName")).param("test", TEST_MARKER);
        if (f.getScope().isPresent() || f.hasInstitute()) {
            StringBuilder sub = new StringBuilder(
                    "EXISTS (SELECT m.studentAssessmentId FROM StudentAssessmentMapping m "
                            + "JOIN m.userStudent us JOIN us.studentInfo si WHERE m.assessmentId = a.id");
            if (f.getScope().isPresent()) {
                StringBuilder p = new StringBuilder();
                AccessScopeJpqlBuilder.appendScopePredicate(p, q.params, "sc", f.getScope().get(),
                        new Fields("si.instituteId", "si.sessionId", "si.courseCode", "si.schoolSectionId"));
                sub.append(" AND ").append(p);
            }
            if (f.hasInstitute()) {
                sub.append(" AND si.instituteId IN :inst");
                q.param("inst", f.getInstituteCodes());
            }
            q.and(sub.append(")").toString());
        }
        return q.assessments(f, "a.id");
    }

    // ─── Predicates ──────────────────────────────────────────────────────

    OverviewQuery and(String predicate) {
        where.append(where.length() == 0 ? " WHERE " : " AND ").append(predicate);
        return this;
    }

    OverviewQuery param(String key, Object value) {
        params.put(key, value);
        return this;
    }

    /** Caller's ABAC scope on the joined {@code StudentInfo} alias; no-op for super-admins. */
    OverviewQuery scope(AdminOverviewFilter f, String si) {
        if (f.getScope().isPresent()) {
            StringBuilder p = new StringBuilder();
            AccessScopeJpqlBuilder.appendScopePredicate(p, params, "sc", f.getScope().get(),
                    new Fields(si + ".instituteId", si + ".sessionId", si + ".courseCode", si + ".schoolSectionId"));
            and(p.toString());
        }
        return this;
    }

    OverviewQuery institute(AdminOverviewFilter f, String si) {
        if (f.hasInstitute()) {
            and(si + ".instituteId IN :inst").param("inst", f.getInstituteCodes());
        }
        return this;
    }

    // ─── Test-data exclusion ─────────────────────────────────────────────

    /** {@code (field IS NULL OR LOWER(field) NOT LIKE :test)} — NULL is not a test marker. */
    private static String notLike(String field) {
        return "(" + field + " IS NULL OR LOWER(" + field + ") NOT LIKE :test)";
    }

    /**
     * Drop test accounts: "test" anywhere in the student's name, email or school
     * name, in their login's username / name / email, or in their institute's name.
     * {@code si} is the {@code StudentInfo} alias.
     */
    OverviewQuery notTestStudent(String si) {
        return and(notLike(si + ".name")).and(notLike(si + ".email")).and(notLike(si + ".schoolName"))
                .and("NOT EXISTS (SELECT tu.id FROM User tu WHERE tu.id = " + si + ".user.id AND ("
                        + "LOWER(tu.username) LIKE :test OR LOWER(tu.email) LIKE :test OR LOWER(tu.name) LIKE :test))")
                .and("NOT EXISTS (SELECT ti.instituteCode FROM InstituteDetail ti WHERE ti.instituteCode = " + si
                        + ".instituteId AND LOWER(ti.instituteName) LIKE :test)")
                .param("test", TEST_MARKER);
    }

    /** Drop rows whose assessment's name carries the test marker. */
    OverviewQuery notTestAssessment(String assessmentIdField) {
        return and("NOT EXISTS (SELECT ta.id FROM AssessmentTable ta WHERE ta.id = " + assessmentIdField
                + " AND LOWER(ta.AssessmentName) LIKE :test)").param("test", TEST_MARKER);
    }

    /** Drop rows whose counsellor's name or email carries the test marker. */
    OverviewQuery notTestCounsellor(String counsellorField) {
        return and("NOT EXISTS (SELECT tc.id FROM Counsellor tc WHERE tc.id = " + counsellorField
                + ".id AND (LOWER(tc.name) LIKE :test OR LOWER(tc.email) LIKE :test))").param("test", TEST_MARKER);
    }

    OverviewQuery assessments(AdminOverviewFilter f, String assessmentIdField) {
        if (f.hasAssessments()) {
            and(assessmentIdField + " IN :aids").param("aids", f.getAssessmentIds());
        }
        return this;
    }

    /** Free-text search over the student's name / email / roll number (case-insensitive contains). */
    OverviewQuery search(String text) {
        return searchFields(text, "si.name", "si.email", "si.schoolRollNumber");
    }

    /** Free-text search over arbitrary string fields (case-insensitive contains, OR-ed). */
    OverviewQuery searchFields(String text, String... fields) {
        if (text != null && !text.trim().isEmpty() && fields.length > 0) {
            StringBuilder p = new StringBuilder("(");
            for (int i = 0; i < fields.length; i++) {
                if (i > 0) p.append(" OR ");
                p.append("LOWER(").append(fields[i]).append(") LIKE :q");
            }
            and(p.append(")").toString()).param("q", "%" + text.trim().toLowerCase() + "%");
        }
        return this;
    }

    /** {@code LocalDate} column: inclusive calendar window. */
    OverviewQuery localDateRange(String field, AdminOverviewFilter f) {
        if (f.hasRange()) {
            String k = "d" + (seq++);
            and(field + " BETWEEN :" + k + "From AND :" + k + "To")
                    .param(k + "From", f.getFrom()).param(k + "To", f.getTo());
        }
        return this;
    }

    /** {@code LocalDateTime} column: [from 00:00, to+1 00:00) as wall-clock. */
    OverviewQuery localDateTimeRange(String field, AdminOverviewFilter f) {
        if (f.hasRange()) {
            String k = "ldt" + (seq++);
            and(field + " >= :" + k + "From AND " + field + " < :" + k + "To")
                    .param(k + "From", f.getFrom().atStartOfDay())
                    .param(k + "To", f.getTo().plusDays(1).atStartOfDay());
        }
        return this;
    }

    /**
     * {@code LocalDateTime} column whose wall-clock is UTC (e.g. {@code user_student.created_at},
     * stamped by the database with {@code UTC_TIMESTAMP}): the app-zone day boundaries,
     * converted to UTC before comparing.
     */
    OverviewQuery utcDateTimeRange(String field, AdminOverviewFilter f) {
        if (f.hasRange()) {
            String k = "utc" + (seq++);
            and(field + " >= :" + k + "From AND " + field + " < :" + k + "To")
                    .param(k + "From", f.getFrom().atStartOfDay(zone).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime())
                    .param(k + "To", f.getTo().plusDays(1).atStartOfDay(zone).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime());
        }
        return this;
    }

    /** {@code java.util.Date} column: [from 00:00, to+1 00:00) as instants in the app zone. */
    OverviewQuery dateRange(String field, AdminOverviewFilter f) {
        if (f.hasRange()) {
            String k = "dt" + (seq++);
            and(field + " >= :" + k + "From AND " + field + " < :" + k + "To")
                    .param(k + "From", Date.from(f.getFrom().atStartOfDay(zone).toInstant()))
                    .param(k + "To", Date.from(f.getTo().plusDays(1).atStartOfDay(zone).toInstant()));
        }
        return this;
    }

    OverviewQuery orderBy(String clause) {
        this.orderBy = clause;
        return this;
    }

    OverviewQuery groupBy(String clause) {
        this.groupBy = clause;
        return this;
    }

    // ─── Execution ───────────────────────────────────────────────────────

    long count(String countSelect) {
        TypedQuery<Long> q = em.createQuery(countSelect + " " + fromClause + where, Long.class);
        bind(q);
        Long v = q.getSingleResult();
        return v == null ? 0L : v;
    }

    <T> List<T> list(String select, Class<T> type, int offset, int limit) {
        String jpql = select + " " + fromClause + where
                + (groupBy != null ? " GROUP BY " + groupBy : "")
                + (orderBy != null ? " ORDER BY " + orderBy : "");
        TypedQuery<T> q = em.createQuery(jpql, type);
        bind(q);
        q.setFirstResult(Math.max(0, offset));
        q.setMaxResults(Math.max(1, limit));
        return q.getResultList();
    }

    private void bind(TypedQuery<?> q) {
        for (Map.Entry<String, Object> e : params.entrySet()) {
            q.setParameter(e.getKey(), e.getValue());
        }
    }
}
