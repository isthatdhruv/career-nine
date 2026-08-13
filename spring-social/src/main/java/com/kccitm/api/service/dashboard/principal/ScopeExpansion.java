package com.kccitm.api.service.dashboard.principal;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Turns what an admin selected into the scopes a release will generate.
 *
 * <p>Selecting a node releases that node <em>and everything beneath it</em>. Picking
 * Class 10 generates Class 10, 10-A, 10-B and 10-C — because a dashboard whose Class 10
 * view works but whose section filter says "not generated" is the failure this feature
 * exists to remove, and after {@link ReleaseSnapshot} a descendant costs a filter
 * rather than a rescore.
 *
 * <p><b>Two axes, never crossed.</b> Session → class → section is a nesting. Groups are
 * defined as independent of all three — cutting across classes is the whole point of a
 * group — so a group is expanded standalone. Crossing them would multiply the row count
 * to produce cohorts like "the four debate-team members who are also in 10-B", which no
 * one selects and which fall under the narrative floor anyway.
 *
 * <p>Expansion reads the {@link ReleaseSnapshot}, never the lookup tables: a section
 * that exists in school records but has no assessed student never becomes a scope.
 */
public final class ScopeExpansion {

    private ScopeExpansion() {}

    /**
     * What the admin picked. A null dimension means "all"; the axis flags say whether
     * that half of the selection was made at all.
     *
     * <p>Release All is {@code academic=true, groups=true} with every dimension null.
     */
    public static final class Selection {
        /** Include the session/class/section axis. */
        public boolean academic = true;
        /** Include the group axis. */
        public boolean groups;
        public Long sessionId;
        public Long classId;
        public Long sectionId;
        /** Specific groups; empty means every group with a scoreable student. */
        public List<Long> groupIds = new ArrayList<>();

        public static Selection all() {
            Selection s = new Selection();
            s.academic = true;
            s.groups = true;
            return s;
        }

        public static Selection academic(Long sessionId, Long classId, Long sectionId) {
            Selection s = new Selection();
            s.academic = true;
            s.groups = false;
            s.sessionId = sessionId;
            s.classId = classId;
            s.sectionId = sectionId;
            return s;
        }

        public static Selection groups(List<Long> groupIds) {
            Selection s = new Selection();
            s.academic = false;
            s.groups = true;
            if (groupIds != null) s.groupIds = groupIds;
            return s;
        }

        /** The scope the admin actually named, before descendants are added. */
        public boolean isLeaf() {
            return sectionId != null;
        }

        public boolean isWholeInstitute() {
            return academic && sessionId == null && classId == null && sectionId == null;
        }
    }

    /**
     * Expand a selection against the snapshot.
     *
     * <p>Institute-first ordering is deliberate: it is the most-viewed scope, so a
     * release interrupted halfway has still produced the one people open.
     *
     * @return canonical scope keys, deduplicated, in generation order
     */
    public static List<ScopeKey> expand(Selection selection, ReleaseSnapshot snapshot) {
        Long assessmentId = snapshot.assessmentId();
        // Dedup on the canonical key: a single-section class yields the same key from
        // both its class node and its section node, and must produce one row.
        Set<ScopeKey> scopes = new LinkedHashSet<>();

        if (selection.academic) {
            expandAcademic(selection, snapshot, assessmentId, scopes);
        }

        if (selection.groups) {
            Collection<Long> groupIds = selection.groupIds.isEmpty()
                    ? snapshot.groups() : selection.groupIds;
            for (Long groupId : groupIds) {
                scopes.add(ScopeKey.group(assessmentId, groupId));
            }
        }

        return new ArrayList<>(scopes);
    }

    private static void expandAcademic(Selection sel, ReleaseSnapshot snapshot,
                                       Long assessmentId, Set<ScopeKey> scopes) {
        // A section is a leaf — there is nothing beneath it to expand.
        if (sel.sectionId != null) {
            scopes.add(ScopeKey.canonical(assessmentId, sel.sessionId, sel.classId,
                    sel.sectionId, null, snapshot));
            return;
        }

        if (sel.classId != null) {
            addClass(assessmentId, sel.sessionId, sel.classId, snapshot, scopes);
            return;
        }

        if (sel.sessionId != null) {
            addSession(assessmentId, sel.sessionId, snapshot, scopes);
            return;
        }

        // Whole institute: the root, then every session, class and section under it.
        scopes.add(ScopeKey.institute(assessmentId));
        for (Long sessionId : sessionsToWalk(snapshot)) {
            addSession(assessmentId, sessionId, snapshot, scopes);
        }
    }

    private static void addSession(Long assessmentId, Long sessionId,
                                   ReleaseSnapshot snapshot, Set<ScopeKey> scopes) {
        scopes.add(ScopeKey.canonical(assessmentId, sessionId, null, null, null, snapshot));
        for (Long classId : snapshot.classesOf(sessionId)) {
            addClass(assessmentId, sessionId, classId, snapshot, scopes);
        }
    }

    private static void addClass(Long assessmentId, Long sessionId, Long classId,
                                 ReleaseSnapshot snapshot, Set<ScopeKey> scopes) {
        scopes.add(ScopeKey.canonical(assessmentId, sessionId, classId, null, null, snapshot));
        for (Long sectionId : snapshot.sectionsOf(sessionId, classId)) {
            scopes.add(ScopeKey.canonical(assessmentId, sessionId, classId, sectionId, null, snapshot));
        }
    }

    /**
     * Sessions to iterate when none was selected.
     *
     * <p>A school that records no session at all still has classes; walking a single
     * null session lets those expand, and {@link ScopeKey#canonical} drops the
     * dimension either way.
     */
    private static Collection<Long> sessionsToWalk(ReleaseSnapshot snapshot) {
        Set<Long> sessions = snapshot.sessions();
        return sessions.isEmpty() ? Collections.<Long>singletonList(null) : sessions;
    }
}
