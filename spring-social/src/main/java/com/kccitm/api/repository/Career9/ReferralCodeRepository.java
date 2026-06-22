package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.ReferralCode;

@Repository
public interface ReferralCodeRepository extends JpaRepository<ReferralCode, Long> {
    Optional<ReferralCode> findByCodeIgnoreCase(String code);

    Optional<ReferralCode> findByCodeIgnoreCaseAndIsActive(String code, Boolean isActive);

    List<ReferralCode> findAllByOrderByCreatedAtDesc();

    /**
     * Atomically consume one use, cap-guarded. Returns 1 if consumed, 0 if at/over
     * {@code maxUses} (or code gone). Mirrors {@code PromoCodeRepository.tryConsume}.
     * Called at realized redemption (student linked), never at link creation.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE ReferralCode r SET r.currentUses = COALESCE(r.currentUses, 0) + 1 "
            + "WHERE r.id = :id AND (r.maxUses IS NULL OR COALESCE(r.currentUses, 0) < r.maxUses)")
    int tryConsume(@Param("id") Long id);
}
