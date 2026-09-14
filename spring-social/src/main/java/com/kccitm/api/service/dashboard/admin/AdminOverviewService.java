package com.kccitm.api.service.dashboard.admin;

import java.time.LocalDate;
import java.util.concurrent.CompletableFuture;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.config.AsyncExecutorsConfig;
import com.kccitm.api.model.career9.LeadType;
import com.kccitm.api.service.counselling.CounsellingClock;

/**
 * Admin overview dashboard — one method per card, each running as its own job on
 * the {@code dashboardExecutor} pool ({@link AsyncExecutorsConfig#DASHBOARD_EXECUTOR}).
 *
 * <p>Design:
 * <ul>
 *   <li><b>One card, one endpoint, one thread.</b> Every public method is
 *       {@code @Async} and returns a {@link CompletableFuture}; the controller hands
 *       that future straight back to Spring MVC, which releases the HTTP thread until
 *       the count is ready. Eleven cards opened at once therefore run as eleven
 *       parallel {@code COUNT} queries on eleven pool threads, and the slowest card
 *       never delays the others.</li>
 *   <li><b>Counts, not rows.</b> Unlike the legacy snapshot (which serialised every
 *       student/report/appointment row and let the browser count), each card is a
 *       single JPQL {@code COUNT} — a few milliseconds each, no payload to page.</li>
 *   <li><b>Scope is explicit.</b> The per-request Hibernate {@code scopeFilter} only
 *       exists on the request thread, so it does not protect these queries. Every
 *       query instead ANDs in the caller's {@code AccessScope} through
 *       {@code AccessScopeJpqlBuilder} (super-admin = no predicate; empty scope =
 *       zero). The scope is resolved by the controller and carried in the
 *       {@link AdminOverviewFilter}.</li>
 * </ul>
 *
 * <p>Date semantics. {@code from}/{@code to} are inclusive calendar days in the app
 * timezone ({@link CounsellingClock}). Slot dates compare as dates; {@code Date}
 * columns compare as instants at the day boundaries in that zone; {@code LocalDateTime}
 * columns compare as wall-clock day boundaries. Every card follows the selected
 * range; {@link CounsellingClock#today()} only decides which bookings are still upcoming.
 */
@Service
public class AdminOverviewService {

    private static final Logger log = LoggerFactory.getLogger(AdminOverviewService.class);

    // Card keys — must match the endpoint path segments in AdminOverviewController
    // and the card registry in the frontend (dashboard-admin.overview.api.ts).
    public static final String SIGNUPS = "signups";
    public static final String ASSESSMENTS_CONDUCTED = "assessments-conducted";
    public static final String ASSESSMENTS_COMPLETED = "assessments-completed";
    public static final String ASSESSMENTS_IN_PROGRESS = "assessments-in-progress";
    public static final String ASSESSMENTS_NOT_STARTED = "assessments-not-started";
    public static final String REPORTS_GENERATED = "reports-generated";
    public static final String COUNSELLING_BOOKED = "counselling-booked";
    public static final String COUNSELLING_SESSIONS = "counselling-sessions";
    public static final String COUNSELLING_COMPLETED = "counselling-completed";
    public static final String STUDENTS_ABSENT = "students-absent";
    public static final String COUNSELLORS_ABSENT = "counsellors-absent";
    public static final String PAYMENTS_COMPLETED = "payments-completed";
    public static final String WEBSITE_REGISTRATIONS = "website-registrations";

    /** Appointment statuses that still represent a real session for the day. */
    private static final String LIVE_SESSION_STATUSES =
            "('PENDING', 'ASSIGNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED')";

    @PersistenceContext
    private EntityManager em;

    @Autowired
    private CounsellingClock clock;

    // ─── Registrations ───────────────────────────────────────────────────

    /** New sign-ups / registrations: {@code user_student} rows created in the window. */
    @Async(AsyncExecutorsConfig.DASHBOARD_EXECUTOR)
    @Transactional(readOnly = true)
    public CompletableFuture<AdminOverviewCard> signups(AdminOverviewFilter f) {
        long t0 = System.nanoTime();
        if (f.isDenied()) return done(AdminOverviewCard.of(SIGNUPS, 0, f, f.hasRange(), "no institute mapped", t0));

        long value = OverviewQuery.signups(em, clock.zone(), f)
                .localDateTimeRange("us.createdAt", f)
                .count("SELECT COUNT(us)");

        String basis = f.hasRange()
                ? "student accounts registered in the selected window"
                : "all registered student accounts";
        return done(AdminOverviewCard.of(SIGNUPS, value, f, f.hasRange(), basis, t0));
    }

