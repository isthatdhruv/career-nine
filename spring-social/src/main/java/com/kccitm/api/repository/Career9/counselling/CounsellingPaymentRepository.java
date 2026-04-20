package com.kccitm.api.repository.Career9.counselling;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.CounsellingPayment;

@Repository
public interface CounsellingPaymentRepository extends JpaRepository<CounsellingPayment, Long> {

    List<CounsellingPayment> findByStudentUserStudentId(Long userStudentId);

    /**
     * Find all payments for a student with a given status.
     * The service layer filters for sessions remaining.
     */
    List<CounsellingPayment> findByStudentUserStudentIdAndStatus(Long userStudentId, String status);

    Optional<CounsellingPayment> findByRazorpayOrderId(String razorpayOrderId);

    Optional<CounsellingPayment> findByRazorpayPaymentId(String razorpayPaymentId);
}
