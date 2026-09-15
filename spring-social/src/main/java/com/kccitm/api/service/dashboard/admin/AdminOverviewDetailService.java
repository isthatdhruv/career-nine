package com.kccitm.api.service.dashboard.admin;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.config.AsyncExecutorsConfig;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.Lead;
import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.counselling.CounsellingPayment;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.service.counselling.CounsellingClock;
import com.kccitm.api.service.dashboard.admin.AdminOverviewDetail.Column;

/**
 * Drill-down behind each admin overview card: the students (rows) that make up
 * the number, under exactly the same filters the card used. Backs
 * {@code GET /dashboard/admin/overview/<card>/students}.
 *
 * <p>Runs on the same {@code dashboardExecutor} pool as the cards and returns a
 * {@link CompletableFuture}, so the modal's request never occupies a servlet
 * thread while the page of rows is being read. Each call is two queries: a
 * {@code COUNT} for the pagination total and one paged {@code SELECT}. The
 * predicates come from the shared {@link OverviewQuery} factories, which is what
 * keeps a card's count and its list in agreement.
 */
@Service
public class AdminOverviewDetailService {

    static final int DEFAULT_SIZE = 50;
    static final int MAX_SIZE = 5000;

    private static final String LIVE_SESSION_STATUSES =
            "('PENDING', 'ASSIGNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED')";

    private static final List<Column> STUDENT_COLUMNS = Arrays.asList(
            new Column("name", "Student"),
            new Column("email", "Email"),
            new Column("rollNumber", "Roll no."),
            new Column("studentClass", "Class"),
            new Column("instituteName", "Institute"));

    @PersistenceContext
    private EntityManager em;

    @Autowired
    private CounsellingClock clock;

    @Autowired
    private AdminCohortFunnel funnel;

    /**
     * The rows behind {@code key}. Unknown keys throw {@link IllegalArgumentException}
     * (the controller maps that to 404).
     */
    @Async(AsyncExecutorsConfig.DASHBOARD_EXECUTOR)
    @Transactional(readOnly = true)
    public CompletableFuture<AdminOverviewDetail> students(String key, AdminOverviewFilter f,
                                                           String search, int page, int size) {
        long t0 = System.nanoTime();
        int pageSize = size <= 0 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        int pageNo = Math.max(0, page);
        int offset = pageNo * pageSize;

        switch (key) {
            case AdminOverviewService.SIGNUPS:
                return signups(f, search, pageNo, pageSize, offset, t0);
            case AdminOverviewService.ACTIVE_ASSESSMENTS:
                return activeAssessments(f, search, pageNo, pageSize, offset, t0);
            case AdminOverviewService.ASSESSMENTS_COMPLETED:
            case AdminOverviewService.ASSESSMENTS_IN_PROGRESS:
            case AdminOverviewService.ASSESSMENTS_NOT_STARTED:
            case AdminOverviewService.REPORTS_GENERATED:
                return funnelStudents(key, f, search, pageNo, pageSize, offset, t0);
            case AdminOverviewService.COUNSELLING_BOOKED:
                return appointments(key, "Counselling booked by students", f, search, pageNo, pageSize, offset, t0,
                        q -> q.and("a.status NOT IN ('CANCELLED', 'DECLINED')").localDateTimeRange("a.createdAt", f)
                              .orderBy("a.createdAt DESC, a.id DESC"));
            case AdminOverviewService.COUNSELLING_SESSIONS:
                return appointments(key, "Counselling sessions", f, search, pageNo, pageSize, offset, t0,
                        q -> q.localDateRange("a.slot.date", f).and("a.status IN " + LIVE_SESSION_STATUSES)
                              .orderBy("a.slot.date DESC, a.slot.startTime DESC"));
            case AdminOverviewService.COUNSELLING_COMPLETED:
                return appointments(key, "Completed counselling sessions", f, search, pageNo, pageSize, offset, t0,
                        q -> q.and("a.status = 'COMPLETED'").localDateRange("a.slot.date", f)
                              .orderBy("a.slot.date DESC, a.slot.startTime DESC"));
            case AdminOverviewService.STUDENTS_ABSENT:
                return appointments(key, "Students absent from counselling", f, search, pageNo, pageSize, offset, t0,
                        q -> q.and("a.missedByRole = 'STUDENT'").localDateRange("a.slot.date", f)
                              .orderBy("a.slot.date DESC, a.slot.startTime DESC"));
            case AdminOverviewService.COUNSELLORS_ABSENT:
                return appointments(key, "Counsellor absent from session", f, search, pageNo, pageSize, offset, t0,
                        q -> q.and("a.missedByRole = 'COUNSELLOR'").localDateRange("a.slot.date", f)
                              .orderBy("a.slot.date DESC, a.slot.startTime DESC"));
            case AdminOverviewService.PAYMENTS_COMPLETED:
                return payments(f, search, pageNo, pageSize, offset, t0);
            case AdminOverviewService.WEBSITE_REGISTRATIONS:
                return leads(f, search, pageNo, pageSize, offset, t0);
            default:
                throw new IllegalArgumentException("Unknown overview card: " + key);
        }
    }

