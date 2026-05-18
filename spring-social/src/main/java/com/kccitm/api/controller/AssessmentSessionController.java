package com.kccitm.api.controller;

import java.util.Collections;
import java.util.Optional;

import javax.servlet.http.HttpServletResponse;
import javax.validation.Valid;
import javax.validation.constraints.NotNull;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.security.AuthCookieService;
import com.kccitm.api.security.TokenProvider;

/**
 * Phase 19 Plan 01: Mints a short-lived (4h) assessment-bound JWT in an HttpOnly
 * cookie ({@code cn_at_asmnt}) for the assessment SPA flow. Per-institute
 * feature-flag gated via {@link InstituteDetail#getAssessmentCookieAuthEnabled()}.
 *
 * <p>When the flag is FALSE/NULL for the student's institute the endpoint returns
 * {@code 404} so the assessment SPA transparently falls back to the legacy
 * {@code X-Assessment-Session} header path (handled by
 * {@code AssessmentSessionInterceptor}). The interceptor and the cookie path are
 * deliberately allowed to co-exist for one release.
 *
 * <p>Separation from {@code AuthController} is intentional: when the rollout hits
 * 100% and the legacy header path is retired, this entire controller can be
 * deleted in a single commit without touching the admin-auth surface.
 */
@RestController
@RequestMapping("/auth")
public class AssessmentSessionController {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentSessionController.class);

    @Autowired
    private TokenProvider tokenProvider;

    @Autowired
    private StudentAssessmentMappingRepository mappingRepo;

    @Autowired
    private InstituteDetailRepository instituteRepo;

    @Autowired
    private UserStudentRepository userStudentRepo;

    @Autowired
    private AuthCookieService authCookieService;

    @Autowired
    private Environment env;

    @Value("${app.auth.assessmentTokenExpirationMsec:14400000}")
    private long assessmentTokenExpirationMsec;

    /**
     * Request body for {@code POST /auth/assessment-session}. Both fields required;
     * Bean Validation rejects null payloads with a 400 before the handler runs.
     */
    public static class AssessmentSessionRequest {
        @NotNull
        public Long userStudentId;
        @NotNull
        public Long assessmentId;
    }

    /**
     * Phase 19 Plan 01. Issues an HttpOnly {@code cn_at_asmnt} cookie carrying a
     * 4h JWT with claims {@code sub=userStudentId, aid=assessmentId, scope=assessment, jti=<uuid>}.
     *
     * <p>Status codes:
     * <ul>
     *   <li>{@code 200} — cookie issued; body {@code {"ok": true}}</li>
     *   <li>{@code 403} — student not enrolled in the requested assessment</li>
     *   <li>{@code 404} — institute feature flag disabled (SPA falls back to legacy header path)</li>
     *   <li>{@code 400} — request body validation failed (Spring default)</li>
     * </ul>
     *
     * <p>Endpoint is exempt from authentication (added to {@code permitAll} in
     * {@code SecurityConfig}); enrolment + feature-flag checks are the gate.
     */
    @PostMapping("/assessment-session")
    public ResponseEntity<?> issueAssessmentSession(
            @Valid @RequestBody AssessmentSessionRequest req,
            HttpServletResponse response) {

        // 1. Look up student + per-institute feature flag.
        Optional<UserStudent> studentOpt = userStudentRepo.findById(req.userStudentId);
        if (!studentOpt.isPresent()) {
            logger.warn("Assessment-session: unknown student userStudentId={}", req.userStudentId);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Unknown student");
        }
        UserStudent student = studentOpt.get();
        InstituteDetail institute = student.getInstitute();
        if (institute != null) {
            // B2B path: institute must have the flag flipped TRUE.
            Optional<InstituteDetail> instOpt = instituteRepo.findById(institute.getInstituteCode());
            boolean enabled = instOpt.isPresent()
                    && Boolean.TRUE.equals(instOpt.get().getAssessmentCookieAuthEnabled());
            if (!enabled) {
                logger.info("Assessment-session: cookie auth not enabled for institute={}, falling back to legacy header path",
                        institute.getInstituteCode());
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("assessment_cookie_auth_not_enabled");
            }
        } else {
            // B2C path (no institute) — gated by a single global env property
            // so product can flip B2C separately once per-institute rollout has
            // been validated. Default FALSE keeps B2C on the legacy header path.
            boolean b2cEnabled = Boolean.parseBoolean(
                    env.getProperty("app.auth.assessmentCookieAuthB2C", "false"));
            if (!b2cEnabled) {
                logger.info("Assessment-session: B2C cookie auth disabled (no institute), userStudentId={}",
                        req.userStudentId);
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("assessment_cookie_auth_not_enabled");
            }
        }

        // 2. Enrolment check — fail fast with 403 if no StudentAssessmentMapping
        // row exists for the (userStudentId, assessmentId) tuple. Uses the
        // existing repository finder (no new query method added in this plan).
        Optional<StudentAssessmentMapping> mapping = mappingRepo
                .findFirstByUserStudentUserStudentIdAndAssessmentId(req.userStudentId, req.assessmentId);
        if (!mapping.isPresent()) {
            logger.warn("Assessment-session: enrolment check failed userStudentId={} assessmentId={}",
                    req.userStudentId, req.assessmentId);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Student not enrolled in this assessment");
        }

        // 3. Mint the assessment-scoped JWT.
        String token = tokenProvider.createAssessmentSessionToken(req.userStudentId, req.assessmentId);

        // 4. Issue the cookie via the centralised AuthCookieService — keeps
        // every Set-Cookie header construction in one place. Cookie attributes:
        // HttpOnly + (Secure outside dev) + SameSite from app.cookie config +
        // Path=/ + Max-Age = assessment TTL / 1000.
        authCookieService.issueAssessmentSessionCookie(response, token,
                (int) (assessmentTokenExpirationMsec / 1000));

        logger.info("Assessment-session issued userStudentId={} assessmentId={}",
                req.userStudentId, req.assessmentId);
        return ResponseEntity.ok(Collections.singletonMap("ok", true));
    }
}
