package com.kccitm.api.controller.career9.b2c;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.transaction.annotation.Transactional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.b2c.Campaign;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentMapping;
import com.kccitm.api.model.career9.b2c.ServiceDeliveryLog;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignRepository;
import com.kccitm.api.repository.Career9.b2c.ServiceDeliveryLogRepository;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.security.AuthCookieService;
import com.kccitm.api.security.CustomUserDetailsService;
import com.kccitm.api.security.TokenProvider;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.StudentProvisioningService;
import com.kccitm.api.service.StudentSessionService;
import com.kccitm.api.service.b2c.EntitlementService;

import javax.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/entitlement")
public class EntitlementController {

    @Autowired private EntitlementService entitlementService;
    @Autowired private StudentEntitlementRepository entitlementRepository;
    @Autowired private ServiceDeliveryLogRepository serviceDeliveryLogRepository;
    @Autowired private CampaignRepository campaignRepository;
    @Autowired private CampaignAssessmentMappingRepository campaignAssessmentMappingRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StudentInfoRepository studentInfoRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private StudentAssessmentMappingRepository studentAssessmentMappingRepository;
    @Autowired private com.kccitm.api.service.b2c.StudentInstituteMembershipService membershipService;
    @Autowired private AuthCookieService authCookieService;
    @Autowired private TokenProvider tokenProvider;
    @Autowired private CustomUserDetailsService customUserDetailsService;
    @Autowired private StudentSessionService studentSessionService;
    @Autowired private StudentProvisioningService studentProvisioningService;
    @Autowired private com.kccitm.api.repository.Career9.AssessmentTableRepository assessmentTableRepository;

    @org.springframework.beans.factory.annotation.Value("${app.auth.assessmentTokenExpirationMsec:14400000}")
    private long assessmentTokenExpirationMsec;

    /**
     * PUBLIC: Path B step 1 — student takes the free assessment from a campaign landing page.
     * Body: { campaignId, assessmentId, name, email, phone?, dob (dd-MM-yyyy)? }
     * Creates UserStudent + StudentAssessmentMapping + pending StudentEntitlement.
     * Returns { entitlementId, accessToken, userStudentId, assessmentStartUrl } so the
     * student-facing site can deep-link into the assessment.
     */
    @PreAuthorize("@auth.allows('entitlement.create')")
    @PostMapping("/start-free-trial")
    @Transactional
    public ResponseEntity<?> startFreeTrial(@RequestBody Map<String, Object> body) {
        Long campaignId = body.get("campaignId") != null ? Long.valueOf(body.get("campaignId").toString()) : null;
        Long assessmentId = body.get("assessmentId") != null ? Long.valueOf(body.get("assessmentId").toString()) : null;
        String name = (String) body.get("name");
        String email = (String) body.get("email");
        String phone = (String) body.get("phone");
        String dobStr = (String) body.get("dob");

        if (campaignId == null || assessmentId == null) {
            return ResponseEntity.badRequest().body("campaignId and assessmentId are required");
        }
        if (name == null || email == null) {
            return ResponseEntity.badRequest().body("name and email are required");
        }

        Optional<Campaign> campaignOpt = campaignRepository.findById(campaignId);
        if (!campaignOpt.isPresent() || Boolean.TRUE.equals(campaignOpt.get().getIsDeleted())
                || !Boolean.TRUE.equals(campaignOpt.get().getIsActive())) {
            return ResponseEntity.badRequest().body("Campaign not found or inactive");
        }
        Optional<CampaignAssessmentMapping> mappingOpt = campaignAssessmentMappingRepository
                .findByCampaignIdAndAssessmentIdAndIsDeletedFalse(campaignId, assessmentId);
        if (!mappingOpt.isPresent()) {
            return ResponseEntity.badRequest().body("Assessment not part of this campaign");
        }

        Date dob;
        try {
            dob = dobStr != null && !dobStr.isEmpty() ? new SimpleDateFormat("dd-MM-yyyy").parse(dobStr) : new Date();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Invalid dob format. Use dd-MM-yyyy");
        }

        // Find-or-create student by email (B2C scope: no instituteCode)
        UserStudent userStudent = null;
        List<StudentInfo> existing = studentInfoRepository.findByEmail(email);
        if (existing != null && !existing.isEmpty()) {
            List<UserStudent> us = userStudentRepository.findByStudentInfoId(existing.get(0).getId());
            if (!us.isEmpty()) userStudent = us.get(0);
        }
        if (userStudent == null) {
            User user = new User((int) (Math.random() * 100000), dob);
            user.setName(name);
            user.setEmail(email);
            user.setPhone(phone);
            user = userRepository.save(user);

            StudentInfo info = new StudentInfo();
            info.setName(name);
            info.setEmail(email);
            info.setStudentDob(dob);
            info.setPhoneNumber(phone);
            info.setUser(user);
            info = studentInfoRepository.save(info);

            userStudent = new UserStudent(user, info, null);
            userStudent = userStudentRepository.save(userStudent);
            studentProvisioningService.provision(userStudent);
        }

        membershipService.assignFromCampaign(userStudent, campaignOpt.get(), "entitlement-create");

        // Ensure assessment mapping exists
        Optional<StudentAssessmentMapping> samOpt = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudent.getUserStudentId(), assessmentId);
        if (!samOpt.isPresent()) {
            studentAssessmentMappingRepository.save(
                    new StudentAssessmentMapping(userStudent.getUserStudentId(), assessmentId));
        }

