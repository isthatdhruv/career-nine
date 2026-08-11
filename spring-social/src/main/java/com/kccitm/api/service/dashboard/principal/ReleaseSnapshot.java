package com.kccitm.api.service.dashboard.principal;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.service.schoolreport.SchoolDashboardDataService.ScoredRoster;
import com.kccitm.api.service.schoolreport.SchoolDashboardDataService.ScoredStudent;

/**
 * One institute+assessment, scored once, with everything a release needs to derive
 * any scope by filtering.
 *
 * <p>This is the pivot of the whole release path. Scoring reads the entire cohort's
 * answers to build its context, so doing it per scope means paying for the same work
 * at every level of the lattice. Here it happens once, and a scope becomes
 * {@link #inScope(ScopeKey)} — a predicate over a list already in memory.
 *
 * <p>The snapshot is also what makes a release <em>consistent</em>: thirty-three
 * independent queries can disagree about who is in 10-A if a student transfers
 * mid-release. One snapshot cannot.
 *
 * <p>Non-completed students are carried deliberately. They score nothing, but they are
 * the only source of a scoped participation count — see {@link Cohort}.
 */
public final class ReleaseSnapshot {

    /**
     * The school's own details, flattened.
     *
     * <p>Deliberately not the JPA entity. A snapshot outlives the transaction that built
     * it and is handed to a background thread, so any lazy association on a stored entity
     * would fail on first touch — {@code InstituteDetail.boards} did exactly that, and
     * every scope in a release failed on the same line. Values are read while the session
     * is open and carried as plain data.
     */
    public static final class InstituteProfile {
        public final String name;
        public final String city;
        public final String state;
        public final List<String> boards;

        public InstituteProfile(String name, String city, String state, List<String> boards) {
            this.name = name;
            this.city = city;
            this.state = state;
            this.boards = boards == null ? Collections.<String>emptyList() : boards;
        }

        /** Everything the entity could not supply, as an empty profile. */
        public static InstituteProfile unknown() {
            return new InstituteProfile(null, null, null, Collections.<String>emptyList());
        }

        /** Must be called inside the transaction that loaded the entity. */
        public static InstituteProfile of(InstituteDetail institute) {
            if (institute == null) return unknown();
            List<String> boards = new ArrayList<>();
            if (institute.getBoards() != null) {
                // Touching the collection here is the point: it initialises while a
                // session still exists.
                for (Object board : institute.getBoards()) {
                    if (board instanceof com.kccitm.api.model.BoardName) {
                        String name = ((com.kccitm.api.model.BoardName) board).getName();
                        if (name != null) boards.add(name);
                    }
                }
            }
            return new InstituteProfile(institute.getInstituteName(),
                    institute.getCity(), institute.getState(), boards);
        }
    }

    private final ScoredRoster roster;
    private final Map<Long, List<Long>> groupsByStudent;
    private final InstituteProfile institute;
    private final Map<Long, String> sessionNames;
    private final Map<Long, String> groupNames;
    private final Set<Long> counselledStudentIds;

    public ReleaseSnapshot(ScoredRoster roster,
                           Map<Long, List<Long>> groupsByStudent,
                           InstituteProfile institute,
                           Map<Long, String> sessionNames,
                           Map<Long, String> groupNames,
                           Set<Long> counselledStudentIds) {
        this.roster = roster;
        this.groupsByStudent = groupsByStudent == null
                ? Collections.<Long, List<Long>>emptyMap() : groupsByStudent;
        this.institute = institute == null ? InstituteProfile.unknown() : institute;
        this.sessionNames = sessionNames == null
                ? Collections.<Long, String>emptyMap() : sessionNames;
        this.groupNames = groupNames == null
                ? Collections.<Long, String>emptyMap() : groupNames;
        this.counselledStudentIds = counselledStudentIds == null
                ? Collections.<Long>emptySet() : counselledStudentIds;
    }

    /**
     * How many students in this list have actually been counselled.
     *
     * <p>Backed by completed appointments, not counsellor assignments — the number is
     * printed in a school's report under "students counselled", and an assignment is
     * not a session.
     */
    public int counselledAmong(List<ScoredStudent> students) {
        int count = 0;
        for (ScoredStudent s : students) {
            if (counselledStudentIds.contains(s.userStudentId)) count++;
        }
        return count;
    }

    /**
     * A scope's display label, using real names where the school has them.
     *
     * <p>Labels are resolved here rather than in {@link ScopeKey} because names live in
     * lookup tables the key deliberately knows nothing about, and they are stored with
     * the payload so the dashboard never has to re-resolve four ids to draw a heading.
     */
    public String labelFor(ScopeKey scope) {
        if (scope.getGroupId() != null) {
            return groupNames.getOrDefault(scope.getGroupId(), "Group " + scope.getGroupId());
        }
        StringBuilder label = new StringBuilder();
        if (scope.getClassId() != null) {
            label.append("Class ").append(scope.getClassId());
            if (scope.getSectionId() != null) {
                label.append(" · Section ")
                     .append(sectionNames().getOrDefault(scope.getSectionId(),
                             String.valueOf(scope.getSectionId())));
            }
        } else if (scope.getSessionId() != null) {
            label.append(sessionNames.getOrDefault(scope.getSessionId(),
                    "Session " + scope.getSessionId()));
        } else {
            label.append("Whole school");
        }
        // A session qualifier only helps when more than one session is in play; with a
        // single session it is noise on every heading in the school.
        if (scope.getClassId() != null && scope.getSessionId() != null && sessions().size() > 1) {
            label.append(" (").append(sessionNames.getOrDefault(scope.getSessionId(),
                    "Session " + scope.getSessionId())).append(")");
        }
        return label.toString();
    }

