package com.kccitm.api.security;

import javax.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.kccitm.api.service.AuthAuditService;

/**
 * Centralized authorization primitive — exposed as Spring bean {@code @auth} so
 * controller methods can write {@code @PreAuthorize("@auth.allows('student.read',
 * #instituteId, #sessionId, #courseCode, #sectionId)")}.
 *
 * <p>Phase 15 ships in <strong>log-only mode</strong>:
 * {@link #allows(String, Integer, Integer, Integer, Long)} computes the policy
 * decision, records DENYs to {@code auth_audit} (once Plan 15-06 wires the
 * service), and always returns {@code true}. The flip to enforcing is Phase 17.
 * The {@code auth.enforce-mode} property is the single switch — set
 * {@code AUTH_ENFORCE_MODE=enforce} in production to flip.
 *
 * <p>Scope rows are queried via
 * {@link com.kccitm.api.repository.UserRoleScopeRepository#findAllByUserId(Long)}
 * — the post-Phase-14 rename: scope attaches to each role-assignment, not to the
 * user globally. {@code AuthorizationService} sees the flattened view via
 * {@link UserPrincipal#getScopes()} which the auth filter hydrates from the JWT.
 *
 * <p>Decision logic:
 * <ol>
 *   <li>No authenticated principal → record {@code ANONYMOUS} deny.</li>
 *   <li>Principal is super-admin → return {@code true} (no audit row).</li>
 *   <li>Principal lacks the permission code → record {@code PERM_MISSING} deny.</li>
 *   <li>No scope arguments supplied → permission alone is sufficient.</li>
 *   <li>Scope arguments supplied but no row matches → record {@code SCOPE_MISMATCH} deny.</li>
 *   <li>Otherwise → allow.</li>
 * </ol>
 *
 * <p>In log-only mode every deny path still falls through to {@code return true}
 * after recording, so unauthorized callers see HTTP 200 with normal payloads
 * (the goal — fail loud in audit logs without breaking traffic during rollout).
 */
@Service("auth")
public class AuthorizationService {

    private static final Logger log = LoggerFactory.getLogger(AuthorizationService.class);

    @Value("${auth.enforce-mode:log-only}")
    private String enforceMode;

    /**
     * Plan 15-06 ships the real audit-recording implementation. Until then the
     * bean is absent and we fall back to WARN-level log lines.
     */
    @Autowired(required = false)
    private AuthAuditService authAuditService;

    @Autowired(required = false)
    private com.kccitm.api.repository.Career9.UserStudentRepository userStudentRepository;

    /**
     * Resolve the institute_code of a student (by {@code userStudentId}) so student-facing
     * endpoints can ABAC-scope on the <em>resource's</em> institute rather than misusing the
     * student id as an institute id. Used from {@code @PreAuthorize} as
     * {@code @auth.allows('perm', @auth.instituteOfStudent(#userStudentId))}.
     *
     * <p>Returns {@code null} when the student is unknown or has no institute (B2C campaign
     * students) — null means "no institute dim bound", i.e. permission alone decides, which is
     * correct since B2C students are wildcard-scoped.
     */
    public Integer instituteOfStudent(Long userStudentId) {
        if (userStudentId == null || userStudentRepository == null) {
            return null;
        }
        return userStudentRepository.findById(userStudentId)
                .map(us -> us.getInstitute() == null ? null : us.getInstitute().getInstituteCode())
                .orElse(null);
    }

    /** No-scope endpoints (e.g., {@code GET /user/me}, {@code POST /auth/logout}). */
    public boolean allows(String permission) {
        return decide(permission, null, null, null, null);
    }

    /**
     * Institute-scoped endpoint convenience overload. Equivalent to
     * {@code allows(perm, instituteId, null, null, null)}. Exists because
     * Spring SpEL resolves overloads by exact arity, so writing
     * {@code @auth.allows('x', #instituteId)} requires a (String, Integer)
     * method to bind to. ~26 controller annotations rely on this shape.
     */
    public boolean allows(String permission, Integer instituteId) {
        return decide(permission, instituteId, null, null, null);
    }

