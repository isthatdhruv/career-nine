package com.kccitm.api.service.career9;

import java.util.Comparator;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.AssessmentMappingTier;
import com.kccitm.api.model.career9.SchoolAssessmentTier;
import com.kccitm.api.repository.Career9.AssessmentMappingTierRepository;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.repository.Career9.SchoolAssessmentTierRepository;

@Service
public class AssessmentMappingTierService {

    @Autowired(required = false)
    private AssessmentMappingTierRepository tierRepository;

    @Autowired(required = false)
    private SchoolAssessmentTierRepository schoolTierRepository;

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

    /** Drift backstop: rebuild currentCount from completed (paid) institute-mapping transactions. */
    public int recountTier(Long tierId) {
        AssessmentMappingTier tier = tierRepository.findById(tierId)
            .orElseThrow(() -> new IllegalArgumentException("Tier not found: " + tierId));
        // mappingTierId is overloaded across two tier tables; scope by mappingId-present
        // so a school tier with the same numeric id can't pollute this count.
        long count = paymentTransactionRepository
            .countByMappingTierIdAndStatusAndMappingIdIsNotNull(tierId, "paid");
        tier.setCurrentCount((int) count);
        tierRepository.save(tier);
        return tier.getCurrentCount();
    }

    // ===== School-level tier overloads — same rules, different table. =====

    /** Same resolution rule as the institute-mapping resolver, applied to school tiers. */
    public SchoolAssessmentTier resolveActiveSchoolTier(List<SchoolAssessmentTier> tiers) {
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

    public SchoolAssessmentTier resolveActiveTierForSchoolAssessment(
            Long instituteCode, Long sessionId, Long assessmentId) {
        return resolveActiveSchoolTier(
            schoolTierRepository.findByInstituteCodeAndSessionIdAndAssessmentIdOrderBySortOrderAsc(
                instituteCode, sessionId, assessmentId));
    }

    public int recountSchoolTier(Long tierId) {
        SchoolAssessmentTier tier = schoolTierRepository.findById(tierId)
            .orElseThrow(() -> new IllegalArgumentException("School tier not found: " + tierId));
        // Scope by schoolConfigId-present so an institute-mapping tier with the same
        // numeric id can't pollute this count.
        long count = paymentTransactionRepository
            .countByMappingTierIdAndStatusAndSchoolConfigIdIsNotNull(tierId, "paid");
        tier.setCurrentCount((int) count);
        schoolTierRepository.save(tier);
        return tier.getCurrentCount();
    }
}
