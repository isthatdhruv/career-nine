package com.kccitm.api.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.RefreshToken;

/**
 * Spring Data JPA repository over the {@code refresh_token} table (Phase 14 migration
 * V20260511001). Phase 18 introduces the lifecycle write operations.
 */
@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, String> {

    Optional<RefreshToken> findByJti(String jti);

    List<RefreshToken> findByUserIdAndRevokedAtIsNull(Long userId);

    List<RefreshToken> findByExpiresAtBefore(LocalDateTime cutoff);

    /**
     * Atomic "revoke if still live" — the rotation-race tie-breaker for Plan 18-01.
     *
     * <p>Returns the number of rows updated:
     * <ul>
     *   <li>{@code 1} — this caller won the race, the row is now revoked with
     *       {@code replaced_by} pointing at the new jti (or null when called from
     *       {@code revoke()} for logout).</li>
     *   <li>{@code 0} — the row either does not exist or was already revoked by a
     *       concurrent caller. {@code RefreshTokenService.rotate} maps this to
     *       {@code RefreshTokenReuseException}.</li>
     * </ul>
     *
     * <p>This is the SOLE rotation-race guard. MySQL 5.7's per-row UPDATE atomicity
     * combined with the {@code revokedAt IS NULL} predicate gives "exactly one UPDATE
     * wins" without holding a row lock for the surrounding transaction.
     *
     * @param replacedBy the new refresh-token jti that supersedes this one, or
     *                   {@code null} when revoking via explicit logout.
     */
    @Modifying
    @Query("UPDATE RefreshToken r SET r.revokedAt = :now, r.replacedBy = :replacedBy " +
           "WHERE r.jti = :jti AND r.revokedAt IS NULL")
    int revokeIfLive(@Param("jti") String jti,
                     @Param("now") LocalDateTime now,
                     @Param("replacedBy") String replacedBy);

    /**
     * Revoke every still-live refresh token belonging to a user. Used by
     * {@code /auth/logout-all} (Plan 18-02) and by chain-break responses to a detected
     * {@code RefreshTokenReuseException}. Returns the number of rows revoked.
     */
    @Modifying
    @Query("UPDATE RefreshToken r SET r.revokedAt = :now " +
           "WHERE r.userId = :userId AND r.revokedAt IS NULL")
    int revokeAllForUser(@Param("userId") Long userId,
                         @Param("now") LocalDateTime now);
}
