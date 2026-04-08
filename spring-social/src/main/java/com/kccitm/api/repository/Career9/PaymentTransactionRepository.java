package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.PaymentTransaction;

@Repository
public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {

    List<PaymentTransaction> findByMappingIdOrderByCreatedAtDesc(Long mappingId);

    List<PaymentTransaction> findByStatusOrderByCreatedAtDesc(String status);

    List<PaymentTransaction> findByInstituteCodeOrderByCreatedAtDesc(Integer instituteCode);

    List<PaymentTransaction> findByInstituteCodeAndStatusOrderByCreatedAtDesc(Integer instituteCode, String status);

    Optional<PaymentTransaction> findByRazorpayLinkId(String razorpayLinkId);

    Optional<PaymentTransaction> findByRazorpayPaymentId(String razorpayPaymentId);

    Optional<PaymentTransaction> findByRazorpayOrderId(String razorpayOrderId);

    List<PaymentTransaction> findByStudentEmailAndAssessmentId(String studentEmail, Long assessmentId);

    List<PaymentTransaction> findByAssessmentIdOrderByCreatedAtDesc(Long assessmentId);
}
