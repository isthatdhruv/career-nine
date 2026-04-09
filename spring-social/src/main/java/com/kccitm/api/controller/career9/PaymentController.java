package com.kccitm.api.controller.career9;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.AssessmentInstituteMapping;
import com.kccitm.api.model.career9.PaymentNotificationLog;
import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.repository.Career9.AssessmentInstituteMappingRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.PaymentNotificationLogRepository;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.RazorpayService;
import com.kccitm.api.service.SmtpEmailService;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/payment")
public class PaymentController {

    private static final Logger logger = LoggerFactory.getLogger(PaymentController.class);

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Autowired
    private AssessmentInstituteMappingRepository mappingRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private RazorpayService razorpayService;

    @Autowired
    private SmtpEmailService emailService;

    @Autowired
    private PaymentNotificationLogRepository notificationLogRepository;

    @Value("${app.razorpay.callback-base-url:}")
    private String callbackBaseUrl;

    @PostMapping("/generate-link")
    public ResponseEntity<?> generatePaymentLink(@RequestBody Map<String, Object> request) {
        try {
            Long mappingId = Long.valueOf(request.get("mappingId").toString());
            Long amountRupees = Long.valueOf(request.get("amount").toString());
            long amountPaise = amountRupees * 100;

            Optional<AssessmentInstituteMapping> mappingOpt = mappingRepository.findById(mappingId);
            if (!mappingOpt.isPresent()) {
                return ResponseEntity.badRequest().body("Assessment mapping not found");
            }

            AssessmentInstituteMapping mapping = mappingOpt.get();

            String assessmentName = assessmentTableRepository.findById(mapping.getAssessmentId())
                    .map(a -> a.getAssessmentName()).orElse("Assessment");

            String description = "Payment for " + assessmentName;
            String referenceId = "MAP-" + mappingId + "-" + System.currentTimeMillis();

            String callbackUrl = null;
            if (callbackBaseUrl != null && !callbackBaseUrl.isEmpty()) {
                callbackUrl = callbackBaseUrl + "/payment-status?ref=" + referenceId;
            }

            Map<String, String> notes = new HashMap<>();
            notes.put("mappingId", mappingId.toString());
            notes.put("assessmentId", mapping.getAssessmentId().toString());
            notes.put("instituteCode", mapping.getInstituteCode().toString());
            notes.put("referenceId", referenceId);

            Map<String, String> linkResult = razorpayService.createPaymentLink(
                    amountPaise, "INR", description, callbackUrl, referenceId, notes);

            PaymentTransaction txn = new PaymentTransaction();
            txn.setMappingId(mappingId);
            txn.setAssessmentId(mapping.getAssessmentId());
            txn.setInstituteCode(mapping.getInstituteCode());
            txn.setAmount(amountPaise);
            txn.setRazorpayLinkId(linkResult.get("linkId"));
            txn.setPaymentLinkUrl(linkResult.get("paymentLinkUrl"));
            txn.setShortUrl(linkResult.get("shortUrl"));
            txn.setStatus("created");
            txn = paymentTransactionRepository.save(txn);

            Map<String, Object> response = new HashMap<>();
            response.put("transactionId", txn.getTransactionId());
            response.put("paymentLinkUrl", txn.getShortUrl());
            response.put("shortUrl", txn.getShortUrl());
            response.put("razorpayLinkId", txn.getRazorpayLinkId());
            response.put("amount", amountRupees);
            response.put("status", "created");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Failed to generate payment link", e);
            return ResponseEntity.internalServerError().body("Failed to generate payment link: " + e.getMessage());
        }
    }

    @GetMapping("/transactions")
    public ResponseEntity<List<PaymentTransaction>> getTransactions(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer instituteCode) {

        List<PaymentTransaction> transactions;

        if (instituteCode != null && status != null) {
            transactions = paymentTransactionRepository
                    .findByInstituteCodeAndStatusOrderByCreatedAtDesc(instituteCode, status);
        } else if (instituteCode != null) {
            transactions = paymentTransactionRepository
                    .findByInstituteCodeOrderByCreatedAtDesc(instituteCode);
        } else if (status != null) {
            transactions = paymentTransactionRepository
                    .findByStatusOrderByCreatedAtDesc(status);
        } else {
            transactions = paymentTransactionRepository.findAll();
        }

        return ResponseEntity.ok(transactions);
    }

    @GetMapping("/transactions/by-mapping/{mappingId}")
    public ResponseEntity<List<PaymentTransaction>> getByMapping(@PathVariable Long mappingId) {
        return ResponseEntity.ok(
                paymentTransactionRepository.findByMappingIdOrderByCreatedAtDesc(mappingId));
    }

