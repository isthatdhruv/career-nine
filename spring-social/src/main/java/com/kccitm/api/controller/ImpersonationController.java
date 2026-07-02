package com.kccitm.api.controller;

import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.security.CustomUserDetailsService;
import com.kccitm.api.security.TokenProvider;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.UserActivityLogService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Admin impersonation: mints a short-lived student JWT so an admin can open the
 * student portal dashboard AS that student, in a new tab, without a cookie.
 *
 * <p>The token is returned in the body (no Set-Cookie). The frontend keeps it in
 * per-tab sessionStorage and sends it as Authorization: Bearer with
 * withCredentials:false, so the admin's own cn_at cookie is never touched. The
 * minting path mirrors EntitlementController.redeemDashboardToken (same
 * loadUserById + createAccessToken) so the JWT validates identically downstream.
 */
@RestController
public class ImpersonationController {

    private final UserStudentRepository userStudentRepository;
    private final CustomUserDetailsService customUserDetailsService;
    private final TokenProvider tokenProvider;
    private final UserActivityLogService userActivityLogService;

    public ImpersonationController(UserStudentRepository userStudentRepository,
                                   CustomUserDetailsService customUserDetailsService,
                                   TokenProvider tokenProvider,
                                   UserActivityLogService userActivityLogService) {
        this.userStudentRepository = userStudentRepository;
        this.customUserDetailsService = customUserDetailsService;
        this.tokenProvider = tokenProvider;
        this.userActivityLogService = userActivityLogService;
    }

    @PreAuthorize("@auth.allows('student.impersonate')")
    @PostMapping("/admin/impersonate/student/{userStudentId}")
    public ResponseEntity<?> impersonateStudent(@PathVariable Long userStudentId,
                                                HttpServletRequest request) {
        Optional<UserStudent> usOpt = userStudentRepository.findById(userStudentId);
        if (!usOpt.isPresent() || usOpt.get().getUserId() == null) {
            return ResponseEntity.status(404).body("Student user not found");
        }

        UserPrincipal principal;
        try {
            principal = (UserPrincipal) customUserDetailsService.loadUserById(usOpt.get().getUserId());
        } catch (RuntimeException ex) {
            return ResponseEntity.status(404).body("Student user not found");
        }

        String jwt = tokenProvider.createAccessToken(principal);

        // Audit: record who impersonated whom (organisation field carries the
        // impersonating admin's id/email; there is no login event for the student
        // otherwise). Best-effort — never block the mint on a logging failure.
        Long adminId = null;
        String adminEmail = null;
        Authentication authn = SecurityContextHolder.getContext().getAuthentication();
        if (authn != null && authn.getPrincipal() instanceof UserPrincipal) {
            UserPrincipal admin = (UserPrincipal) authn.getPrincipal();
            adminId = admin.getId();
            adminEmail = admin.getEmail();
        }
        userActivityLogService.logLogin(
                principal.getId(), principal.getUsername(), principal.getEmail(),
                "IMPERSONATED_BY:" + adminId + ":" + adminEmail,
                UserActivityLogService.getClientIp(request),
                request.getHeader("User-Agent"));

        Map<String, Object> response = new HashMap<>();
        response.put("token", jwt);
        return ResponseEntity.ok(response);
    }
}