    // ─── Per-shape implementations ───────────────────────────────────────

    private interface Narrow {
        OverviewQuery apply(OverviewQuery q);
    }

    private CompletableFuture<AdminOverviewDetail> signups(AdminOverviewFilter f, String search,
                                                           int page, int size, int offset, long t0) {
        List<Column> columns = new ArrayList<>(STUDENT_COLUMNS);
        columns.add(new Column("registeredAt", "Registered"));
        if (f.isDenied()) return empty(AdminOverviewService.SIGNUPS, "New sign-ups", page, size, search, columns, t0);

        OverviewQuery q = OverviewQuery.signups(em, clock.zone(), f)
                .utcDateTimeRange("us.createdAt", f)
                .search(search)
                .orderBy("us.createdAt DESC, us.userStudentId DESC");
        long total = q.count("SELECT COUNT(us)");
        List<Map<String, Object>> rows = new ArrayList<>();
        for (UserStudent us : q.list("SELECT us", UserStudent.class, offset, size)) {
            Map<String, Object> r = studentRow(us);
            r.put("registeredAt", isoFromUtc(us.getCreatedAt()));
            rows.add(r);
        }
        return CompletableFuture.completedFuture(AdminOverviewDetail.of(
                AdminOverviewService.SIGNUPS, "New sign-ups", total, page, size, search, columns, rows, t0));
    }

