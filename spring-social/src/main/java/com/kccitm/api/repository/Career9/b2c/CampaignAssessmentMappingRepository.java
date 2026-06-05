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

    // Includes soft-deleted rows — used by attachAssessment to revive a previously
    // detached mapping instead of inserting a duplicate that violates the
    // UNIQUE(campaign_id, assessment_id) constraint (CRUD1).
    Optional<CampaignAssessmentMapping> findByCampaignIdAndAssessmentId(Long campaignId, Long assessmentId);

    List<CampaignAssessmentMapping> findByAssessmentIdAndIsDeletedFalse(Long assessmentId);
}
