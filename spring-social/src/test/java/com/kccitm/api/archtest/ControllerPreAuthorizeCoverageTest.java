package com.kccitm.api.archtest;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.annotation.Annotation;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.fail;

/**
 * Ensures every controller mapping method carries {@link PreAuthorize}.
 *
 * <p>Enabled in Plan 15-06 after Plans 15-03/04/05 annotated every controller.
 * Plan 15-02 shipped this class with {@code @Disabled} so it would not break CI
 * while parallel waves were in flight; that annotation was removed when
 * Plan 15-06 reconciled the EXCLUSIONS list against actual method names.
 *
 * <p>Adding a new endpoint? Always include {@code @PreAuthorize}. If the
 * endpoint must be anonymous (rare), add it to the {@link #EXCLUSIONS} set
 * with a one-line justification.
 *
 * <p>The test is intentionally a build-time invariant — it is independent of
 * the runtime enforcement mode (LOG-ONLY vs ENFORCE). It guarantees the
 * annotations are <em>present</em>; whether they are <em>enforced</em> at
 * runtime is a separate concern owned by {@code SecurityConfig} /
 * {@code AuthorizationService}.
 *
 * <p>See {@code README.md} in this package for the why and exclusions list.
 */
// @Disabled — removed by Plan 15-06 (test now enforced in CI).
public class ControllerPreAuthorizeCoverageTest {

    /** Mapping annotations that mark public HTTP endpoints. */
    private static final List<Class<? extends Annotation>> MAPPING_ANNOTATIONS =
            Arrays.asList(
                    GetMapping.class,
                    PostMapping.class,
                    PutMapping.class,
                    DeleteMapping.class,
                    PatchMapping.class,
                    RequestMapping.class
            );

    /**
     * Methods exempted from the {@code @PreAuthorize} requirement.
     * Each entry has a one-line justification comment.
     * Format: {@code "FullyQualifiedClassName#methodName"}.
     *
     * <p>Adding to this list is preferred over silently omitting {@code @PreAuthorize}
     * on a controller method — the audit trail of "why this endpoint is unauthenticated"
     * is part of the codebase's security posture.
     *
     * <p>Plan 15-06 reconciliation: the 15-02 baseline included aliases
     * (login/signup/refresh/logout/me, handleWebhook) that did not match the
     * actual method names. Phase 15-05's controller scan confirmed the real
     * names; entries below use those.
     */
    private static final Set<String> EXCLUSIONS = new HashSet<>(Arrays.asList(
            // --- 15-02 baseline (reconciled to actual method names per 15-05 scan) ---
            // AuthController login/signup — these ESTABLISH the auth context, they don't consume it.
            "com.kccitm.api.controller.AuthController#authenticateUser",
            "com.kccitm.api.controller.AuthController#registerUser",
            // UserController login endpoints — anonymous-by-design, mirror /auth/login (dashboard
            // + student username/DOB sign-in establish the auth context, they don't consume it).
            "com.kccitm.api.controller.UserController#checkUser",
            "com.kccitm.api.controller.UserController#studentDashboardAuth",
            // Password reset funnel — anonymous-by-design; the reset-password endpoint is
            // gated by a single-use server-issued token in the request body, not by Spring auth.
            "com.kccitm.api.controller.AuthController#forgotPassword",
            "com.kccitm.api.controller.AuthController#resetPassword",
            // --- 16-01 / 16-04 / 18-02 additions: cookie-session + token-lifecycle auth flow ---
            // logout — must succeed even with a missing/broken cookie; CSRF-exempt + permitAll.
            "com.kccitm.api.controller.AuthController#logout",
            // oauth-exchange — establishes the cookie session from a body-bound JWT (Phase 16-04).
            "com.kccitm.api.controller.AuthController#exchangeOAuthToken",
            // assessment-session minting — anonymous-by-design (permitAll + in PUBLIC_PATHS); the
            // gate is body params + enrolment + feature-flag DB checks, not Spring auth. (Auth
            // remediation Phase 1/HIGH-1 hardens it with identity proof but it stays anonymous.)
            "com.kccitm.api.controller.AssessmentSessionController#issueAssessmentSession",
            // refresh — consumes the opaque cn_rt cookie; MUST work with an EXPIRED access token (Phase 18-02).
            "com.kccitm.api.controller.AuthController#refresh",
            // me — anonymous-friendly: returns 401 when no principal is bound rather than 403 via PreAuthorize.
            "com.kccitm.api.controller.AuthController#me",
            // Razorpay webhook receiver — authenticated via HMAC signature, not user JWT.
            "com.kccitm.api.controller.career9.PaymentWebhookController#handleRazorpayWebhook",
            // Heartbeat/health — explicitly anonymous in SecurityConfig.
            "com.kccitm.api.controller.career9.HeartbeatController#heartbeat",
            // Public lead-capture form — Phase 13 RESEARCH already flagged this stays public.
            "com.kccitm.api.controller.career9.LeadController#captureLead",

            // --- 15-03 additions (student/counselling slice): pre-auth OTP flows ---
            // EmailController OTP send/verify during signup (pre-auth).
            "com.kccitm.api.controller.career9.StudentController#emailValidationOfficial",
            "com.kccitm.api.controller.career9.StudentController#emailValidationOfficialConfermation",
            // School-registration public funnel — token-authenticated, no user JWT.
            "com.kccitm.api.controller.career9.SchoolRegistrationController#getSchoolInfo",
            "com.kccitm.api.controller.career9.SchoolRegistrationController#verifyDetails",
            "com.kccitm.api.controller.career9.SchoolRegistrationController#registerStudent",
            // Counsellor pre-auth self-registration + login.
            "com.kccitm.api.controller.career9.counselling.CounsellorController#selfRegister",
            "com.kccitm.api.controller.career9.counselling.CounsellorController#counsellorLogin",

            // --- 15-04 additions (assessment slice): assessment-app prefetch + public report ---
            // Assessment-app fetches without admin JWT (Phase 19 unification target).
            "com.kccitm.api.controller.career9.AssessmentTableController#prefetchAssessmentData",
            // Public-share report URLs (token-based access).
            "com.kccitm.api.controller.career9.BetReportDataController#publicFinalReportPdf",

            // --- 15-05 additions (b2c slice): entire CampaignPublicController is anonymous-by-design ---
            "com.kccitm.api.controller.career9.b2c.CampaignPublicController#infoBySlug",
            "com.kccitm.api.controller.career9.b2c.CampaignPublicController#infoByAssessment",
            "com.kccitm.api.controller.career9.b2c.CampaignPublicController#infoByTier",
            "com.kccitm.api.controller.career9.b2c.CampaignPublicController#register",
            "com.kccitm.api.controller.career9.b2c.CampaignPublicController#registerTrial",
            "com.kccitm.api.controller.career9.b2c.CampaignPublicController#upgradeInfo",
            "com.kccitm.api.controller.career9.b2c.CampaignPublicController#payForReport",
            // Counselling slot list + booking — same anonymous funnel, gated by the
            // entitlement accessToken (+ required entitlementId), not by Spring auth.
            "com.kccitm.api.controller.career9.b2c.CampaignPublicController#listCounsellingSlots",
            "com.kccitm.api.controller.career9.b2c.CampaignPublicController#bookCounsellingSlot",

            // --- Phase 2 (Task 2.1 / HIGH-B): genuinely anonymous funnel endpoints whose
            // @PreAuthorize was removed (they are permitAll + CSRF-exempt via PUBLIC_PATHS and
            // gated by an in-controller token / promo / signature check, not by Spring auth).
            "com.kccitm.api.controller.career9.PromoCodeController#validatePromoCode",
            "com.kccitm.api.controller.career9.b2c.ReportPreparationController#prepareReport",
            "com.kccitm.api.controller.career9.b2c.EntitlementController#redeemToken",
            // Dashboard SSO bridge — trades the entitlement accessToken for cookies; gated by
            // the token (+ dashboard-active + non-expired window, EXP2), not by Spring auth.
            "com.kccitm.api.controller.career9.b2c.EntitlementController#redeemDashboardToken",
            "com.kccitm.api.controller.career9.AssessmentInstituteMappingController#getMappingInfoByToken",
            "com.kccitm.api.controller.career9.AssessmentInstituteMappingController#registerStudentByToken",

            // Operator-run 4-pager HTML template publish to DigitalOcean Spaces — runs from
            // an authenticated operator shell, not user JWT; gated by network reachability only.
            "com.kccitm.api.controller.career9.FourPagerTemplateController#uploadTemplates"

            // Plan 15-04 DEFERRED block removed by Plan 15-04 FINAL COMPLETION (2026-05-11).
            // All 17 assessment / questionnaire / scoring / report-generation controllers
            // (155 method-mappings) now carry @PreAuthorize against the post-PREFLIGHT
            // 411-code PermissionCode enum. Coverage is now enforced by this gate.
    ));