    /**
     * Active assessments: one row per assessment. Assessments that students
     * completed inside the selected range are sorted to the top and flagged, so
     * the "used in this range" ones stand out from the idle ones.
     */
    private CompletableFuture<AdminOverviewDetail> activeAssessments(AdminOverviewFilter f, String search,
                                                                     int page, int size, int offset, long t0) {
        String key = AdminOverviewService.ACTIVE_ASSESSMENTS;
        List<Column> columns = Arrays.asList(
                new Column("assessmentName", "Assessment"),
                new Column("activity", "Activity in range"),
                new Column("completedInRange", "Completed in range"),
                new Column("status", "Status"),
                new Column("reportType", "Report type"),
                new Column("startDate", "Starts"),
                new Column("endDate", "Ends"),
                new Column("assigned", "Students assigned"),
                new Column("completed", "Completed (all time)"),
                new Column("inProgress", "In progress"));
        if (f.isDenied()) return empty(key, "Active assessments", page, size, search, columns, t0);

        OverviewQuery q = OverviewQuery.assessments(em, clock.zone(), f)
                .and("a.isActive = TRUE")
                .searchFields(search, "a.AssessmentName")
                .orderBy("a.id DESC");
        List<AssessmentTable> all = q.list("SELECT a", AssessmentTable.class, 0, Integer.MAX_VALUE);

        Map<Long, long[]> counts = new HashMap<>();
        Map<Long, Long> inRange = new HashMap<>();
        if (!all.isEmpty()) {
            Set<Long> ids = new HashSet<>();
            for (AssessmentTable a : all) ids.add(a.getId());
            List<Object[]> rows = em.createQuery(
                    "SELECT m.assessmentId, COUNT(m), "
                            + "SUM(CASE WHEN m.status = 'completed' THEN 1 ELSE 0 END), "
                            + "SUM(CASE WHEN m.status = 'ongoing' THEN 1 ELSE 0 END) "
                            + "FROM StudentAssessmentMapping m WHERE m.assessmentId IN :ids GROUP BY m.assessmentId",
                    Object[].class).setParameter("ids", ids).getResultList();
            for (Object[] r : rows) {
                counts.put((Long) r[0], new long[] { ((Number) r[1]).longValue(), ((Number) r[2]).longValue(), ((Number) r[3]).longValue() });
            }
            // completions inside the applied window, same predicate the card's chip uses
            OverviewQuery rq = OverviewQuery.mappings(em, clock.zone(), f)
                    .and("m.status = 'completed'")
                    .and("m.assessmentId IN :pageIds").param("pageIds", ids)
                    .dateRange("m.completedAt", f)
                    .groupBy("m.assessmentId");
            for (Object[] r : rq.list("SELECT m.assessmentId, COUNT(m)", Object[].class, 0, Integer.MAX_VALUE)) {
                inRange.put((Long) r[0], ((Number) r[1]).longValue());
            }
        }

        all.sort((x, y) -> {
            long ix = inRange.getOrDefault(x.getId(), 0L), iy = inRange.getOrDefault(y.getId(), 0L);
            if (ix != iy) return Long.compare(iy, ix);
            return Long.compare(y.getId() == null ? 0 : y.getId(), x.getId() == null ? 0 : x.getId());
        });

        int from = Math.min(offset, all.size());
        int to = Math.min(offset + size, all.size());
        List<Map<String, Object>> rows = new ArrayList<>();
        for (AssessmentTable a : all.subList(from, to)) {
            long[] c = counts.getOrDefault(a.getId(), new long[] { 0, 0, 0 });
            long cir = inRange.getOrDefault(a.getId(), 0L);
            Map<String, Object> r = AdminOverviewDetail.row();
            r.put("assessmentId", a.getId());
            r.put("assessmentName", a.getAssessmentName());
            r.put("activity", cir > 0 ? "Completed by students" : "No completions");
            r.put("completedInRange", cir);
            r.put("highlight", cir > 0);
            r.put("status", Boolean.TRUE.equals(a.getIsLocked()) ? "locked" : "active");
            r.put("reportType", a.getReportType());
            r.put("startDate", a.getStarDate());
            r.put("endDate", a.getEndDate());
            r.put("assigned", c[0]);
            r.put("completed", c[1]);
            r.put("inProgress", c[2]);
            rows.add(r);
        }
        return CompletableFuture.completedFuture(AdminOverviewDetail.of(
                key, "Active assessments", all.size(), page, size, search, columns, rows, t0));
    }

