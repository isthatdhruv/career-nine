package com.kccitm.api.repository.Career9.b2c;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.b2c.CampaignAssessmentMapping;

@Repository
public interface CampaignAssessmentMappingRepository extends JpaRepository<CampaignAssessmentMapping, Long> {
    List<CampaignAssessmentMapping> findByCampaignIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(Long campaignId);

    Optional<CampaignAssessmentMapping> findByCampaignIdAndAssessmentIdAndIsDeletedFalse(Long campaignId, Long assessmentId);

    List<CampaignAssessmentMapping> findByAssessmentIdAndIsDeletedFalse(Long assessmentId);
}
