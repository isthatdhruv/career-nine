package com.kccitm.api.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.JwtTokenAudit;
import com.kccitm.api.model.JwtTokenAudit.TokenType;

/**
 * Spring Data JPA repository for the super-admin JWT audit log.
 *
 * <p>The {@link #search} method is the workhorse for the admin console — a single
 * JPQL query that accepts a bag of optional filters (any/all of which may be
 * {@code null}). The {@code COALESCE(:p, field)} pattern makes a null filter
 * mean "do not constrain this dimension" — cleaner than a Specification builder
 * for this scope.
 */
@Repository
public interface JwtTokenAuditRepository extends JpaRepository<JwtTokenAudit, String> {

    Optional<JwtTokenAudit> findByJti(String jti);

    List<JwtTokenAudit> findByUserIdOrderByIssuedAtDesc(Long userId);

    /**
     * Filtered, paginated search backing {@code GET /admin/jwt-tokens}. Any filter
     * left {@code null} is treated as "no constraint" via the {@code COALESCE}
     * trick. {@code email} is an optional case-insensitive substring match.
     *
     * <p>{@code status} is interpreted on the application side and translated
     * into the {@code revokedAtNull} / expiry-window predicates passed here.
     */
    @Query("SELECT a FROM JwtTokenAudit a " +
           "WHERE (:userId IS NULL OR a.userId = :userId) " +
           "  AND (:tokenType IS NULL OR a.tokenType = :tokenType) " +
           "  AND (:email IS NULL OR LOWER(a.userEmail) LIKE LOWER(CONCAT('%', :email, '%'))) " +
           "  AND (:onlyLive = false OR (a.revokedAt IS NULL AND a.expiresAt > :now)) " +
           "  AND (:onlyRevoked = false OR a.revokedAt IS NOT NULL) " +
           "  AND (:onlyExpired = false OR (a.revokedAt IS NULL AND a.expiresAt <= :now)) " +
           "ORDER BY a.issuedAt DESC")
    Page<JwtTokenAudit> search(@Param("userId") Long userId,
                               @Param("tokenType") TokenType tokenType,
                               @Param("email") String email,
                               @Param("onlyLive") boolean onlyLive,
                               @Param("onlyRevoked") boolean onlyRevoked,
                               @Param("onlyExpired") boolean onlyExpired,
                               @Param("now") LocalDateTime now,
                               Pageable pageable);

    /** Atomic revoke — only updates rows that are still live. Returns rows affected. */
    @Modifying
    @Query("UPDATE JwtTokenAudit a " +
           "SET a.revokedAt = :now, a.revokedBy = :revokedBy, a.revocationReason = :reason " +
           "WHERE a.jti = :jti AND a.revokedAt IS NULL")
    int markRevokedIfLive(@Param("jti") String jti,
                          @Param("now") LocalDateTime now,
                          @Param("revokedBy") Long revokedBy,
                          @Param("reason") String reason);

    /** Returns jti values for every live token owned by a user — used by force-logout-all. */
    @Query("SELECT a.jti FROM JwtTokenAudit a " +
           "WHERE a.userId = :userId AND a.revokedAt IS NULL AND a.expiresAt > :now")
    List<String> findLiveJtisForUser(@Param("userId") Long userId,
                                     @Param("now") LocalDateTime now);

    @Modifying
    @Query("UPDATE JwtTokenAudit a " +
           "SET a.revokedAt = :now, a.revokedBy = :revokedBy, a.revocationReason = :reason " +
           "WHERE a.userId = :userId AND a.revokedAt IS NULL AND a.expiresAt > :now")
    int markRevokedForUser(@Param("userId") Long userId,
                           @Param("now") LocalDateTime now,
                           @Param("revokedBy") Long revokedBy,
                           @Param("reason") String reason);

    long countByRevokedAtIsNullAndExpiresAtAfter(LocalDateTime now);
    long countByRevokedAtIsNotNull();
    long countByTokenType(TokenType tokenType);
}
