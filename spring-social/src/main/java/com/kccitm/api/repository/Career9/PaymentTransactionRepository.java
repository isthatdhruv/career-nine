package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import javax.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.PaymentTransaction;

@Repository
public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {

    List<PaymentTransaction> findByMappingIdOrderByCreatedAtDesc(Long mappingId);

    List<PaymentTransaction> findByStatusOrderByCreatedAtDesc(String status);

    List<PaymentTransaction> findByInstituteCodeOrderByCreatedAtDesc(Integer instituteCode);

    List<PaymentTransaction> findByInstituteCodeAndStatusOrderByCreatedAtDesc(Integer instituteCode, String status);

    Optional<PaymentTransaction> findByRazorpayLinkId(String razorpayLinkId);

    /**
     * Pessimistic-write variant for the Razorpay webhook handler. Concurrent
     * webhook deliveries for the same {@code razorpayLinkId} (Razorpay retries
     * on any non-2xx, and our webhook handler is now {@code @Transactional})
     * serialise on this row-level lock. The early-return {@code status="paid"}
     * check inside {@code markPaidAndProvision} then guarantees only one
     * thread runs provisioning per payment.
     *
     * <p>MUST be called from inside a transaction.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM PaymentTransaction t WHERE t.razorpayLinkId = :linkId")
    Optional<PaymentTransaction> findByRazorpayLinkIdForUpdate(@Param("linkId") String linkId);

    Optional<PaymentTransaction> findByRazorpayPaymentId(String razorpayPaymentId);

    Optional<PaymentTransaction> findByRazorpayOrderId(String razorpayOrderId);

    List<PaymentTransaction> findByStudentEmailAndAssessmentId(String studentEmail, Long assessmentId);

    List<PaymentTransaction> findByAssessmentIdOrderByCreatedAtDesc(Long assessmentId);

    // Used by the spotlight student dossier endpoint to fold every transaction
    // a given student has triggered (paid, failed, abandoned) into one
    // chronologically ordered list.
    List<PaymentTransaction> findByUserStudentIdOrderByCreatedAtDesc(Long userStudentId);

    long countByMappingTierIdAndStatus(Long mappingTierId, String status);

    // mappingTierId is overloaded across AssessmentMappingTier (paid via /assessment-mapping)
    // and SchoolAssessmentTier (paid via /school-registration). Disambiguate by which scope
    // column is populated on the transaction.
    long countByMappingTierIdAndStatusAndMappingIdIsNotNull(Long mappingTierId, String status);
    long countByMappingTierIdAndStatusAndSchoolConfigIdIsNotNull(Long mappingTierId, String status);
}
