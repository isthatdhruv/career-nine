package com.kccitm.api.repository.Career9.b2c;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.b2c.CampaignAssessmentTier;

@Repository
public interface CampaignAssessmentTierRepository extends JpaRepository<CampaignAssessmentTier, Long> {
    List<CampaignAssessmentTier> findByCampaignAssessmentMappingIdAndIsActiveTrueOrderByIdAsc(Long mappingId);

    List<CampaignAssessmentTier> findByCampaignAssessmentMappingIdOrderByIdAsc(Long mappingId);

    Optional<CampaignAssessmentTier> findByCampaignAssessmentMappingIdAndPricingTierId(Long mappingId, Long pricingTierId);

    long countByPricingTierIdAndIsActiveTrue(Long pricingTierId);
}
