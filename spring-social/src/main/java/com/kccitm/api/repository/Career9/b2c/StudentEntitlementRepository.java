package com.kccitm.api.repository.Career9.b2c;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.b2c.StudentEntitlement;

@Repository
public interface StudentEntitlementRepository extends JpaRepository<StudentEntitlement, Long> {
    Optional<StudentEntitlement> findByAccessToken(String token);

    Optional<StudentEntitlement> findByPaymentTransactionId(Long paymentTransactionId);

    List<StudentEntitlement> findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(Long userStudentId, Long assessmentId);

    List<StudentEntitlement> findByUserStudentIdOrderByCreatedAtDesc(Long userStudentId);

    List<StudentEntitlement> findByCampaignIdOrderByCreatedAtDesc(Long campaignId);

    List<StudentEntitlement> findByStatusOrderByCreatedAtDesc(String status);

    @Query("SELECT e FROM StudentEntitlement e WHERE e.status = 'active' AND e.expiresAt IS NOT NULL AND e.expiresAt < :now")
    List<StudentEntitlement> findExpired(@Param("now") Date now);

    @Query("SELECT e FROM StudentEntitlement e WHERE e.status = 'active' AND e.purchasePath = 'A' " +
           "AND e.grantedAt < :before AND e.userStudentId IS NOT NULL")
    List<StudentEntitlement> findActiveOlderThan(@Param("before") Date before);

    // Active entitlements that include counselling, still have unused sessions,
    // were granted before :before, and have not yet been nudged to book.
    @Query("SELECT e FROM StudentEntitlement e WHERE e.status = 'active' " +
           "AND e.counsellingActive = true " +
           "AND e.counsellingSessionsTotal > e.counsellingSessionsUsed " +
           "AND e.counsellingNudgeSentAt IS NULL " +
           "AND e.userStudentId IS NOT NULL " +
           "AND e.grantedAt IS NOT NULL AND e.grantedAt < :before")
    List<StudentEntitlement> findCounsellingNudgeDue(@Param("before") Date before);
}