    // ─── Assessments ─────────────────────────────────────────────────────

    /** Distinct assessments that had at least one completion in the window. */
    @Async(AsyncExecutorsConfig.DASHBOARD_EXECUTOR)
    @Transactional(readOnly = true)
    public CompletableFuture<AdminOverviewCard> assessmentsConducted(AdminOverviewFilter f) {
        long t0 = System.nanoTime();
        if (f.isDenied()) return done(AdminOverviewCard.of(ASSESSMENTS_CONDUCTED, 0, f, f.hasRange(), "no institute mapped", t0));

        long distinct = OverviewQuery.mappings(em, clock.zone(), f)
                .and("m.status = 'completed'")
                .dateRange("m.completedAt", f)
                .count("SELECT COUNT(DISTINCT m.assessmentId)");
        long completions = OverviewQuery.mappings(em, clock.zone(), f)
                .and("m.status = 'completed'")
                .dateRange("m.completedAt", f)
                .count("SELECT COUNT(m)");

        return done(AdminOverviewCard.of(ASSESSMENTS_CONDUCTED, distinct, f, f.hasRange(),
                "distinct assessments with at least one student completion" + windowSuffix(f), t0)
                .with("completions", completions));
    }

    /** Assessment attempts fully completed by students. */
    @Async(AsyncExecutorsConfig.DASHBOARD_EXECUTOR)
    @Transactional(readOnly = true)
    public CompletableFuture<AdminOverviewCard> assessmentsCompleted(AdminOverviewFilter f) {
        long t0 = System.nanoTime();
        if (f.isDenied()) return done(AdminOverviewCard.of(ASSESSMENTS_COMPLETED, 0, f, f.hasRange(), "no institute mapped", t0));

        long value = OverviewQuery.mappings(em, clock.zone(), f)
                .and("m.status = 'completed'")
                .dateRange("m.completedAt", f)
                .count("SELECT COUNT(m)");
        long students = OverviewQuery.mappings(em, clock.zone(), f)
                .and("m.status = 'completed'")
                .dateRange("m.completedAt", f)
                .count("SELECT COUNT(DISTINCT us.userStudentId)");

        return done(AdminOverviewCard.of(ASSESSMENTS_COMPLETED, value, f, f.hasRange(),
                "student attempts submitted in full" + windowSuffix(f), t0)
                .with("students", students));
    }

    /** Attempts currently in progress — a snapshot; nothing records when an attempt began. */
    @Async(AsyncExecutorsConfig.DASHBOARD_EXECUTOR)
    @Transactional(readOnly = true)
    public CompletableFuture<AdminOverviewCard> assessmentsInProgress(AdminOverviewFilter f) {
        long t0 = System.nanoTime();
        if (f.isDenied()) return done(AdminOverviewCard.of(ASSESSMENTS_IN_PROGRESS, 0, f, false, "no institute mapped", t0));

        long value = OverviewQuery.mappings(em, clock.zone(), f).and("m.status = 'ongoing'").count("SELECT COUNT(m)");
        long students = OverviewQuery.mappings(em, clock.zone(), f).and("m.status = 'ongoing'").count("SELECT COUNT(DISTINCT us.userStudentId)");

        return done(AdminOverviewCard.of(ASSESSMENTS_IN_PROGRESS, value, f, false,
                "attempts started but not yet submitted (current state)", t0)
                .with("students", students));
    }

    /** Assigned attempts not yet opened — a snapshot of current state. */
    @Async(AsyncExecutorsConfig.DASHBOARD_EXECUTOR)
    @Transactional(readOnly = true)
    public CompletableFuture<AdminOverviewCard> assessmentsNotStarted(AdminOverviewFilter f) {
        long t0 = System.nanoTime();
        if (f.isDenied()) return done(AdminOverviewCard.of(ASSESSMENTS_NOT_STARTED, 0, f, false, "no institute mapped", t0));

        long value = OverviewQuery.mappings(em, clock.zone(), f)
                .and("(m.status IS NULL OR m.status = 'notstarted')").count("SELECT COUNT(m)");
        long students = OverviewQuery.mappings(em, clock.zone(), f)
                .and("(m.status IS NULL OR m.status = 'notstarted')").count("SELECT COUNT(DISTINCT us.userStudentId)");

        return done(AdminOverviewCard.of(ASSESSMENTS_NOT_STARTED, value, f, false,
                "assigned attempts never opened (current state)", t0)
                .with("students", students));
    }

    // ─── Reports ─────────────────────────────────────────────────────────

