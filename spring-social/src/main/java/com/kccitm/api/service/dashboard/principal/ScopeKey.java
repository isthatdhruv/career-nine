package com.kccitm.api.service.dashboard.principal;

import java.util.Objects;

import com.kccitm.api.model.career9.PrincipalDashboardData;

/**
 * The canonical name of a dashboard scope.
 *
 * <p>Every write and every read goes through this class. That is the whole point:
 * the writer stores {@code a:12|s:3|c:10|x:null|g:null} and the reader looks up the
 * same string, so the two can never disagree about what a scope is called. Formatting
 * a key anywhere else — string concatenation in a query, a hand-built key in a test —
 * defeats the guarantee.
 *
 * <p>It is also why {@code principal_dashboard_data} is unique on this string rather
 * than on the four nullable dimension columns: MySQL treats NULLs as distinct inside a
 * unique index, so a composite constraint would silently permit two "all classes" rows
 * for the same institute. The dimension columns exist to be queried, not to be identity.
 *
 * <p>A null dimension means <em>unconstrained</em> ("every class"), never "unknown".
 */
public final class ScopeKey {

    /** Literal used for an unconstrained dimension. Never a real id. */
    private static final String ALL = "null";

    private final Long assessmentId;
    private final Long sessionId;
    private final Long classId;
    private final Long sectionId;
    private final Long groupId;

    private ScopeKey(Long assessmentId, Long sessionId, Long classId, Long sectionId, Long groupId) {
        this.assessmentId = assessmentId;
        this.sessionId = sessionId;
        this.classId = classId;
        this.sectionId = sectionId;
        this.groupId = groupId;
    }

    /** The institute as a whole, for one assessment. */
    public static ScopeKey institute(Long assessmentId) {
        return new ScopeKey(assessmentId, null, null, null, null);
    }

    public static ScopeKey session(Long assessmentId, Long sessionId) {
        return new ScopeKey(assessmentId, sessionId, null, null, null);
    }

    public static ScopeKey ofClass(Long assessmentId, Long sessionId, Long classId) {
        return new ScopeKey(assessmentId, sessionId, classId, null, null);
    }

    public static ScopeKey section(Long assessmentId, Long sessionId, Long classId, Long sectionId) {
        return new ScopeKey(assessmentId, sessionId, classId, sectionId, null);
    }

    /**
     * A group scope. Groups are deliberately <em>not</em> crossed with session, class
     * or section: a group is defined as independent of them, so crossing multiplies
     * rows for no analytical gain — cutting across classes is the point of a group.
     */
    public static ScopeKey group(Long assessmentId, Long groupId) {
        return new ScopeKey(assessmentId, null, null, null, groupId);
    }

    /** Rebuild from stored dimension columns — used when reading a row back. */
    public static ScopeKey of(Long assessmentId, Long sessionId, Long classId, Long sectionId, Long groupId) {
        return new ScopeKey(assessmentId, sessionId, classId, sectionId, groupId);
    }

    /**
     * The one true key for a requested scope, given what the school actually has.
     *
     * <p>Two scopes with identical membership must not become two rows — that stores
     * the same payload twice and bills OpenAI twice for one cohort. Which pairs are
     * identical depends on the school, so it cannot be decided by the key format
     * alone:
     *
     * <ul>
     *   <li><b>One session</b> — every scope is inside it, so binding it distinguishes
     *       nothing. Dropped.</li>
     *   <li><b>A class with one populated section</b> — the section scope and the class
     *       scope hold the same students. The section is dropped in favour of the
     *       class, which is the one an admin selected by name.</li>
     *   <li><b>A group</b> — deliberately independent of session, class and section, so
     *       those dimensions are cleared rather than carried alongside it.</li>
     * </ul>
     *
     * <p>Every write goes through here. The read path does <em>not</em> re-derive this
     * — it would need a snapshot it has no reason to build — and instead resolves
     * against the stored dimension columns, reporting which scope it matched.
     */
    public static ScopeKey canonical(Long assessmentId, Long sessionId, Long classId,
                                     Long sectionId, Long groupId, ReleaseSnapshot snapshot) {
        if (groupId != null) {
            return group(assessmentId, groupId);
        }
        Long session = snapshot.sessions().size() <= 1 ? null : sessionId;
        Long section = sectionId;
        if (section != null && snapshot.sectionsOf(session, classId).size() <= 1) {
            section = null;
        }
        return new ScopeKey(assessmentId, session, classId, section, null);
    }

    /**
     * The stored form: {@code a:<assessment>|s:<session>|c:<class>|x:<section>|g:<group>}
     * with {@code null} for any unconstrained dimension. Fixed field order, so the
     * string is stable across callers.
     */
    public String key() {
        return "a:" + id(assessmentId)
             + "|s:" + id(sessionId)
             + "|c:" + id(classId)
             + "|x:" + id(sectionId)
             + "|g:" + id(groupId);
    }

    private static String id(Long v) {
        return v == null ? ALL : v.toString();
    }

    /**
     * Which lattice level this scope sits on. Derived from which dimensions are bound
     * rather than stored separately, so level and key can never contradict each other.
     */
    public String level() {
        if (groupId != null) return PrincipalDashboardData.LEVEL_GROUP;
        if (sectionId != null) return PrincipalDashboardData.LEVEL_SECTION;
        if (classId != null) return PrincipalDashboardData.LEVEL_CLASS;
        if (sessionId != null) return PrincipalDashboardData.LEVEL_SESSION;
        return PrincipalDashboardData.LEVEL_INSTITUTE;
    }

    /** Human-readable, for confirmation dialogs and error messages. */
    public String describe() {
        if (groupId != null) return "Group " + groupId;
        if (sectionId != null) return "Class " + classId + " Section " + sectionId;
        if (classId != null) return "Class " + classId;
        if (sessionId != null) return "Session " + sessionId;
        return "Whole institute";
    }

    public Long getAssessmentId() { return assessmentId; }
    public Long getSessionId() { return sessionId; }
    public Long getClassId() { return classId; }
    public Long getSectionId() { return sectionId; }
    public Long getGroupId() { return groupId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ScopeKey)) return false;
        return key().equals(((ScopeKey) o).key());
    }

    @Override
    public int hashCode() {
        return Objects.hash(key());
    }

    @Override
    public String toString() {
        return key();
    }
}