    /**
     * The four funnel cards share one shape: one row per sign-up in the bucket,
     * in registration order, with the bucket's own extra columns. Search runs in
     * Java over the (bounded) cohort, since the bucket is not a single query.
     */
    private CompletableFuture<AdminOverviewDetail> funnelStudents(String key, AdminOverviewFilter f, String search,
                                                                  int page, int size, int offset, long t0) {
        List<Column> columns = new ArrayList<>(STUDENT_COLUMNS);
        String title;
        switch (key) {
            case AdminOverviewService.ASSESSMENTS_COMPLETED:
                title = "Completed fully";
                columns.add(new Column("completedAttempts", "Completed"));
                columns.add(new Column("lastAssessment", "Latest assessment"));
                columns.add(new Column("completedAt", "Completed at"));
                columns.add(new Column("reportStatus", "Report"));
                break;
            case AdminOverviewService.ASSESSMENTS_IN_PROGRESS:
                title = "Partially completed / in progress";
                columns.add(new Column("assessmentName", "Assessment"));
                columns.add(new Column("answersSaved", "Answers saved"));
                columns.add(new Column("lastSavedAt", "Last saved"));
                break;
            case AdminOverviewService.ASSESSMENTS_NOT_STARTED:
                title = "Not started";
                columns.add(new Column("assignedAssessments", "Assigned"));
                columns.add(new Column("registeredAt", "Registered"));
                break;
            default:
                title = "Reports generated";
                columns.add(new Column("reportStatus", "Report"));
                columns.add(new Column("reports", "Reports"));
                columns.add(new Column("lastAssessment", "Latest assessment"));
                columns.add(new Column("reportAt", "Generated at"));
                break;
        }
        if (f.isDenied()) return empty(key, title, page, size, search, columns, t0);

        AdminCohortFunnel.Funnel fn = funnel.compute(f);
        List<AdminCohortFunnel.Student> bucket;
        switch (key) {
            case AdminOverviewService.ASSESSMENTS_COMPLETED: bucket = fn.completed(); break;
            case AdminOverviewService.ASSESSMENTS_IN_PROGRESS: bucket = fn.inProgress(); break;
            case AdminOverviewService.ASSESSMENTS_NOT_STARTED: bucket = fn.notStarted(); break;
            default: {
                // Every completed student, the ones still waiting for a report first
                // (and highlighted), so the gaps stand out.
                bucket = new ArrayList<>();
                for (AdminCohortFunnel.Student st : fn.completed()) if (!st.hasReport()) bucket.add(st);
                for (AdminCohortFunnel.Student st : fn.completed()) if (st.hasReport()) bucket.add(st);
                break;
            }
        }

        // Load the accounts behind the bucket (chunked IN), keep bucket order.
        Map<Long, UserStudent> accounts = new HashMap<>();
        List<Long> ids = new ArrayList<>();
        for (AdminCohortFunnel.Student s : bucket) ids.add(s.id);
        for (int i = 0; i < ids.size(); i += 900) {
            List<Long> chunk = ids.subList(i, Math.min(ids.size(), i + 900));
            for (UserStudent us : em.createQuery("SELECT us FROM UserStudent us WHERE us.userStudentId IN :ids", UserStudent.class)
                    .setParameter("ids", chunk).getResultList()) {
                accounts.put(us.getUserStudentId(), us);
            }
        }

        String needle = search == null ? "" : search.trim().toLowerCase();
        List<AdminCohortFunnel.Student> matched = new ArrayList<>();
        for (AdminCohortFunnel.Student s : bucket) {
            if (needle.isEmpty()) { matched.add(s); continue; }
            UserStudent us = accounts.get(s.id);
            StudentInfo si = us == null ? null : us.getStudentInfo();
            String hay = ((si == null || si.getName() == null ? "" : si.getName()) + " "
                    + (si == null || si.getEmail() == null ? "" : si.getEmail()) + " "
                    + (si == null || si.getSchoolRollNumber() == null ? "" : si.getSchoolRollNumber())).toLowerCase();
            if (hay.contains(needle)) matched.add(s);
        }

        int from = Math.min(offset, matched.size());
        int to = Math.min(offset + size, matched.size());
        List<AdminCohortFunnel.Student> pageStudents = matched.subList(from, to);
        Map<Long, String> names = assessmentNames(AdminCohortFunnel.assessmentIds(pageStudents));

        List<Map<String, Object>> rows = new ArrayList<>();
        for (AdminCohortFunnel.Student s : pageStudents) {
            UserStudent us = accounts.get(s.id);
            Map<String, Object> r = studentRow(us);
            if (us == null) r.put("userStudentId", s.id);
            switch (key) {
                case AdminOverviewService.ASSESSMENTS_COMPLETED: {
                    AdminCohortFunnel.Attempt last = s.latestCompleted();
                    r.put("completedAttempts", s.completedAttempts());
                    r.put("lastAssessment", last == null ? null : names.getOrDefault(last.assessmentId, "Assessment #" + last.assessmentId));
                    r.put("completedAt", last == null ? null : iso(last.completedAt));
                    r.put("reportStatus", s.hasReport() ? "generated" : (s.failedReports() > 0 ? "failed" : "pending"));
                    break;
                }
                case AdminOverviewService.ASSESSMENTS_IN_PROGRESS: {
                    AdminCohortFunnel.Draft d = s.latestDraft();
                    AdminCohortFunnel.Attempt a = s.ongoingAttempt();
                    Long aid = d != null ? d.assessmentId : (a != null ? a.assessmentId : null);
                    r.put("assessmentName", aid == null ? null : names.getOrDefault(aid, "Assessment #" + aid));
                    r.put("source", d != null ? "Answers saved" : "Started only");
                    r.put("answersSaved", d != null ? d.answerCount : null);
                    r.put("lastSavedAt", d != null ? d.savedAt : null);
                    break;
                }
                case AdminOverviewService.ASSESSMENTS_NOT_STARTED: {
                    r.put("assignedAssessments", s.attempts.size());
                    r.put("registeredAt", us == null ? null : isoFromUtc(us.getCreatedAt()));
                    break;
                }
                default: {
                    AdminCohortFunnel.Report rep = s.latestReport();
                    AdminCohortFunnel.Attempt last = s.latestCompleted();
                    boolean has = s.hasReport();
                    r.put("reportStatus", has ? "generated" : (s.failedReports() > 0 ? "failed" : "pending"));
                    r.put("highlight", !has);
                    r.put("reports", s.generatedReports());
                    r.put("lastAssessment", rep != null
                            ? names.getOrDefault(rep.assessmentId, "Assessment #" + rep.assessmentId)
                            : (last == null ? null : names.getOrDefault(last.assessmentId, "Assessment #" + last.assessmentId)));
                    r.put("reportAt", rep == null ? null : iso(rep.createdAt));
                    break;
                }
            }
            rows.add(r);
        }
        return CompletableFuture.completedFuture(AdminOverviewDetail.of(
                key, title, matched.size(), page, size, search, columns, rows, t0));
    }

