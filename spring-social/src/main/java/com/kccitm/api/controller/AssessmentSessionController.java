package com.kccitm.api.controller;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.Optional;

import javax.servlet.http.HttpServletRequest;
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
import com.kccitm.api.model.career9.StudentInfo;
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
        /**
         * Phase 1 (Task 1.4 / audit HIGH-1): identity proof. Date of birth in {@code dd-MM-yyyy},
         * matched against the student's record before a session is minted so that
         * {@code (userStudentId, assessmentId)} enumeration alone can no longer obtain another
         * student's assessment session. Required; callers (the assessment SPA entry) must supply it.
         */
        @NotNull
        public String dob;
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
            HttpServletRequest request,
            HttpServletResponse response) {

        logger.debug("MINT ENTRY userStudentId=" + req.userStudentId
                + " assessmentId=" + req.assessmentId
                + " origin=" + request.getHeader("Origin")
                + " referer=" + request.getHeader("Referer")
                + " ua=" + (request.getHeader("User-Agent") == null ? "null"
                        : request.getHeader("User-Agent").substring(0, Math.min(40, request.getHeader("User-Agent").length()))));

        // 1. Look up student + per-institute feature flag.
        Optional<UserStudent> studentOpt = userStudentRepo.findById(req.userStudentId);
        if (!studentOpt.isPresent()) {
            logger.debug("MINT FAIL unknown-student userStudentId=" + req.userStudentId);
            logger.warn("Assessment-session: unknown student userStudentId={}", req.userStudentId);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Unknown student");
        }
        UserStudent student = studentOpt.get();
        // Global override: skips both the per-institute and B2C gate checks below.
        // Used by the dev profile so local testing isn't blocked on a DB flag flip.
        boolean forceEnabled = Boolean.parseBoolean(
                env.getProperty("app.auth.assessmentCookieAuthForceEnabled", "false"));
        InstituteDetail institute = student.getInstitute();
        if (!forceEnabled && institute != null) {
            // B2B path: institute must have the flag flipped TRUE.
            Optional<InstituteDetail> instOpt = instituteRepo.findById(institute.getInstituteCode());
            boolean enabled = instOpt.isPresent()
                    && Boolean.TRUE.equals(instOpt.get().getAssessmentCookieAuthEnabled());
            if (!enabled) {
                logger.debug("MINT FAIL institute-flag-off institute=" + institute.getInstituteCode()
                        + " userStudentId=" + req.userStudentId);
                logger.info("Assessment-session: cookie auth not enabled for institute={}, falling back to legacy header path",
                        institute.getInstituteCode());
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("assessment_cookie_auth_not_enabled");
            }
        } else if (!forceEnabled) {
            // B2C path (no institute) — gated by a single global env property
            // so product can flip B2C separately once per-institute rollout has
            // been validated. Default FALSE keeps B2C on the legacy header path.
            boolean b2cEnabled = Boolean.parseBoolean(
                    env.getProperty("app.auth.assessmentCookieAuthB2C", "false"));
            if (!b2cEnabled) {
                logger.debug("MINT FAIL b2c-flag-off userStudentId=" + req.userStudentId);
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
            logger.debug("MINT FAIL enrolment-missing userStudentId=" + req.userStudentId
                    + " assessmentId=" + req.assessmentId);
            logger.warn("Assessment-session: enrolment check failed userStudentId={} assessmentId={}",
                    req.userStudentId, req.assessmentId);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Student not enrolled in this assessment");
        }

        // 2b. Identity proof (Phase 1 / HIGH-1): the supplied DOB must match the student's record.
        // Mirrors the duplicate-email DOB gate in CampaignPublicController: when a DOB is on file we
        // require an exact day match; when none is on file we mint anyway (so legacy students with no
        // recorded DOB are not locked out) but log it. This closes the pure-id enumeration path.
        Date suppliedDob = parseDob(req.dob);
        if (suppliedDob == null) {
            logger.debug("MINT FAIL bad-dob userStudentId=" + req.userStudentId
                    + " rawDob=" + req.dob);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Invalid date of birth; expected format dd-MM-yyyy");
        }
        StudentInfo info = student.getStudentInfo();
        Date storedDob = info != null ? info.getStudentDob() : null;
        if (storedDob != null) {
            if (!sameDay(storedDob, suppliedDob)) {
                logger.debug("MINT FAIL dob-mismatch userStudentId=" + req.userStudentId);
                logger.warn("Assessment-session: DOB mismatch userStudentId={}", req.userStudentId);
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Identity verification failed");
            }
        } else {
            logger.debug("MINT WARN no-dob-on-record userStudentId=" + req.userStudentId);
            logger.warn("Assessment-session: no DOB on record for userStudentId={} — minting without DOB proof",
                    req.userStudentId);
        }

        // 3. Mint the assessment-scoped JWT.
        String token = tokenProvider.createAssessmentSessionToken(
                req.userStudentId, req.assessmentId, student.getUserId());

        // 4. Issue the cookie via the centralised AuthCookieService — keeps
        // every Set-Cookie header construction in one place. Cookie attributes:
        // HttpOnly + (Secure outside dev) + SameSite from app.cookie config +
        // Path=/ + Max-Age = assessment TTL / 1000.
        authCookieService.issueAssessmentSessionCookie(response, token,
                (int) (assessmentTokenExpirationMsec / 1000));

        // Issue a cn_csrf cookie so the assessment SPA can perform the CSRF
        // double-submit pattern on subsequent POST/PUT requests. Without this
        // the student has no CSRF token and every state-changing request 403s.
        authCookieService.issueCsrfCookie(response,
                (int) (assessmentTokenExpirationMsec / 1000));

        logger.debug("MINT SUCCESS userStudentId=" + req.userStudentId
                + " assessmentId=" + req.assessmentId + " ttlMsec=" + assessmentTokenExpirationMsec);
        logger.info("Assessment-session issued userStudentId={} assessmentId={}",
                req.userStudentId, req.assessmentId);
        return ResponseEntity.ok(Collections.singletonMap("ok", true));
    }

    /** Parse a {@code dd-MM-yyyy} date string; returns null on null/blank/malformed input. */
    private static Date parseDob(String s) {
        if (s == null || s.trim().isEmpty()) {
            return null;
        }
        SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
        sdf.setLenient(false);
        try {
            return sdf.parse(s.trim());
        } catch (ParseException e) {
            return null;
        }
    }

    /** True iff both dates fall on the same calendar day. */
    private static boolean sameDay(Date a, Date b) {
        if (a == null || b == null) {
            return false;
        }
        Calendar ca = Calendar.getInstance();
        ca.setTime(a);
        Calendar cb = Calendar.getInstance();
        cb.setTime(b);
        return ca.get(Calendar.YEAR) == cb.get(Calendar.YEAR)
                && ca.get(Calendar.DAY_OF_YEAR) == cb.get(Calendar.DAY_OF_YEAR);
    }
}