    @Test
    public void everyControllerMappingMethodMustHavePreAuthorize() {
        JavaClasses classes = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("com.kccitm.api.controller");

        List<String> violatingMethods = new ArrayList<>();

        for (JavaClass cls : classes) {
            if (!isController(cls)) {
                continue;
            }
            for (JavaMethod m : cls.getMethods()) {
                boolean hasMapping = MAPPING_ANNOTATIONS.stream().anyMatch(m::isAnnotatedWith);
                if (!hasMapping) {
                    continue;
                }

                boolean hasPreAuthorize = m.isAnnotatedWith(PreAuthorize.class)
                        || classMethodHasPreAuthorize(cls);
                if (hasPreAuthorize) {
                    continue;
                }

                String fqn = cls.getFullName() + "#" + m.getName();
                if (EXCLUSIONS.contains(fqn)) {
                    continue;
                }

                violatingMethods.add(fqn);
            }
        }

        if (!violatingMethods.isEmpty()) {
            Collections.sort(violatingMethods);
            StringBuilder sb = new StringBuilder();
            sb.append("Controller mapping methods missing @PreAuthorize (")
              .append(violatingMethods.size()).append("):\n");
            for (String v : violatingMethods) {
                sb.append("  - ").append(v).append('\n');
            }
            sb.append("\nFix by adding @PreAuthorize to the method, or add to the EXCLUSIONS set in ")
              .append(ControllerPreAuthorizeCoverageTest.class.getSimpleName())
              .append(".java with a one-line justification.");
            fail(sb.toString());
        }
    }

    /** A class counts as a controller if it carries {@code @RestController} OR {@code @Controller}. */
    private boolean isController(JavaClass cls) {
        return cls.isAnnotatedWith(RestController.class) || cls.isAnnotatedWith(Controller.class);
    }

    /** Permits class-level {@code @PreAuthorize} as covering all mapping methods of that class (rare but legal). */
    private boolean classMethodHasPreAuthorize(JavaClass cls) {
        return cls.isAnnotatedWith(PreAuthorize.class);
    }
}
