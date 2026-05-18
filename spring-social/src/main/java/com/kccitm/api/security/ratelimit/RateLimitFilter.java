package com.kccitm.api.security.ratelimit;

import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import com.kccitm.api.security.UserPrincipal;

import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;

/**
 * Phase 20-01: in-process token-bucket rate-limit filter.
 *
 * <p>The same class supports two modes. {@code SecurityConfig} instantiates two
 * filter beans with different {@link Mode} values and registers them at two
 * different positions in the chain:
 * <ul>
 *   <li>{@link Mode#PER_IP} runs BEFORE {@code TokenAuthenticationFilter} —
 *       brute-force on unauthenticated {@code /auth/login} is rejected without
 *       engaging the JWT parser.</li>
 *   <li>{@link Mode#PER_USER} runs AFTER {@code TokenAuthenticationFilter} so
 *       that {@code SecurityContextHolder} holds an authenticated
 *       {@code UserPrincipal} this filter can key off.</li>
 * </ul>
 *
 * <p>On rate-limit breach the filter responds with HTTP 429 + a
 * {@code Retry-After} header (integer seconds), short-circuiting the chain.
 *
 * <p>CORS pre-flight ({@code OPTIONS}) requests are ALWAYS bypassed — pre-flight
 * is the browser's right to ask the server about CORS and must never be capped.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    public enum Mode { PER_IP, PER_USER }

    /**
     * PER_IP scope (run BEFORE auth filter — these are unauthenticated brute-force targets).
     * Match exactly the three auth endpoints. Avoid prefix matches — {@code /auth/me} or
     * {@code /auth/logout} must NOT be capped.
     */
    private static final Set<String> PER_IP_PATHS;
    static {
        Set<String> s = new HashSet<>(Arrays.asList(
                "/auth/login",
                "/auth/refresh",
                "/auth/signup"));
        PER_IP_PATHS = Collections.unmodifiableSet(s);
    }

    /**
     * PER_USER scope (run AFTER auth filter — needs {@link UserPrincipal}).
     * {@code /student/save-csv} is exact. The other two are wildcard.
     */
    private static final Pattern PER_USER_PATTERNS = Pattern.compile(
            "^/student/save-csv$|" +
            "^/user/getbyid/.+$|" +
            "^/student-info/getStudentsWithMappingByInstituteId/.+$");

    private final Mode mode;
    private final BucketRegistry registry;
    private final RateLimitConfig config;

    public RateLimitFilter(Mode mode, BucketRegistry registry, RateLimitConfig config) {
        this.mode = mode;
        this.registry = registry;
        this.config = config;
        // Boot-time ordering breadcrumb — proves runtime registration order matches design.
        // Verified by the verify-block: boot the app and grep for both lines.
        if (mode == Mode.PER_IP) {
            log.info("RateLimitFilter [ip] initialized — runs before TokenAuthenticationFilter");
        } else {
            log.info("RateLimitFilter [user] initialized — runs after TokenAuthenticationFilter");
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                     FilterChain chain) throws ServletException, IOException {

        // Always bypass CORS pre-flight.
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }

        if (!config.isEnabled() || !shouldRateLimit(request)) {
            chain.doFilter(request, response);
            return;
        }

        String identifier = resolveIdentifier(request);
        if (identifier == null) {
            // PER_USER mode but no authenticated principal — let the chain proceed; the
            // downstream 401 (RestAuthenticationEntryPoint) will handle it. We don't
            // double-charge the IP-bucket here; that's the per-IP filter's job (which has
            // already run by the time we reach here in PER_USER mode).
            chain.doFilter(request, response);
            return;
        }

        BucketRegistry.Category category = (mode == Mode.PER_IP)
                ? BucketRegistry.Category.IP
                : BucketRegistry.Category.USER;
        Bucket bucket = registry.bucketFor(category, identifier);
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);

        if (probe.isConsumed()) {
            response.setHeader("X-RateLimit-Remaining", String.valueOf(probe.getRemainingTokens()));
            chain.doFilter(request, response);
            return;
        }

        long retryAfterSec = Math.max(1L, probe.getNanosToWaitForRefill() / 1_000_000_000L);
        // Servlet API in Spring Boot 2.5 (javax.servlet 4.0) does not expose a
        // SC_TOO_MANY_REQUESTS constant on HttpServletResponse — use the literal 429.
        response.setStatus(429);
        response.setHeader("Retry-After", String.valueOf(retryAfterSec));
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"status\":429,\"error\":\"Too Many Requests\","
                + "\"message\":\"Rate limit exceeded. Try again in " + retryAfterSec + "s.\","
                + "\"path\":\"" + request.getRequestURI() + "\"}");
        log.warn("RATE_LIMIT_BREACH mode={} category={} id={} path={}",
                mode, category, identifier, request.getRequestURI());
    }

    private boolean shouldRateLimit(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path == null) {
            return false;
        }
        if (mode == Mode.PER_IP) {
            return PER_IP_PATHS.contains(path);
        }
        return PER_USER_PATTERNS.matcher(path).matches();
    }

    private String resolveIdentifier(HttpServletRequest request) {
        if (mode == Mode.PER_IP) {
            return clientIp(request);
        }
        // PER_USER
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof UserPrincipal)) {
            return null;
        }
        return String.valueOf(((UserPrincipal) auth.getPrincipal()).getId());
    }

    private String clientIp(HttpServletRequest request) {
        // Fail-safe default: only honor X-Forwarded-For when explicitly trusted via config.
        // Without a known upstream proxy, XFF is client-controlled and spoofable — an attacker
        // could rotate the header value to bypass per-IP buckets. The
        // `app.rate-limit.trust-xff` flag defaults to `false` (dev/sandbox) and is set
        // `true` only on profiles that run behind a trusted reverse proxy
        // (staging/production).
        if (config.isTrustXff()) {
            String xff = request.getHeader("X-Forwarded-For");
            if (xff != null && !xff.trim().isEmpty()) {
                // Take the leftmost (original client). DigitalOcean App Platform / nginx-ingress
                // set this header AND strip any incoming XFF from untrusted clients.
                return xff.split(",")[0].trim();
            }
        }
        return request.getRemoteAddr();
    }
}
