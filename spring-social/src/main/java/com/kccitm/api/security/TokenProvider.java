package com.kccitm.api.security;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import javax.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;

import com.kccitm.api.config.AppProperties;
import com.kccitm.api.model.JwtTokenAudit.TokenType;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.SignatureException;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Keys;

/**
 * JWT mint + parse for the Phase 15 hybrid RBAC + ABAC claim shape.
 *
 * <p>New claim shape (replacing the pre-Phase-15 sub-only token):
 * <ul>
 *   <li>{@code sub} — user id (unchanged)</li>
 *   <li>{@code jti} — UUID (used by Phase 18's revocation list)</li>
 *   <li>{@code roles[]} — string role codes (from {@code GrantedAuthority})</li>
 *   <li>{@code perms[]} — string permission codes (RBAC)</li>
 *   <li>{@code scopes[]} — array of objects with shortened keys {@code i/s/c/x}
 *       (institute / session / course / section); any key may be missing = wildcard</li>
 *   <li>{@code sa} — super-admin bool</li>
 * </ul>
 *
 * <p>Legacy tokens (minted before Phase 15) lack {@code perms} and {@code scopes}.
 * {@link #parseClaims(String)} detects that shape and flags {@code isLegacyShape=true};
 * {@link TokenAuthenticationFilter} then logs {@code LEGACY_TOKEN} and proceeds
 * with empty perms (safe in log-only mode).
 */
@Service
public class TokenProvider {

    private static final Logger logger = LoggerFactory.getLogger(TokenProvider.class);

    private AppProperties appProperties;

    /**
     * Records every minted JWT into {@code jwt_token_audit} for the super-admin
     * console. Field-injected (not constructor-injected) so the audit hook is a
     * pure additive change to a class that other security-package beans depend
     * on heavily. Best-effort — the service swallows DB failures internally.
     */
    @Autowired(required = false)
    private JwtTokenAuditService auditService;

    /**
     * HS512 signing/verification key, built once from the raw bytes of
     * {@code app.auth.tokenSecret}. The previous {@code signWith(alg, String)}
     * overload base64-decoded the secret string and threw
     * {@code DecodingException} on any non-base64 character (e.g. {@code _}).
     * Using {@link Keys#hmacShaKeyFor(byte[])} treats the secret as raw bytes,
     * so any sufficiently long (≥ 64 bytes / 512 bits for HS512) string works.
     *
     * <p>Generate a production secret with: {@code openssl rand -base64 64}
     * (treat the output as an opaque string; the bytes-as-UTF-8 path here does
     * not care whether it is base64 or not).
     */
    private Key signingKey;

    public TokenProvider(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    @PostConstruct
    void initSigningKey() {
        String secret = appProperties.getAuth().getTokenSecret();
        if (secret == null || secret.isEmpty()) {
            throw new IllegalStateException(
                    "app.auth.tokenSecret is missing — set APP_AUTH_TOKEN_SECRET to a 64+ byte random string");
        }
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 64) {
            throw new IllegalStateException(
                    "app.auth.tokenSecret must be at least 64 bytes for HS512; current length is "
                            + bytes.length + ". Generate one with: openssl rand -base64 64");
        }
        this.signingKey = Keys.hmacShaKeyFor(bytes);
    }

    /**
     * Legacy single-token minter — emits the FULL Phase-15 RBAC+ABAC claim shape
     * (roles, perms, scopes, sa, jti). Uses {@code tokenExpirationMsec} (10-day v2.0 TTL)
     * to preserve backwards-compat for OAuth callers that haven't migrated to the
     * Phase-18 split-token model yet.
     *
     * <p>Phase 18 callers ({@code /auth/login}, {@code /auth/refresh}) should call
     * {@link #createAccessToken(Authentication)} instead, which uses the new short-lived
     * 60-min TTL and is paired with an opaque refresh token from
     * {@code RefreshTokenService.issue}.
     */
    public String createToken(Authentication authentication) {
        return buildJwtFromAuthentication(authentication,
                appProperties.getAuth().getTokenExpirationMsec(), TokenType.LEGACY);
    }