    /** Distinct students who received a generated report in the window. */
    @Async(AsyncExecutorsConfig.DASHBOARD_EXECUTOR)
    @Transactional(readOnly = true)
    public CompletableFuture<AdminOverviewCard> reportsGenerated(AdminOverviewFilter f) {
        long t0 = System.nanoTime();
        if (f.isDenied()) return done(AdminOverviewCard.of(REPORTS_GENERATED, 0, f, f.hasRange(), "no institute mapped", t0));

        long students = OverviewQuery.reports(em, clock.zone(), f)
                .and("LOWER(r.reportStatus) = 'generated'")
                .dateRange("r.createdAt", f)
                .count("SELECT COUNT(DISTINCT us.userStudentId)");
        long reports = OverviewQuery.reports(em, clock.zone(), f)
                .and("LOWER(r.reportStatus) = 'generated'")
                .dateRange("r.createdAt", f)
                .count("SELECT COUNT(r)");
        long failed = OverviewQuery.reports(em, clock.zone(), f)
                .and("LOWER(r.reportStatus) = 'failed'")
                .dateRange("r.createdAt", f)
                .count("SELECT COUNT(r)");

        return done(AdminOverviewCard.of(REPORTS_GENERATED, students, f, f.hasRange(),
                "students with a successfully generated report" + windowSuffix(f), t0)
                .with("reports", reports)
                .with("failed", failed));
    }

    // ─── Counselling ─────────────────────────────────────────────────────

    /** Bookings students made in the window (by booking time), whatever day the session is on. */
    @Async(AsyncExecutorsConfig.DASHBOARD_EXECUTOR)
    @Transactional(readOnly = true)
    public CompletableFuture<AdminOverviewCard> counsellingBooked(AdminOverviewFilter f) {
        long t0 = System.nanoTime();
        if (f.isDenied()) return done(AdminOverviewCard.of(COUNSELLING_BOOKED, 0, f, f.hasRange(), "no institute mapped", t0));

        long value = OverviewQuery.appointments(em, clock.zone(), f)
                .and("a.status NOT IN ('CANCELLED', 'DECLINED')")
                .localDateTimeRange("a.createdAt", f)
                .count("SELECT COUNT(a)");
        long forFuture = OverviewQuery.appointments(em, clock.zone(), f)
                .and("a.status NOT IN ('CANCELLED', 'DECLINED')")
                .localDateTimeRange("a.createdAt", f)
                .and("a.slot.date >= :today").param("today", clock.today())
                .count("SELECT COUNT(a)");
        long students = OverviewQuery.appointments(em, clock.zone(), f)
                .and("a.status NOT IN ('CANCELLED', 'DECLINED')")
                .localDateTimeRange("a.createdAt", f)
                .count("SELECT COUNT(DISTINCT us.userStudentId)");

        return done(AdminOverviewCard.of(COUNSELLING_BOOKED, value, f, f.hasRange(),
                "sessions booked by students" + windowSuffix(f), t0)
                .with("forFuture", forFuture)
                .with("students", students));
    }

    /** Sessions on the calendar in the window (by session date) that are live — not cancelled or rescheduled away. */
    @Async(AsyncExecutorsConfig.DASHBOARD_EXECUTOR)
    @Transactional(readOnly = true)
    public CompletableFuture<AdminOverviewCard> counsellingSessions(AdminOverviewFilter f) {
        long t0 = System.nanoTime();
        if (f.isDenied()) return done(AdminOverviewCard.of(COUNSELLING_SESSIONS, 0, f, f.hasRange(), "no institute mapped", t0));

        long value = OverviewQuery.appointments(em, clock.zone(), f)
                .localDateRange("a.slot.date", f)
                .and("a.status IN " + LIVE_SESSION_STATUSES)
                .count("SELECT COUNT(a)");
        long completed = OverviewQuery.appointments(em, clock.zone(), f)
                .localDateRange("a.slot.date", f)
                .and("a.status = 'COMPLETED'")
                .count("SELECT COUNT(a)");
        long inProgress = OverviewQuery.appointments(em, clock.zone(), f)
                .localDateRange("a.slot.date", f)
                .and("a.status = 'IN_PROGRESS'")
                .count("SELECT COUNT(a)");
        long counsellors = OverviewQuery.appointments(em, clock.zone(), f)
                .localDateRange("a.slot.date", f)
                .and("a.status IN " + LIVE_SESSION_STATUSES)
                .count("SELECT COUNT(DISTINCT a.counsellor.id)");

        return done(AdminOverviewCard.of(COUNSELLING_SESSIONS, value, f, f.hasRange(),
                "sessions on the calendar" + windowSuffix(f), t0)
                .with("completed", completed)
                .with("inProgress", inProgress)
                .with("scheduled", Math.max(0, value - completed - inProgress))
                .with("counsellors", counsellors));
    }

