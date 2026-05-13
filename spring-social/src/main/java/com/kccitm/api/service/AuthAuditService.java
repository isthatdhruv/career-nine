package com.kccitm.api.service;

/**
 * Records authorization audit events to the {@code auth_audit} table.
 * Implementation: {@link AuthAuditServiceImpl}.
 *
 * <p>Two write paths are owned by this interface:
 * <ul>
 *   <li>{@link #recordDeny} — Phase 15-06. Called by
 *       {@link com.kccitm.api.security.AuthorizationService} from
 *       {@code recordAndReturn(...)} on every policy DENY (in both log-only and
 *       enforce modes).</li>
 *   <li>{@link #recordSensitiveOp} — Phase 20-02. Called by the
 *       {@link com.kccitm.api.security.audit.SensitiveOpAspect} after every
 *       {@code @SensitiveOp}-annotated method invocation (ALLOW on success,
 *       DENY on exception). Separate from {@code recordDeny} to avoid
 *       double-writing rows when both code paths fire on the same request.</li>
 * </ul>
 *
 * <p>The auth_audit DDL (Phase 14, V20260511001) stores the four scope dimensions
 * as a single encoded VARCHAR(128) column named {@code scope} — not as
 * four separate columns. {@link AuthAuditServiceImpl} encodes the
 * {@code (instituteId, sessionId, courseCode, sectionId)} tuple as
 * {@code "i=1,s=2026,c=3,x=4"} omitting null dimensions.
 */
public interface AuthAuditService {

    /**
     * Record a policy denial. Invoked from {@code AuthorizationService} when the
     * computed policy decision is {@code false} (missing permission or scope mismatch).
     *
     * @param userId      caller's user id (nullable for anonymous denials)
     * @param permission  permission code that was checked (e.g., {@code student.read})
     * @param instituteId target institute scope dimension (nullable wildcard)
     * @param sessionId   target session scope dimension (nullable wildcard)
     * @param courseCode  target course/class scope dimension (nullable wildcard)
     * @param sectionId   target section scope dimension (nullable wildcard)
     * @param requestId   correlation id for trace-back (e.g., {@code X-Request-Id} header)
     * @param reason      short tag describing why the policy denied — one of
     *                    {@code ANONYMOUS}, {@code PERM_MISSING}, {@code SCOPE_MISMATCH}
     */
    void recordDeny(Long userId,
                    String permission,
                    Integer instituteId,
                    Integer sessionId,
                    Integer courseCode,
                    Long sectionId,
                    String requestId,
                    String reason);

    /**
     * Record an audit event for a {@code @SensitiveOp}-annotated method invocation.
     * Phase 20-02 owns this method.
     *
     * <p>Writes one row with no scope/resource_id; the operation code is in
     * {@code permission} and the row distinguishes itself from {@link #recordDeny}
     * rows only by having a non-null {@code decision} of either {@code ALLOW} or
     * {@code DENY} written by this method (the policy-DENY path always uses
     * {@code "DENY"}; this method writes either, with {@code reason} carrying the
     * exception class+message on the DENY branch).
     *
     * <p>Implementations MUST swallow exceptions — audit-write failure must
     * never break the business operation.
     *
     * @param userId     caller's user id (nullable for anonymous)
     * @param permission operation code (e.g., {@code user.write}, {@code role.assign},
     *                   {@code payment.refund}, {@code permission.grant})
     * @param decision   {@code "ALLOW"} on success, {@code "DENY"} on exception
     * @param reason     null on ALLOW; exception class+message (truncated) on DENY
     * @param requestId  correlation id from MDC (nullable if no requestId is set)
     */
    void recordSensitiveOp(Long userId,
                           String permission,
                           String decision,
                           String reason,
                           String requestId);
}
