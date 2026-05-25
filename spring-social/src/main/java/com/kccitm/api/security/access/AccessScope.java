package com.kccitm.api.security.access;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Per-user view of "what institute/session/class/section combinations is this
 * user allowed to see?". Built by {@link AccessScopeService} from the user's
 * {@code ContactPerson} + {@code ContactPersonAccessLevel} rows.
 *
 * <p>Two layers:
 * <ul>
 *   <li>{@link #getAllowedInstituteCodes()} — the set of institutes the user
 *       is mapped to (from {@code ContactPerson.institute.instituteCode}).
 *       Used to short-circuit institute-level filtering.</li>
 *   <li>{@link #getRules()} — one or more {@link Rule}s per allowed institute.
 *       Each rule narrows by session/class/section. A {@code null} dimension
 *       in a rule means wildcard for that dimension. If an institute has zero
 *       rules under it, every row in that institute passes.</li>
 * </ul>
 *
 * <p>Helper {@link #allows(Integer, Integer, Integer, Integer)} returns true
 * iff at least one rule under the institute matches all the non-null target
 * dimensions. Mirror semantics of the backend {@code AuthorizationService}
 * predicate (a null on the user's side = wildcard, a null on the target side
 * = "this dim wasn't constrained" and matches everything).
 */
public class AccessScope {

    public static final class Rule {
        public final Integer instituteCode;
        public final Integer sessionId;
        public final Integer classId;
        public final Integer sectionId;

        public Rule(Integer instituteCode, Integer sessionId, Integer classId, Integer sectionId) {
            this.instituteCode = instituteCode;
            this.sessionId = sessionId;
            this.classId = classId;
            this.sectionId = sectionId;
        }
    }

    private final Set<Integer> allowedInstituteCodes;
    private final List<Rule> rules;

    public AccessScope(Set<Integer> allowedInstituteCodes, List<Rule> rules) {
        this.allowedInstituteCodes = allowedInstituteCodes == null
                ? Collections.<Integer>emptySet()
                : new HashSet<>(allowedInstituteCodes);
        this.rules = rules == null ? Collections.<Rule>emptyList() : new ArrayList<>(rules);
    }

    public static AccessScope empty() {
        return new AccessScope(Collections.<Integer>emptySet(), Collections.<Rule>emptyList());
    }

    public Set<Integer> getAllowedInstituteCodes() {
        return allowedInstituteCodes;
    }

    public List<Rule> getRules() {
        return rules;
    }

    public boolean isEmpty() {
        return allowedInstituteCodes.isEmpty();
    }

    /**
     * True iff {@code instituteCode} is allowed AND at least one access rule
     * under that institute matches the supplied session/class/section. Pass
     * {@code null} for a dim you don't want to constrain.
     */
    public boolean allows(Integer instituteCode, Integer sessionId, Integer classId, Integer sectionId) {
        if (instituteCode == null || !allowedInstituteCodes.contains(instituteCode)) {
            return false;
        }

        // If the institute has any rules attached, the target must match at least one.
        // If it has zero rules (i.e., contact person was mapped but had no access
        // levels added), every row in that institute passes — same semantics the
        // existing UI conveyed via the "No access levels defined ... no granular
        // access restrictions" message.
        boolean hasAnyRule = false;
        for (Rule r : rules) {
            if (!instituteCode.equals(r.instituteCode)) continue;
            hasAnyRule = true;
            if (dimMatches(r.sessionId, sessionId)
                    && dimMatches(r.classId, classId)
                    && dimMatches(r.sectionId, sectionId)) {
                return true;
            }
        }
        return !hasAnyRule;
    }

    /**
     * Wildcard predicate: {@code null} on the user's grant means "any value",
     * {@code null} on the target side means "this dim wasn't bound" (also OK).
     */
    private static boolean dimMatches(Integer ruleDim, Integer targetDim) {
        if (ruleDim == null) return true;
        if (targetDim == null) return true;
        return ruleDim.equals(targetDim);
    }
}