    /**
     * Phase 18 access-token minter. Identical claim shape to {@link #createToken} but
     * uses the new {@code accessTokenExpirationMsec} (default 60 min) instead of the
     * legacy 10-day TTL. Always carries a UUID {@code jti} claim — that is the key the
     * Plan 18-03 Caffeine deny-list looks up for emergency revocation.
     */
    public String createAccessToken(Authentication authentication) {
        return buildJwtFromAuthentication(authentication,
                appProperties.getAuth().getAccessTokenExpirationMsec(), TokenType.ACCESS);
    }

    /**
     * Phase 18 access-token minter for callers that already have a {@link UserPrincipal}
     * resolved (e.g. {@code /auth/refresh} after a successful refresh-token rotation —
     * there is no fresh {@link Authentication} object on that path).
     */
    public String createAccessToken(UserPrincipal userPrincipal) {
        return buildJwt(userPrincipal,
                appProperties.getAuth().getAccessTokenExpirationMsec(), TokenType.ACCESS);
    }

    /**
     * Admin-impersonation minter: mints a short-lived (5 min) access token for
     * {@link com.kccitm.api.controller.ImpersonationController}. A URL/sessionStorage-borne
     * impersonation token should live only long enough for the admin to open the student
     * dashboard tab — not the full 60-min {@link #createAccessToken(UserPrincipal)} TTL.
     */
    public String createImpersonationToken(UserPrincipal userPrincipal) {
        return buildJwt(userPrincipal, 5 * 60 * 1000L, TokenType.ACCESS);
    }

    /**
     * Opaque refresh-token string generator. Refresh tokens are NOT JWTs — they are
     * UUID v4 strings whose only server-side state lives in the {@code refresh_token}
     * table (Phase 14). The {@code RefreshTokenService.issue} method calls this and
     * persists the row; callers wanting the full lifecycle should use that service
     * instead of this raw helper.
     */
    public String createRefreshTokenString() {
        return UUID.randomUUID().toString();
    }

    private String buildJwtFromAuthentication(Authentication authentication, long ttlMsec, TokenType tokenType) {
        UserPrincipal userPrincipal = (UserPrincipal) authentication.getPrincipal();
        return buildJwt(userPrincipal, ttlMsec, tokenType);
    }