        // Resolve path/model from mapping → campaign default
        String purchasePath = mappingOpt.get().getPurchasePath();
        if (purchasePath == null) purchasePath = campaignOpt.get().getDefaultPurchasePath();
        if (purchasePath == null) purchasePath = "B";
        String counsellingModel = mappingOpt.get().getCounsellingModel();
        if (counsellingModel == null) counsellingModel = campaignOpt.get().getDefaultCounsellingModel();
        if (counsellingModel == null) counsellingModel = "1";

        StudentEntitlement entitlement = entitlementService.createPending(
                userStudent.getUserStudentId(), campaignId, assessmentId, purchasePath, counsellingModel);

        Map<String, Object> response = new HashMap<>();
        response.put("entitlementId", entitlement.getEntitlementId());
        response.put("userStudentId", userStudent.getUserStudentId());
        response.put("campaignId", campaignId);
        response.put("assessmentId", assessmentId);
        response.put("purchasePath", purchasePath);
        response.put("counsellingModel", counsellingModel);
        return ResponseEntity.ok(response);
    }

    /**
     * Public endpoint — student lands on /assessment/start?t=...&e=...; SPA calls this to validate
     * before letting them in. Returns the entitlement if the token is good, 404 otherwise.
     * NOTE: this endpoint does NOT issue a JWT yet — that's a follow-up integrated with the
     * existing JWT pipeline. The SPA can use the entitlement reference to short-circuit the
     * assessment-start flow with the resolved userStudentId.
     */
    // Phase 2 (Task 2.1 / HIGH-B): anonymous SPA token redemption, gated by the unguessable
    // 30-byte SecureRandom access token validated in EntitlementService.redeemAccessToken.
    // @PreAuthorize removed so the enforce flip won't 403 the anonymous redeem; permitAll +
    // CSRF-exempt via PUBLIC_PATHS (/entitlement/redeem-token). Coverage-excluded.
    @PostMapping("/redeem-token")
    public ResponseEntity<?> redeemToken(@RequestBody Map<String, Object> body,
                                          HttpServletResponse httpResponse) {
        String token = body.get("token") != null ? body.get("token").toString() : null;
        Long entitlementId = body.get("entitlementId") != null
                ? Long.valueOf(body.get("entitlementId").toString()) : null;
        StudentEntitlement e = entitlementService.redeemAccessToken(token, entitlementId);
        if (e == null) return ResponseEntity.status(404).body("Invalid or expired token");

        // Issue the cn_at_asmnt cookie so the SPA can hit assessment-scoped
        // endpoints (allotted-assessment, demographics, sections, submit) with
        // server-side auth — not just localStorage trust. Same TTL as paid /
        // free-registration flows for consistency.
        if (e.getUserStudentId() != null && e.getAssessmentId() != null) {
            Long ownerUserId = userStudentRepository.findById(e.getUserStudentId())
                    .map(UserStudent::getUserId).orElse(null);
            String sessionJwt = tokenProvider.createAssessmentSessionToken(
                    e.getUserStudentId(), e.getAssessmentId(), ownerUserId);
            authCookieService.issueAssessmentSessionCookie(httpResponse, sessionJwt,
                    (int) (assessmentTokenExpirationMsec / 1000));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("entitlementId", e.getEntitlementId());
        response.put("userStudentId", e.getUserStudentId());
        response.put("assessmentId", e.getAssessmentId());
        response.put("campaignId", e.getCampaignId());
        response.put("status", e.getStatus());
        response.put("purchasePath", e.getPurchasePath());
        response.put("counsellingModel", e.getCounsellingModel());
        response.put("dashboardActive", e.getDashboardActive());
        response.put("counsellingActive", e.getCounsellingActive());
        response.put("lmsActive", e.getLmsActive());
        response.put("finalReportActive", e.getFinalReportActive());
        response.put("expiresAt", e.getExpiresAt());

        // Include the allotted-assessments list + campaign slug so the SPA can
        // navigate straight to /allotted-assessment in one round-trip.
        if (e.getUserStudentId() != null) {
            response.putAll(studentSessionService.buildSessionPayload(e.getUserStudentId()));
        }
        if (e.getCampaignId() != null) {
            campaignRepository.findById(e.getCampaignId())
                    .ifPresent(c -> response.put("campaignSlug", c.getSlug()));
        }

        return ResponseEntity.ok(response);
    }

    /**
     * PUBLIC: token-exchange for dashboard auto-login. The assessment Thank-You
     * page sends the student to {@code /student/sso?t=<accessToken>&e=<entitlementId>}
     * on the dashboard host; that route POSTs this endpoint, which validates the
     * token, mints a full Phase-18 access JWT, and issues the {@code cn_at} +
     * {@code cn_csrf} cookies on the dashboard domain so the regular student
     * routes accept the session without forcing a username+DOB login.
     *
     * <p>Body: {@code { token, entitlementId }}. On success returns
     * {@code { userStudentId, entitlementId, redirectPath: "/student/dashboard" }}
     * and sets the auth cookies. On invalid/expired token returns 401.
     *
     * <p>Auth/CSRF: in {@code PUBLIC_PATHS} — anonymous-by-design, gated by the
     * unguessable 30-byte SecureRandom access token validated in
     * {@code EntitlementService.redeemAccessToken}. Mirrors the
     * {@code /entitlement/redeem-token} pattern; the only difference is the
     * cookie issued (full {@code cn_at} instead of the assessment-scoped
     * {@code cn_at_asmnt}) so the dashboard's regular guards accept the session.
     */
    @PostMapping("/redeem-dashboard-token")
    public ResponseEntity<?> redeemDashboardToken(@RequestBody Map<String, Object> body,
                                                   HttpServletResponse httpResponse) {
        String token = body.get("token") != null ? body.get("token").toString() : null;
        Long entitlementId = body.get("entitlementId") != null
                ? Long.valueOf(body.get("entitlementId").toString()) : null;

        StudentEntitlement e = entitlementService.redeemAccessToken(token, entitlementId);
        if (e == null) return ResponseEntity.status(401).body("Invalid or expired token");
        if (e.getUserStudentId() == null) {
            return ResponseEntity.status(404).body("No student linked to this entitlement");
        }
        if (!Boolean.TRUE.equals(e.getDashboardActive())) {
            // Dashboard access wasn't purchased for this entitlement. The Thank-You
            // page should not have rendered the auto-login button in this case, but
            // double-check defensively so a tampered URL can't grant dashboard access
            // to a free-tier student.
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Dashboard access is not included in your plan");
        }
        // EXP2: enforce the dashboard validity window directly — the hourly expiry
        // sweep flips dashboardActive off, but check the date here too so a lapsed
        // window can't grant SSO during the sweep's lag.
        if (e.getDashboardExpiresAt() != null && e.getDashboardExpiresAt().before(new Date())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Your dashboard access window has expired");
        }

        Optional<UserStudent> usOpt = userStudentRepository.findById(e.getUserStudentId());
        if (!usOpt.isPresent() || usOpt.get().getUserId() == null) {
            return ResponseEntity.status(404).body("Student user not found");
        }

        // Hydrate the UserPrincipal via the same path the regular login uses, so the
        // minted JWT carries the same roles/scopes/superAdmin claim shape and every
        // subsequent request through TokenAuthenticationFilter validates identically.
        UserPrincipal principal;
        try {
            principal = (UserPrincipal) customUserDetailsService.loadUserById(usOpt.get().getUserId());
        } catch (RuntimeException ex) {
            return ResponseEntity.status(404).body("Student user not found");
        }

        String jwt = tokenProvider.createAccessToken(principal);
        authCookieService.issueAuthCookies(httpResponse, jwt);

        Map<String, Object> response = new HashMap<>();
        response.put("userStudentId", e.getUserStudentId());
        response.put("entitlementId", e.getEntitlementId());
        response.put("redirectPath", "/student/dashboard");
        return ResponseEntity.ok(response);
    }

    @PreAuthorize("@auth.allows('entitlement.read')")
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        Optional<StudentEntitlement> opt = entitlementRepository.findById(id);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(opt.get());
    }

    /**
     * Lists every entitlement belonging to a student, newest first, enriched
     * with the assessment + campaign names so the admin UI can present a
     * pickable list (e.g. "Career Discovery — Demo Campaign — completed
     * (Jun 17)") when more than one match exists. Used by the Group Students
     * admin page to drive its "Thank You" button — single-entitlement students
     * open the Thank-You URL directly; multi-entitlement students see a picker
     * modal sourced from this list.
     *
     * <p>Response shape per row: {@code { entitlementId, assessmentId,
     * assessmentName, campaignId, campaignName, status, alreadyActive,
     * createdAt }}. An empty list (HTTP 200, {@code []}) means the student
     * never went through a B2C funnel — the caller should surface that as
     * "no Thank-You page available" rather than open an empty one.
     */
    @PreAuthorize("@auth.allows('entitlement.read')")
    @GetMapping("/by-student/{userStudentId}")
    public ResponseEntity<?> getByStudent(@PathVariable Long userStudentId) {
        List<StudentEntitlement> entitlements = entitlementRepository
                .findByUserStudentIdOrderByCreatedAtDesc(userStudentId);

        List<Map<String, Object>> out = new java.util.ArrayList<>();
        for (StudentEntitlement e : entitlements) {
            Map<String, Object> dto = new HashMap<>();
            dto.put("entitlementId", e.getEntitlementId());
            dto.put("assessmentId", e.getAssessmentId());
            dto.put("campaignId", e.getCampaignId());
            dto.put("status", e.getStatus());
            dto.put("alreadyActive", "active".equals(e.getStatus()));
            dto.put("createdAt", e.getCreatedAt());
            // Per-row name lookups. N+1 is fine: an individual student rarely
            // owns more than a handful of entitlements, and this endpoint is
            // not on any hot path.
            if (e.getAssessmentId() != null) {
                assessmentTableRepository.findById(e.getAssessmentId())
                        .ifPresent(at -> dto.put("assessmentName", at.getAssessmentName()));
            }
            if (e.getCampaignId() != null) {
                campaignRepository.findById(e.getCampaignId())
                        .ifPresent(c -> dto.put("campaignName", c.getName()));
            }
            out.add(dto);
        }
        return ResponseEntity.ok(out);
    }

    @PreAuthorize("@auth.allows('entitlement.read')")
    @GetMapping("/{id}/communications")
    public ResponseEntity<List<ServiceDeliveryLog>> getCommunications(@PathVariable Long id) {
        return ResponseEntity.ok(serviceDeliveryLogRepository.findByEntitlementIdOrderByCreatedAtDesc(id));
    }

    @PreAuthorize("@auth.allows('entitlement.update')")
    @PostMapping("/{id}/resend/{serviceType}")
    public ResponseEntity<?> resend(@PathVariable Long id,
                                    @PathVariable String serviceType,
                                    @RequestBody(required = false) Map<String, Object> body) {
        Optional<StudentEntitlement> opt = entitlementRepository.findById(id);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        // Recipient is resolved server-side from the entitlement's own student;
        // any client-supplied recipient is ignored to prevent report/token
        // exfiltration to an attacker-chosen address.
        EntitlementService.ResendResult r = entitlementService.resendServiceLink(id, serviceType, null);
        if (!r.ok) return ResponseEntity.badRequest().body(r.message);
        return ResponseEntity.ok(Map.of("status", "sent"));
    }

    @PreAuthorize("@auth.allows('entitlement.update')")
    @PostMapping("/{id}/extend")
    public ResponseEntity<?> extend(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        if (body.get("newExpiresAt") == null) {
            return ResponseEntity.badRequest().body("newExpiresAt (dd-MM-yyyy) is required");
        }
        Date newExpiresAt;
        try {
            newExpiresAt = new SimpleDateFormat("dd-MM-yyyy").parse(body.get("newExpiresAt").toString());
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body("Use dd-MM-yyyy format");
        }
        StudentEntitlement e = entitlementService.extendExpiry(id, newExpiresAt);
        if (e == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(e);
    }

    @PreAuthorize("@auth.allows('entitlement.delete')")
    @PostMapping("/{id}/revoke")
    public ResponseEntity<?> revoke(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        String reason = body != null && body.get("reason") != null ? body.get("reason").toString() : "manual";
        StudentEntitlement e = entitlementService.revoke(id, reason);
        if (e == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(e);
    }
}
