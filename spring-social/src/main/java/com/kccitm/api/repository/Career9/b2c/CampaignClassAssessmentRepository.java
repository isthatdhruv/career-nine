package com.kccitm.api.repository.Career9.b2c;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.b2c.CampaignClassAssessment;

@Repository
public interface CampaignClassAssessmentRepository extends JpaRepository<CampaignClassAssessment, Long> {

    List<CampaignClassAssessment> findByCampaignIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(Long campaignId);

    // Includes soft-deleted rows — used to revive a previously detached class
    // route instead of inserting a duplicate that violates the
    // UNIQUE(campaign_id, class_id) constraint.
    Optional<CampaignClassAssessment> findByCampaignIdAndClassId(Long campaignId, Integer classId);

    List<CampaignClassAssessment> findByAssessmentIdAndIsDeletedFalse(Long assessmentId);
}
