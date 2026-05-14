package com.kccitm.api.security.access;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

/**
 * Prunes the cached admin-dashboard snapshot down to the rows visible to the
 * caller's {@link AccessScope}. The snapshot is computed once globally and
 * cached for 24h ({@code DashboardSnapshotService}); this filter runs in-memory
 * on every request so a single cached payload still serves N callers with
 * different access scopes.
 *
 * <p>Lists handled (the 8 keys produced by {@code DashboardSnapshotService.compute}):
 * <ul>
 *   <li>{@code students}, {@code studentMappings} — filtered by institute +
 *       optional session/class/section. {@code StudentInfo} carries
 *       {@code instituteId}, {@code sessionId}, {@code courseCode},
 *       {@code schoolSectionId} which we read as the four ABAC dims.</li>
 *   <li>{@code institutes} — filtered to the user's mapped institute set.</li>
 *   <li>{@code counsellors}, {@code appointments}, {@code ratingSummary},
 *       {@code assessments}, {@code reports} — left intact. These are either
 *       global catalogs or aggregates without per-row institute attribution,
 *       and the ContactPerson scope model doesn't cleanly slice them. Can be
 *       extended if/when those entities grow institute scoping.</li>
 * </ul>
 *
 * <p>Note on {@code courseCode} vs {@code classId}: {@code StudentInfo.courseCode}
 * historically maps to the Career-9 course catalog, not to {@code SchoolClasses.id}
 * (which is what {@code ContactPersonAccessLevel.classId} stores). When the
 * two id-spaces coincide, the class-level filter narrows correctly; when they
 * don't, the rule's class predicate falls back to "matches" so the institute
 * filter is still effective. Section semantics align ({@code schoolSectionId}
 * is also the {@code SchoolSections.id}).
 */
@Component
public class DashboardSnapshotFilter {

    private static final List<String> STUDENT_LIST_KEYS = Arrays.asList("students", "studentMappings");
    private static final String INSTITUTES_KEY = "institutes";

    /**
     * Return a new payload Map with student/institute lists narrowed to what
     * the scope allows. If the scope is empty (user has no mappings), every
     * filtered list comes back empty — matches the deny-by-default semantics
     * the controller agreed to.
     */
    public Map<String, Object> filter(Map<String, Object> snapshot, AccessScope scope) {
        if (snapshot == null) return Collections.<String, Object>emptyMap();
        if (scope == null) return snapshot;

        Map<String, Object> out = new LinkedHashMap<>(snapshot);

        for (String key : STUDENT_LIST_KEYS) {
            Object raw = out.get(key);
            if (raw instanceof List<?>) {
                out.put(key, filterStudents((List<?>) raw, scope));
            }
        }

        Object rawInstitutes = out.get(INSTITUTES_KEY);
        if (rawInstitutes instanceof List<?>) {
            out.put(INSTITUTES_KEY, filterInstitutes((List<?>) rawInstitutes, scope));
        }

        // Stamp the scope summary so the FE can show "showing N institutes / M students"
        // without re-deriving the math. Keeps debugging easier too.
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("allowedInstituteCodes", new ArrayList<>(scope.getAllowedInstituteCodes()));
        meta.put("ruleCount", scope.getRules().size());
        out.put("__accessScope", meta);

        return out;
    }

    private List<Object> filterStudents(List<?> students, AccessScope scope) {
        List<Object> kept = new ArrayList<>();
        for (Object item : students) {
            if (!(item instanceof Map<?, ?>)) continue;
            @SuppressWarnings("unchecked")
            Map<String, Object> row = (Map<String, Object>) item;

            Integer instituteCode = asInt(row.get("instituteId"));
            // studentMappings shape may use "instituteCode" instead of "instituteId"
            if (instituteCode == null) instituteCode = asInt(row.get("instituteCode"));
            Integer sessionId = asInt(row.get("sessionId"));
            Integer classId = asInt(row.get("courseCode"));
            Integer sectionId = asInt(row.get("schoolSectionId"));
            if (sectionId == null) sectionId = asInt(row.get("sectionId"));

            if (scope.allows(instituteCode, sessionId, classId, sectionId)) {
                kept.add(item);
            }
        }
        return kept;
    }

    private List<Object> filterInstitutes(List<?> institutes, AccessScope scope) {
        List<Object> kept = new ArrayList<>();
        for (Object item : institutes) {
            if (!(item instanceof Map<?, ?>)) continue;
            @SuppressWarnings("unchecked")
            Map<String, Object> row = (Map<String, Object>) item;
            Integer code = asInt(row.get("instituteCode"));
            if (code != null && scope.getAllowedInstituteCodes().contains(code)) {
                kept.add(item);
            }
        }
        return kept;
    }

    /**
     * Jackson's Map round-trip may produce Integer, Long, or numeric String for
     * what was originally an int field. Normalize to Integer (or null).
     */
    private static Integer asInt(Object v) {
        if (v == null) return null;
        if (v instanceof Integer) return (Integer) v;
        if (v instanceof Number) return ((Number) v).intValue();
        if (v instanceof String) {
            String s = ((String) v).trim();
            if (s.isEmpty()) return null;
            try {
                return Integer.parseInt(s);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
