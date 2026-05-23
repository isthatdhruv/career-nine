package com.kccitm.api.config;

import java.util.Arrays;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.BeanIds;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.firewall.HttpFirewall;
import org.springframework.security.web.firewall.StrictHttpFirewall;
import org.springframework.security.web.header.HeaderWriter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.kccitm.api.security.CustomUserDetailsService;
import com.kccitm.api.security.RestAuthenticationEntryPoint;
import com.kccitm.api.security.TokenAuthenticationFilter;
import com.kccitm.api.security.oauth2.CustomOAuth2UserService;
import com.kccitm.api.security.oauth2.HttpCookieOAuth2AuthorizationRequestRepository;
import com.kccitm.api.security.oauth2.OAuth2AuthenticationFailureHandler;
import com.kccitm.api.security.oauth2.OAuth2AuthenticationSuccessHandler;
import com.kccitm.api.security.ratelimit.BucketRegistry;
import com.kccitm.api.security.ratelimit.RateLimitConfig;
import com.kccitm.api.security.ratelimit.RateLimitFilter;

@Configuration
@EnableWebSecurity
@EnableGlobalMethodSecurity(securedEnabled = true, jsr250Enabled = true, prePostEnabled = true)
public class SecurityConfig extends WebSecurityConfigurerAdapter {

    @Value("${app.cors.allowedOrigins}")
    private String[] allowedOrigins;

    /**
     * Phase 20-03: active Spring profile, used to gate HSTS (production only) and CSP
     * (report-only in all profiles until manual sign-off flips production to enforcing).
     *
     * <p>Defaults to {@code dev} when {@code spring.profiles.active} is unset so the most
     * permissive header set ships when the profile is unspecified.
     */
    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    @Value("${app.cookie.domain:}")
    private String cookieDomain;

    @Autowired
    private CustomUserDetailsService customUserDetailsService;

    @Autowired
    private CustomOAuth2UserService customOAuth2UserService;

    @Autowired
    private OAuth2AuthenticationSuccessHandler oAuth2AuthenticationSuccessHandler;

    @Autowired
    private OAuth2AuthenticationFailureHandler oAuth2AuthenticationFailureHandler;

    // Phase 20-01: in-process rate limit dependencies (Bucket4j).
    @Autowired
    private BucketRegistry bucketRegistry;

    @Autowired
    private RateLimitConfig rateLimitConfig;

    // @Autowired
    // private HttpCookieOAuth2AuthorizationRequestRepository
    // httpCookieOAuth2AuthorizationRequestRepository;

    /**
     * Phase 0 (Task 0.1) — single source of truth for anonymous-by-design request paths.
     *
     * <p>Fed to BOTH the CSRF {@code ignoringAntMatchers(...)} list and the
     * {@code authorizeRequests().permitAll()} list in {@link #configure(HttpSecurity)}, so the
     * two can never drift. The prior split definition (two hand-maintained lists) was the root
     * cause of the audit's HIGH-B / MED-C findings: several B2C funnel endpoints were
     * CSRF-exempt but NOT permitAll (so anonymous callers got 401), and others were permitAll
     * but NOT CSRF-exempt.
     *
     * <p>Every entry is either auth-bootstrap (no prior {@code cn_csrf} cookie exists yet) or an
     * anonymous B2C / registration funnel gated by an in-controller signature / token /
     * promo-lookup check rather than by Spring auth.
     *
     * <p>NOTE (Phase 2 / HIGH-B follow-up): {@code /promo-code/validate} is the legacy
     * (mis-typed) path; the live endpoint is {@code /promo-codes/public/validate}. Phase 2
     * corrects this and removes the now-redundant {@code @PreAuthorize} on these genuinely
     * anonymous handlers. {@code /util/file-get/**} is deliberately NOT in this set: Phase 1
     * (CRIT-B) removes its public access entirely, so it stays a separate, clearly-flagged
     * permitAll entry below rather than being baked into the shared constant.
     */
    private static final String[] PUBLIC_PATHS = {
            // --- auth bootstrap / token lifecycle ---
            "/auth/login",
            "/auth/signup",
            "/auth/logout",
            "/auth/oauth-exchange",
            "/auth/refresh",
            // Phase 19: assessment-session minting is the SPA's first call; no prior cn_csrf.
            "/auth/assessment-session",
            "/oauth2/**",
            // --- payment + anonymous B2C / registration funnels ---
            // POSTs issued by students/landing pages that never sign in (no cn_csrf to echo);
            // each body is protected by a signature / token / promo-lookup gate in-controller.
            "/payment/webhook/**",
            "/campaign/public/**",
            "/entitlement/redeem-token",
            // Phase 2 (Task 2.1 / HIGH-B): corrected from the dead "/promo-code/validate" typo to
            // the real endpoint path; was CSRF-exempt-but-not-permitAll, so anonymous validation 401'd.
            "/promo-codes/public/validate",
            "/bet-report-data/public/**",
            "/navigator-report-data/public/**",
            "/assessment-mapping/public/**",
            "/school-registration/public/**",
            // Phase 2 (Task 2.1 / HIGH-B): landing-page lead capture — was not permitAll (401 for
            // external pages). The handler validates/sanitises the body itself.
            "/leads/capture",
            // Phase 2 (Task 2.2 / HIGH-A): counsellor self-registration + login are pre-auth flows
            // for users who have no session yet. Now reachable anonymously; their @PreAuthorize is removed.
            "/api/counsellor/self-register",
            "/api/counsellor/login"
    };

