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
import com.kccitm.api.service.PaymentEmailService;
import com.kccitm.api.service.RazorpayService;

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
    private PaymentEmailService paymentEmailService;

    @Autowired
    private PaymentNotificationLogRepository notificationLogRepository;

    @Autowired(required = false)
    private com.kccitm.api.repository.Career9.b2c.CampaignRepository campaignRepository;

    @Autowired(required = false)
    private com.kccitm.api.repository.Career9.b2c.CampaignAssessmentMappingRepository campaignAssessmentMappingRepository;

    @Autowired(required = false)
    private com.kccitm.api.repository.Career9.b2c.CampaignAssessmentTierRepository campaignAssessmentTierRepository;

    @Autowired(required = false)
    private com.kccitm.api.repository.Career9.b2c.PricingTierRepository pricingTierRepository;

    @Autowired(required = false)
    private com.kccitm.api.service.b2c.EntitlementService entitlementService;

    @Value("${app.razorpay.callback-base-url:}")
    private String callbackBaseUrl;

    private String getRegistrationUrl(PaymentTransaction txn) {
        String base = (callbackBaseUrl != null && !callbackBaseUrl.isEmpty())
                ? callbackBaseUrl : "https://dashboard.career-9.com";
        return base + "/payment-register/" + txn.getTransactionId();
    }

    @PostMapping("/generate-link")
    public ResponseEntity<?> generatePaymentLink(@RequestBody Map<String, Object> request) {
        try {
            Long mappingId = Long.valueOf(request.get("mappingId").toString());
            Long amountRupees = Long.valueOf(request.get("amount").toString());
            if (amountRupees <= 0) {
                return ResponseEntity.badRequest().body("Amount must be positive");
            }
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

    /**
     * B2C campaign payment link generation. Used by campaign landing pages.
     * Body: { campaignId, assessmentId, campaignAssessmentTierId,
     *         studentName, studentEmail, studentPhone, promoCode? }
     * Response: { transactionId, paymentLinkUrl, shortUrl, amount }
     */
    @PostMapping("/generate-campaign-link")
    public ResponseEntity<?> generateCampaignPaymentLink(@RequestBody Map<String, Object> request) {
        if (entitlementService == null || campaignRepository == null
                || campaignAssessmentMappingRepository == null
                || campaignAssessmentTierRepository == null
                || pricingTierRepository == null) {
            return ResponseEntity.status(503).body("B2C module not enabled on this server");
        }
        try {
            Long campaignId = toLong(request.get("campaignId"));
            Long assessmentId = toLong(request.get("assessmentId"));
            Long campaignAssessmentTierId = toLong(request.get("campaignAssessmentTierId"));
            if (campaignId == null || assessmentId == null || campaignAssessmentTierId == null) {
                return ResponseEntity.badRequest()
                        .body("campaignId, assessmentId, and campaignAssessmentTierId are required");
            }
            String studentName = (String) request.get("studentName");
            String studentEmail = (String) request.get("studentEmail");
            String studentPhone = (String) request.get("studentPhone");
            if (studentName == null || studentEmail == null) {
                return ResponseEntity.badRequest().body("studentName and studentEmail are required");
            }

            var campaignOpt = campaignRepository.findById(campaignId);
            if (!campaignOpt.isPresent() || Boolean.TRUE.equals(campaignOpt.get().getIsDeleted())) {
                return ResponseEntity.badRequest().body("Campaign not found");
            }
            var mappingOpt = campaignAssessmentMappingRepository
                    .findByCampaignIdAndAssessmentIdAndIsDeletedFalse(campaignId, assessmentId);
            if (!mappingOpt.isPresent()) {
                return ResponseEntity.badRequest().body("Assessment is not part of this campaign");
            }
            var tierMapOpt = campaignAssessmentTierRepository.findById(campaignAssessmentTierId);
            if (!tierMapOpt.isPresent()
                    || !mappingOpt.get().getId().equals(tierMapOpt.get().getCampaignAssessmentMappingId())) {
                return ResponseEntity.badRequest().body("Tier does not belong to this campaign-assessment");
            }
            var pricingTierOpt = pricingTierRepository.findById(tierMapOpt.get().getPricingTierId());
            if (!pricingTierOpt.isPresent()) {
                return ResponseEntity.badRequest().body("Pricing tier not found");
            }

            Long priceInr = tierMapOpt.get().getPriceOverrideInr() != null
                    ? tierMapOpt.get().getPriceOverrideInr()
                    : pricingTierOpt.get().getBasePriceInr();
            if (priceInr == null || priceInr <= 0) {
                return ResponseEntity.badRequest().body("Tier price is not set");
            }

            String assessmentName = assessmentTableRepository.findById(assessmentId)
                    .map(a -> a.getAssessmentName()).orElse("Assessment");
            String description = "Career-9: " + campaignOpt.get().getName() + " — " + assessmentName;
            String referenceId = "CAM-" + campaignId + "-" + campaignAssessmentTierId + "-" + System.currentTimeMillis();

            String callbackUrl = null;
            if (callbackBaseUrl != null && !callbackBaseUrl.isEmpty()) {
                callbackUrl = callbackBaseUrl + "/payment-status?ref=" + referenceId;
            }

            Map<String, String> notes = new HashMap<>();
            notes.put("campaignId", campaignId.toString());
            notes.put("assessmentId", assessmentId.toString());
            notes.put("campaignAssessmentTierId", campaignAssessmentTierId.toString());
            notes.put("referenceId", referenceId);
            if (studentName != null) notes.put("customerName", studentName);

            Map<String, String> linkResult = razorpayService.createPaymentLink(
                    priceInr, "INR", description, callbackUrl, referenceId, notes);

            // Resolve purchase path for analytics on the txn
            String purchasePath = mappingOpt.get().getPurchasePath();
            if (purchasePath == null) purchasePath = campaignOpt.get().getDefaultPurchasePath();
            if (purchasePath == null) purchasePath = "B";

            PaymentTransaction txn = new PaymentTransaction();
            txn.setAssessmentId(assessmentId);
            txn.setCampaignId(campaignId);
            txn.setCampaignAssessmentTierId(campaignAssessmentTierId);
            txn.setPurchasePath(purchasePath);
            txn.setAmount(priceInr);
            txn.setStudentName(studentName);
            txn.setStudentEmail(studentEmail);
            txn.setStudentPhone(studentPhone);
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
            response.put("amount", priceInr);
            response.put("status", "created");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Failed to generate campaign payment link", e);
            return ResponseEntity.internalServerError().body("Failed: " + e.getMessage());
        }
    }

    private static Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).longValue();
        return Long.parseLong(o.toString());
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

        paymentEmailService.sendNudgeEmail(txn, assessmentName);

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

        paymentEmailService.sendWelcomeEmailResend(txn, assessmentName);

        txn.setWelcomeEmailSent(true);
        paymentTransactionRepository.save(txn);

        return ResponseEntity.ok(Map.of("message", "Welcome email resent successfully"));
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
        log.setPaymentLinkUrl(getRegistrationUrl(txn));
        log.setAmount(txn.getAmount());
        log.setSentBy(currentUser != null ? currentUser.getName() : "admin");

        try {
            paymentEmailService.sendPaymentLinkEmail(email, studentName, txn, assessmentName);
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
                + "Payment Link: " + getRegistrationUrl(txn) + "\n\n"
                + "Thank you!";

        String encodedMessage = URLEncoder.encode(message, StandardCharsets.UTF_8);
        String whatsappUrl = "https://wa.me/" + cleanPhone + "?text=" + encodedMessage;

        PaymentNotificationLog log = new PaymentNotificationLog();
        log.setTransactionId(transactionId);
        log.setChannel("whatsapp");
        log.setRecipient(cleanPhone);
        log.setPaymentLinkUrl(getRegistrationUrl(txn));
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

}
