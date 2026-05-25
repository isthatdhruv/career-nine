package com.kccitm.api.repository.Career9.b2c;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.b2c.PricingTier;

@Repository
public interface PricingTierRepository extends JpaRepository<PricingTier, Long> {
    List<PricingTier> findByIsDeletedFalseOrderBySortOrderAscTierIdAsc();

    List<PricingTier> findByIsDeletedFalseAndIsActiveTrueOrderBySortOrderAscTierIdAsc();
}
