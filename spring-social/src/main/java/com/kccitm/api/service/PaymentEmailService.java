package com.kccitm.api.service;

import java.text.SimpleDateFormat;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;
import com.kccitm.api.service.b2c.EntitlementService;
import com.kccitm.api.service.b2c.LinkBuilder;
import com.kccitm.api.service.email.EmailDispatchService;
import com.kccitm.api.service.email.mails.AccountMails;
import com.kccitm.api.service.email.mails.PaymentMails;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLink;
import com.kccitm.api.service.email.theme.MailLinks;

@Service
public class PaymentEmailService {

    private static final Logger logger = LoggerFactory.getLogger(PaymentEmailService.class);

    @Autowired
    private EmailDispatchService emailDispatchService;

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Autowired
    private LinkBuilder linkBuilder;

    @Autowired
    private MailLinks mailLinks;

    @Autowired
    private StudentEntitlementRepository entitlementRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    // @Lazy: EntitlementService already depends on payment-side beans, so a direct
    // (non-lazy) wiring here would form a bean-creation cycle.
    @Autowired
    @Lazy
    private EntitlementService entitlementService;

    @Value("${app.razorpay.callback-base-url:}")
    private String callbackBaseUrl;

    private String getRegistrationUrl(PaymentTransaction txn) {
        String base = (callbackBaseUrl != null && !callbackBaseUrl.isEmpty())
                ? callbackBaseUrl : linkBuilder.frontendBase();
        return base + "/payment-register/" + txn.getTransactionId();
    }

    @Async
    public void sendWelcomeEmail(String email, String name, String username,
            String dob, String assessmentName, PaymentTransaction txn) {
        try {
            Mail mail = PaymentMails.paymentReceived(AccountMails.firstName(name), assessmentName, username, dob,
                    mailLinks.of(linkBuilder.manualLogin(), "student_login"));
            emailDispatchService.sendMail(EmailType.PAYMENT_SUCCESS, email, mail);

            txn.setWelcomeEmailSent(true);
            paymentTransactionRepository.save(txn);

            logger.info("Welcome email sent to: {} for transaction: {}", email, txn.getTransactionId());
        } catch (Exception e) {
            logger.error("Failed to send welcome email to: {}", email, e);
        }
    }

    @Async
    public void sendFailedOrPendingEmail(PaymentTransaction txn, String assessmentName, String status) {
        try {
            long amountRupees = txn.getAmount() != null ? txn.getAmount() : 0L;
            String studentName = txn.getStudentName() != null ? txn.getStudentName() : "Student";

            PaymentMails.Outcome outcome;
            if ("failed".equals(status)) {
                outcome = PaymentMails.Outcome.FAILED;
            } else if ("expired".equals(status)) {
                outcome = PaymentMails.Outcome.EXPIRED;
            } else {
                outcome = PaymentMails.Outcome.CANCELLED;
            }

            Mail mail = PaymentMails.paymentFailed(AccountMails.firstName(studentName), assessmentName,
                    String.format("%,d", amountRupees), outcome,
                    mailLinks.of(getRegistrationUrl(txn), "payment_retry"));

            emailDispatchService.sendMail(EmailType.PAYMENT_FAILED, txn.getStudentEmail(), mail);
            txn.setNudgeEmailSent(true);
            paymentTransactionRepository.save(txn);
            logger.info("Automated {} email sent to: {} for transaction: {}", status, txn.getStudentEmail(), txn.getTransactionId());
        } catch (Exception e) {
            logger.error("Failed to send {} email to: {}", status, txn.getStudentEmail(), e);
        }
    }

    @Async
    public void sendNudgeEmail(PaymentTransaction txn, String assessmentName) {
        try {
            long amountRupees = txn.getAmount() != null ? txn.getAmount() : 0L;
            String studentName = txn.getStudentName() != null ? txn.getStudentName() : "Student";

            Mail mail = PaymentMails.paymentPending(AccountMails.firstName(studentName), assessmentName,
                    String.format("%,d", amountRupees), mailLinks.of(getRegistrationUrl(txn), "payment_pending"));

            emailDispatchService.sendMail(EmailType.PAYMENT_REMINDER, txn.getStudentEmail(), mail);
            logger.info("Nudge email sent to: {} for transaction: {}", txn.getStudentEmail(), txn.getTransactionId());
        } catch (Exception e) {
            logger.error("Failed to send nudge email to: {}", txn.getStudentEmail(), e);
        }
    }

    @Async
    public void sendPaymentLinkEmail(String email, String studentName, PaymentTransaction txn, String assessmentName) {
        long amountRupees = txn.getAmount() != null ? txn.getAmount() : 0L;

        Mail mail = PaymentMails.paymentLink(AccountMails.firstName(studentName), assessmentName,
                String.format("%,d", amountRupees), mailLinks.of(getRegistrationUrl(txn), "payment_link"));

        emailDispatchService.sendMail(EmailType.PAYMENT_LINK, email, mail);
        logger.info("Payment link email sent to: {} for transaction: {}", email, txn.getTransactionId());
    }

    @Async
    public void sendWelcomeEmailResend(PaymentTransaction txn, String assessmentName) {
        try {
            String studentName = txn.getStudentName() != null ? txn.getStudentName() : "Student";

            // Username via the same path EntitlementService.sendWelcomeAssessmentLink uses;
            // null-safe at every step since not every transaction resolves to a UserStudent.
            String username = null;
            if (txn.getUserStudentId() != null) {
                UserStudent us = userStudentRepository.findById(txn.getUserStudentId()).orElse(null);
                if (us != null && us.getStudentInfo() != null) {
                    User u = us.getStudentInfo().getUser();
                    if (u != null) username = u.getUsername();
                }
            }
            String dob = txn.getStudentDob() != null
                    ? new SimpleDateFormat("dd-MM-yyyy").format(txn.getStudentDob()) : null;

            // The one-tap magic link only exists when this payment minted an entitlement;
            // a legacy school/mapping payment has none, so the resend falls back to manual sign-in.
            MailLink magic = null;
            Optional<StudentEntitlement> entitlementOpt =
                    entitlementRepository.findFirstByPaymentTransactionIdOrderByEntitlementIdDesc(txn.getTransactionId());
            if (entitlementOpt.isPresent()) {
                StudentEntitlement entitlement = entitlementOpt.get();
                String token = entitlementService.ensureLiveAccessToken(entitlement);
                magic = mailLinks.of(linkBuilder.assessmentStart(token, entitlement.getEntitlementId()), "assessment_start");
            }

            Mail mail = PaymentMails.welcomeResend(AccountMails.firstName(studentName), assessmentName, username, dob,
                    magic, mailLinks.of(linkBuilder.manualLogin(), "student_login"));

            emailDispatchService.sendMail(EmailType.PAYMENT_SUCCESS, txn.getStudentEmail(), mail);
            logger.info("Welcome resend email sent to: {} for transaction: {}", txn.getStudentEmail(), txn.getTransactionId());
        } catch (Exception e) {
            logger.error("Failed to resend welcome email to: {}", txn.getStudentEmail(), e);
        }
    }
}