    /** Static assets + root/error/favicon — always anonymous (Phase 0 Task 0.1 extraction). */
    private static final String[] STATIC_ASSET_PATHS = {
            "/",
            "/error",
            "/favicon.ico",
            "/**/*.png",
            "/**/*.gif",
            "/**/*.svg",
            "/**/*.jpg",
            "/**/*.html",
            "/**/*.css",
            "/**/*.js"
    };

    @Bean
    public TokenAuthenticationFilter tokenAuthenticationFilter() {
        return new TokenAuthenticationFilter();
    }

    /**
     * Phase 20-01: per-IP rate-limit filter.
     *
     * <p>Registered BEFORE {@link TokenAuthenticationFilter} in {@link #configure(HttpSecurity)}
     * so brute-force on unauthenticated {@code /auth/login}, {@code /auth/refresh},
     * {@code /auth/signup} is rejected without engaging the JWT parser.
     */
    @Bean
    public RateLimitFilter rateLimitFilterIp() {
        return new RateLimitFilter(RateLimitFilter.Mode.PER_IP, bucketRegistry, rateLimitConfig);
    }

    /**
     * Phase 20-01: per-user rate-limit filter.
     *
     * <p>Registered AFTER {@link TokenAuthenticationFilter} so the security context
     * holds an authenticated {@link com.kccitm.api.security.UserPrincipal} this
     * filter can key its buckets off.
     */
    @Bean
    public RateLimitFilter rateLimitFilterUser() {
        return new RateLimitFilter(RateLimitFilter.Mode.PER_USER, bucketRegistry, rateLimitConfig);
    }

    /**
     * Phase 16-01: CSRF double-submit token repository.
     *
     * <p>{@code withHttpOnlyFalse()} makes the cookie readable by JavaScript so the
     * frontend interceptor (Plan 16-03) can copy it into the {@code X-CSRF-Token}
     * header on every state-changing request. We pin:
     * <ul>
     *   <li>{@code cookieName = "cn_csrf"} so it shares naming convention with {@code cn_at}
     *       (and matches what {@code AuthCookieService} emits at login).</li>
     *   <li>{@code headerName = "X-CSRF-Token"} matching the frontend interceptor contract.</li>
     *   <li>{@code cookiePath = "/"} so the token covers every authenticated route.</li>
     * </ul>
     *
     * <p>Caveat: Spring 2.5's {@code CookieCsrfTokenRepository} cannot emit a
     * {@code SameSite} attribute on its own (Servlet 4 API limitation). The cookie WE
     * issue at {@code /auth/login} via {@code AuthCookieService} does set
     * {@code SameSite=Strict}; on subsequent state-changing responses Spring overwrites
     * {@code cn_csrf} without {@code SameSite} and relies on container defaults. This
     * is an acceptable Phase-16 defect; Phase 18 will harden via a custom subclass.
     */
    @Bean
    public CookieCsrfTokenRepository csrfTokenRepository() {
        CookieCsrfTokenRepository repo = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repo.setCookieName("cn_csrf");
        repo.setHeaderName("X-CSRF-Token");
        repo.setCookiePath("/");
        // When frontend and API live on different subdomains (e.g.
        // staging-dashboard.career-9.com → api-staging.career-9.com), the
        // cn_csrf cookie must carry Domain=.career-9.com so frontend JS can
        // read it for the double-submit CSRF pattern.
        if (cookieDomain != null && !cookieDomain.isEmpty()) {
            repo.setCookieDomain(cookieDomain);
        }
        return repo;
    }

