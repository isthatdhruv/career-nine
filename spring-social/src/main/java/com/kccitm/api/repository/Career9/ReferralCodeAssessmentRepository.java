package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.ReferralCodeAssessment;

@Repository
public interface ReferralCodeAssessmentRepository extends JpaRepository<ReferralCodeAssessment, Long> {
    List<ReferralCodeAssessment> findByReferralCodeId(Long referralCodeId);

    boolean existsByReferralCodeIdAndAssessmentId(Long referralCodeId, Long assessmentId);

    @Transactional
    void deleteByReferralCodeId(Long referralCodeId);
}
