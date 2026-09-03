package com.kccitm.api.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.PasswordResetToken;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByToken(String token);

    @Modifying
    @Transactional
    @Query("DELETE FROM PasswordResetToken t WHERE t.userId = :userId")
    void deleteAllForUser(@Param("userId") Long userId);

    /**
     * Consume a token if and only if it is still unused. Returns the number of rows
     * updated: 1 means this caller won the token, 0 means another request already
     * consumed it. Two concurrent resets both read {@code usedAt == null}; this
     * conditional update is what makes "single-use" actually single-use.
     */
    @Modifying
    @Transactional
    @Query("UPDATE PasswordResetToken t SET t.usedAt = :now WHERE t.id = :id AND t.usedAt IS NULL")
    int consume(@Param("id") Long id, @Param("now") java.time.Instant now);
}
