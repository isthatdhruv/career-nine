package com.kccitm.api.service.dashboard.admin;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.TypedQuery;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.kccitm.api.service.AssessmentSessionService;
import com.kccitm.api.service.counselling.CounsellingClock;

/**
 * The registration funnel behind the "Registrations &amp; assessments" cards.
 *
 * <p>The cohort is every student account registered inside the applied window
 * (all accounts for "all time"), narrowed by the caller's scope and the view
 * filters. Each member is then placed in exactly one bucket, in this priority:
 * <ol>
 *   <li><b>completed</b> — at least one attempt with {@code status = completed};</li>
 *   <li><b>in progress</b> — otherwise, an attempt marked {@code ongoing} in MySQL
 *       <em>or</em> a live partial-answer draft in Redis
 *       ({@code career9:partial:{student}:{assessment}}). Redis is the source of
 *       truth for "started but not submitted": the DB status only flips on the
 *       start call, while every autosave lands in Redis;</li>
 *   <li><b>not started</b> — everything else, including accounts with no
 *       assessment assigned yet.</li>
 * </ol>
 * So {@code notStarted + inProgress + completed == cohort}. "With report" is the
 * subset of <i>completed</i> holding a {@code generated} report.
 *
 * <p>Redis being down does not fail the card: the funnel falls back to the DB
 * status alone and flags {@link Funnel#redisAvailable} so the UI can say so.
 */
@Component
class AdminCohortFunnel {

    private static final Logger log = LoggerFactory.getLogger(AdminCohortFunnel.class);
    private static final int CHUNK = 900;

    @PersistenceContext
    private EntityManager em;

    @Autowired
    private CounsellingClock clock;

    @Autowired(required = false)
    private AssessmentSessionService sessions;

    // ─── Model ───────────────────────────────────────────────────────────

    static final class Attempt {
        final Long assessmentId;
        final String status;
        final Date completedAt;
        Attempt(Long assessmentId, String status, Date completedAt) {
            this.assessmentId = assessmentId;
            this.status = status;
            this.completedAt = completedAt;
        }
        boolean completed() { return "completed".equalsIgnoreCase(status); }
        boolean ongoing() { return "ongoing".equalsIgnoreCase(status); }
    }

    static final class Draft {
        final Long assessmentId;
        final int answerCount;
        final String savedAt;
        Draft(Long assessmentId, int answerCount, String savedAt) {
            this.assessmentId = assessmentId;
            this.answerCount = answerCount;
            this.savedAt = savedAt;
        }
    }

    static final class Report {
        final Long assessmentId;
        final String status;
        final Date createdAt;
        Report(Long assessmentId, String status, Date createdAt) {
            this.assessmentId = assessmentId;
            this.status = status;
            this.createdAt = createdAt;
        }
        boolean generated() { return "generated".equalsIgnoreCase(status); }
    }

    static final class Student {
        final Long id;
        final List<Attempt> attempts = new ArrayList<>();
        final List<Draft> drafts = new ArrayList<>();
        final List<Report> reports = new ArrayList<>();
        Student(Long id) { this.id = id; }