    private CompletableFuture<AdminOverviewDetail> appointments(String key, String title, AdminOverviewFilter f, String search,
                                                                int page, int size, int offset, long t0, Narrow narrow) {
        List<Column> columns = new ArrayList<>(STUDENT_COLUMNS);
        columns.add(new Column("counsellorName", "Counsellor"));
        columns.add(new Column("sessionDate", "Session date"));
        columns.add(new Column("startTime", "Time"));
        columns.add(new Column("mode", "Mode"));
        columns.add(new Column("status", "Status"));
        columns.add(new Column("bookedAt", "Booked"));
        if (f.isDenied()) return empty(key, title, page, size, search, columns, t0);

        OverviewQuery q = narrow.apply(OverviewQuery.appointments(em, clock.zone(), f)).search(search);
        long total = q.count("SELECT COUNT(a)");
        List<Map<String, Object>> rows = new ArrayList<>();
        for (CounsellingAppointment a : q.list("SELECT a", CounsellingAppointment.class, offset, size)) {
            Map<String, Object> r = studentRow(a.getStudent());
            r.put("appointmentId", a.getId());
            r.put("counsellorName", a.getCounsellor() == null ? null : a.getCounsellor().getName());
            r.put("sessionDate", a.getSlot() == null || a.getSlot().getDate() == null ? null : a.getSlot().getDate().toString());
            r.put("startTime", a.getSlot() == null || a.getSlot().getStartTime() == null ? null : a.getSlot().getStartTime().toString());
            r.put("endTime", a.getSlot() == null || a.getSlot().getEndTime() == null ? null : a.getSlot().getEndTime().toString());
            r.put("mode", a.getMode() != null ? a.getMode() : (a.getSlot() == null ? null : a.getSlot().getMode()));
            r.put("status", a.getStatus());
            r.put("missedByRole", a.getMissedByRole());
            r.put("bookedAt", iso(a.getCreatedAt()));
            rows.add(r);
        }
        return CompletableFuture.completedFuture(AdminOverviewDetail.of(key, title, total, page, size, search, columns, rows, t0));
    }