    @Bean
    public HttpFirewall strictHttpFirewall() {
        // Use all StrictHttpFirewall defaults. The defaults reject:
        //  - non-standard HTTP methods (TRACE, CONNECT, custom verbs)
        //  - URL-encoded slashes (%2F)
        //  - double slashes (//)
        //  - semicolons (;)
        //  - backslashes (\)
        //  - percent (%) in path
        // Verified via grep: no controllers use matrix params, TRACE/CONNECT,
        // or rely on semicolon paths.
        return new StrictHttpFirewall();
    }

    /*
     * By default, Spring OAuth2 uses
     * HttpSessionOAuth2AuthorizationRequestRepository to save
     * the authorization request. But, since our service is stateless, we can't save
     * it in
     * the session. We'll save the request in a Base64 encoded cookie instead.
     */
    @Bean
    public HttpCookieOAuth2AuthorizationRequestRepository cookieAuthorizationRequestRepository() {
        return new HttpCookieOAuth2AuthorizationRequestRepository();
    }

    @Override
    public void configure(AuthenticationManagerBuilder authenticationManagerBuilder) throws Exception {
        authenticationManagerBuilder
                .userDetailsService(customUserDetailsService)
                .passwordEncoder(passwordEncoder());
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean(BeanIds.AUTHENTICATION_MANAGER)
    @Override
    public AuthenticationManager authenticationManagerBean() throws Exception {
        return super.authenticationManagerBean();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(Arrays.asList(allowedOrigins));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList(
                "Authorization",
                "Content-Type",
                "Accept",
                // Phase 16-01: frontend CSRF interceptor (AuthHelpers.setupAxios)
                // mirrors the cn_csrf cookie into this header on every state-
                // changing request (POST/PUT/PATCH/DELETE). Must be in the CORS
                // allow-list or the browser preflight refuses cross-origin calls
                // from the React dev server (http://localhost:3000 → :8080/:8091).
                "X-CSRF-Token",
                "X-Assessment-Session",
                "X-Assessment-Student-Id",
                "X-Assessment-Id",
                "X-Requested-With"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http
                .cors().configurationSource(corsConfigurationSource())
                .and()
                // Phase 20-03: OWASP security response headers.
                //  - X-Frame-Options: DENY                 — clickjacking defense, every profile
                //  - X-Content-Type-Options: nosniff       — MIME-sniff defense, every profile
                //  - Referrer-Policy: strict-origin-when-cross-origin — referrer leak defense, every profile
                //  - Strict-Transport-Security             — production profile ONLY (HSTS would pin
                //                                            browsers to https:// on dev http:// origins
                //                                            for the max-age TTL and brick local work).
                //  - Content-Security-Policy-Report-Only   — every profile, including production. The
                //                                            enforcing flip to `Content-Security-Policy`
                //                                            is DEFERRED to manual user action after a
                //                                            7-day staging soak (see 20-03-SUMMARY).
                .headers(headers -> headers
                        .frameOptions(frame -> frame.deny())
                        .contentTypeOptions(cto -> {})
                        .referrerPolicy(rp -> rp.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds("production".equals(activeProfile) ? 31536000L : 0L)
                                .preload(false))
                        .addHeaderWriter(buildCspHeaderWriter())
                )
                .sessionManagement()
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                .and()
                // Phase 16-01: CSRF protection via double-submit cookie pattern.
                // Login/signup/logout/refresh/oauth-exchange + OAuth callbacks + Razorpay
                // webhooks are exempt — none have a prior cn_csrf cookie to validate against.
                .csrf()
                .csrfTokenRepository(csrfTokenRepository())
                // Phase 0 (Task 0.1): exempt the shared PUBLIC_PATHS set. Sourced from the
                // SAME constant fed to permitAll() below so the CSRF-exempt and
                // authentication-exempt sets can never drift (audit MED-C / HIGH-B root cause).
                .ignoringAntMatchers(PUBLIC_PATHS)
                .and()
                .formLogin()
                .disable()
                .httpBasic()
                .disable()
                .exceptionHandling()
                .authenticationEntryPoint(new RestAuthenticationEntryPoint())
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setContentType("application/json");
                    response.setStatus(403);
                    response.getWriter().write("{\"status\":403,\"error\":\"Forbidden\",\"message\":\"You do not have permission to perform this action\",\"path\":\"" + request.getRequestURI() + "\"}");
                })
                .and()
                .authorizeRequests()
                // CORS preflight — must stay open for every path
                .antMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // Root, error page, favicon, static assets (Phase 0 Task 0.1: extracted constant).
                .antMatchers(STATIC_ASSET_PATHS)
                .permitAll()
                // Public application endpoints — Phase 0 (Task 0.1): the SAME PUBLIC_PATHS
                // constant fed to ignoringAntMatchers() above, so anonymous-reachable and
                // CSRF-exempt sets stay in lockstep.
                .antMatchers(PUBLIC_PATHS)
                .permitAll()
                // CRIT-B (audit) — /util/file-get/** is an UNAUTHENTICATED arbitrary GCS object
                // read. It is intentionally kept OUT of PUBLIC_PATHS and isolated here because
                // Phase 1 (Task 1.1) REMOVES this permitAll entry entirely and replaces it with
                // an authenticated + scope-checked (or signed-URL) handler. DO NOT fold this into
                // PUBLIC_PATHS. (It is a GET, so CSRF exemption is not needed.)
                .antMatchers("/util/file-get/**")
                .permitAll()
                // Phase 20-04: Spring Boot Actuator lockdown.
                // Order matters — Spring Security's antMatcher chain is first-match-wins,
                // so the more-specific /actuator/health line MUST come before the broader
                // /actuator/** line.
                //
                // Health probe for load balancers (DigitalOcean App Platform / k8s) — anonymous.
                // OPERATOR NOTE: if production switches to authenticated health probes via a
                // SUPER_ADMIN service-account credential, remove the carve-out line below and
                // confirm infra has updated the probe configuration BEFORE deploying.
                .antMatchers("/actuator/health").permitAll()
                // Everything else under /actuator/** requires SUPER_ADMIN or INFRA_ADMIN.
                // Note on hasAnyAuthority vs hasAnyRole: Career-9's UserPrincipal stores
                // authorities as raw role-name strings (e.g. "SUPER_ADMIN") via
                // `new SimpleGrantedAuthority(role.getName())` in User.getRole() — there is
                // NO `ROLE_` prefix. `hasAnyRole(...)` would check for `ROLE_SUPER_ADMIN`
                // and fail. Use `hasAnyAuthority(...)` so the literal authority string is
                // compared.
                //
                // PRODUCT FOLLOW-UP: the `INFRA_ADMIN` role is NOT yet seeded in the DB
                // (grep for INFRA_ADMIN returns zero hits across java + resources before
                // this plan). Until the role is seeded and assigned to an on-call ops
                // user, only SUPER_ADMIN principals can hit /actuator/metrics, /info, etc.
                // See 20-04-SUMMARY.md for the seeding recipe.
                .antMatchers("/actuator/**").hasAnyAuthority("SUPER_ADMIN", "INFRA_ADMIN")
                .anyRequest()
                .authenticated()
                .and()
                .oauth2Login()
                .authorizationEndpoint()
                .baseUri("/oauth2/authorize")
                .authorizationRequestRepository(cookieAuthorizationRequestRepository())
                .and()
                .redirectionEndpoint()
                .baseUri("/oauth2/callback/*")
                .and()
                .userInfoEndpoint()
                .userService(customOAuth2UserService)
                .and()
                .successHandler(oAuth2AuthenticationSuccessHandler)
                .failureHandler(oAuth2AuthenticationFailureHandler);

        // Phase 20-01 + 13-02 filter chain order:
        //   rate-limit-IP  →  TokenAuthenticationFilter  →  UsernamePasswordAuthenticationFilter  →  rate-limit-user
        //
        // Anchor: UsernamePasswordAuthenticationFilter (a Spring Security built-in
        // known to FilterOrderRegistration). DO NOT anchor on TokenAuthenticationFilter
        // — it's a custom filter not in the registration map, and the lookup returns
        // null which Spring then unboxes → NPE at boot.
        //
        // Spring resolves "same anchor" registrations in REGISTRATION ORDER, so the
        // sequence below produces the chain above.

        // 1. Per-IP rate limit — first, so anonymous brute force on /auth/login is
        //    rejected before any auth machinery is engaged.
        http.addFilterBefore(rateLimitFilterIp(), UsernamePasswordAuthenticationFilter.class);

        // 2. Token-based JWT auth filter (populates SecurityContext).
        http.addFilterBefore(tokenAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class);

        // 3. Per-user rate limit — after UsernamePasswordAuthenticationFilter, so
        //    SecurityContext holds the authenticated UserPrincipal we key buckets off.
        http.addFilterAfter(rateLimitFilterUser(), UsernamePasswordAuthenticationFilter.class);
    }

