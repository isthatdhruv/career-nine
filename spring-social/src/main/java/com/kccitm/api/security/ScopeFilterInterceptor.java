package com.kccitm.api.security;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.hibernate.Filter;
import org.hibernate.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Phase 15-06 — per-request Hibernate filter enable/disable for the
 * {@code scopeFilter} declared on {@link com.kccitm.api.model.career9.StudentInfo}.
 *
 * <p>On every request that reaches a controller:
 * <ol>
 *   <li>Reads {@link UserPrincipal#getScopes()} (populated by
 *       {@link TokenAuthenticationFilter} from the JWT {@code scopes[]} claim).</li>
 *   <li>Aggregates per-dimension target id sets across all scope rows.</li>
 *   <li>If the caller is super-admin OR every dimension is wildcard, SKIPS
 *       filter enablement (the caller sees all rows).</li>
 *   <li>Otherwise enables {@code scopeFilter} on the current Hibernate Session
 *       and binds the four parameter lists.</li>
 *   <li>In {@code afterCompletion} disables the filter so the pooled
 *       persistence context doesn't carry it into the next request.</li>
 * </ol>
 *
 * <p>Idempotent — a request-attribute flag prevents double-enable if the
 * interceptor is invoked twice for the same request (e.g., via forwarding).
 *
 * <p>Sentinel pattern: Hibernate's {@code setParameterList} throws on empty
 * collections; for dimensions where the caller has no specific scope grants,
 * we pass {@code Integer.MIN_VALUE} / {@code Long.MIN_VALUE} as a sentinel
 * that won't match any real id. Combined with the {@code OR col IS NULL}
 * carve-out in each {@code @Filter.condition}, wildcard-data (rows with NULL
 * institute / session / etc.) remains visible.
 */
@Component
public class ScopeFilterInterceptor implements HandlerInterceptor {
    private static final Logger log = LoggerFactory.getLogger(ScopeFilterInterceptor.class);
    private static final String ATTR_ENABLED = "scopeFilter.enabled";

    /** Sentinel "match-nothing" value used when a dimension has no specific grant. */
    private static final Integer NONE_INT = Integer.MIN_VALUE;
    private static final Long NONE_LONG = Long.MIN_VALUE;

    @PersistenceContext
    private EntityManager em;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (Boolean.TRUE.equals(request.getAttribute(ATTR_ENABLED))) {
            return true; // idempotent
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal)) {
            return true; // anonymous request — no filter (and no rows that need it)
        }
        UserPrincipal up = (UserPrincipal) auth.getPrincipal();

        if (up.isSuperAdmin()) {
            log.debug("scopeFilter skipped (super-admin) for user={}", up.getId());
            return true;
        }

        Set<Integer> instituteIds = new HashSet<Integer>();
        Set<Integer> sessionIds   = new HashSet<Integer>();
        Set<Integer> courseCodes  = new HashSet<Integer>();
        Set<Long>    sectionIds   = new HashSet<Long>();
        boolean anyWildcardInstitute = false, anyWildcardSession = false,
                anyWildcardCourse = false, anyWildcardSection = false;

        if (up.getScopes() != null) {
            for (CurrentScopes.ScopeRow r : up.getScopes()) {
                if (r.i == null) anyWildcardInstitute = true; else instituteIds.add(r.i);
                if (r.s == null) anyWildcardSession   = true; else sessionIds.add(r.s);
                if (r.c == null) anyWildcardCourse    = true; else courseCodes.add(r.c);
                if (r.x == null) anyWildcardSection   = true; else sectionIds.add(r.x);
            }
        }

        // Full wildcard across every dim → effectively super-admin reach; skip filter.
        if (anyWildcardInstitute && anyWildcardSession && anyWildcardCourse && anyWildcardSection) {
            log.debug("scopeFilter skipped (full wildcard) for user={}", up.getId());
            return true;
        }

        try {
            Session session = em.unwrap(Session.class);
            Filter f = session.enableFilter("scopeFilter");
            f.setParameterList("instituteIds",
                    instituteIds.isEmpty() ? Collections.singleton(NONE_INT) : instituteIds);
            f.setParameterList("sessionIds",
                    sessionIds.isEmpty()   ? Collections.singleton(NONE_INT) : sessionIds);
            f.setParameterList("courseCodes",
                    courseCodes.isEmpty()  ? Collections.singleton(NONE_INT) : courseCodes);
            f.setParameterList("sectionIds",
                    sectionIds.isEmpty()   ? Collections.singleton(NONE_LONG) : sectionIds);

            request.setAttribute(ATTR_ENABLED, Boolean.TRUE);
            log.debug("scopeFilter enabled for user={} institutes={} sessions={} courses={} sections={}",
                    up.getId(), instituteIds, sessionIds, courseCodes, sectionIds);
        } catch (Exception e) {
            log.warn("Failed to enable scopeFilter (will pass-through unfiltered): {}", e.getMessage());
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        if (!Boolean.TRUE.equals(request.getAttribute(ATTR_ENABLED))) {
            return;
        }
        try {
            Session session = em.unwrap(Session.class);
            session.disableFilter("scopeFilter");
        } catch (Exception e) {
            log.warn("Failed to disable scopeFilter post-request: {}", e.getMessage());
        }
    }
}