    /**
     * Payments: assessment purchases and counselling purchases merged into one
     * list, newest first. Both sources are read in full (the modal shows one
     * scrollable page), then the requested window is cut from the merged list so
     * paging still behaves for other callers.
     */
    private CompletableFuture<AdminOverviewDetail> payments(AdminOverviewFilter f, String search,
                                                            int page, int size, int offset, long t0) {
        String key = AdminOverviewService.PAYMENTS_COMPLETED;
        List<Column> columns = Arrays.asList(
                new Column("name", "Student"),
                new Column("email", "Email"),
                new Column("phone", "Phone"),
                new Column("instituteName", "Institute"),
                new Column("purpose", "Paid for"),
                new Column("assessmentName", "Assessment"),
                new Column("amount", "Amount"),
                new Column("paymentId", "Payment id"),
                new Column("paidAt", "Paid"));
        if (f.isDenied()) return empty(key, "Payments completed", page, size, search, columns, t0);

        int fetch = offset + size;

        OverviewQuery tq = OverviewQuery.payments(em, clock.zone(), f)
                .and("LOWER(p.status) = 'paid'")
                .dateRange("p.updatedAt", f)
                .searchFields(search, "p.studentName", "p.studentEmail", "p.studentPhone", "p.razorpayPaymentId")
                .orderBy("p.updatedAt DESC, p.transactionId DESC");
        long tTotal = tq.count("SELECT COUNT(p)");
        List<PaymentTransaction> txns = tq.list("SELECT p", PaymentTransaction.class, 0, fetch);

        OverviewQuery cq = OverviewQuery.counsellingPayments(em, clock.zone(), f)
                .and("UPPER(cp.status) = 'PAID'")
                .localDateTimeRange("cp.paidAt", f)
                .search(search)
                .orderBy("cp.paidAt DESC, cp.id DESC");
        long cTotal = cq.count("SELECT COUNT(cp)");
        List<CounsellingPayment> cps = cq.list("SELECT cp", CounsellingPayment.class, 0, fetch);

        Set<Long> aids = new HashSet<>();
        Set<Integer> codes = new HashSet<>();
        for (PaymentTransaction p : txns) {
            if (p.getAssessmentId() != null) aids.add(p.getAssessmentId());
            if (p.getInstituteCode() != null) codes.add(p.getInstituteCode());
        }
        Map<Long, String> names = assessmentNames(aids);
        Map<Integer, String> institutes = instituteNames(codes);

        List<Map<String, Object>> merged = new ArrayList<>();
        for (PaymentTransaction p : txns) {
            Map<String, Object> r = AdminOverviewDetail.row();
            r.put("userStudentId", p.getUserStudentId());
            r.put("name", p.getStudentName());
            r.put("email", p.getStudentEmail());
            r.put("phone", p.getStudentPhone());
            r.put("instituteCode", p.getInstituteCode());
            r.put("instituteName", p.getInstituteCode() == null ? null : institutes.get(p.getInstituteCode()));
            r.put("purpose", p.getPurpose() != null ? p.getPurpose() : "Assessment");
            r.put("assessmentId", p.getAssessmentId());
            r.put("assessmentName", p.getAssessmentId() == null ? null
                    : names.getOrDefault(p.getAssessmentId(), "Assessment #" + p.getAssessmentId()));
            r.put("amount", p.getAmount());
            r.put("currency", p.getCurrency());
            r.put("paymentId", p.getRazorpayPaymentId());
            r.put("paidAt", iso(p.getUpdatedAt()));
            merged.add(r);
        }
        for (CounsellingPayment cp : cps) {
            Map<String, Object> r = studentRow(cp.getStudent());
            r.put("purpose", "Counselling" + (cp.getSessionsPurchased() != null && cp.getSessionsPurchased() > 1
                    ? " (" + cp.getSessionsPurchased() + " sessions)" : ""));
            r.put("assessmentId", null);
            r.put("assessmentName", null);
            r.put("amount", cp.getAmount());
            r.put("currency", cp.getCurrency());
            r.put("paymentId", cp.getRazorpayPaymentId());
            r.put("paidAt", iso(cp.getPaidAt()));
            merged.add(r);
        }
        merged.sort((a, b) -> {
            String x = a.get("paidAt") == null ? "" : String.valueOf(a.get("paidAt"));
            String y = b.get("paidAt") == null ? "" : String.valueOf(b.get("paidAt"));
            return y.compareTo(x);
        });
        int from = Math.min(offset, merged.size());
        int to = Math.min(fetch, merged.size());
        List<Map<String, Object>> rows = new ArrayList<>(merged.subList(from, to));
        return CompletableFuture.completedFuture(AdminOverviewDetail.of(
                key, "Payments completed", tTotal + cTotal, page, size, search, columns, rows, t0));
    }