    public String sessionName(Long sessionId) {
        return sessionId == null ? null
                : sessionNames.getOrDefault(sessionId, "Session " + sessionId);
    }

    public String groupName(Long groupId) {
        return groupId == null ? null
                : groupNames.getOrDefault(groupId, "Group " + groupId);
    }

    public ScoredRoster roster() { return roster; }
    public InstituteProfile institute() { return institute; }
    public Long assessmentId() { return roster.assessmentId; }
    public String assessmentName() { return roster.assessmentName; }
    public String instituteName() { return roster.instituteName; }
    public Integer instituteCode() { return roster.instituteCode; }
    public int scoringFailures() { return roster.scoringFailures; }
    public List<ScoredStudent> allStudents() { return roster.students; }

    /** Groups this student belongs to; empty when they are in none. */
    public List<Long> groupsOf(Long studentId) {
        List<Long> groups = groupsByStudent.get(studentId);
        return groups == null ? Collections.<Long>emptyList() : groups;
    }

    // ───────────────────────────── filtering ─────────────────────────────

    /**
     * Every student inside a scope, whatever their status.
     *
     * <p>A group scope resolves through membership; every other level resolves through
     * the student's own session/class/section. A null dimension on the scope means
     * unconstrained; a null on the student never matches a bound dimension, because a
     * student with no recorded section is not in section A.
     */
    public List<ScoredStudent> inScope(ScopeKey scope) {
        List<ScoredStudent> matched = new ArrayList<>();
        for (ScoredStudent s : roster.students) {
            if (scope.getGroupId() != null) {
                if (!groupsOf(s.userStudentId).contains(scope.getGroupId())) continue;
            } else {
                if (!dimMatches(scope.getSessionId(), s.sessionId)) continue;
                if (!dimMatches(scope.getClassId(), s.classId)) continue;
                if (!dimMatches(scope.getSectionId(), s.sectionId)) continue;
            }
            matched.add(s);
        }
        return matched;
    }

    private static boolean dimMatches(Long scopeDim, Long studentDim) {
        if (scopeDim == null) return true;
        if (studentDim == null) return false;
        return scopeDim.equals(studentDim);
    }

    // ─────────────────────────── participation ───────────────────────────

    /** Headcounts for one scope. {@code scored} is the base for every sheet number. */
    public static final class Cohort {
        public int total;
        public int completed;
        public int ongoing;
        public int notStarted;
        public int completedPct;
        /** Completed <em>and</em> successfully scored — what the sheets are computed from. */
        public int scored;
        /** Completed but scoring failed. Never silently folded into another bucket. */
        public int unscored;
    }

    public static Cohort cohortOf(List<ScoredStudent> students) {
        Cohort c = new Cohort();
        for (ScoredStudent s : students) {
            c.total++;
            switch (s.status == null ? "" : s.status) {
                case "completed":
                    c.completed++;
                    if (s.isScored()) c.scored++; else c.unscored++;
                    break;
                case "ongoing":
                    c.ongoing++;
                    break;
                default:
                    c.notStarted++;
                    break;
            }
        }
        c.completedPct = c.total == 0 ? 0 : (int) Math.round(c.completed * 100.0 / c.total);
        return c;
    }

    // ───────────────────────── dimension cardinality ─────────────────────────

    /**
     * Distinct populated values per dimension, over scoreable students.
     *
     * <p>Drives both expansion (which scopes exist) and canonicalisation (a dimension
     * with one value is dropped from the key). Both must read the same numbers or the
     * writer and the reader will name the same scope differently.
     */
    public Set<Long> sessions() { return distinct(Dim.SESSION); }
    public Set<Long> classes() { return distinct(Dim.CLASS); }

    /** Sections of one class, in encounter order. */
    public Set<Long> sectionsOf(Long sessionId, Long classId) {
        Set<Long> out = new LinkedHashSet<>();
        for (ScoredStudent s : roster.students) {
            if (!s.isScored()) continue;
            if (!dimMatches(sessionId, s.sessionId)) continue;
            if (!dimMatches(classId, s.classId)) continue;
            if (s.sectionId != null) out.add(s.sectionId);
        }
        return out;
    }

    /** Classes within one session, in encounter order. */
    public Set<Long> classesOf(Long sessionId) {
        Set<Long> out = new LinkedHashSet<>();
        for (ScoredStudent s : roster.students) {
            if (!s.isScored()) continue;
            if (!dimMatches(sessionId, s.sessionId)) continue;
            if (s.classId != null) out.add(s.classId);
        }
        return out;
    }

    /** Every group with at least one scoreable student. */
    public Set<Long> groups() {
        Set<Long> out = new LinkedHashSet<>();
        for (ScoredStudent s : roster.students) {
            if (!s.isScored()) continue;
            out.addAll(groupsOf(s.userStudentId));
        }
        return out;
    }

    /** Section id → display name, for scope labels. */
    public Map<Long, String> sectionNames() {
        Map<Long, String> names = new LinkedHashMap<>();
        for (ScoredStudent s : roster.students) {
            if (s.sectionId != null && s.sectionName != null && !s.sectionName.isEmpty()) {
                names.putIfAbsent(s.sectionId, s.sectionName);
            }
        }
        return names;
    }

    private enum Dim { SESSION, CLASS }

    private Set<Long> distinct(Dim dim) {
        Set<Long> out = new LinkedHashSet<>();
        for (ScoredStudent s : roster.students) {
            if (!s.isScored()) continue;
            Long v = dim == Dim.SESSION ? s.sessionId : s.classId;
            if (v != null) out.add(v);
        }
        return out;
    }
}
