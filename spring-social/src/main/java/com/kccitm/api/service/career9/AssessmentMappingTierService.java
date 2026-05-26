package com.kccitm.api.service.career9;

import java.util.Comparator;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.AssessmentMappingTier;
import com.kccitm.api.repository.Career9.AssessmentMappingTierRepository;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;

@Service
public class AssessmentMappingTierService {

    @Autowired(required = false)
    private AssessmentMappingTierRepository tierRepository;

    @Autowired(required = false)
    private PaymentTransactionRepository paymentTransactionRepository;

    /**
     * Pure resolution: the live tier is the active tier with the lowest sortOrder
     * whose currentCount is below its cap. A null/0 maxRegistrations is unlimited.
     * Returns null when every active tier is capped and full (registration closed).
     */
    public AssessmentMappingTier resolveActiveTier(List<AssessmentMappingTier> tiers) {
        if (tiers == null) return null;
        return tiers.stream()
            .filter(t -> Boolean.TRUE.equals(t.getIsActive()))
            .sorted(Comparator.comparingInt(t ->
                t.getSortOrder() == null ? Integer.MAX_VALUE : t.getSortOrder()))
            .filter(t -> {
                Integer max = t.getMaxRegistrations();
                int cur = t.getCurrentCount() == null ? 0 : t.getCurrentCount();
                return max == null || max == 0 || cur < max;
            })
            .findFirst()
            .orElse(null);
    }

    /** Convenience: load a mapping's tiers and resolve the live one. */
    public AssessmentMappingTier resolveActiveTierForMapping(Long mappingId) {
        return resolveActiveTier(
            tierRepository.findByMappingIdOrderBySortOrderAsc(mappingId));
    }

    /** Drift backstop: rebuild currentCount from completed (paid) transactions. */
    public int recountTier(Long tierId) {
        AssessmentMappingTier tier = tierRepository.findById(tierId)
            .orElseThrow(() -> new IllegalArgumentException("Tier not found: " + tierId));
        long count = paymentTransactionRepository.countByMappingTierIdAndStatus(tierId, "paid");
        tier.setCurrentCount((int) count);
        tierRepository.save(tier);
        return tier.getCurrentCount();
    }
}
