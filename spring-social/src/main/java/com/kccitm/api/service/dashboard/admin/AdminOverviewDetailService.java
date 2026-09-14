package com.kccitm.api.service.dashboard.admin;

import java.time.LocalDateTime;
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
            case AdminOverviewService.ASSESSMENTS_CONDUCTED:
            case AdminOverviewService.ASSESSMENTS_COMPLETED:
                return mappings(key, "Completed assessments", f, search, pageNo, pageSize, offset, t0,
                        q -> q.and("m.status = 'completed'").dateRange("m.completedAt", f)
                              .orderBy("m.completedAt DESC, m.studentAssessmentId DESC"));
            case AdminOverviewService.ASSESSMENTS_IN_PROGRESS:
                return mappings(key, "Assessments in progress", f, search, pageNo, pageSize, offset, t0,
                        q -> q.and("m.status = 'ongoing'").orderBy("m.studentAssessmentId DESC"));
            case AdminOverviewService.ASSESSMENTS_NOT_STARTED:
                return mappings(key, "Assessments not started", f, search, pageNo, pageSize, offset, t0,
                        q -> q.and("(m.status IS NULL OR m.status = 'notstarted')").orderBy("m.studentAssessmentId DESC"));
            case AdminOverviewService.REPORTS_GENERATED:
                return reports(f, search, pageNo, pageSize, offset, t0);
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
                .localDateTimeRange("us.createdAt", f)
                .search(search)
                .orderBy("us.createdAt DESC, us.userStudentId DESC");
        long total = q.count("SELECT COUNT(us)");
        List<Map<String, Object>> rows = new ArrayList<>();
        for (UserStudent us : q.list("SELECT us", UserStudent.class, offset, size)) {
            Map<String, Object> r = studentRow(us);
            r.put("registeredAt", iso(us.getCreatedAt()));
            rows.add(r);
        }
        return CompletableFuture.completedFuture(AdminOverviewDetail.of(
                AdminOverviewService.SIGNUPS, "New sign-ups", total, page, size, search, columns, rows, t0));
    }

    private CompletableFuture<AdminOverviewDetail> mappings(String key, String title, AdminOverviewFilter f, String search,
                                                            int page, int size, int offset, long t0, Narrow narrow) {
        List<Column> columns = new ArrayList<>(STUDENT_COLUMNS);
        columns.add(new Column("assessmentName", "Assessment"));
        columns.add(new Column("status", "Status"));
        columns.add(new Column("completedAt", "Completed"));
        if (f.isDenied()) return empty(key, title, page, size, search, columns, t0);

        OverviewQuery q = narrow.apply(OverviewQuery.mappings(em, clock.zone(), f)).search(search);
        long total = q.count("SELECT COUNT(m)");
        List<StudentAssessmentMapping> page0 = q.list("SELECT m", StudentAssessmentMapping.class, offset, size);
        Set<Long> ids = new HashSet<>();
        for (StudentAssessmentMapping m : page0) ids.add(m.getAssessmentId());
        Map<Long, String> names = assessmentNames(ids);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (StudentAssessmentMapping m : page0) {
            Map<String, Object> r = studentRow(m.getUserStudent());
            r.put("assessmentId", m.getAssessmentId());
            r.put("assessmentName", names.getOrDefault(m.getAssessmentId(), "Assessment #" + m.getAssessmentId()));
            r.put("status", m.getStatus() == null ? "notstarted" : m.getStatus());
            r.put("completedAt", iso(m.getCompletedAt()));
            rows.add(r);
        }
        return CompletableFuture.completedFuture(AdminOverviewDetail.of(key, title, total, page, size, search, columns, rows, t0));
    }

    private CompletableFuture<AdminOverviewDetail> reports(AdminOverviewFilter f, String search,
                                                           int page, int size, int offset, long t0) {
        String key = AdminOverviewService.REPORTS_GENERATED;
        List<Column> columns = new ArrayList<>(STUDENT_COLUMNS);
        columns.add(new Column("assessmentName", "Assessment"));
        columns.add(new Column("typeOfReport", "Report type"));
        columns.add(new Column("reportStatus", "Status"));
        columns.add(new Column("generatedAt", "Generated"));
        if (f.isDenied()) return empty(key, "Reports generated", page, size, search, columns, t0);

        OverviewQuery q = OverviewQuery.reports(em, clock.zone(), f)
                .and("LOWER(r.reportStatus) = 'generated'")
                .dateRange("r.createdAt", f)
                .search(search)
                .orderBy("r.createdAt DESC, r.generatedReportId DESC");
        long total = q.count("SELECT COUNT(r)");
        List<GeneratedReport> page0 = q.list("SELECT r", GeneratedReport.class, offset, size);
        Set<Long> ids = new HashSet<>();
        for (GeneratedReport r : page0) ids.add(r.getAssessmentId());
        Map<Long, String> names = assessmentNames(ids);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (GeneratedReport rep : page0) {
            Map<String, Object> r = studentRow(rep.getUserStudent());
            r.put("assessmentId", rep.getAssessmentId());
            r.put("assessmentName", names.getOrDefault(rep.getAssessmentId(), "Assessment #" + rep.getAssessmentId()));
            r.put("typeOfReport", rep.getTypeOfReport());
            r.put("reportStatus", rep.getReportStatus());
            r.put("generatedAt", iso(rep.getCreatedAt()));
            r.put("reportUrl", rep.getReportUrl());
            rows.add(r);
        }
        return CompletableFuture.completedFuture(AdminOverviewDetail.of(key, "Reports generated", total, page, size, search, columns, rows, t0));
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

    private String iso(Date d) {
        return d == null ? null : d.toInstant().atZone(clock.zone()).toLocalDateTime().toString();
    }
}