    /**
     * Institute + session scoped convenience overload — same SpEL arity
     * rationale as {@link #allows(String, Integer)}. ~10 controller
     * annotations use this shape.
     */
    public boolean allows(String permission, Integer instituteId, Integer sessionId) {
        return decide(permission, instituteId, sessionId, null, null);
    }

    /**
     * 4-dim ABAC endpoint. Any of {@code instituteId}, {@code sessionId},
     * {@code courseCode}, {@code sectionId} may be {@code null}; a null target
     * dim means "the request did not bind this dim" and authorization succeeds
     * iff the caller's scope row is also null at that dim or the caller has a
     * wildcard row.
     */
    public boolean allows(String permission, Integer instituteId, Integer sessionId,
                          Integer courseCode, Long sectionId) {
        return decide(permission, instituteId, sessionId, courseCode, sectionId);
    }

    private boolean decide(String permission, Integer i, Integer s, Integer c, Long x) {
        UserPrincipal principal = currentPrincipal();
        if (principal == null) {
            return recordAndReturn(false, "ANONYMOUS", permission, i, s, c, x, null);
        }

        if (principal.isSuperAdmin()) {
            // Super-admin bypass — Phase 20's sensitive-op aspect audits these, not us.
            return true;
        }

        boolean hasPerm = principal.getPermissions() != null
                && principal.getPermissions().contains(permission);
        if (!hasPerm) {
            return recordAndReturn(false, "PERM_MISSING", permission, i, s, c, x, principal.getId());
        }

        // No scope args supplied → permission alone is sufficient (e.g., /user/me).
        if (i == null && s == null && c == null && x == null) {
            return true;
        }

        boolean scopeOk = principal.getScopes() != null
                && new CurrentScopes(principal.getScopes()).anyMatch(i, s, c, x);
        if (!scopeOk) {
            return recordAndReturn(false, "SCOPE_MISMATCH", permission, i, s, c, x, principal.getId());
        }
        return true;
    }

    /**
     * Record a DENY when the computed policy decision is {@code false}, then
     * collapse to {@code true} when running in log-only mode.
     */
    private boolean recordAndReturn(boolean policyDecision, String reason, String permission,
                                    Integer i, Integer s, Integer c, Long x, Long userId) {
        if (!policyDecision) {
            try {
                if (authAuditService != null) {
                    authAuditService.recordDeny(userId, permission, i, s, c, x, currentRequestId(), reason);
                } else {
                    log.warn("AUTH-DENY (no auditor): user={} perm={} scope=[i={},s={},c={},x={}] reason={}",
                            userId, permission, i, s, c, x, reason);
                }
            } catch (Exception ex) {
                log.error("AuthAuditService.recordDeny threw — swallowing in log-only mode", ex);
            }
        }
        return "enforce".equalsIgnoreCase(enforceMode) ? policyDecision : true;
    }

    private UserPrincipal currentPrincipal() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !(a.getPrincipal() instanceof UserPrincipal)) {
            return null;
        }
        return (UserPrincipal) a.getPrincipal();
    }

    /**
     * Best-effort correlation id pulled from the {@code X-Request-Id} header;
     * falls back to {@code "no-rid"} when no request is bound to the current
     * thread (e.g., in async handlers or scheduled tasks that somehow reach this
     * bean — neither path should but we degrade gracefully).
     */
    private String currentRequestId() {
        try {
            RequestAttributes ra = RequestContextHolder.getRequestAttributes();
            if (ra instanceof ServletRequestAttributes) {
                HttpServletRequest req = ((ServletRequestAttributes) ra).getRequest();
                String rid = req.getHeader("X-Request-Id");
                if (rid != null) {
                    return rid;
                }
            }
        } catch (Exception ignored) {
            // Fall through to default.
        }
        return "no-rid";
    }
}
