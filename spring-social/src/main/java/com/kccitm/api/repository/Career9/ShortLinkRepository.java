package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.ShortLink;

@Repository
public interface ShortLinkRepository extends JpaRepository<ShortLink, Long> {

    Optional<ShortLink> findByCode(String code);

    boolean existsByCode(String code);

    /**
     * Rows for a target, newest first. A list rather than an Optional because nothing stops two
     * concurrent sends creating two codes for the same URL — harmless, both work, and we simply
     * reuse the most recent.
     */
    List<ShortLink> findByTargetHashOrderByIdDesc(String targetHash);

    /**
     * Counts an open without loading the row or touching the caller's transaction state. Written
     * as a direct UPDATE because the redirect is on the student's critical path and must not wait
     * on a read-modify-write.
     */
    @Modifying
    @Query("update ShortLink s set s.hitCount = s.hitCount + 1, s.lastHitAt = CURRENT_TIMESTAMP "
            + "where s.id = :id")
    void recordHit(@Param("id") Long id);
}
