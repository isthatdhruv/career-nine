package com.kccitm.api.repository.Career9.b2c;

import com.kccitm.api.model.career9.b2c.PromoCodeCampaign;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface PromoCodeCampaignRepository extends JpaRepository<PromoCodeCampaign, Long> {
    List<PromoCodeCampaign> findByPromoCodeId(Long promoCodeId);
    List<PromoCodeCampaign> findByCampaignId(Long campaignId);
    boolean existsByPromoCodeIdAndCampaignId(Long promoCodeId, Long campaignId);
    boolean existsByPromoCodeId(Long promoCodeId);

    @Transactional
    void deleteByPromoCodeId(Long promoCodeId);
}