    /**
     * Phase 20-03: build the Content-Security-Policy header writer.
     *
     * <p><b>Safety posture (per user directive, plan 20-03):</b> CSP ships as
     * {@code Content-Security-Policy-Report-Only} in EVERY profile — including production —
     * for this phase. Browsers will log violations to the devtools console without blocking
     * any resource. The flip to enforcing {@code Content-Security-Policy} is DEFERRED to
     * manual user action after a 7-day staging soak with zero unresolved violations on
     * legitimate Career-9 flows (see {@code 20-03-SUMMARY.md} "REQUIRES USER ACTION").
     *
     * <p><b>Policy allowlist (Career-9 known third-party origins):</b>
     * <ul>
     *   <li>{@code default-src 'self'} — same-origin by default.</li>
     *   <li>{@code script-src} — self + Bootstrap/Metronic CDN ({@code cdn.jsdelivr.net}),
     *       Razorpay checkout, Firebase, Google APIs. Includes {@code 'unsafe-inline'}
     *       and {@code 'unsafe-eval'} because the existing Career-9 frontend ships
     *       inline {@code <script>} blocks and inline event handlers (Metronic template
     *       pattern). This is a known weakness — nonce-based CSP is a follow-up phase.</li>
     *   <li>{@code style-src} — self + Google Fonts + Bootstrap/Metronic CDN, plus
     *       {@code 'unsafe-inline'} for inline styles.</li>
     *   <li>{@code font-src} — self + Google Fonts ({@code fonts.gstatic.com}) +
     *       {@code data:} URIs for icon fonts.</li>
     *   <li>{@code img-src} — permissive ({@code https:} + {@code http:} + {@code data:}
     *       + {@code blob:}) to cover Mandrill tracking pixels, Firebase storage,
     *       Razorpay logos, base64 inline images, generated PDF previews.</li>
     *   <li>{@code connect-src} — self + Career-9 API origins + Firebase HTTP/WSS.</li>
     *   <li>{@code frame-src} — Razorpay checkout iframe origins.</li>
     *   <li>{@code object-src 'none'} — block legacy {@code <object>/<embed>} plugins.</li>
     *   <li>{@code base-uri 'self'} — pin the base URI to prevent injected
     *       {@code <base>} tag attacks.</li>
     *   <li>{@code form-action 'self'} — forbid cross-origin form submissions.</li>
     * </ul>
     *
     * <p>Known weakness: {@code 'unsafe-inline'} + {@code 'unsafe-eval'} in {@code script-src}
     * significantly weaken the XSS protection CSP would otherwise provide. The remaining
     * directives ({@code connect-src}, {@code img-src}, {@code frame-src},
     * {@code object-src 'none'}, {@code base-uri 'self'}, {@code form-action 'self'})
     * still close meaningful attack surface.
     */
    private HeaderWriter buildCspHeaderWriter() {
        final String policy = String.join("; ",
                // default: same-origin only
                "default-src 'self'",
                // scripts: self + CDN + Razorpay + Firebase + Google APIs + inline/eval (Metronic legacy)
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://checkout.razorpay.com https://*.firebaseio.com https://*.googleapis.com",
                // styles: self + Google Fonts + CDN + inline (Bootstrap/Metronic)
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
                // fonts: self + Google Fonts + data: URIs
                "font-src 'self' data: https://fonts.gstatic.com",
                // images: permissive (Mandrill tracking pixels, Firebase storage, generated previews)
                "img-src 'self' data: blob: https: http:",
                // XHR/fetch/WebSocket: self + Career-9 API + Firebase
                "connect-src 'self' https://*.career-9.com https://*.career-9.net https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com",
                // frames: Razorpay checkout iframe
                "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
                // disallow plugins
                "object-src 'none'",
                // base URI locked to self
                "base-uri 'self'",
                // form actions to self only
                "form-action 'self'"
        );

        // Always emit Content-Security-Policy-Report-Only in this phase (every profile).
        // The flip to enforcing `Content-Security-Policy` for production is a deferred
        // manual user action — see 20-03-SUMMARY "REQUIRES USER ACTION".
        final String headerName = "Content-Security-Policy-Report-Only";
        final String headerValue = policy;
        return (request, response) -> {
            if (!response.containsHeader(headerName)) {
                response.setHeader(headerName, headerValue);
            }
        };
    }
}
