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
    private final com.kccitm.api.repository.Career9.counselling.CounsellorRepository counsellorRepository;
    private final CustomUserDetailsService customUserDetailsService;
    private final TokenProvider tokenProvider;
    private final UserActivityLogService userActivityLogService;

    public ImpersonationController(UserStudentRepository userStudentRepository,
                                   com.kccitm.api.repository.Career9.counselling.CounsellorRepository counsellorRepository,
                                   CustomUserDetailsService customUserDetailsService,
                                   TokenProvider tokenProvider,
                                   UserActivityLogService userActivityLogService) {
        this.userStudentRepository = userStudentRepository;
        this.counsellorRepository = counsellorRepository;
        this.customUserDetailsService = customUserDetailsService;
        this.tokenProvider = tokenProvider;
        this.userActivityLogService = userActivityLogService;
    }

    @PreAuthorize("@auth.allows('student.impersonate')")
    @PostMapping("/admin/impersonate/student/{userStudentId}")
    public ResponseEntity<?> impersonateStudent(@PathVariable Long userStudentId,
                                                HttpServletRequest request) {
        // Hard, enforce-mode-independent authorization check. @auth.allows(...) above is a
        // NO-OP while auth.enforce-mode=log-only (see AuthorizationService.recordAndReturn),
        // so this endpoint MUST NOT rely on it alone — any authenticated user (including a
        // student) could otherwise mint an impersonation token for any other student.
        Authentication authn = SecurityContextHolder.getContext().getAuthentication();
        if (authn == null || !(authn.getPrincipal() instanceof UserPrincipal)) {
            return ResponseEntity.status(403).body("Not authorized to impersonate students");
        }
        UserPrincipal caller = (UserPrincipal) authn.getPrincipal();
        boolean permitted = caller.isSuperAdmin()
                || (caller.getPermissions() != null && caller.getPermissions().contains("student.impersonate"));
        if (!permitted) {
            return ResponseEntity.status(403).body("Not authorized to impersonate students");
        }

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

        String jwt = tokenProvider.createImpersonationToken(principal);

        // Audit: record who impersonated whom (organisation field carries the
        // impersonating admin's id/email; there is no login event for the student
        // otherwise). Best-effort — never block the mint on a logging failure.
        Long adminId = caller.getId();
        String adminEmail = caller.getEmail();
        userActivityLogService.logLogin(
                principal.getId(), principal.getUsername(), principal.getEmail(),
                "IMPERSONATED_BY:" + adminId + ":" + adminEmail,
                UserActivityLogService.getClientIp(request),
                request.getHeader("User-Agent"));

        Map<String, Object> response = new HashMap<>();
        response.put("token", jwt);
        return ResponseEntity.ok(response);
    }

    /**
     * The counsellor equivalent of the student impersonation above: mints a short-lived JWT
     * for the User behind a counsellor profile so an admin can open the counsellor portal as
     * them, in a new tab, without disturbing their own session.
     */
    @PreAuthorize("@auth.allows('counsellor.update')")
    @PostMapping("/admin/impersonate/counsellor/{counsellorId}")
    public ResponseEntity<?> impersonateCounsellor(@PathVariable Long counsellorId,
                                                   HttpServletRequest request) {
        // Same hard check as the student path, and for the same reason: @auth.allows(...) is
        // a NO-OP while auth.enforce-mode=log-only, so relying on the annotation alone would
        // let ANY authenticated caller mint a counsellor token and read other people's
        // students, notes and sessions.
        Authentication authn = SecurityContextHolder.getContext().getAuthentication();
        if (authn == null || !(authn.getPrincipal() instanceof UserPrincipal)) {
            return ResponseEntity.status(403).body("Not authorized to impersonate counsellors");
        }
        UserPrincipal caller = (UserPrincipal) authn.getPrincipal();
        boolean permitted = caller.isSuperAdmin()
                || (caller.getPermissions() != null && caller.getPermissions().contains("counsellor.update"));
        if (!permitted) {
            return ResponseEntity.status(403).body("Not authorized to impersonate counsellors");
        }

        var counsellorOpt = counsellorRepository.findById(counsellorId);
        if (counsellorOpt.isEmpty() || counsellorOpt.get().getUser() == null) {
            // A counsellor with no linked login cannot be opened as — they have no account.
            return ResponseEntity.status(404)
                    .body("This counsellor has no login account to open.");
        }

        UserPrincipal principal;
        try {
            principal = (UserPrincipal) customUserDetailsService
                    .loadUserById(counsellorOpt.get().getUser().getId());
        } catch (RuntimeException ex) {
            return ResponseEntity.status(404).body("Counsellor user not found");
        }

        String jwt = tokenProvider.createImpersonationToken(principal);

        userActivityLogService.logLogin(
                principal.getId(), principal.getUsername(), principal.getEmail(),
                "IMPERSONATED_BY:" + caller.getId() + ":" + caller.getEmail(),
                UserActivityLogService.getClientIp(request),
                request.getHeader("User-Agent"));

        Map<String, Object> response = new HashMap<>();
        response.put("token", jwt);
        return ResponseEntity.ok(response);
    }
}