    @PostMapping("/{transactionId}/send-nudge")
    public ResponseEntity<?> sendNudgeEmail(@PathVariable Long transactionId) {
        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findById(transactionId);
        if (!txnOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        PaymentTransaction txn = txnOpt.get();
        if (txn.getStudentEmail() == null || txn.getStudentEmail().isEmpty()) {
            return ResponseEntity.badRequest().body("No student email available for this transaction");
        }

        String assessmentName = assessmentTableRepository.findById(txn.getAssessmentId())
                .map(a -> a.getAssessmentName()).orElse("Assessment");

        sendNudgeEmailAsync(txn, assessmentName);

        txn.setNudgeEmailSent(true);
        paymentTransactionRepository.save(txn);

        return ResponseEntity.ok(Map.of("message", "Nudge email sent successfully"));
    }

    @PostMapping("/{transactionId}/resend-welcome")
    public ResponseEntity<?> resendWelcomeEmail(@PathVariable Long transactionId) {
        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findById(transactionId);
        if (!txnOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        PaymentTransaction txn = txnOpt.get();
        if (!"paid".equals(txn.getStatus())) {
            return ResponseEntity.badRequest().body("Cannot resend welcome email for non-paid transaction");
        }
        if (txn.getStudentEmail() == null || txn.getStudentEmail().isEmpty()) {
            return ResponseEntity.badRequest().body("No student email available");
        }

        String assessmentName = assessmentTableRepository.findById(txn.getAssessmentId())
                .map(a -> a.getAssessmentName()).orElse("Assessment");

        sendWelcomeEmailAsync(txn, assessmentName);

        txn.setWelcomeEmailSent(true);
        paymentTransactionRepository.save(txn);

        return ResponseEntity.ok(Map.of("message", "Welcome email resent successfully"));
    }

    @Async
    void sendNudgeEmailAsync(PaymentTransaction txn, String assessmentName) {
        try {
            long amountRupees = txn.getAmount() / 100;
            String subject = "Complete Your Payment - " + assessmentName;
            String htmlContent = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                    + "<div style='background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                    + "<h2 style='margin: 0;'>Payment Pending</h2>"
                    + "</div>"
                    + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                    + "<p>Dear <strong>" + (txn.getStudentName() != null ? txn.getStudentName() : "Student") + "</strong>,</p>"
                    + "<p>Your payment of <strong>INR " + amountRupees + "</strong> for <strong>" + assessmentName + "</strong> is still pending.</p>"
                    + "<p>Please complete your payment using the link below:</p>"
                    + "<div style='text-align: center; margin: 24px 0;'>"
                    + "<a href='" + txn.getShortUrl() + "' style='background: #f59e0b; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1.1em;'>Complete Payment</a>"
                    + "</div>"
                    + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated reminder. Please do not reply.</p>"
                    + "</div></div>";

            emailService.sendHtmlEmail(txn.getStudentEmail(), subject, htmlContent);
            logger.info("Nudge email sent to: {}", txn.getStudentEmail());
        } catch (Exception e) {
            logger.error("Failed to send nudge email to: {}", txn.getStudentEmail(), e);
        }
    }

    @Async
    void sendWelcomeEmailAsync(PaymentTransaction txn, String assessmentName) {
        try {
            String subject = "Welcome! Complete Your Assessment - " + assessmentName;
            String htmlContent = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                    + "<div style='background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                    + "<h2 style='margin: 0;'>Payment Successful!</h2>"
                    + "</div>"
                    + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                    + "<p>Dear <strong>" + (txn.getStudentName() != null ? txn.getStudentName() : "Student") + "</strong>,</p>"
                    + "<p>Your payment for <strong>" + assessmentName + "</strong> has been received successfully.</p>"
                    + "<p>Your assessment has been allotted. Please log in to complete it at your earliest convenience.</p>"
                    + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                    + "</div></div>";

            emailService.sendHtmlEmail(txn.getStudentEmail(), subject, htmlContent);
            logger.info("Welcome email sent to: {}", txn.getStudentEmail());
        } catch (Exception e) {
            logger.error("Failed to send welcome email to: {}", txn.getStudentEmail(), e);
        }
    }

    @PostMapping("/{transactionId}/send-email")
    public ResponseEntity<?> sendPaymentLinkEmail(
            @PathVariable Long transactionId,
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findById(transactionId);
        if (!txnOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        PaymentTransaction txn = txnOpt.get();
        String email = request.get("email");
        String studentName = request.getOrDefault("studentName", "Student");

        if (email == null || email.isEmpty()) {
            return ResponseEntity.badRequest().body("Email is required");
        }

        String assessmentName = assessmentTableRepository.findById(txn.getAssessmentId())
                .map(a -> a.getAssessmentName()).orElse("Assessment");

        PaymentNotificationLog log = new PaymentNotificationLog();
        log.setTransactionId(transactionId);
        log.setChannel("email");
        log.setRecipient(email);
        log.setPaymentLinkUrl(txn.getShortUrl());
        log.setAmount(txn.getAmount());
        log.setSentBy(currentUser != null ? currentUser.getName() : "admin");

        try {
            sendPaymentLinkEmailAsync(email, studentName, txn, assessmentName);
            log.setStatus("sent");
            notificationLogRepository.save(log);

            if (txn.getStudentEmail() == null || txn.getStudentEmail().isEmpty()) {
                txn.setStudentEmail(email);
                txn.setStudentName(studentName);
                paymentTransactionRepository.save(txn);
            }

            return ResponseEntity.ok(Map.of("message", "Payment link sent via email", "logId", log.getLogId()));
        } catch (Exception e) {
            log.setStatus("failed");
            log.setErrorMessage(e.getMessage());
            notificationLogRepository.save(log);
            return ResponseEntity.internalServerError().body("Failed to send email: " + e.getMessage());
        }
    }

    @PostMapping("/{transactionId}/send-whatsapp")
    public ResponseEntity<?> sendPaymentLinkWhatsApp(
            @PathVariable Long transactionId,
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findById(transactionId);
        if (!txnOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        PaymentTransaction txn = txnOpt.get();
        String phone = request.get("phone");
        String studentName = request.getOrDefault("studentName", "Student");

        if (phone == null || phone.isEmpty()) {
            return ResponseEntity.badRequest().body("Phone number is required");
        }

        String cleanPhone = phone.replaceAll("[^0-9]", "");
        if (cleanPhone.length() == 10) {
            cleanPhone = "91" + cleanPhone;
        }

        String assessmentName = assessmentTableRepository.findById(txn.getAssessmentId())
                .map(a -> a.getAssessmentName()).orElse("Assessment");

        long amountRupees = txn.getAmount() / 100;
        String message = "Hi " + studentName + ",\n\n"
                + "Please complete your payment of INR " + amountRupees + " for " + assessmentName + ".\n\n"
                + "Payment Link: " + txn.getShortUrl() + "\n\n"
                + "Thank you!";

        String encodedMessage = URLEncoder.encode(message, StandardCharsets.UTF_8);
        String whatsappUrl = "https://wa.me/" + cleanPhone + "?text=" + encodedMessage;

        PaymentNotificationLog log = new PaymentNotificationLog();
        log.setTransactionId(transactionId);
        log.setChannel("whatsapp");
        log.setRecipient(cleanPhone);
        log.setPaymentLinkUrl(txn.getShortUrl());
        log.setAmount(txn.getAmount());
        log.setSentBy(currentUser != null ? currentUser.getName() : "admin");
        log.setStatus("sent");
        notificationLogRepository.save(log);

        if (txn.getStudentPhone() == null || txn.getStudentPhone().isEmpty()) {
            txn.setStudentPhone(phone);
            txn.setStudentName(studentName);
            paymentTransactionRepository.save(txn);
        }

        return ResponseEntity.ok(Map.of(
            "whatsappUrl", whatsappUrl,
            "message", "WhatsApp link generated",
            "logId", log.getLogId()
        ));
    }

    @GetMapping("/{transactionId}/notifications")
    public ResponseEntity<List<PaymentNotificationLog>> getNotificationLogs(@PathVariable Long transactionId) {
        return ResponseEntity.ok(
                notificationLogRepository.findByTransactionIdOrderByCreatedAtDesc(transactionId));
    }

    @Async
    void sendPaymentLinkEmailAsync(String email, String studentName, PaymentTransaction txn, String assessmentName) {
        long amountRupees = txn.getAmount() / 100;
        String subject = "Payment Link - " + assessmentName + " (INR " + amountRupees + ")";
        String htmlContent = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                + "<div style='background: linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                + "<h2 style='margin: 0;'>Assessment Payment</h2>"
                + "</div>"
                + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                + "<p>Dear <strong>" + studentName + "</strong>,</p>"
                + "<p>Please complete your payment of <strong>INR " + amountRupees + "</strong> for <strong>" + assessmentName + "</strong>.</p>"
                + "<div style='text-align: center; margin: 28px 0;'>"
                + "<a href='" + txn.getShortUrl() + "' style='background: linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 1.1em; display: inline-block;'>Pay Now</a>"
                + "</div>"
                + "<p style='color: #666; font-size: 0.85em;'>Or copy this link: <a href='" + txn.getShortUrl() + "'>" + txn.getShortUrl() + "</a></p>"
                + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                + "</div></div>";

        emailService.sendHtmlEmail(email, subject, htmlContent);
        logger.info("Payment link email sent to: {} for transaction: {}", email, txn.getTransactionId());
    }
}
