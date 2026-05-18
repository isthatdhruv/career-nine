package com.kccitm.api.security.access;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Translates an {@link AccessScope} into a JPQL {@code WHERE}-fragment + a
 * named-parameter map suitable for {@code EntityManager.createQuery(...)}.
 *
 * <p>Used by {@code DashboardDataService} so each scoped list query gets the
 * same predicate shape:
 *
 * <pre>{@code
 * StringBuilder jpql = new StringBuilder("SELECT si FROM StudentInfo si WHERE ");
 * Map<String, Object> params = new HashMap<>();
 * AccessScopeJpqlBuilder.appendScopePredicate(
 *     jpql, params, "s", scope,
 *     new Fields("si.instituteId", "si.sessionId", "si.courseCode", "si.schoolSectionId"));
 * TypedQuery<StudentInfo> q = em.createQuery(jpql.toString(), StudentInfo.class);
 * params.forEach(q::setParameter);
 * }</pre>
 *
 * <p>The generated predicate has two halves OR-ed together:
 *
 * <ul>
 *   <li><b>Full-access institutes</b> — institutes the user is mapped to with
 *       <em>no</em> attached {@code ContactPersonAccessLevel} rows. Matches via
 *       {@code <instituteField> IN :prefix_fullInstitutes}.</li>
 *   <li><b>Per-rule clauses</b> — one clause per {@link AccessScope.Rule}.
 *       Each rule's clause ANDs together the dimensions it constrains and
 *       skips the dimensions that are {@code null} (wildcard).</li>
 * </ul>
 *
 * <p>If the scope is empty (no institutes), {@link #appendScopePredicate} emits
 * {@code 1 = 0} so the query returns nothing — the deny-by-default branch.
 */
public final class AccessScopeJpqlBuilder {

    private AccessScopeJpqlBuilder() {}

    /**
     * Field accessors as JPQL fragments (e.g., {@code "si.instituteId"}). For
     * dimensions the entity doesn't carry, pass {@code null} and the predicate
     * silently skips that dim across all rules (treats it as wildcard).
     */
    public static final class Fields {
        public final String instituteField;
        public final String sessionField;
        public final String classField;
        public final String sectionField;

        public Fields(String instituteField, String sessionField,
                      String classField, String sectionField) {
            this.instituteField = instituteField;
            this.sessionField = sessionField;
            this.classField = classField;
            this.sectionField = sectionField;
        }

        /** Convenience: only the institute dim (for entities like InstituteDetail). */
        public static Fields instituteOnly(String instituteField) {
            return new Fields(instituteField, null, null, null);
        }
    }

    /**
     * Append the scope predicate (parenthesized) to {@code jpql} and register
     * the params in {@code params}. Caller decides whether to wrap in
     * {@code AND}/{@code OR} with surrounding context.
     *
     * @param jpql       the buffer to append to
     * @param params     the parameter map to populate; keys are prefixed
     *                   {@code <paramPrefix>_...} so multiple builders can run
     *                   against the same query without collision
     * @param paramPrefix unique per query (e.g., {@code "s"} for students,
     *                    {@code "a"} for appointments)
     * @param scope      the user's scope; never null
     * @param fields     where the four dimensions live on the entity being queried
     */
    public static void appendScopePredicate(StringBuilder jpql,
                                            Map<String, Object> params,
                                            String paramPrefix,
                                            AccessScope scope,
                                            Fields fields) {
        if (scope == null || scope.isEmpty()) {
            jpql.append("(1 = 0)");
            return;
        }
        if (fields.instituteField == null) {
            throw new IllegalArgumentException(
                    "Fields.instituteField is required — every scope predicate hinges on the institute dim");
        }

        // Partition institutes into "full access" (no rules under them) and
        // "rule-bounded" (rules exist).
        Set<Integer> ruleInstitutes = new HashSet<>();
        for (AccessScope.Rule r : scope.getRules()) {
            if (r.instituteCode != null) ruleInstitutes.add(r.instituteCode);
        }
        Set<Integer> fullAccess = new HashSet<>(scope.getAllowedInstituteCodes());
        fullAccess.removeAll(ruleInstitutes);

        jpql.append("(");
        boolean firstClause = true;

        if (!fullAccess.isEmpty()) {
            String key = paramPrefix + "_fullInstitutes";
            jpql.append(fields.instituteField).append(" IN :").append(key);
            params.put(key, fullAccess);
            firstClause = false;
        }

        int i = 0;
        for (AccessScope.Rule r : scope.getRules()) {
            if (r.instituteCode == null) continue;
            if (!firstClause) jpql.append(" OR ");
            firstClause = false;

            jpql.append("(");
            String iKey = paramPrefix + "_r" + i + "_inst";
            jpql.append(fields.instituteField).append(" = :").append(iKey);
            params.put(iKey, r.instituteCode);

            if (fields.sessionField != null && r.sessionId != null) {
                String sKey = paramPrefix + "_r" + i + "_sess";
                jpql.append(" AND ").append(fields.sessionField).append(" = :").append(sKey);
                params.put(sKey, r.sessionId);
            }
            if (fields.classField != null && r.classId != null) {
                String cKey = paramPrefix + "_r" + i + "_cls";
                jpql.append(" AND ").append(fields.classField).append(" = :").append(cKey);
                params.put(cKey, r.classId);
            }
            if (fields.sectionField != null && r.sectionId != null) {
                String xKey = paramPrefix + "_r" + i + "_sec";
                jpql.append(" AND ").append(fields.sectionField).append(" = :").append(xKey);
                params.put(xKey, r.sectionId);
            }
            jpql.append(")");
            i++;
        }

        // Edge case: scope has institutes but every rule had a null instituteCode
        // (shouldn't happen given AccessScopeService's construction, but guard
        // against it so we don't emit an empty parenthesized expression).
        if (firstClause) {
            jpql.append("1 = 0");
        }

        jpql.append(")");
    }
}
