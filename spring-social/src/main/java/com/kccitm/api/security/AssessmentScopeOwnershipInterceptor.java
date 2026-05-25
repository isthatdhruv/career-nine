package com.kccitm.api.security;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

/**
 * Phase 1 (Task 1.2 / audit CRIT-C + MED-H) — assessment-scoped token ownership guard.
 *
 * <p>The assessment-scoped JWT (scope="assessment", minted by {@code /auth/assessment-session} and
 * the pay-first flow) authenticates a SINGLE {@code (userStudentId, assessmentId)} pair.
 * {@link TokenAuthenticationFilter} surfaces that pair as the request attributes
 * {@code assessmentUserStudentId} / {@code assessmentAssessmentId} and installs a minimal
 * {@code Authentication} with NO authorities — so the {@code @PreAuthorize}/{@code @auth} gate
 * cannot tell "my data" from "another student's data". Several read/write endpoints on the
 * assessment-scope paths took the id straight from the path with no cross-check
 * (e.g. {@code /student-info/getDemographics/{id}},
 * {@code /student-demographics/contact-info/{id}}, proctoring / live-tracking by {@code {studentId}}),
 * letting any student iterate ids to read/overwrite other students' PII (CRIT-C) or proctoring
 * data (MED-H).
 *
 * <p>This interceptor centralises the cross-check: when an assessment-scoped token is present, any
 * path/query id that names the assessment-taker ({@code userStudentId} / {@code studentId}) MUST
 * equal the token's student id, and any {@code assessmentId} MUST equal the token's assessment id —
 * otherwise 403. New assessment-scope endpoints inherit the guard automatically.
 *
 * <p>Admin/staff principals (a full {@link UserPrincipal} via the {@code cn_at} cookie) never carry
 * the assessment attributes, so they are unaffected. Endpoints that carry the id only in the request
 * body (e.g. {@code /assessment-answer/submit}) are out of scope here and keep their existing
 * in-controller body check.
 */
@Component
public class AssessmentScopeOwnershipInterceptor implements HandlerInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentScopeOwnershipInterceptor.class);

    /** Path/query variable names that denote the assessment-taker (UserStudent id). */
    private static final List<String> STUDENT_ID_KEYS = Arrays.asList("userStudentId", "studentId");
    /** Path/query variable names that denote the assessment. */
    private static final List<String> ASSESSMENT_ID_KEYS = Arrays.asList("assessmentId");

    @Override
    @SuppressWarnings("unchecked")
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        Object tokenStudentObj = request.getAttribute("assessmentUserStudentId");
        // Only enforce for assessment-scoped tokens. No attribute => admin/staff/student session
        // (or anonymous) — authorization stays with the normal @auth path.
        if (tokenStudentObj == null) {
            return true;
        }
        Long tokenStudentId = toLong(tokenStudentObj);
        Long tokenAssessmentId = toLong(request.getAttribute("assessmentAssessmentId"));

        Map<String, String> uriVars = (Map<String, String>)
                request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);

        // The student id in the request (path first, then query) must match the token's student.
        for (String key : STUDENT_ID_KEYS) {
            Long requested = readId(uriVars, request, key);
            if (requested != null && !requested.equals(tokenStudentId)) {
                return deny(request, response, key, requested, tokenStudentId);
            }
        }
        // The assessment id (when the token carries one) must match too.
        if (tokenAssessmentId != null) {
            for (String key : ASSESSMENT_ID_KEYS) {
                Long requested = readId(uriVars, request, key);
                if (requested != null && !requested.equals(tokenAssessmentId)) {
                    return deny(request, response, key, requested, tokenAssessmentId);
                }
            }
        }
        return true;
    }

    /** Reads {@code key} from the URI template variables first, then the query string. */
    private Long readId(Map<String, String> uriVars, HttpServletRequest request, String key) {
        String raw = uriVars != null ? uriVars.get(key) : null;
        if (raw == null) {
            raw = request.getParameter(key);
        }
        if (raw == null || raw.trim().isEmpty()) {
            return null;
        }
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException e) {
            // Not a numeric id we can compare — let the controller validate/handle it.
            return null;
        }
    }

    private Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).longValue();
        try {
            return Long.parseLong(o.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private boolean deny(HttpServletRequest request, HttpServletResponse response,
                         String key, Long requested, Long allowed) throws IOException {
        logger.warn("Assessment-scope ownership violation: token allows={} but {}={} on uri={}",
                allowed, key, requested, request.getRequestURI());
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"status\":403,\"error\":\"Forbidden\","
                + "\"message\":\"This assessment session may only access its own data\"}");
        return false;
    }
}
