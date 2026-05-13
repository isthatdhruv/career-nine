package com.kccitm.api.security.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a method as a sensitive operation. The {@code SensitiveOpAspect} writes
 * one {@code auth_audit} row per invocation — {@code ALLOW} on success, {@code DENY}
 * on exception — so every privileged change is observable in a single SELECT.
 *
 * <p>Phase 15-06 owns the DENY-on-policy-block half of the auth audit pipeline
 * (driven from {@code AuthorizationService.recordAndReturn}). This annotation
 * complements that by capturing successful privileged actions plus
 * exception-driven denials at the method-call seam — closing the audit gap
 * documented in ROADMAP Phase 20 criterion #4.
 *
 * <h2>Where to place this annotation</h2>
 * <p>Prefer SERVICE methods over controllers. Spring AOP proxies only the
 * call from a caller to a Spring-managed bean — controller-only annotation
 * is skipped when one service calls another internally (no proxy on a same-bean
 * private call). Service-method annotations fire regardless of how the call
 * arrives (HTTP, scheduler, internal caller).
 *
 * <p>EXCEPTION: when no service layer exists for an operation (e.g.,
 * role-mapping today), the annotation may temporarily live on a controller
 * method. Migrate to the service layer when one is introduced. As of Plan
 * 20-02 the controller-level placement applies to:
 * {@code UserRoleGroupMappingController} ({@code role.assign}) — Plan 15-06
 * (or a follow-up) will relocate the annotation once it introduces a
 * {@code UserRoleGroupMappingService}.
 *
 * <h2>Operation codes</h2>
 * <p>Must match the Phase 14 {@code PermissionCode} enum where overlapping:
 * <ul>
 *   <li>{@code "role.assign"}      — assigning/revoking a role-group to/from a user</li>
 *   <li>{@code "user.write"}       — create/update/delete on the {@code User} entity</li>
 *   <li>{@code "payment.refund"}   — initiating a Razorpay refund (or, today, the
 *       closest payment-write surface — see "Wired today" below)</li>
 *   <li>{@code "permission.grant"} — granting a permission to a role</li>
 * </ul>
 *
 * <h2>Wired today (Plan 20-02 ship state)</h2>
 * <ul>
 *   <li>{@code user.write}       — {@code UserService} mutation method.</li>
 *   <li>{@code role.assign}      — {@code UserRoleGroupMappingController} mutation
 *       methods. No service layer exists for role-mapping today; the annotation
 *       lives on the controller and migrates to the service when one is built.</li>
 *   <li>{@code payment.refund}   — {@code RazorpayService}. Priority-ordered
 *       fallback per Plan 20-02 Task 2 Step B: {@code refund*} → {@code markPaid}/
 *       {@code processWebhookEvent} → {@code createPaymentLink}. Today only
 *       {@code createPaymentLink} exists; the annotation lives there with a TODO
 *       to migrate when a real refund method ships.</li>
 * </ul>
 *
 * <h2>Pending wiring</h2>
 * <ul>
 *   <li>{@code permission.grant} — DEFERRED to Plan 15-06 (or follow-up). No
 *       permission-mutation method exists today; Phase 14 ships the
 *       {@code role_permission} table, the service layer that owns
 *       {@code @SensitiveOp("permission.grant")} has not yet been written.
 *       Failure to land this annotation by Phase 20's exit gate leaves ROADMAP
 *       Phase 20 success criterion #4 partially unsatisfied.</li>
 * </ul>
 *
 * <h2>Visibility caveat</h2>
 * <p>Spring AOP proxies only public methods of Spring-managed beans. Placing
 * this annotation on a {@code private} or package-private method results in a
 * silent no-op — the aspect will not fire.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface SensitiveOp {
    String value();
}
