package com.kccitm.api.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;

/**
 * Persists a {@link PaymentTransaction} in its OWN committed transaction
 * ({@code REQUIRES_NEW}).
 *
 * <p>PAY1 fix: the register/checkout controllers used to create the (irreversible)
 * Razorpay payment link <em>before</em> the txn row was durably saved, all inside
 * one {@code @Transactional} method. A commit failure after the link was created
 * left a live, payable link with no matching DB row — the payer was charged but
 * the webhook's {@code findByRazorpayLinkId} found nothing, so the student was
 * never provisioned and there was no record to recover from.
 *
 * <p>Routing the save through this helper commits a {@code created} row
 * independently <em>before</em> the link call, so a durable, recoverable record
 * always exists first. The link id is then stamped in a second committed save.
 * Because the propagation is {@code REQUIRES_NEW}, the row survives even if the
 * caller's surrounding transaction later rolls back.
 */
@Service
public class PaymentTransactionWriter {

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public PaymentTransaction saveInNewTransaction(PaymentTransaction txn) {
        return paymentTransactionRepository.save(txn);
    }
}