        boolean completed() {
            for (Attempt a : attempts) if (a.completed()) return true;
            return false;
        }
        boolean ongoingInDb() {
            for (Attempt a : attempts) if (a.ongoing()) return true;
            return false;
        }
        boolean inProgress() { return !completed() && (ongoingInDb() || !drafts.isEmpty()); }
        boolean notStarted() { return !completed() && !inProgress(); }
        boolean hasReport() {
            for (Report r : reports) if (r.generated()) return true;
            return false;
        }
        int completedAttempts() {
            int n = 0;
            for (Attempt a : attempts) if (a.completed()) n++;
            return n;
        }
        int generatedReports() {
            int n = 0;
            for (Report r : reports) if (r.generated()) n++;
            return n;
        }
        int failedReports() {
            int n = 0;
            for (Report r : reports) if ("failed".equalsIgnoreCase(r.status)) n++;
            return n;
        }
        Attempt latestCompleted() {
            Attempt best = null;
            for (Attempt a : attempts) {
                if (!a.completed()) continue;
                if (best == null || (a.completedAt != null && (best.completedAt == null || a.completedAt.after(best.completedAt)))) best = a;
            }
            return best;
        }
        Report latestReport() {
            Report best = null;
            for (Report r : reports) {
                if (!r.generated()) continue;
                if (best == null || (r.createdAt != null && (best.createdAt == null || r.createdAt.after(best.createdAt)))) best = r;
            }
            return best;
        }
        /** The attempt being worked on: the freshest Redis draft, else the DB-ongoing one. */
        Draft latestDraft() {
            Draft best = null;
            for (Draft d : drafts) {
                if (best == null || (d.savedAt != null && (best.savedAt == null || d.savedAt.compareTo(best.savedAt) > 0))) best = d;
            }
            return best;
        }
        Attempt ongoingAttempt() {
            for (Attempt a : attempts) if (a.ongoing()) return a;
            return null;
        }
    }

    static final class Funnel {
        /** Cohort in registration order, newest first. */
        final List<Student> cohort;
        final boolean redisAvailable;
        Funnel(List<Student> cohort, boolean redisAvailable) {
            this.cohort = cohort;
            this.redisAvailable = redisAvailable;
        }
        static Funnel empty() { return new Funnel(Collections.<Student>emptyList(), true); }

        List<Student> completed() { List<Student> l = new ArrayList<>(); for (Student s : cohort) if (s.completed()) l.add(s); return l; }
        List<Student> inProgress() { List<Student> l = new ArrayList<>(); for (Student s : cohort) if (s.inProgress()) l.add(s); return l; }
        List<Student> notStarted() { List<Student> l = new ArrayList<>(); for (Student s : cohort) if (s.notStarted()) l.add(s); return l; }
        List<Student> withReport() { List<Student> l = new ArrayList<>(); for (Student s : cohort) if (s.completed() && s.hasReport()) l.add(s); return l; }

        long completedAttempts() { long n = 0; for (Student s : cohort) n += s.completedAttempts(); return n; }
        long generatedReports() { long n = 0; for (Student s : cohort) n += s.generatedReports(); return n; }
        long failedReports() { long n = 0; for (Student s : cohort) n += s.failedReports(); return n; }
        long withDraft() { long n = 0; for (Student s : cohort) if (s.inProgress() && !s.drafts.isEmpty()) n++; return n; }
        long ongoingOnly() { long n = 0; for (Student s : cohort) if (s.inProgress() && s.drafts.isEmpty()) n++; return n; }
        long assignedNotStarted() { long n = 0; for (Student s : cohort) if (s.notStarted() && !s.attempts.isEmpty()) n++; return n; }
        long unassigned() { long n = 0; for (Student s : cohort) if (s.notStarted() && s.attempts.isEmpty()) n++; return n; }
    }

    // ─── Computation ─────────────────────────────────────────────────────