    /** Sessions that ran to completion, by session date. */
    @Async(AsyncExecutorsConfig.DASHBOARD_EXECUTOR)
    @Transactional(readOnly = true)
    public CompletableFuture<AdminOverviewCard> counsellingCompleted(AdminOverviewFilter f) {
        long t0 = System.nanoTime();
        if (f.isDenied()) return done(AdminOverviewCard.of(COUNSELLING_COMPLETED, 0, f, f.hasRange(), "no institute mapped", t0));

        long value = OverviewQuery.appointments(em, clock.zone(), f)
                .and("a.status = 'COMPLETED'")
                .localDateRange("a.slot.date", f)
                .count("SELECT COUNT(a)");
        long students = OverviewQuery.appointments(em, clock.zone(), f)
                .and("a.status = 'COMPLETED'")
                .localDateRange("a.slot.date", f)
                .count("SELECT COUNT(DISTINCT us.userStudentId)");
        long counsellors = OverviewQuery.appointments(em, clock.zone(), f)
                .and("a.status = 'COMPLETED'")
                .localDateRange("a.slot.date", f)
                .count("SELECT COUNT(DISTINCT a.counsellor.id)");

        return done(AdminOverviewCard.of(COUNSELLING_COMPLETED, value, f, f.hasRange(),
                "sessions marked completed" + windowSuffix(f), t0)
                .with("students", students)
                .with("counsellors", counsellors));
    }

    /** Sessions the student did not attend (attributed no-shows), by session date. */
    @Async(AsyncExecutorsConfig.DASHBOARD_EXECUTOR)
    @Transactional(readOnly = true)
    public CompletableFuture<AdminOverviewCard> studentsAbsent(AdminOverviewFilter f) {
        long t0 = System.nanoTime();
        if (f.isDenied()) return done(AdminOverviewCard.of(STUDENTS_ABSENT, 0, f, f.hasRange(), "no institute mapped", t0));

        long value = OverviewQuery.appointments(em, clock.zone(), f)
                .and("a.missedByRole = 'STUDENT'")
                .localDateRange("a.slot.date", f)
                .count("SELECT COUNT(a)");
        long disputed = OverviewQuery.appointments(em, clock.zone(), f)
                .and("a.missedByRole = 'STUDENT'")
                .and("a.disputeRaisedAt IS NOT NULL AND a.disputeResolvedAt IS NULL")
                .localDateRange("a.slot.date", f)
                .count("SELECT COUNT(a)");
        long students = OverviewQuery.appointments(em, clock.zone(), f)
                .and("a.missedByRole = 'STUDENT'")
                .localDateRange("a.slot.date", f)
                .count("SELECT COUNT(DISTINCT us.userStudentId)");

        return done(AdminOverviewCard.of(STUDENTS_ABSENT, value, f, f.hasRange(),
                "sessions where the student did not show up" + windowSuffix(f), t0)
                .with("disputed", disputed)
                .with("students", students));
    }

    /** Sessions the counsellor did not attend (system-attributed), by session date. */
    @Async(AsyncExecutorsConfig.DASHBOARD_EXECUTOR)
    @Transactional(readOnly = true)
    public CompletableFuture<AdminOverviewCard> counsellorsAbsent(AdminOverviewFilter f) {
        long t0 = System.nanoTime();
        if (f.isDenied()) return done(AdminOverviewCard.of(COUNSELLORS_ABSENT, 0, f, f.hasRange(), "no institute mapped", t0));

        long value = OverviewQuery.appointments(em, clock.zone(), f)
                .and("a.missedByRole = 'COUNSELLOR'")
                .localDateRange("a.slot.date", f)
                .count("SELECT COUNT(a)");
        long awaitingReschedule = OverviewQuery.appointments(em, clock.zone(), f)
                .and("a.missedByRole = 'COUNSELLOR'")
                .and("a.status = 'AWAITING_RESCHEDULE'")
                .localDateRange("a.slot.date", f)
                .count("SELECT COUNT(a)");
        long counsellors = OverviewQuery.appointments(em, clock.zone(), f)
                .and("a.missedByRole = 'COUNSELLOR'")
                .localDateRange("a.slot.date", f)
                .count("SELECT COUNT(DISTINCT a.counsellor.id)");

        return done(AdminOverviewCard.of(COUNSELLORS_ABSENT, value, f, f.hasRange(),
                "sessions where the counsellor did not show up" + windowSuffix(f), t0)
                .with("awaitingReschedule", awaitingReschedule)
                .with("counsellors", counsellors));
    }

