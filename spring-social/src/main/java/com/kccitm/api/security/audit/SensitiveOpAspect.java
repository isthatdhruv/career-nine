package com.kccitm.api.security.audit;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.AuthAuditService;

/**
 * Spring AOP {@code @Around} advice that intercepts every method annotated
 * with {@link SensitiveOp} and writes one {@code auth_audit} row per
 * invocation (ALLOW on success, DENY on exception).
 *
 * <p>Closes the audit gap left by Phase 15-06: that plan's
 * {@code AuthorizationService.recordAndReturn(...)} only writes a DENY row
 * when policy blocks. Legitimate (ALLOW) actions and exception-driven failures
 * inside the method body went unrecorded. After this aspect ships, every
 * {@code @SensitiveOp}-marked method writes exactly one row, whether it
 * succeeded or threw — closing ROADMAP Phase 20 criterion #4.
 *
 * <p>The advice ALWAYS rethrows the original exception unchanged on the DENY
 * path so business behavior is unaffected. The audit-write path itself is
 * defensive: an exception from {@code AuthAuditService} is swallowed and
 * logged at WARN — a broken audit pipeline MUST NEVER fail the business op.
 *
 * <p>Spring Boot's {@code spring-boot-starter-aop} auto-config enables
 * {@code @EnableAspectJAutoProxy} so this aspect is picked up automatically
 * from {@code @Component} scanning.
 */
@Aspect
@Component
public class SensitiveOpAspect {

    private static final Logger log = LoggerFactory.getLogger(SensitiveOpAspect.class);
    private static final int REASON_MAX = 200;

    @Autowired(required = false)
    private AuthAuditService authAuditService;

    @Around("@annotation(sensitiveOp)")
    public Object aroundSensitive(ProceedingJoinPoint pjp, SensitiveOp sensitiveOp) throws Throwable {
        String permission = sensitiveOp.value();
        Long userId = currentUserId();
        String requestId = MDC.get("requestId");

        try {
            Object result = pjp.proceed();
            recordSafe(userId, permission, "ALLOW", null, requestId);
            return result;
        } catch (Throwable ex) {
            String reason = ex.getClass().getSimpleName()
                    + (ex.getMessage() != null ? ": " + truncate(ex.getMessage(), REASON_MAX) : "");
            recordSafe(userId, permission, "DENY", reason, requestId);
            throw ex;
        }
    }

    private void recordSafe(Long userId, String permission, String decision, String reason, String requestId) {
        if (authAuditService == null) {
            // Defensive: should not happen — AuthAuditServiceImpl (15-06) or
            // AuthAuditServiceJdbcDefault (20-02 fallback) is always present.
            log.warn("AUDIT_SKIPPED (no AuthAuditService bean) perm={} decision={} userId={}",
                    permission, decision, userId);
            return;
        }
        try {
            authAuditService.recordSensitiveOp(userId, permission, decision, reason, requestId);
        } catch (Throwable t) {
            // NEVER let an audit failure fail the business operation.
            log.warn("AUDIT_WRITE_FAILED perm={} decision={} userId={} err={}",
                    permission, decision, userId, t.toString());
        }
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal)) {
            return null;
        }
        return ((UserPrincipal) auth.getPrincipal()).getId();
    }

    private String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }
}
