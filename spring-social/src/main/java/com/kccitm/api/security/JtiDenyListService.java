package com.kccitm.api.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import com.github.benmanes.caffeine.cache.Cache;

/**
 * Phase 18 — Emergency revocation list for access-token {@code jti} values.
 *
 * <p>Consulted by {@link TokenAuthenticationFilter} on every authenticated request, AFTER
 * JWT signature/expiry validation and BEFORE the Spring security context is populated. A
 * present jti causes the filter to skip {@code setAuthentication}, and the request is
 * subsequently denied by {@link RestAuthenticationEntryPoint}.
 *
 * <p><b>Backing store:</b> a Caffeine {@code Cache<String, Boolean>} exposed by
 * {@link com.kccitm.api.config.JtiDenyListConfig} with a 10_000-entry max and a TTL bound
 * to {@code app.auth.accessTokenExpirationMsec} (60 min). See {@code JtiDenyListConfig} for
 * the full rationale.
 *
 * <p><b>Lifecycle is in-process only.</b> A JVM restart drops the list. Acceptable trade-off
 * because (a) access tokens have a bounded 60-min TTL and (b) the project deploys
 * single-instance per {@code docker-compose.yml}. Phase 20 may upgrade to a Redis-backed
 * implementation if horizontal scaling becomes a goal.
 *
 * <p><b>Backwards-compatibility:</b> Legacy v2.0 tokens have no {@code jti} claim. They
 * surface as {@code null} from {@link TokenProvider#getJtiFromToken(String)}. {@link
 * #isRevoked(String)} returns {@code false} for {@code null}/empty jti so those tokens fall
 * through to natural expiry within their original TTL — the project's Phase-13 secret-rotation
 * is the heavy hammer for "kill all pre-existing tokens at once".
 */
@Service
public class JtiDenyListService {

    private static final Logger logger = LoggerFactory.getLogger(JtiDenyListService.class);

    private final Cache<String, Boolean> denyList;

    @Autowired
    public JtiDenyListService(@Qualifier("jtiDenyList") Cache<String, Boolean> denyList) {
        this.denyList = denyList;
    }

    /**
     * Adds the given jti to the deny list. Idempotent — repeated calls overwrite the
     * existing entry with the same {@code Boolean.TRUE} value and reset the TTL window.
     * No-op for {@code null}/empty jti.
     */
    public void revoke(String jti) {
        if (jti == null || jti.isEmpty()) {
            return;
        }
        denyList.put(jti, Boolean.TRUE);
        logger.debug("Revoked jti={} (deny list size now ~{})", jti, denyList.estimatedSize());
    }

    /**
     * Returns {@code true} iff the jti is in the deny list. Returns {@code false} for
     * {@code null}/empty jti — legacy v2.0 tokens carry no {@code jti} claim and must pass
     * this check (locked-decision backwards-compat clause).
     *
     * <p>Caffeine treats {@code null} values as absent, but we defensively use
     * {@code getIfPresent(jti) != null} rather than relying on a typed boxed return.
     */
    public boolean isRevoked(String jti) {
        if (jti == null || jti.isEmpty()) {
            return false;
        }
        return denyList.getIfPresent(jti) != null;
    }

    /**
     * Current estimated size of the deny list. Exposed for admin tooling and metrics. The
     * value is approximate per Caffeine's contract — concurrent operations may shift it by
     * a small amount.
     */
    public long size() {
        return denyList.estimatedSize();
    }
}
