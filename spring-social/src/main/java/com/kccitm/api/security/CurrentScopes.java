package com.kccitm.api.security;

import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Per-request holder for the caller's effective scope rows. Populated by
 * {@link TokenAuthenticationFilter} from the JWT {@code scopes[]} claim, stored
 * on {@link UserPrincipal#getScopes()}, and consulted by
 * {@link AuthorizationService} when an endpoint's {@code @PreAuthorize} supplies
 * the 4-dim ABAC arguments.
 *
 * <p>Each {@link ScopeRow} carries four optional dimensions using the short JWT
 * keys ({@code i}/{@code s}/{@code c}/{@code x}) for institute, session, course,
 * and section. {@code null} on any dimension means wildcard ("all values within
 * the parent").
 *
 * <p>The class is a plain POJO (not a Spring bean). One instance per request is
 * constructed by the auth filter; it is read-only after construction.
 *
 * <p>Naming note: Phase 14's redesign attaches scope rows to each role-assignment
 * via {@code user_role_scope} (not to a user globally) — but at runtime, after
 * the filter has resolved permissions and flattened scope rows from all of the
 * caller's role-assignments, the principal carries a single combined list. This
 * class represents that combined view.
 */
public class CurrentScopes {

    /** HTTP request-attribute key for stashing the current-request scope holder. */
    public static final String REQUEST_ATTR = "currentScopes";

    /**
     * A single ABAC scope row using the compact JWT field names.
     *
     * <p>Field semantics:
     * <ul>
     *   <li>{@code i} = institute id (nullable = wildcard across all institutes)</li>
     *   <li>{@code s} = session id (nullable = wildcard across all sessions)</li>
     *   <li>{@code c} = course/class code (nullable = wildcard across all classes)</li>
     *   <li>{@code x} = section id (nullable = wildcard across all sections)</li>
     * </ul>
     */
    public static class ScopeRow {
        public final Integer i; // institute id (nullable = wildcard)
        public final Integer s; // session id (nullable = wildcard)
        public final Integer c; // course / class code (nullable = wildcard)
        public final Long    x; // section id (nullable = wildcard)

        public ScopeRow(Integer i, Integer s, Integer c, Long x) {
            this.i = i;
            this.s = s;
            this.c = c;
            this.x = x;
        }

        /**
         * Does this scope row authorize the given target tuple?
         *
         * <p>Containment semantics: every non-null dim on the row must equal the
         * corresponding target dim. A null dim on the row is wildcard and matches
         * any target value (including null). A null target dim against a non-null
         * row dim does NOT match — the row is more specific than the request, so
         * authorization fails.
         */
        public boolean matches(Integer ti, Integer ts, Integer tc, Long tx) {
            return (i == null || Objects.equals(i, ti))
                && (s == null || Objects.equals(s, ts))
                && (c == null || Objects.equals(c, tc))
                && (x == null || Objects.equals(x, tx));
        }
    }

    private final List<ScopeRow> rows;

    public CurrentScopes(List<ScopeRow> rows) {
        this.rows = rows == null ? Collections.<ScopeRow>emptyList() : rows;
    }

    public List<ScopeRow> rows() {
        return rows;
    }

    /** True iff at least one stored scope row matches the requested target tuple. */
    public boolean anyMatch(Integer i, Integer s, Integer c, Long x) {
        for (ScopeRow r : rows) {
            if (r.matches(i, s, c, x)) {
                return true;
            }
        }
        return false;
    }
}
