package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.PaymentNotificationLog;

@Repository
public interface PaymentNotificationLogRepository extends JpaRepository<PaymentNotificationLog, Long> {

    List<PaymentNotificationLog> findByTransactionIdOrderByCreatedAtDesc(Long transactionId);

    List<PaymentNotificationLog> findByChannelOrderByCreatedAtDesc(String channel);

    List<PaymentNotificationLog> findByRecipientOrderByCreatedAtDesc(String recipient);
}
