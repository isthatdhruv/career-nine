package com.kccitm.api.service.dashboard.principal;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Works out which scopes a Release should actually generate.
 *
 * <p>Two rules do all the work here.
 *
 * <p><b>Only scopes that contain students.</b> The lattice is derived from the roster,
 * never from the lookup tables. A Grade 7 Section D that exists in {@code section} but
 * has no assessed students never becomes a row.
 *
 * <p><b>A lattice, not a cross-product.</b> Groups are defined as independent of
 * session, class and section — cutting across classes is the point of a group — so
 * crossing group × class × section multiplies rows for no analytical gain. Levels are
 * therefore additive:
 *
 * <pre>
 *   institute                      1
 *   session                        S
 *   session × class                C
 *   session × class × section      X
 *   group (standalone)             G
 *                            = 1 + S + C + X + G
 * </pre>
 *
 * For a typical school that is ~25 scopes against ~225 for the full cross-product,
 * and the 200 it skips are combinations nobody would open.
 *
 * <p>Degenerate scopes are collapsed: when a class has exactly one populated section,
 * the class row and the section row would have identical membership, so only the class
 * row is generated. Generating both would mean paying OpenAI twice for the same cohort.
 */
public final class ScopeLattice {

    /** One student's position on the dimensions, as read off StudentInfo. */
    public static final class RosterEntry {
        public final Long sessionId;
        public final Long classId;
        public final Long sectionId;
        /** Groups this student belongs to; empty when they are in none. */
        public final List<Long> groupIds;

        public RosterEntry(Long sessionId, Long classId, Long sectionId) {
            this(sessionId, classId, sectionId, java.util.Collections.<Long>emptyList());
        }

        public RosterEntry(Long sessionId, Long classId, Long sectionId, List<Long> groupIds) {
            this.sessionId = sessionId;
            this.classId = classId;
            this.sectionId = sectionId;
            this.groupIds = groupIds == null ? java.util.Collections.<Long>emptyList() : groupIds;
        }
    }

    private ScopeLattice() {}

    /**
     * Build the scope list for one institute+assessment.
     *
     * @param assessmentId the assessment being released
     * @param roster       one entry per scoreable student; entries with a null
     *                     dimension simply do not contribute a scope at that level
     * @param groupIds     groups that have at least one scoreable student
     * @return scopes in generation order, institute first so the most-viewed scope
     *         lands earliest and a partially-finished release is still useful
     */
    public static List<ScopeKey> build(Long assessmentId,
                                       List<RosterEntry> roster,
                                       Set<Long> groupIds) {
        List<ScopeKey> scopes = new ArrayList<>();
        scopes.add(ScopeKey.institute(assessmentId));

        Set<Long> sessions = new LinkedHashSet<>();
        // session -> class -> sections, preserving encounter order for stable output
        Map<Long, Map<Long, Set<Long>>> tree = new LinkedHashMap<>();

        for (RosterEntry e : roster) {
            if (e.sessionId == null) continue;
            sessions.add(e.sessionId);
            Map<Long, Set<Long>> classes = tree.computeIfAbsent(e.sessionId, k -> new LinkedHashMap<>());
            if (e.classId == null) continue;
            Set<Long> sections = classes.computeIfAbsent(e.classId, k -> new LinkedHashSet<>());
            if (e.sectionId != null) sections.add(e.sectionId);
        }

        for (Long sessionId : sessions) {
            scopes.add(ScopeKey.session(assessmentId, sessionId));

            Map<Long, Set<Long>> classes = tree.getOrDefault(sessionId, new LinkedHashMap<>());
            for (Map.Entry<Long, Set<Long>> ce : classes.entrySet()) {
                Long classId = ce.getKey();
                scopes.add(ScopeKey.ofClass(assessmentId, sessionId, classId));

                Set<Long> sections = ce.getValue();
                // A single populated section has the same membership as its class —
                // generating both would bill OpenAI twice for one cohort.
                if (sections.size() <= 1) continue;
                for (Long sectionId : sections) {
                    scopes.add(ScopeKey.section(assessmentId, sessionId, classId, sectionId));
                }
            }
        }

        if (groupIds != null) {
            for (Long groupId : groupIds) {
                scopes.add(ScopeKey.group(assessmentId, groupId));
            }
        }

        return scopes;
    }

    /**
     * How many scopes a Release would generate, without building them. Used by the
     * confirmation dialog so the admin is told the size of what they are about to
     * trigger before they trigger it.
     */
    public static int size(Long assessmentId, List<RosterEntry> roster, Set<Long> groupIds) {
        return build(assessmentId, roster, groupIds).size();
    }

    /**
     * Every combination, not just the lattice — "Release All".
     *
     * <p>Where {@link #build} deliberately keeps the levels additive, this generates
     * every combination of bound and unbound dimensions: session alone, class alone,
     * class without its session, group crossed with a section, and so on. Each student
     * position contributes up to 2<sup>4</sup> masks over (session, class, section,
     * group), deduplicated across the roster.
     *
     * <p>It stays populated-only — a mask is emitted only because some real student
     * sits at that intersection — so it is bounded by the data rather than by the
     * product of the lookup tables. That bound is still much larger than the lattice's:
     * the additive ~25 becomes a multiplicative figure that grows with how many
     * distinct positions the school actually has, and every one of them is an OpenAI
     * call. The caller is expected to show the count before spending it.
     */
    public static List<ScopeKey> buildFull(Long assessmentId, List<RosterEntry> roster) {
        // LinkedHashSet: dedup across students, stable order for reproducible releases.
        Set<ScopeKey> scopes = new LinkedHashSet<>();
        scopes.add(ScopeKey.institute(assessmentId));

        for (RosterEntry e : roster) {
            // A student in no group still contributes their session/class/section
            // combinations, with the group dimension left unbound.
            List<Long> groups = e.groupIds.isEmpty()
                    ? java.util.Collections.<Long>singletonList(null)
                    : new ArrayList<>(e.groupIds);
            if (!e.groupIds.isEmpty()) groups.add(null);

            for (Long groupId : groups) {
                // 4 dimensions, so 16 masks; bit set = that dimension is bound.
                for (int mask = 0; mask < 16; mask++) {
                    Long s = (mask & 1) != 0 ? e.sessionId : null;
                    Long c = (mask & 2) != 0 ? e.classId : null;
                    Long x = (mask & 4) != 0 ? e.sectionId : null;
                    Long g = (mask & 8) != 0 ? groupId : null;

                    // A mask that binds a dimension the student has no value for would
                    // describe a scope they are not actually in.
                    if ((mask & 1) != 0 && s == null) continue;
                    if ((mask & 2) != 0 && c == null) continue;
                    if ((mask & 4) != 0 && x == null) continue;
                    if ((mask & 8) != 0 && g == null) continue;

                    scopes.add(ScopeKey.of(assessmentId, s, c, x, g));
                }
            }
        }
        return new ArrayList<>(scopes);
    }
}
