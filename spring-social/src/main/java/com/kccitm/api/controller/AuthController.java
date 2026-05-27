package com.kccitm.api.controller;

import java.net.URI;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.DuplicateResourceException;
import com.kccitm.api.model.AuthProvider;
import com.kccitm.api.model.User;
import com.kccitm.api.payload.ApiResponse;
import com.kccitm.api.payload.AuthResponse;
import com.kccitm.api.payload.LoginRequest;
import com.kccitm.api.payload.MeResponse;
import com.kccitm.api.payload.OAuthExchangeRequest;
import com.kccitm.api.payload.SignUpRequest;
import com.kccitm.api.repository.RoleUrlRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.security.AuthCookieService;
import com.kccitm.api.security.CurrentScopes;
import com.kccitm.api.security.JtiDenyListService;
import com.kccitm.api.security.JwtTokenAuditService;
import com.kccitm.api.security.RefreshTokenService;
import com.kccitm.api.security.RefreshTokenService.RefreshTokenReuseException;
import com.kccitm.api.security.CustomUserDetailsService;
import com.kccitm.api.security.TokenProvider;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.SmtpEmailService;
import com.kccitm.api.service.StudentProvisioningService;
import com.kccitm.api.service.UserActivityLogService;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.UserStudentRepository;

import org.springframework.security.core.userdetails.UserDetails;

import java.text.SimpleDateFormat;
import java.util.Date;
@RestController
@RequestMapping("/auth")

