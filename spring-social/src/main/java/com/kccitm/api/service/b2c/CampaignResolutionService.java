package com.kccitm.api.service.b2c;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.b2c.Campaign;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentMapping;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentTier;
import com.kccitm.api.model.career9.b2c.PricingTier;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentTierRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignRepository;
import com.kccitm.api.repository.Career9.b2c.PricingTierRepository;

/**
 * Single source of truth for "what path/model/tiers apply" lookup.
 * Resolution: CampaignAssessmentMapping -> Campaign default -> AssessmentTable default -> 'B'/'1'.
 */
@Service
public class CampaignResolutionService {

    @Autowired private CampaignRepository campaignRepository;
    @Autowired private CampaignAssessmentMappingRepository mappingRepository;
    @Autowired private CampaignAssessmentTierRepository tierMappingRepository;
    @Autowired private PricingTierRepository pricingTierRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;

    public Map<String, Object> resolve(Long campaignId, Long assessmentId) {
        Optional<Campaign> campaignOpt = campaignRepository.findById(campaignId);
        if (!campaignOpt.isPresent()) return null;
        Campaign campaign = campaignOpt.get();

        Optional<CampaignAssessmentMapping> mappingOpt = mappingRepository
                .findByCampaignIdAndAssessmentIdAndIsDeletedFalse(campaignId, assessmentId);
        if (!mappingOpt.isPresent()) return null;
        CampaignAssessmentMapping mapping = mappingOpt.get();

        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId).orElse(null);

        String purchasePath = mapping.getPurchasePath();
        if (purchasePath == null) purchasePath = campaign.getDefaultPurchasePath();
        if (purchasePath == null && assessment != null) purchasePath = assessment.getDefaultPurchasePath();
        if (purchasePath == null) purchasePath = "B";

        String counsellingModel = mapping.getCounsellingModel();
        if (counsellingModel == null) counsellingModel = campaign.getDefaultCounsellingModel();
        if (counsellingModel == null && assessment != null) counsellingModel = assessment.getDefaultCounsellingModel();
        if (counsellingModel == null) counsellingModel = "1";

        Map<String, Object> response = new HashMap<>();
        response.put("campaignId", campaignId);
        response.put("campaignName", campaign.getName());
        response.put("campaignSlug", campaign.getSlug());
        response.put("brandLogoUrl", campaign.getBrandLogoUrl());
        response.put("assessmentId", assessmentId);
        response.put("assessmentName", assessment != null ? assessment.getAssessmentName() : null);
        response.put("purchasePath", purchasePath);
        response.put("counsellingModel", counsellingModel);
        response.put("validFrom", campaign.getValidFrom());
        response.put("validTo", campaign.getValidTo());

        List<CampaignAssessmentTier> tierMaps = tierMappingRepository
                .findByCampaignAssessmentMappingIdAndIsActiveTrueOrderByIdAsc(mapping.getId());
        List<Map<String, Object>> tiers = new ArrayList<>();
        for (CampaignAssessmentTier tm : tierMaps) {
            Optional<PricingTier> ptOpt = pricingTierRepository.findById(tm.getPricingTierId());
            if (!ptOpt.isPresent() || Boolean.TRUE.equals(ptOpt.get().getIsDeleted())) continue;
            PricingTier pt = ptOpt.get();
            Map<String, Object> row = new HashMap<>();
            row.put("campaignAssessmentTierId", tm.getId());
            row.put("pricingTierId", pt.getTierId());
            row.put("name", pt.getName());
            row.put("description", pt.getDescription());
            row.put("priceInr", tm.getPriceOverrideInr() != null ? tm.getPriceOverrideInr() : pt.getBasePriceInr());
            row.put("currency", pt.getCurrency());
            row.put("isDefault", tm.getIsDefault());
            row.put("includesFinalReport", pt.getIncludesFinalReport());
            row.put("includesDashboard", pt.getIncludesDashboard());
            row.put("includesCounselling", pt.getIncludesCounselling());
            row.put("counsellingSessionCount", pt.getCounsellingSessionCount());
            row.put("includesLms", pt.getIncludesLms());
            row.put("lmsValidityDays", pt.getLmsValidityDays());
            row.put("dashboardValidityDays", pt.getDashboardValidityDays());
            tiers.add(row);
        }
        response.put("tiers", tiers);

        return response;
    }
}