    Funnel compute(AdminOverviewFilter f) {
        if (f.isDenied()) return Funnel.empty();

        List<Long> ids = OverviewQuery.signups(em, clock.zone(), f)
                .utcDateTimeRange("us.createdAt", f)
                .orderBy("us.createdAt DESC, us.userStudentId DESC")
                .list("SELECT us.userStudentId", Long.class, 0, Integer.MAX_VALUE);
        if (ids.isEmpty()) return Funnel.empty();

        Map<Long, Student> byId = new LinkedHashMap<>();
        for (Long id : ids) byId.put(id, new Student(id));

        String aidClause = f.hasAssessments() ? " AND m.assessmentId IN :aids" : "";
        String ridClause = f.hasAssessments() ? " AND r.assessmentId IN :aids" : "";
        for (List<Long> chunk : chunks(ids)) {
            TypedQuery<Object[]> mq = em.createQuery(
                    "SELECT m.userStudent.userStudentId, m.assessmentId, m.status, m.completedAt "
                            + "FROM StudentAssessmentMapping m WHERE m.userStudent.userStudentId IN :ids" + aidClause,
                    Object[].class).setParameter("ids", chunk);
            if (f.hasAssessments()) mq.setParameter("aids", f.getAssessmentIds());
            for (Object[] row : mq.getResultList()) {
                Student s = byId.get((Long) row[0]);
                if (s != null) s.attempts.add(new Attempt((Long) row[1], (String) row[2], (Date) row[3]));
            }

            TypedQuery<Object[]> rq = em.createQuery(
                    "SELECT r.userStudent.userStudentId, r.assessmentId, r.reportStatus, r.createdAt "
                            + "FROM GeneratedReport r WHERE r.userStudent.userStudentId IN :ids" + ridClause,
                    Object[].class).setParameter("ids", chunk);
            if (f.hasAssessments()) rq.setParameter("aids", f.getAssessmentIds());
            for (Object[] row : rq.getResultList()) {
                Student s = byId.get((Long) row[0]);
                if (s != null) s.reports.add(new Report((Long) row[1], (String) row[2], (Date) row[3]));
            }
        }

        boolean redisOk = attachDrafts(byId, f);
        return new Funnel(new ArrayList<>(byId.values()), redisOk);
    }

    /**
     * Pull every live partial-answer draft out of Redis and attach it to cohort
     * members. A draft for an assessment the student has already completed is
     * stale (the processor deletes it after persisting) and is ignored.
     */
    private boolean attachDrafts(Map<Long, Student> byId, AdminOverviewFilter f) {
        if (sessions == null) return false;
        List<Map<String, Object>> entries;
        try {
            entries = sessions.getAllPartialAnswerEntries(null);
        } catch (Exception e) {
            log.warn("admin-overview: Redis partial scan failed, in-progress falls back to DB status: {}", e.getMessage());
            return false;
        }
        for (Map<String, Object> e : entries) {
            Long sid = toLong(e.get("userStudentId"));
            Long aid = toLong(e.get("assessmentId"));
            if (sid == null || aid == null) continue;
            Student s = byId.get(sid);
            if (s == null) continue;
            if (f.hasAssessments() && !f.getAssessmentIds().contains(aid)) continue;
            boolean doneAlready = false;
            for (Attempt a : s.attempts) if (aid.equals(a.assessmentId) && a.completed()) doneAlready = true;
            if (doneAlready) continue;
            Object cnt = e.get("answerCount");
            int answers = cnt instanceof Number ? ((Number) cnt).intValue() : 0;
            s.drafts.add(new Draft(aid, answers, e.get("savedAt") == null ? null : String.valueOf(e.get("savedAt"))));
        }
        return true;
    }

    private static Long toLong(Object o) {
        if (o instanceof Number) return ((Number) o).longValue();
        if (o == null) return null;
        try { return Long.parseLong(String.valueOf(o)); } catch (NumberFormatException ex) { return null; }
    }

    private static List<List<Long>> chunks(List<Long> ids) {
        List<List<Long>> out = new ArrayList<>();
        for (int i = 0; i < ids.size(); i += CHUNK) out.add(ids.subList(i, Math.min(ids.size(), i + CHUNK)));
        return out;
    }

    /** Distinct assessment ids referenced by the given students (for name lookups). */
    static Set<Long> assessmentIds(List<Student> students) {
        Set<Long> ids = new HashSet<>();
        for (Student s : students) {
            for (Attempt a : s.attempts) if (a.assessmentId != null) ids.add(a.assessmentId);
            for (Draft d : s.drafts) if (d.assessmentId != null) ids.add(d.assessmentId);
            for (Report r : s.reports) if (r.assessmentId != null) ids.add(r.assessmentId);
        }
        return ids;
    }
}
