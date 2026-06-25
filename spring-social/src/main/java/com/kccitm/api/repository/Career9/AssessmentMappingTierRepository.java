package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.AssessmentMappingTier;

@Repository
public interface AssessmentMappingTierRepository extends JpaRepository<AssessmentMappingTier, Long> {

    List<AssessmentMappingTier> findByMappingIdOrderBySortOrderAsc(Long mappingId);

    List<AssessmentMappingTier> findByMappingIdAndIsActiveOrderBySortOrderAsc(Long mappingId, Boolean isActive);

    // Free tier (the is_free=true row backing the free link). Expected: at most one per mapping.
    Optional<AssessmentMappingTier> findFirstByMappingIdAndIsFreeTrue(Long mappingId);

    // The tier materialised on this mapping from a given B2C pricing tier (per-student invites).
    Optional<AssessmentMappingTier> findFirstByMappingIdAndPricingTierId(Long mappingId, Long pricingTierId);

    // Paid waves only (is_free=false), for active-tier resolution on the paid link.
    List<AssessmentMappingTier> findByMappingIdAndIsFreeAndIsActiveOrderBySortOrderAsc(
            Long mappingId, Boolean isFree, Boolean isActive);

    void deleteByMappingId(Long mappingId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE AssessmentMappingTier t SET t.currentCount = COALESCE(t.currentCount, 0) + 1 " +
           "WHERE t.tierId = :tierId AND (COALESCE(t.maxRegistrations, 0) = 0 OR COALESCE(t.currentCount, 0) < COALESCE(t.maxRegistrations, 0))")
    int tryIncrementCount(@Param("tierId") Long tierId);
}
