package com.kccitm.api.config;

import com.kccitm.api.service.AssessmentSessionService;
import com.kccitm.api.model.career9.AssessmentSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * HandlerInterceptor that validates assessment session tokens.
 * Reads X-Assessment-Session header and validates against Redis.
 * Backwards compatible: requests without the header pass through.
 */
@Component
public class AssessmentSessionInterceptor implements HandlerInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentSessionInterceptor.class);

    @Autowired
    private AssessmentSessionService sessionService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {

        String sessionToken = request.getHeader("X-Assessment-Session");

        // No header = pass through (backwards compatible)
        if (sessionToken == null || sessionToken.isEmpty()) {
            return true;
        }

        String studentIdHeader = request.getHeader("X-Assessment-Student-Id");
        String assessmentIdHeader = request.getHeader("X-Assessment-Id");

        // Can't validate without IDs — pass through
        if (studentIdHeader == null || studentIdHeader.isEmpty()
                || assessmentIdHeader == null || assessmentIdHeader.isEmpty()) {
            return true;
        }

        Long studentId;
        Long assessmentId;
        try {
            studentId = Long.parseLong(studentIdHeader);
            assessmentId = Long.parseLong(assessmentIdHeader);
        } catch (NumberFormatException e) {
            // Invalid IDs — pass through
            return true;
        }

        AssessmentSession session = sessionService.validateSession(studentId, assessmentId, sessionToken);

        if (session == null) {
            logger.warn("Invalid or expired assessment session for student={} assessment={}", studentId, assessmentId);
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Invalid or expired assessment session\"}");
            return false;
        }

        // Store validated session as request attribute for downstream use
        request.setAttribute("assessmentSession", session);
        return true;
    }
}