    // ─── Payments ────────────────────────────────────────────────────────

    /**
     * Payments completed: assessment purchases ({@code payment_transaction.status = paid},
     * by the time the row was last updated, i.e. when the webhook marked it paid) plus
     * counselling purchases ({@code counselling_payment.status = PAID}, by {@code paid_at}).
     */
    @Async(AsyncExecutorsConfig.DASHBOARD_EXECUTOR)
    @Transactional(readOnly = true)
    public CompletableFuture<AdminOverviewCard> paymentsCompleted(AdminOverviewFilter f) {
        long t0 = System.nanoTime();
        if (f.isDenied()) return done(AdminOverviewCard.of(PAYMENTS_COMPLETED, 0, f, f.hasRange(), "no institute mapped", t0));

        long assessment = OverviewQuery.payments(em, clock.zone(), f)
                .and("LOWER(p.status) = 'paid'")
                .dateRange("p.updatedAt", f)
                .count("SELECT COUNT(p)");
        long assessmentAmount = OverviewQuery.payments(em, clock.zone(), f)
                .and("LOWER(p.status) = 'paid'")
                .dateRange("p.updatedAt", f)
                .count("SELECT SUM(p.amount)");
        long counselling = OverviewQuery.counsellingPayments(em, clock.zone(), f)
                .and("UPPER(cp.status) = 'PAID'")
                .localDateTimeRange("cp.paidAt", f)
                .count("SELECT COUNT(cp)");
        long counsellingAmount = OverviewQuery.counsellingPayments(em, clock.zone(), f)
                .and("UPPER(cp.status) = 'PAID'")
                .localDateTimeRange("cp.paidAt", f)
                .count("SELECT SUM(cp.amount)");

        return done(AdminOverviewCard.of(PAYMENTS_COMPLETED, assessment + counselling, f, f.hasRange(),
                "successful payments (assessment + counselling)" + windowSuffix(f), t0)
                .with("amount", assessmentAmount + counsellingAmount)
                .with("assessmentPayments", assessment)
                .with("counsellingPayments", counselling));
    }

    // ─── Website ─────────────────────────────────────────────────────────

    /**
     * Registrations on career-9.com: rows of {@code leads} (every submission of the
     * Login / Register form and the pop-up goes through {@code POST /leads/capture}),
     * by the time they were captured. Split by lead type and by source.
     */
    @Async(AsyncExecutorsConfig.DASHBOARD_EXECUTOR)
    @Transactional(readOnly = true)
    public CompletableFuture<AdminOverviewCard> websiteRegistrations(AdminOverviewFilter f) {
        long t0 = System.nanoTime();
        if (f.isDenied()) return done(AdminOverviewCard.of(WEBSITE_REGISTRATIONS, 0, f, f.hasRange(), "no institute mapped", t0));

        long total = OverviewQuery.leads(em, clock.zone(), f).dateRange("l.createdAt", f).count("SELECT COUNT(l)");
        long students = OverviewQuery.leads(em, clock.zone(), f).dateRange("l.createdAt", f)
                .and("l.leadType = :lt").param("lt", LeadType.STUDENT).count("SELECT COUNT(l)");
        long parents = OverviewQuery.leads(em, clock.zone(), f).dateRange("l.createdAt", f)
                .and("l.leadType = :lt").param("lt", LeadType.PARENT).count("SELECT COUNT(l)");
        long schools = OverviewQuery.leads(em, clock.zone(), f).dateRange("l.createdAt", f)
                .and("l.leadType = :lt").param("lt", LeadType.SCHOOL).count("SELECT COUNT(l)");
        long popup = OverviewQuery.leads(em, clock.zone(), f).dateRange("l.createdAt", f)
                .and("l.source = 'website-popup'").count("SELECT COUNT(l)");

        return done(AdminOverviewCard.of(WEBSITE_REGISTRATIONS, total, f, f.hasRange(),
                "registrations captured on career-9.com" + windowSuffix(f), t0)
                .with("students", students)
                .with("parents", parents)
                .with("schools", schools)
                .with("popup", popup)
                .with("signupForm", Math.max(0, total - popup)));
    }

    // ─── Query scaffolding ───────────────────────────────────────────────

    private static String windowSuffix(AdminOverviewFilter f) {
        return f.hasRange() ? " in the selected window" : " (all time)";
    }

    private static CompletableFuture<AdminOverviewCard> done(AdminOverviewCard card) {
        if (log.isDebugEnabled()) {
            log.debug("admin-overview {} = {} ({} ms on {})", card.getKey(), card.getValue(), card.getTookMs(), card.getThread());
        }
        return CompletableFuture.completedFuture(card);
    }
}