    /** Website registrations: one row per lead, newest first. */
    private CompletableFuture<AdminOverviewDetail> leads(AdminOverviewFilter f, String search,
                                                         int page, int size, int offset, long t0) {
        String key = AdminOverviewService.WEBSITE_REGISTRATIONS;
        List<Column> columns = Arrays.asList(
                new Column("name", "Name"),
                new Column("email", "Email"),
                new Column("phone", "Phone"),
                new Column("leadType", "Registered as"),
                new Column("source", "Source"),
                new Column("designation", "Designation"),
                new Column("schoolName", "School"),
                new Column("city", "City"),
                new Column("registeredAt", "Registered"));
        if (f.isDenied()) return empty(key, "Website registrations", page, size, search, columns, t0);

        OverviewQuery q = OverviewQuery.leads(em, clock.zone(), f)
                .dateRange("l.createdAt", f)
                .searchFields(search, "l.fullName", "l.email", "l.phone", "l.schoolName", "l.city")
                .orderBy("l.createdAt DESC, l.id DESC");
        long total = q.count("SELECT COUNT(l)");
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Lead l : q.list("SELECT l", Lead.class, offset, size)) {
            Map<String, Object> r = AdminOverviewDetail.row();
            r.put("leadId", l.getId());
            r.put("name", l.getFullName());
            r.put("email", l.getEmail());
            r.put("phone", l.getPhone());
            r.put("leadType", l.getLeadType() == null ? null : l.getLeadType().name());
            r.put("source", l.getSource());
            r.put("designation", l.getDesignation());
            r.put("schoolName", l.getSchoolName());
            r.put("city", l.getCity());
            r.put("registeredAt", iso(l.getCreatedAt()));
            rows.add(r);
        }
        return CompletableFuture.completedFuture(AdminOverviewDetail.of(
                key, "Website registrations", total, page, size, search, columns, rows, t0));
    }

    private Map<Integer, String> instituteNames(Set<Integer> codes) {
        Map<Integer, String> out = new HashMap<>();
        if (codes.isEmpty()) return out;
        List<InstituteDetail> list = em.createQuery(
                "SELECT i FROM InstituteDetail i WHERE i.instituteCode IN :codes", InstituteDetail.class)
                .setParameter("codes", codes).getResultList();
        for (InstituteDetail i : list) out.put(i.getInstituteCode(), i.getInstituteName());
        return out;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private static CompletableFuture<AdminOverviewDetail> empty(String key, String title, int page, int size,
                                                                String search, List<Column> columns, long t0) {
        return CompletableFuture.completedFuture(AdminOverviewDetail.of(
                key, title, 0, page, size, search, columns, Collections.<Map<String, Object>>emptyList(), t0));
    }

    /** The common student columns from a {@code UserStudent} (+ its {@code StudentInfo} / institute). */
    private static Map<String, Object> studentRow(UserStudent us) {
        Map<String, Object> r = AdminOverviewDetail.row();
        StudentInfo si = us == null ? null : us.getStudentInfo();
        InstituteDetail inst = us == null ? null : us.getInstitute();
        r.put("userStudentId", us == null ? null : us.getUserStudentId());
        r.put("name", si == null ? null : si.getName());
        r.put("email", si == null ? null : si.getEmail());
        r.put("phone", si == null ? null : si.getPhoneNumber());
        r.put("rollNumber", si == null ? null : si.getSchoolRollNumber());
        r.put("studentClass", si == null ? null : si.getStudentClass());
        r.put("instituteCode", inst != null ? inst.getInstituteCode() : (si == null ? null : si.getInstituteId()));
        r.put("instituteName", inst == null ? null : inst.getInstituteName());
        return r;
    }

    private Map<Long, String> assessmentNames(Set<Long> ids) {
        Map<Long, String> out = new HashMap<>();
        if (ids.isEmpty()) return out;
        List<AssessmentTable> list = em.createQuery(
                "SELECT t FROM AssessmentTable t WHERE t.id IN :ids", AssessmentTable.class)
                .setParameter("ids", ids).getResultList();
        for (AssessmentTable t : list) out.put(t.getId(), t.getAssessmentName());
        return out;
    }

    private static String iso(LocalDateTime t) {
        return t == null ? null : t.toString();
    }

    /** A UTC wall-clock value (user_student.created_at) rendered in the app zone. */
    private String isoFromUtc(LocalDateTime utc) {
        return utc == null ? null : utc.atOffset(ZoneOffset.UTC).atZoneSameInstant(clock.zone()).toLocalDateTime().toString();
    }

    private String iso(Date d) {
        return d == null ? null : d.toInstant().atZone(clock.zone()).toLocalDateTime().toString();
    }
}
