package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.PromoCode;

@Repository
public interface PromoCodeRepository extends JpaRepository<PromoCode, Long> {
    Optional<PromoCode> findByCodeIgnoreCase(String code);

    Optional<PromoCode> findByCodeIgnoreCaseAndIsActive(String code, Boolean isActive);

    List<PromoCode> findAllByOrderByCreatedAtDesc();

    /**
     * Atomically consume one promo use, but only if the cap allows it. Returns
     * the number of rows updated: 1 = consumed, 0 = at/over {@code maxUses} (or
     * code gone). Mirrors {@code AssessmentMappingTierRepository.tryIncrementCount}.
     *
     * <p>Replaces the old non-atomic read-check-write (A2) and is called at
     * realized redemption — webhook payment success / free-commit — never at
     * link creation, so abandoned/expired/failed attempts no longer burn a use (A1).
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE PromoCode p SET p.currentUses = COALESCE(p.currentUses, 0) + 1 "
            + "WHERE p.id = :id AND (p.maxUses IS NULL OR COALESCE(p.currentUses, 0) < p.maxUses)")
    int tryConsume(@Param("id") Long id);
}