    private String buildJwt(UserPrincipal userPrincipal, long ttlMsec, TokenType tokenType) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + ttlMsec);
        String jti = UUID.randomUUID().toString();

        // Serialize scope rows using the short JWT keys (omit null dims for size).
        List<Map<String, Object>> scopes = new ArrayList<>();
        if (userPrincipal.getScopes() != null) {
            for (CurrentScopes.ScopeRow r : userPrincipal.getScopes()) {
                Map<String, Object> row = new LinkedHashMap<>();
                if (r.i != null) row.put("i", r.i);
                if (r.s != null) row.put("s", r.s);
                if (r.c != null) row.put("c", r.c);
                if (r.x != null) row.put("x", r.x);
                scopes.add(row);
            }
        }

        List<String> roles = userPrincipal.getAuthorities() == null
                ? Collections.<String>emptyList()
                : userPrincipal.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .collect(Collectors.toList());

        // NOTE: perms[] is intentionally OMITTED from the JWT. A user assigned to
        // multiple admin role groups can hold 400+ permission codes (~80 bytes each
        // serialised), pushing the JWT past the ~4 KB per-cookie browser limit —
        // the browser silently drops cn_at and every subsequent request comes back
        // as "Full authentication required". Permissions are hydrated server-side
        // on each request from the DB via CustomUserDetailsService.loadUserById in
        // TokenAuthenticationFilter, so the principal still carries the full set
        // when @auth.allows() runs. Roles / scopes / sa stay in the JWT because
        // they are small and the existing filter treats them as authoritative.

        String token = Jwts.builder()
                .setSubject(Long.toString(userPrincipal.getId()))
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .setId(jti)
                .claim("roles", roles)
                .claim("scopes", scopes)
                .claim("sa", userPrincipal.isSuperAdmin())
                .signWith(signingKey, SignatureAlgorithm.HS512)
                .compact();

        if (auditService != null) {
            auditService.record(jti, userPrincipal.getId(), userPrincipal.getEmail(),
                    userPrincipal.getAuthorities(), userPrincipal.isSuperAdmin(),
                    now, expiryDate, tokenType);
        }
        return token;
    }

    public Long getUserIdFromToken(String token) {
        Claims claims = parseSigned(token).getBody();
        return Long.parseLong(claims.getSubject());
    }

    /**
     * Phase 7 (Task 7.1 / audit HIGH-3): the single signed-JWT parse path. Uses the non-deprecated
     * {@code parserBuilder()} and EXPLICITLY pins the signing algorithm to HS512. jjwt 0.11 already
     * rejects {@code alg:none} and HMAC/RSA confusion because {@link #signingKey} is a
     * {@code SecretKey}, but asserting the header algorithm here makes that protection explicit
     * (not silently dependent on key-type behaviour) and future-proof. Every parse call site routes
     * through this method.
     */
    private Jws<Claims> parseSigned(String token) {
        Jws<Claims> jws = Jwts.parserBuilder()
                .setSigningKey(signingKey)
                .build()
                .parseClaimsJws(token);
        String alg = jws.getHeader().getAlgorithm();
        if (!SignatureAlgorithm.HS512.getValue().equals(alg)) {
            throw new UnsupportedJwtException("Unexpected JWT signing algorithm: " + alg);
        }
        return jws;
    }

    // ── Phase 19 Plan 01: assessment-scoped JWT minting + scope helpers ────────────────

    /**
     * Phase 19 Plan 01. Mint a short-lived (4h) assessment-bound JWT carrying:
     * <ul>
     *   <li>{@code sub} — userStudentId</li>
     *   <li>{@code aid} — assessmentId</li>
     *   <li>{@code scope} — literal {@code "assessment"}</li>
     *   <li>{@code jti} — UUID (for emergency revocation via Plan 18-03 deny list)</li>
     * </ul>
     *
     * <p>Signed with the same {@code APP_AUTH_TOKEN_SECRET} as admin tokens. The
     * {@code scope} claim is what {@link TokenAuthenticationFilter} uses to enforce
     * the route allow-list (an assessment-scoped token is REJECTED on non-assessment
     * routes — see the filter's {@code ASSESSMENT_SCOPE_PATHS} guard).
     *
     * <p>TTL pulled from {@code app.auth.assessmentTokenExpirationMsec}; default 4h
     * (14_400_000 ms) — short enough that loss-of-cookie has bounded blast radius,
     * long enough that a student finishing one or two assessments in a session
     * does not have to re-authenticate. No refresh path — Phase 18 owns refresh and
     * deliberately excluded the assessment cookie from rotation.
     */
    public String createAssessmentSessionToken(Long userStudentId, Long assessmentId, Long ownerUserId) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + appProperties.getAuth().getAssessmentTokenExpirationMsec());
        String jti = UUID.randomUUID().toString();
        String token = Jwts.builder()
                .setSubject(String.valueOf(userStudentId))
                .claim("aid", assessmentId)
                .claim("scope", "assessment")
                .setId(jti)
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(signingKey, SignatureAlgorithm.HS512)
                .compact();

        if (auditService != null) {
            // ownerUserId is the User.id (student_user PK) — the audit table FK
            // points there, NOT at user_student.user_student_id. Passing
            // userStudentId here previously caused fk_jta_user violations.
            auditService.record(jti, ownerUserId, null, null, false,
                    now, expiryDate, TokenType.ASSESSMENT);
        }
        return token;
    }

    /**
     * Phase 19 Plan 01. Returns the {@code scope} claim from a signed JWT, defaulting
     * to {@code "session"} when the claim is absent — this preserves backwards-compat
     * for legacy admin tokens minted before Phase 19 (none of which carry a {@code scope}
     * claim and which {@link TokenAuthenticationFilter} must continue to accept on every
     * route).
     */
    public String getScopeFromToken(String token) {
        try {
            Claims claims = parseSigned(token).getBody();
            Object scope = claims.get("scope");
            return scope == null ? "session" : scope.toString();
        } catch (Exception ex) {
            return "session";
        }
    }

    /**
     * Phase 19 Plan 01. Returns the {@code aid} (assessment id) claim from an
     * assessment-scoped JWT, or {@code null} if the claim is absent / token is
     * malformed. Used by controllers that need to confirm the cookie matches the
     * assessment being queried.
     */
    public Long getAssessmentIdFromToken(String token) {
        try {
            Claims claims = parseSigned(token).getBody();
            Object aid = claims.get("aid");
            return aid == null ? null : Long.valueOf(aid.toString());
        } catch (Exception ex) {
            return null;
        }
    }

    /**
     * Phase 19 Plan 01. Readability alias for {@link #getUserIdFromToken(String)} —
     * for the assessment-scoped JWT path, the subject is always a {@code userStudentId},
     * not a generic user id. Functionally identical; provided so call sites
     * documenting "this is an assessment-token-derived student id" read clearly.
     */
    public Long getStudentIdFromToken(String token) {
        return getUserIdFromToken(token);
    }

    /**
     * Returns the JWT ID ({@code jti}) claim, or {@code null} if the token cannot be
     * parsed or carries no {@code jti}.
     *
     * <p>Backwards-compat: v2.0 tokens issued before Phase 15 lack a {@code jti} claim
     * entirely. Plan 18-03's deny-list lookup must treat a {@code null} jti as
     * "not on deny list" — those tokens then fall through to their natural expiry.
     * This method MUST NOT throw, even for malformed or expired tokens; callers
     * downstream (the auth filter) make their own validity decision.
     */
    public String getJtiFromToken(String token) {
        try {
            return parseSigned(token).getBody().getId();
        } catch (Exception ex) {
            return null;
        }
    }

    public boolean validateToken(String authToken) {
        try {
            parseSigned(authToken);
            return true;
        } catch (SignatureException ex) {
            logger.error("Invalid JWT signature");
        } catch (MalformedJwtException ex) {
            logger.error("Invalid JWT token");
        } catch (ExpiredJwtException ex) {
            logger.error("Expired JWT token");
        } catch (UnsupportedJwtException ex) {
            logger.error("Unsupported JWT token");
        } catch (IllegalArgumentException ex) {
            logger.error("JWT claims string is empty.");
        }
        return false;
    }

    /**
     * Typed wrapper around the new JWT claim shape. Returned by
     * {@link #parseClaims(String)} and consumed by {@link TokenAuthenticationFilter}.
     */
    public static class TokenClaims {
        public Long userId;
        public List<String> roles = Collections.emptyList();
        public Set<String> perms = Collections.emptySet();
        public List<CurrentScopes.ScopeRow> scopes = Collections.emptyList();
        public boolean superAdmin;
        public String jti;
        /** True when neither {@code perms} nor {@code scopes} claim was present (pre-Phase-15 token). */
        public boolean isLegacyShape;
    }

    /**
     * Parse signed JWT into the typed {@link TokenClaims} record. Caller must
     * have already validated the signature via {@link #validateToken(String)}.
     *
     * <p>Legacy-shape detection: a token minted before Phase 15 carries
     * {@code sub} and signature but no {@code perms} / {@code scopes} claims.
     * We flag {@code isLegacyShape=true} so the auth filter can downgrade
     * gracefully and emit a {@code LEGACY_TOKEN} log line.
     */
    @SuppressWarnings("unchecked")
    public TokenClaims parseClaims(String token) {
        Claims c = parseSigned(token).getBody();

        TokenClaims out = new TokenClaims();
        out.userId = Long.parseLong(c.getSubject());
        out.jti = c.getId();

        Object rolesRaw = c.get("roles");
        if (rolesRaw instanceof List) {
            out.roles = new ArrayList<>((List<String>) rolesRaw);
        }

        Object permsRaw = c.get("perms");
        Object scopesRaw = c.get("scopes");
        out.isLegacyShape = (permsRaw == null && scopesRaw == null);

        if (permsRaw instanceof List) {
            out.perms = new HashSet<>((List<String>) permsRaw);
        }

        if (scopesRaw instanceof List) {
            List<CurrentScopes.ScopeRow> rows = new ArrayList<>();
            for (Object o : (List<?>) scopesRaw) {
                if (o instanceof Map) {
                    Map<?, ?> m = (Map<?, ?>) o;
                    Integer i = num(m.get("i"));
                    Integer s = num(m.get("s"));
                    Integer cc = num(m.get("c"));
                    Long x = m.get("x") == null ? null : Long.valueOf(m.get("x").toString());
                    rows.add(new CurrentScopes.ScopeRow(i, s, cc, x));
                }
            }
            out.scopes = rows;
        }

        Object sa = c.get("sa");
        out.superAdmin = (sa instanceof Boolean) ? ((Boolean) sa).booleanValue() : false;

        return out;
    }

    private static Integer num(Object o) {
        return o == null ? null : Integer.valueOf(o.toString());
    }
}