public class AuthController {
    @Autowired
    private SmtpEmailService smtpEmailService;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * Phase 7 (Task 7.9): a dummy bcrypt hash (computed once, at the encoder's configured cost) so
     * the unknown-email login path spends the same time as a real password check — removing the
     * timing oracle that would otherwise reveal which emails are registered.
     */
    private volatile String dummyBcryptHash;

    private String dummyHash() {
        String h = dummyBcryptHash;
        if (h == null) {
            synchronized (this) {
                if (dummyBcryptHash == null) {
                    dummyBcryptHash = passwordEncoder.encode("timing-equalizer-not-a-real-password");
                }
                h = dummyBcryptHash;
            }
        }
        return h;
    }

    @Autowired
    private TokenProvider tokenProvider;

    @Autowired
    private UserActivityLogService userActivityLogService;

    @Autowired
    private AuthCookieService authCookieService;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private JtiDenyListService jtiDenyListService;

    @Autowired(required = false)
    private JwtTokenAuditService jwtTokenAuditService;

    @Autowired
    private RoleUrlRepository roleUrlRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private StudentProvisioningService studentProvisioningService;

    @Autowired
    private CustomUserDetailsService customUserDetailsService;

    // @PreAuthorize-Exempt: login/signup are anonymous-by-design — auth entrypoint establishes auth context, cannot consume it
    // See ControllerPreAuthorizeCoverageTest.EXCLUSIONS (15-02 / 15-06)
    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest,
            HttpServletRequest request, HttpServletResponse response) {
        // Student mode (R3): username/email + date-of-birth, no password. Issues the SAME
        // cn_at session as staff. Dissolves the separate /student/login portal.
        if (loginRequest.isStudentMode()) {
            return authenticateStudent(loginRequest, request, response);
        }

        User user = userRepository.findByEmailAndProvider(loginRequest.getEmail(), AuthProvider.local);
        if (user == null) {
            // Phase 7 (Task 7.9): burn equivalent bcrypt time on the unknown-email path so it is
            // not distinguishable by timing from a known-email/wrong-password failure, and return
            // the SAME generic message as a credential failure (no user enumeration).
            passwordEncoder.matches(
                    loginRequest.getPassword() == null ? "" : loginRequest.getPassword(), dummyHash());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse(false, "Invalid email or password."));
        }
        if (user.getIsActive() == null || !user.getIsActive()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse(false, "Your registration is under Process"));
        }

        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            loginRequest.getEmail(),
                            loginRequest.getPassword()));
        } catch (BadCredentialsException ex) {
            // Phase 7 (Task 7.9): identical generic message as the unknown-email path above, so a
            // wrong password on a real account is indistinguishable from an unknown email.
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse(false, "Invalid email or password."));
        }

        SecurityContextHolder.getContext().setAuthentication(authentication);

        // Async login activity logging - wrapped in try-catch so login is never affected
        try {
            String ipAddress = UserActivityLogService.getClientIp(request);
            String userAgent = request.getHeader("User-Agent");
            String userName = user.getName() != null ? user.getName() : "";
            String organisation = user.getOrganisation() != null ? user.getOrganisation() : "";

            userActivityLogService.logLogin(user.getId(), userName, user.getEmail(),
                    organisation, ipAddress, userAgent);
        } catch (Exception e) {
            // Silently fail - never block login due to logging
        }

        // Phase 18 Plan 02: split-token model — short-lived access JWT + opaque refresh token.
        // The access JWT carries the Phase-15 RBAC+ABAC claim shape (roles/perms/scopes/sa/jti);
        // the refresh token is an opaque UUID v4 persisted server-side in `refresh_token`.
        String accessJwt = tokenProvider.createAccessToken(authentication);

        String loginUserAgent = request.getHeader("User-Agent");
        String loginIp = UserActivityLogService.getClientIp(request);
        String refreshJti = refreshTokenService.issue(user.getId(), loginUserAgent, loginIp);

        // Phase 16-01: issue HttpOnly cn_at + non-HttpOnly cn_csrf. Phase 18-02: ALSO issue
        // cn_rt (HttpOnly, Path=/auth/refresh). The JSON body is preserved unchanged for
        // backwards compatibility with the v2.0 assessment app and external curl scripts —
        // Phase 19 will collapse this onto the cookie session.
        authCookieService.issueAuthCookies(response, accessJwt);
        authCookieService.setRefreshToken(response, refreshJti);

        return ResponseEntity.ok(new AuthResponse(accessJwt));
    }

    /**
     * Student-mode login (R3): authenticate by username-or-email + date of birth, verify the
     * user is actually a student (has a UserStudent record), lazy-provision the student role
     * group/scope if missing, then issue the same cn_at/cn_rt session as staff. Anonymous-reachable
     * because /auth/login is in SecurityConfig.PUBLIC_PATHS.
     */
    private ResponseEntity<?> authenticateStudent(LoginRequest loginRequest,
            HttpServletRequest request, HttpServletResponse response) {
        User user = findStudentUser(loginRequest.getEmail(), loginRequest.getDob());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse(false, "Invalid username/email or date of birth."));
        }

        Optional<UserStudent> userStudentOpt = userStudentRepository.getByUserId(user.getId());
        if (!userStudentOpt.isPresent()) {
            // "Is a student" gate: only users with a UserStudent record may use student mode.
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse(false, "Invalid username/email or date of birth."));
        }
        UserStudent userStudent = userStudentOpt.get();

        // Lazy safety net (R5): self-heal a student that predates / missed provisioning.
        try {
            studentProvisioningService.provision(userStudent);
        } catch (Exception e) {
            // Provisioning failure must not block login; permissions resolve from whatever exists.
        }

        // Build a fully-hydrated principal (roles/perms/scopes/sa) without a password check.
        UserDetails principal = customUserDetailsService.loadUserById(user.getId());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(authentication);

        String accessJwt = tokenProvider.createAccessToken(authentication);
        String loginUserAgent = request.getHeader("User-Agent");
        String loginIp = UserActivityLogService.getClientIp(request);
        String refreshJti = refreshTokenService.issue(user.getId(), loginUserAgent, loginIp);

        authCookieService.issueAuthCookies(response, accessJwt);
        authCookieService.setRefreshToken(response, refreshJti);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("accessToken", accessJwt);
        body.put("tokenType", "Bearer");
        body.put("userStudentId", userStudent.getUserStudentId());
        return ResponseEntity.ok(body);
    }

    /** Resolve a student User by username+DOB, falling back to email+DOB (same calendar day). */
    private User findStudentUser(String identifier, Date dob) {
        if (identifier == null || identifier.trim().isEmpty() || dob == null) {
            return null;
        }
        identifier = identifier.trim();

        Optional<User> byUsername = userRepository.findByUsernameAndDobDate(identifier, dob);
        if (byUsername.isPresent()) {
            return byUsername.get();
        }

        User byEmail = userRepository.findByEmail(identifier);
        if (byEmail != null && sameDay(byEmail.getDobDate(), dob)) {
            return byEmail;
        }
        return null;
    }

    private boolean sameDay(Date a, Date b) {
        if (a == null || b == null) {
            return false;
        }
        SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
        return sdf.format(a).equals(sdf.format(b));
    }

    /**
     * Phase 16-01 stub → Phase 18-02 + 18-03 full revoke:
     * <ol>
     *   <li>Revoke the access-token {@code jti} via {@link JtiDenyListService} so the
     *       still-live JWT cannot be reused for its remaining 60-min TTL (Plan 18-03).</li>
     *   <li>Revoke the refresh-token row via {@link RefreshTokenService#revoke(String)}
     *       reading the value from the {@code cn_rt} cookie (Plan 18-02).</li>
     *   <li>Clear ALL auth cookies via {@link AuthCookieService#clearAll} —
     *       {@code cn_at}, {@code cn_csrf}, {@code cn_rt}.</li>
     * </ol>
     *
     * <p>All steps are BEST-EFFORT — missing / expired / malformed / legacy-shape tokens
     * result in no-op revokes. Logout MUST succeed always: returns 204 even with broken
     * state. CSRF-exempt + permitAll at the SecurityConfig layer.
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        // Phase 18-03: revoke the access-token jti (best-effort — no-op on missing/legacy tokens).
        String accessJti = readAccessTokenJti(request);
        if (accessJti != null) {
            if (jwtTokenAuditService != null) {
                jwtTokenAuditService.revoke(accessJti, null, "User logout");
            } else {
                jtiDenyListService.revoke(accessJti);
            }
        }

        // Phase 18-02: revoke the refresh-token row (idempotent — no-op on missing cookie).
        authCookieService.readRefreshTokenCookie(request)
                .ifPresent(refreshTokenService::revoke);

        authCookieService.clearAll(response);
        return ResponseEntity.noContent().build();
    }

    /**
     * Phase 18 Plan 02: rotate-and-reset. Reads {@code cn_rt}, validates the row,
     * rotates it atomically via {@link RefreshTokenService#rotate}, mints a fresh
     * access JWT, and rewrites both {@code cn_at} and {@code cn_rt} cookies.
     *
     * <p>Returns 204 on success. Returns 401 + clears all auth cookies when:
     * <ul>
     *   <li>no {@code cn_rt} cookie present</li>
     *   <li>refresh-token row missing / expired / revoked</li>
     *   <li>rotation race lost ({@link RefreshTokenReuseException})</li>
     *   <li>user lookup fails (defense-in-depth — should not occur for a valid row)</li>
     * </ul>
     *
     * <p>CSRF-exempt at SecurityConfig (Phase 16-01 already added {@code /auth/refresh}
     * to {@code ignoringAntMatchers}). Also in the permitAll allowlist.
     */
    // @PreAuthorize-Exempt: refresh consumes the opaque cn_rt cookie, not a JWT.
    // The endpoint MUST work with an EXPIRED access token — that is its purpose.
    // See ControllerPreAuthorizeCoverageTest.EXCLUSIONS (15-02 / 15-06 / 18-02).
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(HttpServletRequest request, HttpServletResponse response) {
        Optional<String> rtOpt = authCookieService.readRefreshTokenCookie(request);
        if (!rtOpt.isPresent()) {
            authCookieService.clearAll(response);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String oldJti = rtOpt.get();
        // Pre-rotation validation + user-id lookup. We need the userId BEFORE rotating
        // because the new access token must encode it.
        if (!refreshTokenService.validate(oldJti).isPresent()) {
            authCookieService.clearAll(response);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Long userId = refreshTokenService.getUserIdForJti(oldJti);
        if (userId == null) {
            authCookieService.clearAll(response);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String userAgent = request.getHeader("User-Agent");
        String ip = UserActivityLogService.getClientIp(request);

        String newJti;
        try {
            newJti = refreshTokenService.rotate(oldJti, userAgent, ip);
        } catch (RefreshTokenReuseException ex) {
            // Race lost OR replay attempt. Clear cookies; the client must re-login.
            authCookieService.clearAll(response);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // Rebuild a UserPrincipal so TokenProvider can emit the Phase-15 claim shape
        // (roles via User.getRole(); perms/scopes will be repopulated by the filter
        // on the next request — refresh path lacks an Authentication context).
        User refreshedUser = userRepository.findById(userId).orElse(null);
        if (refreshedUser == null) {
            authCookieService.clearAll(response);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        UserPrincipal principal = UserPrincipal.create(refreshedUser);
        String accessJwt = tokenProvider.createAccessToken(principal);

        authCookieService.setAccessToken(response, accessJwt);
        authCookieService.setRefreshToken(response, newJti);
        return ResponseEntity.noContent().build();
    }

    /**
     * Phase 18 Plan 02: returns the current user's identity + RBAC + ABAC claims as
     * a JSON body. Derived from the authenticated {@link UserPrincipal} — which is
     * populated by Phase 15's {@code TokenAuthenticationFilter} from the JWT claims.
     *
     * <p>For pre-Phase-15 ("legacy shape") tokens that lack {@code perms} / {@code scopes},
     * {@code permissions} and {@code scopes} are empty and {@code superAdmin} is false.
     *
     * <p>Returns 401 when there is no valid access token (no principal in the security
     * context). The cookie-first {@code TokenAuthenticationFilter} (Phase 16-02) tries
     * {@code cn_at} first, then falls back to the {@code Authorization: Bearer} header.
     */
    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // Roles are GrantedAuthority#getAuthority strings — the same role-code values
        // the JWT carries in `roles[]`.
        List<String> roles = principal.getAuthorities() == null
                ? Collections.<String>emptyList()
                : principal.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .collect(Collectors.toList());

        // Phase 15 RBAC: principal.getPermissions() returns Set<String> (perms claim).
        List<String> permissions = principal.getPermissions() == null
                ? Collections.<String>emptyList()
                : new java.util.ArrayList<>(principal.getPermissions());

        // Phase 15 ABAC: principal.getScopes() returns List<CurrentScopes.ScopeRow>;
        // serialize to the short-key JSON shape {i, s, c, x} for parity with the JWT
        // claim shape so the frontend can share a parser between /me and decoded JWTs.
        List<Map<String, Object>> scopes = serializeScopes(principal.getScopes());

        // Resolve a human-readable name. UserPrincipal.getName() implements UserDetails
        // and returns String.valueOf(id) — useless as a display name. Fall back to a DB
        // lookup on User; if that fails, fall back to the email. (Phase 20 may extend
        // UserPrincipal with a cached displayName at filter time.)
        String displayName = resolveDisplayName(principal);

        // Per-user URL allow-list — distinct paths whitelisted by any of the
        // user's roles via their role groups. Used by the FE RequirePermission
        // guard for an intersection check against the permission gate.
        // Super-admins get an empty list returned but bypass the URL check
        // entirely on the FE (same convention as the permission bypass).
        List<String> urls;
        try {
            urls = roleUrlRepository.findPathsForUser(principal.getId());
        } catch (Exception e) {
            // Defensive — if the role_url table is missing on a partial-deploy
            // boot, fall back to empty rather than 500-ing the auth bootstrap.
            urls = Collections.<String>emptyList();
        }

        return ResponseEntity.ok(new MeResponse(
                principal.getId(),
                displayName,
                principal.getEmail(),
                roles,
                permissions,
                scopes,
                urls,
                principal.isSuperAdmin()
        ));
    }

    private String resolveDisplayName(UserPrincipal principal) {
        try {
            User u = userRepository.findById(principal.getId()).orElse(null);
            if (u != null && u.getName() != null && !u.getName().isEmpty()) {
                return u.getName();
            }
        } catch (Exception ignored) {
            // fall through to email
        }
        return principal.getEmail();
    }

    private static List<Map<String, Object>> serializeScopes(List<CurrentScopes.ScopeRow> rows) {
        if (rows == null || rows.isEmpty()) {
            return Collections.emptyList();
        }
        java.util.ArrayList<Map<String, Object>> out = new java.util.ArrayList<>(rows.size());
        for (CurrentScopes.ScopeRow r : rows) {
            Map<String, Object> row = new LinkedHashMap<>();
            if (r.i != null) row.put("i", r.i);
            if (r.s != null) row.put("s", r.s);
            if (r.c != null) row.put("c", r.c);
            if (r.x != null) row.put("x", r.x);
            out.add(row);
        }
        return out;
    }

    /**
     * Reads the {@code cn_at} access-token cookie from the request and extracts its
     * {@code jti} claim. Returns {@code null} if the cookie is absent, empty, malformed,
     * expired (unparseable), or pre-Phase-15 (no {@code jti} claim).
     *
     * <p>Inlined rather than delegated to {@code AuthCookieService} because the cookie
     * service currently only exposes {@code issue/clear} helpers. A future refactor may
     * promote this to {@code AuthCookieService.readAccessTokenCookie()} symmetric with
     * the refresh-token cookie reader that Plan 18-02 will introduce.
     */
    private String readAccessTokenJti(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie c : cookies) {
            if (AuthCookieService.ACCESS_COOKIE.equals(c.getName())) {
                String value = c.getValue();
                if (value != null && !value.isEmpty()) {
                    return tokenProvider.getJtiFromToken(value);
                }
            }
        }
        return null;
    }

    /**
     * Phase 16-04: Bridge between the OAuth2 success handler (which emits a URL-query
     * JWT today and is OUT OF SCOPE for Phase 16) and the new cookie-based session.
     *
     * <p>The browser is redirected by the OAuth handler to {@code /oauth2/redirect?token=<jwt>}.
     * The frontend extracts that token from {@code window.location.search} and POSTs it here.
     * We re-validate the JWT (signature + expiry) via {@link TokenProvider#validateToken(String)}
     * and, on success, emit the standard {@code cn_at} + {@code cn_csrf} cookies via
     * {@link AuthCookieService#issueAuthCookies(HttpServletResponse, String)}. The frontend then
     * strips the token from the URL with {@code window.history.replaceState}.
     *
     * <p>This endpoint is CSRF-exempt (Plan 16-01 added it to {@code ignoringAntMatchers})
     * and listed in the permitAll allowlist — authentication is established by the body token
     * itself, not by a prior session. Phase 18 will tighten this further with a {@code jti}
     * deny-list and (eventually) by collapsing this endpoint into the OAuth handler.
     */
    // @PreAuthorize-Exempt: oauth-exchange establishes the cookie session from a body-bound
    // JWT issued seconds earlier by the OAuth2 success handler — there is no prior auth
    // context to consume. See ControllerPreAuthorizeCoverageTest.EXCLUSIONS (15-02 / 15-06).
    @PostMapping("/oauth-exchange")
    public ResponseEntity<?> exchangeOAuthToken(
            @Valid @RequestBody OAuthExchangeRequest body,
            HttpServletResponse response) {
        String token = body.getToken();
        if (token == null || token.isEmpty() || !tokenProvider.validateToken(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiResponse(false, "Invalid or expired token"));
        }
        authCookieService.issueAuthCookies(response, token);
        return ResponseEntity.ok(new ApiResponse(true, "Cookies issued"));
    }

    // @PreAuthorize-Exempt: login/signup are anonymous-by-design — auth entrypoint establishes auth context, cannot consume it
    // See ControllerPreAuthorizeCoverageTest.EXCLUSIONS (15-02 / 15-06)
    @PostMapping("/signup")
    public ResponseEntity<?> registerUser(@Valid @RequestBody SignUpRequest signUpRequest) {
        
        if (userRepository.existsByEmail(signUpRequest.getEmail())) {
            throw new DuplicateResourceException("Email address already in use.");
        }
        if (signUpRequest.getPhone() == null || signUpRequest.getPhone().trim().isEmpty()) {
            throw new BadRequestException("Phone number is required.");
        }
        if (userRepository.existsByPhone(signUpRequest.getPhone())) {
            throw new DuplicateResourceException("Phone number already in use.");
        }
        // if (signUpRequest.getAcceptTerms() == null || !signUpRequest.getAcceptTerms()) {
        //     throw new BadRequestException("You must accept the terms and conditions.");
        // }

    // Creating user's account
    User user = new User();
    // set name from firstname+lastname if available otherwise use provided name
    String fullName = (signUpRequest.getFirstname() != null && !signUpRequest.getFirstname().isBlank())
        ? signUpRequest.getFirstname() + " " + signUpRequest.getLastname()
        : "";
    user.setName(signUpRequest.getFirstname() + " " + signUpRequest.getLastname());
    user.setEmail(signUpRequest.getEmail());
    user.setPhone(signUpRequest.getPhone());
    user.setOrganisation(signUpRequest.getOrganisation());
    user.setDesignation(signUpRequest.getDesignation());
    user.setAcceptTerms(signUpRequest.getAcceptTerms());
    user.setProvider(AuthProvider.local);

    user.setPassword(passwordEncoder.encode(signUpRequest.getPassword()));

    User result = userRepository.save(user);

        URI location = ServletUriComponentsBuilder
                .fromCurrentContextPath().path("/user/me")
                .buildAndExpand(result.getId()).toUri();

    // Send welcome email asynchronously (fire-and-forget)
    try {
        String subject = "Welcome to Career-9";
        String body = "Hello " + fullName + ",\n\nThank you for registering.\nYour account is under review.We will get back to you soon.\n\nRegards,\nCareer-9 Team";
        smtpEmailService.sendSimpleEmail(user.getEmail(), subject, body);
    } catch (Exception e) {
        // log and continue - do not fail registration because of email
    }

    return ResponseEntity.created(location)
        .body(new ApiResponse(true, "User registered successfully"));
    }
    // return ResponseEntity.ok(new ApiResponse(true, "User registered successfully"));
    // }
}
