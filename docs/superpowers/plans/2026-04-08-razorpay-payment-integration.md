# Razorpay Payment Integration for Assessment Mappings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Razorpay payment link generation per assessment mapping, track all payment transactions (success/failed/aborted), auto-create students on successful payment, allot assessments, provide a payment tracking dashboard with nudge/resend actions, and enable sending payment links via email/WhatsApp with full send logging.

**Architecture:** Backend adds a `PaymentTransaction` entity and a `RazorpayService` that creates Razorpay Payment Links via REST API. A webhook endpoint receives Razorpay callbacks and updates transaction status. On success, the existing student-creation flow from `AssessmentInstituteMappingController.registerStudentByToken()` is reused. Frontend adds a "Payment Link" column to the assessment mapping table, a modal to generate links at custom amounts, and 3 new payment tracking pages (Success/Pending/Failed tabs).

**Tech Stack:** Spring Boot 2.5.5, Razorpay Java SDK, React 18, TypeScript, React Bootstrap, QRCodeCanvas

---

## File Structure

### Backend (New Files)

| File | Responsibility |
|------|---------------|
| `model/career9/PaymentTransaction.java` | JPA entity storing every Razorpay transaction |
| `repository/Career9/PaymentTransactionRepository.java` | JPA repository with queries by status, mapping, student |
| `service/RazorpayService.java` | Creates Razorpay payment links, verifies webhook signatures |
| `controller/career9/PaymentController.java` | Admin endpoints (generate link, list transactions, nudge, resend) |
| `controller/career9/PaymentWebhookController.java` | Public webhook endpoint for Razorpay callbacks |
| `model/career9/PaymentNotificationLog.java` | JPA entity logging every email/WhatsApp send for a payment link |
| `repository/Career9/PaymentNotificationLogRepository.java` | Repository for notification logs |

### Backend (Modified Files)

| File | Change |
|------|--------|
| `pom.xml` | Add Razorpay SDK dependency |
| `resources/application.yml` | Add Razorpay API key/secret per profile |
| `config/SecurityConfig.java` | Permit `/payment/webhook/**` as public |

### Frontend (New Files)

| File | Responsibility |
|------|---------------|
| `pages/PaymentTracking/PaymentTrackingPage.tsx` | Main page with 3 tabs: Success, Pending, Failed/Aborted |
| `pages/PaymentTracking/components/PaymentTable.tsx` | Reusable table component for payment rows |
| `pages/PaymentTracking/API/Payment_APIs.ts` | All payment-related axios calls |

### Frontend (Modified Files)

| File | Change |
|------|--------|
| `pages/College/components/AssessmentMappingModal.tsx` | Add "Payment Link" column + PaymentLinkModal trigger button |
| `pages/College/components/PaymentLinkModal.tsx` | New modal: enter amount, generate link, show QR, copy link, send via email/WhatsApp |
| `routing/PrivateRoutes.tsx` | Add `/payment-tracking` route |
| `_metronic/layout/components/aside/AsideMenuMain.tsx` | Add "Payment Tracking" menu item |

---

## Task 1: Add Razorpay SDK Dependency + Configuration

**Files:**
- Modify: `spring-social/pom.xml`
- Modify: `spring-social/src/main/resources/application.yml`

- [ ] **Step 1: Add Razorpay Java SDK to pom.xml**

In `spring-social/pom.xml`, add inside the `<dependencies>` block (after the existing Google Zxing dependency around line 111):

```xml
<!-- Razorpay Payment Gateway -->
<dependency>
    <groupId>com.razorpay</groupId>
    <artifactId>razorpay-java</artifactId>
    <version>1.4.7</version>
</dependency>
```

- [ ] **Step 2: Add Razorpay config to application.yml**

In `spring-social/src/main/resources/application.yml`, add under the `app:` section for each profile. 

For `dev` profile (around line 170, inside `app:` block):

```yaml
    razorpay:
      key-id: rzp_test_XXXXXXXXXXXXXXX
      key-secret: XXXXXXXXXXXXXXXXXXXXXXXX
      webhook-secret: XXXXXXXXXXXXXXXXXXXXXXXX
```

For `staging` profile (around line 340, inside `app:` block):

```yaml
    razorpay:
      key-id: rzp_test_XXXXXXXXXXXXXXX
      key-secret: XXXXXXXXXXXXXXXXXXXXXXXX
      webhook-secret: XXXXXXXXXXXXXXXXXXXXXXXX
```

For `production` profile (around line 640, inside `app:` block):

```yaml
    razorpay:
      key-id: rzp_live_XXXXXXXXXXXXXXX
      key-secret: XXXXXXXXXXXXXXXXXXXXXXXX
      webhook-secret: XXXXXXXXXXXXXXXXXXXXXXXX
```

> **Note:** Replace `XXXXXXX` values with actual Razorpay credentials before deployment. The test keys are for development.

- [ ] **Step 3: Commit**

```bash
cd /home/kccsw/Projects/career-nine-sandbox
git add spring-social/pom.xml spring-social/src/main/resources/application.yml
git commit -m "feat: add Razorpay SDK dependency and config placeholders"
```

---

## Task 2: Create PaymentTransaction Entity

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/model/career9/PaymentTransaction.java`

- [ ] **Step 1: Create the PaymentTransaction JPA entity**

```java
package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "payment_transaction")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class PaymentTransaction implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "transaction_id")
    private Long transactionId;

    // Razorpay payment link ID (plink_XXXX)
    @Column(name = "razorpay_link_id", length = 50)
    private String razorpayLinkId;

    // Razorpay payment ID (pay_XXXX) — set on callback
    @Column(name = "razorpay_payment_id", length = 50)
    private String razorpayPaymentId;

    // Razorpay order ID — set on callback
    @Column(name = "razorpay_order_id", length = 50)
    private String razorpayOrderId;

    // Which assessment mapping this payment is for
    @Column(name = "mapping_id", nullable = false)
    private Long mappingId;

    // Amount in paise (Razorpay uses paise)
    @Column(name = "amount", nullable = false)
    private Long amount;

    // Currency code
    @Column(name = "currency", length = 10, columnDefinition = "varchar(10) default 'INR'")
    private String currency = "INR";

    // Payment status: created, paid, failed, expired, cancelled
    @Column(name = "status", length = 20, columnDefinition = "varchar(20) default 'created'")
    private String status = "created";

    // The generated payment link URL
    @Column(name = "payment_link_url", length = 500)
    private String paymentLinkUrl;

    // Short payment link URL
    @Column(name = "short_url", length = 500)
    private String shortUrl;

    // Student info captured during payment
    @Column(name = "student_name", length = 200)
    private String studentName;

    @Column(name = "student_email", length = 200)
    private String studentEmail;

    @Column(name = "student_phone", length = 20)
    private String studentPhone;

    @Column(name = "student_dob")
    @Temporal(TemporalType.DATE)
    @JsonFormat(pattern = "dd-MM-yyyy")
    private Date studentDob;

    // After successful payment, the created user's student ID
    @Column(name = "user_student_id")
    private Long userStudentId;

    // Assessment ID (denormalized from mapping for easy queries)
    @Column(name = "assessment_id")
    private Long assessmentId;

    // Institute code (denormalized from mapping for easy queries)
    @Column(name = "institute_code")
    private Integer instituteCode;

    // Razorpay webhook error reason (if failed)
    @Column(name = "failure_reason", length = 500)
    private String failureReason;

    // Whether welcome email was sent
    @Column(name = "welcome_email_sent", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean welcomeEmailSent = false;

    // Whether nudge email was sent (for failed/pending)
    @Column(name = "nudge_email_sent", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean nudgeEmailSent = false;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) this.createdAt = new Date();
        if (this.updatedAt == null) this.updatedAt = new Date();
        if (this.status == null) this.status = "created";
        if (this.currency == null) this.currency = "INR";
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = new Date();
    }

    // ── Getters and Setters ──

    public Long getTransactionId() { return transactionId; }
    public void setTransactionId(Long transactionId) { this.transactionId = transactionId; }

    public String getRazorpayLinkId() { return razorpayLinkId; }
    public void setRazorpayLinkId(String razorpayLinkId) { this.razorpayLinkId = razorpayLinkId; }

    public String getRazorpayPaymentId() { return razorpayPaymentId; }
    public void setRazorpayPaymentId(String razorpayPaymentId) { this.razorpayPaymentId = razorpayPaymentId; }

    public String getRazorpayOrderId() { return razorpayOrderId; }
    public void setRazorpayOrderId(String razorpayOrderId) { this.razorpayOrderId = razorpayOrderId; }

    public Long getMappingId() { return mappingId; }
    public void setMappingId(Long mappingId) { this.mappingId = mappingId; }

    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPaymentLinkUrl() { return paymentLinkUrl; }
    public void setPaymentLinkUrl(String paymentLinkUrl) { this.paymentLinkUrl = paymentLinkUrl; }

    public String getShortUrl() { return shortUrl; }
    public void setShortUrl(String shortUrl) { this.shortUrl = shortUrl; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getStudentEmail() { return studentEmail; }
    public void setStudentEmail(String studentEmail) { this.studentEmail = studentEmail; }

    public String getStudentPhone() { return studentPhone; }
    public void setStudentPhone(String studentPhone) { this.studentPhone = studentPhone; }

    public Date getStudentDob() { return studentDob; }
    public void setStudentDob(Date studentDob) { this.studentDob = studentDob; }

    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public Integer getInstituteCode() { return instituteCode; }
    public void setInstituteCode(Integer instituteCode) { this.instituteCode = instituteCode; }

    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }

    public Boolean getWelcomeEmailSent() { return welcomeEmailSent; }
    public void setWelcomeEmailSent(Boolean welcomeEmailSent) { this.welcomeEmailSent = welcomeEmailSent; }

    public Boolean getNudgeEmailSent() { return nudgeEmailSent; }
    public void setNudgeEmailSent(Boolean nudgeEmailSent) { this.nudgeEmailSent = nudgeEmailSent; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
}
```

- [ ] **Step 2: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/model/career9/PaymentTransaction.java
git commit -m "feat: add PaymentTransaction JPA entity for Razorpay tracking"
```

---

## Task 3: Create PaymentTransaction Repository

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/repository/Career9/PaymentTransactionRepository.java`

- [ ] **Step 1: Create the repository interface**

```java
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
```

- [ ] **Step 2: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/repository/Career9/PaymentTransactionRepository.java
git commit -m "feat: add PaymentTransactionRepository with query methods"
```

---

## Task 4: Create RazorpayService

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/RazorpayService.java`

- [ ] **Step 1: Create the Razorpay service**

```java
package com.kccitm.api.service;

import java.util.Map;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.razorpay.PaymentLink;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;

@Service
public class RazorpayService {

    private static final Logger logger = LoggerFactory.getLogger(RazorpayService.class);

    @Value("${app.razorpay.key-id}")
    private String keyId;

    @Value("${app.razorpay.key-secret}")
    private String keySecret;

    @Value("${app.razorpay.webhook-secret}")
    private String webhookSecret;

    private RazorpayClient getClient() throws RazorpayException {
        return new RazorpayClient(keyId, keySecret);
    }

    /**
     * Create a Razorpay Payment Link.
     *
     * @param amountInPaise   Amount in paise (e.g., 50000 for INR 500)
     * @param currency        Currency code (default "INR")
     * @param description     Payment description
     * @param callbackUrl     URL to redirect after payment
     * @param referenceId     Internal reference (mapping ID + timestamp)
     * @param notes           Additional metadata (mappingId, assessmentId, instituteCode)
     * @return Map with keys: linkId, shortUrl, paymentLinkUrl, status
     */
    public Map<String, String> createPaymentLink(
            long amountInPaise,
            String currency,
            String description,
            String callbackUrl,
            String referenceId,
            Map<String, String> notes) throws RazorpayException {

        RazorpayClient client = getClient();

        JSONObject request = new JSONObject();
        request.put("amount", amountInPaise);
        request.put("currency", currency != null ? currency : "INR");
        request.put("description", description);
        request.put("reference_id", referenceId);

        if (callbackUrl != null) {
            request.put("callback_url", callbackUrl);
            request.put("callback_method", "get");
        }

        // Collect customer info via Razorpay's built-in form
        JSONObject notify = new JSONObject();
        notify.put("sms", false);
        notify.put("email", false);
        request.put("notify", notify);

        // Attach metadata notes
        if (notes != null && !notes.isEmpty()) {
            JSONObject notesJson = new JSONObject();
            notes.forEach(notesJson::put);
            request.put("notes", notesJson);
        }

        // Reminder enabled
        request.put("reminder_enable", true);

        PaymentLink paymentLink = client.paymentLink.create(request);

        logger.info("Razorpay payment link created: {}", paymentLink.get("id"));

        return Map.of(
            "linkId", paymentLink.get("id").toString(),
            "shortUrl", paymentLink.get("short_url").toString(),
            "paymentLinkUrl", paymentLink.get("short_url").toString(),
            "status", paymentLink.get("status").toString()
        );
    }

    /**
     * Verify Razorpay webhook signature.
     */
    public boolean verifyWebhookSignature(String payload, String signature) {
        try {
            Mac sha256_HMAC = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(webhookSecret.getBytes(), "HmacSHA256");
            sha256_HMAC.init(secretKey);
            byte[] hash = sha256_HMAC.doFinal(payload.getBytes());
            String computedSignature = bytesToHex(hash);
            return computedSignature.equals(signature);
        } catch (Exception e) {
            logger.error("Webhook signature verification failed", e);
            return false;
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    public String getKeyId() {
        return keyId;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/service/RazorpayService.java
git commit -m "feat: add RazorpayService for payment link creation and webhook verification"
```

---

## Task 5: Create PaymentController (Admin Endpoints)

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/controller/career9/PaymentController.java`

- [ ] **Step 1: Create the admin payment controller**

```java
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
import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.repository.Career9.AssessmentInstituteMappingRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.service.RazorpayService;
import com.kccitm.api.service.SmtpEmailService;

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

    @Value("${app.razorpay.callback-base-url:}")
    private String callbackBaseUrl;

    /**
     * Generate a Razorpay payment link for an assessment mapping.
     * POST /payment/generate-link
     * Body: { mappingId: Long, amount: Long (in rupees) }
     */
    @PostMapping("/generate-link")
    public ResponseEntity<?> generatePaymentLink(@RequestBody Map<String, Object> request) {
        try {
            Long mappingId = Long.valueOf(request.get("mappingId").toString());
            Long amountRupees = Long.valueOf(request.get("amount").toString());
            long amountPaise = amountRupees * 100;

            // Validate mapping exists
            Optional<AssessmentInstituteMapping> mappingOpt = mappingRepository.findById(mappingId);
            if (!mappingOpt.isPresent()) {
                return ResponseEntity.badRequest().body("Assessment mapping not found");
            }

            AssessmentInstituteMapping mapping = mappingOpt.get();

            // Get assessment name for description
            String assessmentName = assessmentTableRepository.findById(mapping.getAssessmentId())
                    .map(a -> a.getAssessmentName()).orElse("Assessment");

            String description = "Payment for " + assessmentName;
            String referenceId = "MAP-" + mappingId + "-" + System.currentTimeMillis();

            // Callback URL - redirects to frontend payment status page
            String callbackUrl = null;
            if (callbackBaseUrl != null && !callbackBaseUrl.isEmpty()) {
                callbackUrl = callbackBaseUrl + "/payment-status?ref=" + referenceId;
            }

            // Notes for tracking
            Map<String, String> notes = new HashMap<>();
            notes.put("mappingId", mappingId.toString());
            notes.put("assessmentId", mapping.getAssessmentId().toString());
            notes.put("instituteCode", mapping.getInstituteCode().toString());
            notes.put("referenceId", referenceId);

            // Create Razorpay link
            Map<String, String> linkResult = razorpayService.createPaymentLink(
                    amountPaise, "INR", description, callbackUrl, referenceId, notes);

            // Save transaction
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

            // Return link info
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
     * Get all transactions, optionally filtered by status and/or institute.
     * GET /payment/transactions?status=paid&instituteCode=123
     */
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

    /**
     * Get transactions for a specific mapping.
     * GET /payment/transactions/by-mapping/{mappingId}
     */
    @GetMapping("/transactions/by-mapping/{mappingId}")
    public ResponseEntity<List<PaymentTransaction>> getByMapping(@PathVariable Long mappingId) {
        return ResponseEntity.ok(
                paymentTransactionRepository.findByMappingIdOrderByCreatedAtDesc(mappingId));
    }

    /**
     * Send nudge email for failed/pending payment.
     * POST /payment/{transactionId}/send-nudge
     */
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

    /**
     * Resend welcome email for successful payment.
     * POST /payment/{transactionId}/resend-welcome
     */
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

    // ── Async Email Methods ──

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
}
```

- [ ] **Step 2: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/controller/career9/PaymentController.java
git commit -m "feat: add PaymentController with link generation, transactions listing, nudge and welcome emails"
```

---

## Task 6: Create Payment Webhook Controller

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/controller/career9/PaymentWebhookController.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java`

- [ ] **Step 1: Create the webhook controller**

This is the most critical piece — it receives Razorpay callbacks, updates transaction status, and on success creates the student + allots the assessment (reusing the same logic as `AssessmentInstituteMappingController.registerStudentByToken()`).

```java
package com.kccitm.api.controller.career9;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.AssessmentInstituteMapping;
import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.Career9.AssessmentInstituteMappingRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.service.CareerNineRollNumberService;
import com.kccitm.api.service.RazorpayService;
import com.kccitm.api.service.SmtpEmailService;

@RestController
@RequestMapping("/payment/webhook")
public class PaymentWebhookController {

    private static final Logger logger = LoggerFactory.getLogger(PaymentWebhookController.class);

    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private AssessmentInstituteMappingRepository mappingRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StudentInfoRepository studentInfoRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private StudentAssessmentMappingRepository studentAssessmentMappingRepository;
    @Autowired private InstituteDetailRepository instituteDetailRepository;
    @Autowired private CareerNineRollNumberService rollNumberService;
    @Autowired private RazorpayService razorpayService;
    @Autowired private SmtpEmailService emailService;

    /**
     * Razorpay webhook handler. Receives events like payment_link.paid, payment_link.expired, etc.
     * POST /payment/webhook/razorpay
     */
    @PostMapping("/razorpay")
    @Transactional
    public ResponseEntity<?> handleRazorpayWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {

        logger.info("Razorpay webhook received");

        // Verify signature
        if (signature != null && !razorpayService.verifyWebhookSignature(payload, signature)) {
            logger.warn("Invalid Razorpay webhook signature");
            return ResponseEntity.badRequest().body("Invalid signature");
        }

        try {
            JSONObject event = new JSONObject(payload);
            String eventType = event.getString("event");
            JSONObject payloadObj = event.getJSONObject("payload");

            logger.info("Razorpay webhook event: {}", eventType);

            switch (eventType) {
                case "payment_link.paid":
                    handlePaymentLinkPaid(payloadObj);
                    break;
                case "payment_link.expired":
                    handlePaymentLinkStatusChange(payloadObj, "expired");
                    break;
                case "payment_link.cancelled":
                    handlePaymentLinkStatusChange(payloadObj, "cancelled");
                    break;
                case "payment.failed":
                    handlePaymentFailed(payloadObj);
                    break;
                default:
                    logger.info("Unhandled webhook event: {}", eventType);
            }

            return ResponseEntity.ok(Map.of("status", "ok"));

        } catch (Exception e) {
            logger.error("Error processing Razorpay webhook", e);
            // Return 200 to prevent Razorpay from retrying (we log the error)
            return ResponseEntity.ok(Map.of("status", "error_logged"));
        }
    }

    /**
     * Callback URL handler — Razorpay redirects here after payment.
     * GET /payment/webhook/callback?razorpay_payment_id=XXX&razorpay_payment_link_id=XXX&razorpay_payment_link_reference_id=XXX&razorpay_payment_link_status=paid&razorpay_signature=XXX
     */
    @GetMapping("/callback")
    public ResponseEntity<?> handleCallback(
            @RequestParam(required = false) String razorpay_payment_id,
            @RequestParam(required = false) String razorpay_payment_link_id,
            @RequestParam(required = false) String razorpay_payment_link_status,
            @RequestParam(required = false) String razorpay_signature) {

        Map<String, Object> response = new HashMap<>();
        response.put("paymentId", razorpay_payment_id);
        response.put("linkId", razorpay_payment_link_id);
        response.put("status", razorpay_payment_link_status);

        // Look up the transaction
        if (razorpay_payment_link_id != null) {
            Optional<PaymentTransaction> txnOpt = paymentTransactionRepository
                    .findByRazorpayLinkId(razorpay_payment_link_id);
            txnOpt.ifPresent(txn -> {
                response.put("transactionId", txn.getTransactionId());
                response.put("assessmentId", txn.getAssessmentId());
                response.put("amount", txn.getAmount() / 100);
            });
        }

        return ResponseEntity.ok(response);
    }

    // ── Private Handlers ──

    private void handlePaymentLinkPaid(JSONObject payloadObj) {
        JSONObject paymentLink = payloadObj.getJSONObject("payment_link").getJSONObject("entity");
        String linkId = paymentLink.getString("id");

        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findByRazorpayLinkId(linkId);
        if (!txnOpt.isPresent()) {
            logger.warn("Payment link not found in DB: {}", linkId);
            return;
        }

        PaymentTransaction txn = txnOpt.get();

        // Extract payment details
        JSONObject payment = payloadObj.getJSONObject("payment").getJSONObject("entity");
        txn.setRazorpayPaymentId(payment.getString("id"));
        if (payment.has("order_id") && !payment.isNull("order_id")) {
            txn.setRazorpayOrderId(payment.getString("order_id"));
        }
        txn.setStatus("paid");

        // Extract customer info from payment
        if (payment.has("email") && !payment.isNull("email")) {
            txn.setStudentEmail(payment.getString("email"));
        }
        if (payment.has("contact") && !payment.isNull("contact")) {
            txn.setStudentPhone(payment.getString("contact"));
        }

        // Extract customer name and DOB from notes
        JSONObject notes = paymentLink.optJSONObject("notes");
        if (notes != null) {
            if (notes.has("customerName")) {
                txn.setStudentName(notes.getString("customerName"));
            }
            if (notes.has("customerDob")) {
                try {
                    SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
                    txn.setStudentDob(sdf.parse(notes.getString("customerDob")));
                } catch (Exception e) {
                    logger.warn("Could not parse customer DOB from notes");
                }
            }
        }

        paymentTransactionRepository.save(txn);

        // Now create the student and allot assessment
        createStudentAndAllotAssessment(txn);
    }

    private void handlePaymentLinkStatusChange(JSONObject payloadObj, String status) {
        JSONObject paymentLink = payloadObj.getJSONObject("payment_link").getJSONObject("entity");
        String linkId = paymentLink.getString("id");

        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findByRazorpayLinkId(linkId);
        if (!txnOpt.isPresent()) {
            logger.warn("Payment link not found in DB: {}", linkId);
            return;
        }

        PaymentTransaction txn = txnOpt.get();
        txn.setStatus(status);
        paymentTransactionRepository.save(txn);
        logger.info("Payment link {} status changed to: {}", linkId, status);
    }

    private void handlePaymentFailed(JSONObject payloadObj) {
        JSONObject payment = payloadObj.getJSONObject("payment").getJSONObject("entity");
        String paymentId = payment.getString("id");

        // Try to find by payment ID first
        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findByRazorpayPaymentId(paymentId);

        if (!txnOpt.isPresent()) {
            // Try to find by notes
            JSONObject notes = payment.optJSONObject("notes");
            if (notes != null && notes.has("razorpayLinkId")) {
                txnOpt = paymentTransactionRepository.findByRazorpayLinkId(notes.getString("razorpayLinkId"));
            }
        }

        if (!txnOpt.isPresent()) {
            logger.warn("Transaction not found for failed payment: {}", paymentId);
            return;
        }

        PaymentTransaction txn = txnOpt.get();
        txn.setStatus("failed");
        txn.setRazorpayPaymentId(paymentId);

        // Capture failure reason
        if (payment.has("error_description") && !payment.isNull("error_description")) {
            txn.setFailureReason(payment.getString("error_description"));
        } else if (payment.has("error_reason") && !payment.isNull("error_reason")) {
            txn.setFailureReason(payment.getString("error_reason"));
        }

        // Capture customer info if available
        if (payment.has("email") && !payment.isNull("email")) {
            txn.setStudentEmail(payment.getString("email"));
        }
        if (payment.has("contact") && !payment.isNull("contact")) {
            txn.setStudentPhone(payment.getString("contact"));
        }

        paymentTransactionRepository.save(txn);
        logger.info("Payment {} marked as failed. Reason: {}", paymentId, txn.getFailureReason());
    }

    /**
     * Core logic: Create student account and allot assessment after successful payment.
     * Reuses the same flow as AssessmentInstituteMappingController.registerStudentByToken().
     */
    private void createStudentAndAllotAssessment(PaymentTransaction txn) {
        try {
            Optional<AssessmentInstituteMapping> mappingOpt = mappingRepository.findById(txn.getMappingId());
            if (!mappingOpt.isPresent()) {
                logger.error("Mapping not found for transaction: {}", txn.getTransactionId());
                return;
            }

            AssessmentInstituteMapping mapping = mappingOpt.get();
            Long assessmentId = mapping.getAssessmentId();
            Integer instituteCode = mapping.getInstituteCode();

            String email = txn.getStudentEmail();
            String name = txn.getStudentName() != null ? txn.getStudentName() : "Student";
            Date dob = txn.getStudentDob() != null ? txn.getStudentDob() : new Date();
            String phone = txn.getStudentPhone();

            // Check if student already exists by email
            if (email != null) {
                List<StudentInfo> byEmail = studentInfoRepository.findByEmailAndInstituteId(email, instituteCode);
                if (!byEmail.isEmpty()) {
                    // Existing student — just allot assessment
                    handleExistingStudentPayment(byEmail.get(0), assessmentId, instituteCode, txn);
                    return;
                }
            }

            // Create new User
            User user = new User((int) (Math.random() * 100000), dob);
            user.setName(name);
            user.setEmail(email);
            user.setPhone(phone);
            user = userRepository.save(user);

            // Generate roll number
            Integer sectionId = mapping.getSectionId();
            String rollNumber = rollNumberService.generateNextRollNumber(instituteCode, sectionId);
            if (rollNumber != null) {
                user.setCareerNineRollNumber(rollNumber);
                user = userRepository.save(user);
            }

            // Create StudentInfo
            StudentInfo studentInfo = new StudentInfo();
            studentInfo.setName(name);
            studentInfo.setEmail(email);
            studentInfo.setStudentDob(dob);
            studentInfo.setPhoneNumber(phone);
            studentInfo.setInstituteId(instituteCode);
            studentInfo.setSchoolSectionId(sectionId);
            studentInfo.setUser(user);
            studentInfo = studentInfoRepository.save(studentInfo);

            // Create UserStudent
            InstituteDetail institute = instituteDetailRepository.findById(instituteCode.intValue());
            UserStudent userStudent = new UserStudent(user, studentInfo, institute);
            userStudent = userStudentRepository.save(userStudent);

            // Create StudentAssessmentMapping
            StudentAssessmentMapping sam = new StudentAssessmentMapping(
                    userStudent.getUserStudentId(), assessmentId);
            studentAssessmentMappingRepository.save(sam);

            // Update transaction with student reference
            txn.setUserStudentId(userStudent.getUserStudentId());
            paymentTransactionRepository.save(txn);

            // Send welcome email async
            String assessmentName = assessmentTableRepository.findById(assessmentId)
                    .map(a -> a.getAssessmentName()).orElse("Assessment");
            SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
            String dobStr = sdf.format(dob);

            sendWelcomeAndAssessmentEmailAsync(email, name, user.getUsername(), dobStr, assessmentName, txn);

            logger.info("Student created and assessment allotted via payment. UserStudentId: {}, TransactionId: {}",
                    userStudent.getUserStudentId(), txn.getTransactionId());

        } catch (Exception e) {
            logger.error("Failed to create student after payment. TransactionId: {}", txn.getTransactionId(), e);
        }
    }

    private void handleExistingStudentPayment(StudentInfo existingStudent, Long assessmentId,
            Integer instituteCode, PaymentTransaction txn) {
        List<UserStudent> userStudents = userStudentRepository.findByStudentInfoId(existingStudent.getId());
        if (userStudents.isEmpty()) {
            InstituteDetail institute = instituteDetailRepository.findById(instituteCode.intValue());
            User existingUser = existingStudent.getUser();
            if (existingUser == null) {
                existingUser = new User((int) (Math.random() * 100000), existingStudent.getStudentDob());
                existingUser.setName(existingStudent.getName());
                existingUser.setEmail(existingStudent.getEmail());
                existingUser = userRepository.save(existingUser);
                existingStudent.setUser(existingUser);
                studentInfoRepository.save(existingStudent);
            }
            UserStudent newUs = new UserStudent(existingUser, existingStudent, institute);
            newUs = userStudentRepository.save(newUs);
            userStudents = List.of(newUs);
        }

        UserStudent userStudent = userStudents.get(0);

        // Check if already assigned
        Optional<StudentAssessmentMapping> existingMapping = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(
                        userStudent.getUserStudentId(), assessmentId);

        if (!existingMapping.isPresent()) {
            StudentAssessmentMapping sam = new StudentAssessmentMapping(
                    userStudent.getUserStudentId(), assessmentId);
            studentAssessmentMappingRepository.save(sam);
        }

        txn.setUserStudentId(userStudent.getUserStudentId());
        paymentTransactionRepository.save(txn);

        // Send welcome email
        User user = existingStudent.getUser();
        if (user != null && existingStudent.getEmail() != null) {
            String assessmentName = assessmentTableRepository.findById(assessmentId)
                    .map(a -> a.getAssessmentName()).orElse("Assessment");
            SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
            String dobStr = user.getDobDate() != null ? sdf.format(user.getDobDate()) : "";
            sendWelcomeAndAssessmentEmailAsync(existingStudent.getEmail(), existingStudent.getName(),
                    user.getUsername(), dobStr, assessmentName, txn);
        }

        logger.info("Existing student assigned assessment via payment. UserStudentId: {}", userStudent.getUserStudentId());
    }

    @Async
    void sendWelcomeAndAssessmentEmailAsync(String email, String name, String username,
            String dob, String assessmentName, PaymentTransaction txn) {
        try {
            String subject = "Payment Successful - " + assessmentName;
            String htmlContent = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                    + "<div style='background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                    + "<h2 style='margin: 0;'>Payment Successful!</h2>"
                    + "</div>"
                    + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                    + "<p>Dear <strong>" + name + "</strong>,</p>"
                    + "<p>Your payment for <strong>" + assessmentName + "</strong> has been received. Your assessment has been allotted.</p>"
                    + "<div style='background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;'>"
                    + "<p style='margin: 4px 0;'><strong>Username:</strong> <span style='color: #059669; font-size: 1.1em;'>" + username + "</span></p>"
                    + "<p style='margin: 4px 0;'><strong>Password:</strong> <span style='color: #059669; font-size: 1.1em;'>" + dob + "</span> (Your Date of Birth)</p>"
                    + "</div>"
                    + "<p>Please log in and complete your assessment at your earliest convenience.</p>"
                    + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                    + "</div></div>";

            emailService.sendHtmlEmail(email, subject, htmlContent);

            // Mark welcome email as sent
            txn.setWelcomeEmailSent(true);
            paymentTransactionRepository.save(txn);

            logger.info("Welcome + assessment email sent to: {}", email);
        } catch (Exception e) {
            logger.error("Failed to send welcome email to: {}", email, e);
        }
    }
}
```

- [ ] **Step 2: Add webhook endpoint to SecurityConfig public paths**

In `spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java`, find the line with `.antMatchers("/assessment-mapping/public/**"` (around line 151) and add the payment webhook endpoints:

The existing line looks like:
```java
.antMatchers("/assessment-mapping/public/**", "/assessments/prefetch/**", "/leads/capture",
```

Change it to include payment webhook paths:
```java
.antMatchers("/assessment-mapping/public/**", "/assessments/prefetch/**", "/leads/capture", "/payment/webhook/**",
```

- [ ] **Step 3: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/controller/career9/PaymentWebhookController.java spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java
git commit -m "feat: add PaymentWebhookController for Razorpay callbacks with student creation flow"
```

---

## Task 7: Create Frontend Payment API Functions

**Files:**
- Create: `react-social/src/app/pages/PaymentTracking/API/Payment_APIs.ts`

- [ ] **Step 1: Create the API directory and file**

```bash
mkdir -p /home/kccsw/Projects/career-nine-sandbox/react-social/src/app/pages/PaymentTracking/API
mkdir -p /home/kccsw/Projects/career-nine-sandbox/react-social/src/app/pages/PaymentTracking/components
```

- [ ] **Step 2: Create Payment_APIs.ts**

```typescript
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

// Generate a Razorpay payment link for an assessment mapping
export function generatePaymentLink(mappingId: number, amount: number) {
  return axios.post(`${API_URL}/payment/generate-link`, {
    mappingId,
    amount,
  });
}

// Get all transactions (optionally filtered)
export function getPaymentTransactions(params?: {
  status?: string;
  instituteCode?: number;
}) {
  return axios.get(`${API_URL}/payment/transactions`, { params });
}

// Get transactions for a specific mapping
export function getPaymentTransactionsByMapping(mappingId: number) {
  return axios.get(`${API_URL}/payment/transactions/by-mapping/${mappingId}`);
}

// Send nudge email for failed/pending payment
export function sendNudgeEmail(transactionId: number) {
  return axios.post(`${API_URL}/payment/${transactionId}/send-nudge`);
}

// Resend welcome email for successful payment
export function resendWelcomeEmail(transactionId: number) {
  return axios.post(`${API_URL}/payment/${transactionId}/resend-welcome`);
}
```

- [ ] **Step 3: Commit**

```bash
git add react-social/src/app/pages/PaymentTracking/
git commit -m "feat: add frontend Payment_APIs.ts for Razorpay integration"
```

---

## Task 8: Create PaymentLinkModal Component

**Files:**
- Create: `react-social/src/app/pages/College/components/PaymentLinkModal.tsx`

- [ ] **Step 1: Create the PaymentLinkModal**

This modal opens from the assessment mapping table. The admin enters an amount, generates a Razorpay payment link, and can copy the link or show a QR code.

```tsx
import { useState } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { MdContentCopy, MdQrCode, MdPayment } from "react-icons/md";
import { QRCodeCanvas } from "qrcode.react";
import { generatePaymentLink } from "../../PaymentTracking/API/Payment_APIs";

interface PaymentLinkModalProps {
  show: boolean;
  onHide: () => void;
  mappingId: number;
  assessmentName: string;
}

interface GeneratedLink {
  transactionId: number;
  paymentLinkUrl: string;
  shortUrl: string;
  amount: number;
}

const PaymentLinkModal = ({
  show,
  onHide,
  mappingId,
  assessmentName,
}: PaymentLinkModalProps) => {
  const [amount, setAmount] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<GeneratedLink[]>([]);
  const [copySuccess, setCopySuccess] = useState<string>("");
  const [showQrFor, setShowQrFor] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const handleGenerate = async () => {
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const res = await generatePaymentLink(mappingId, amountNum);
      const link: GeneratedLink = {
        transactionId: res.data.transactionId,
        paymentLinkUrl: res.data.paymentLinkUrl,
        shortUrl: res.data.shortUrl,
        amount: amountNum,
      };
      setGeneratedLinks((prev) => [link, ...prev]);
      setAmount("");
    } catch (err: any) {
      setError(
        err.response?.data || err.message || "Failed to generate payment link"
      );
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopySuccess(url);
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleClose = () => {
    setGeneratedLinks([]);
    setAmount("");
    setError("");
    setShowQrFor(null);
    onHide();
  };

  return (
    <>
      <Modal show={show} onHide={handleClose} size="lg" centered>
        <Modal.Header
          closeButton
          style={{
            background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
            borderBottom: "none",
            padding: "24px 32px",
          }}
        >
          <div>
            <Modal.Title
              style={{ color: "#fff", fontWeight: 700, fontSize: "1.15rem" }}
            >
              <MdPayment
                size={20}
                style={{ marginRight: 10, verticalAlign: "middle" }}
              />
              Generate Payment Link
            </Modal.Title>
            <div
              style={{ color: "#c7d2fe", fontSize: "0.85rem", marginTop: 4 }}
            >
              {assessmentName}
            </div>
          </div>
        </Modal.Header>

        <Modal.Body style={{ padding: "28px 32px", background: "#f8fafc" }}>
          {/* Amount Input */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "24px",
              border: "1px solid #e2e8f0",
              marginBottom: 24,
            }}
          >
            <Form.Label
              style={{
                fontWeight: 600,
                fontSize: "0.85rem",
                color: "#475569",
                marginBottom: 8,
              }}
            >
              Amount (INR)
            </Form.Label>
            <div style={{ display: "flex", gap: 12 }}>
              <Form.Control
                type="number"
                placeholder="Enter amount in rupees"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #e2e8f0",
                  fontSize: "0.95rem",
                }}
                min="1"
              />
              <Button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  background: generating
                    ? "#94a3b8"
                    : "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 24px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  whiteSpace: "nowrap",
                  boxShadow: generating
                    ? "none"
                    : "0 4px 14px rgba(67, 97, 238, 0.3)",
                }}
              >
                {generating ? (
                  <>
                    <Spinner
                      animation="border"
                      size="sm"
                      style={{ marginRight: 8 }}
                    />
                    Generating...
                  </>
                ) : (
                  "Generate Link"
                )}
              </Button>
            </div>
            {error && (
              <div
                style={{
                  color: "#ef4444",
                  fontSize: "0.82rem",
                  marginTop: 8,
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Generated Links */}
          {generatedLinks.length > 0 && (
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: "24px",
                border: "1px solid #e2e8f0",
              }}
            >
              <h6
                style={{
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "#1e293b",
                  marginBottom: 16,
                }}
              >
                Generated Links ({generatedLinks.length})
              </h6>

              {generatedLinks.map((link, idx) => (
                <div
                  key={link.transactionId}
                  style={{
                    background: idx % 2 === 0 ? "#f8fafc" : "#fff",
                    borderRadius: 10,
                    padding: "16px",
                    border: "1px solid #e2e8f0",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "1.1rem",
                        color: "#059669",
                      }}
                    >
                      INR {link.amount}
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => copyLink(link.shortUrl)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 14px",
                          borderRadius: 8,
                          border:
                            copySuccess === link.shortUrl
                              ? "1.5px solid #059669"
                              : "1.5px solid #e2e8f0",
                          background:
                            copySuccess === link.shortUrl ? "#dcfce7" : "#fff",
                          color:
                            copySuccess === link.shortUrl
                              ? "#059669"
                              : "#475569",
                          fontWeight: 600,
                          fontSize: "0.78rem",
                          cursor: "pointer",
                        }}
                      >
                        <MdContentCopy size={14} />
                        {copySuccess === link.shortUrl ? "Copied!" : "Copy Link"}
                      </button>
                      <button
                        onClick={() =>
                          setShowQrFor(
                            showQrFor === link.shortUrl ? null : link.shortUrl
                          )
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1.5px solid #e2e8f0",
                          background:
                            showQrFor === link.shortUrl ? "#eef2ff" : "#fff",
                          color: "#475569",
                          cursor: "pointer",
                        }}
                      >
                        <MdQrCode size={14} />
                        QR
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "#94a3b8",
                      wordBreak: "break-all",
                    }}
                  >
                    {link.shortUrl}
                  </div>

                  {showQrFor === link.shortUrl && (
                    <div
                      style={{
                        textAlign: "center",
                        marginTop: 16,
                        padding: 16,
                        background: "#fff",
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <QRCodeCanvas
                        value={link.shortUrl}
                        size={200}
                        level="H"
                        includeMargin
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal.Body>

        <Modal.Footer
          style={{
            padding: "16px 32px",
            borderTop: "1px solid #e2e8f0",
            background: "#fff",
          }}
        >
          <Button
            variant="secondary"
            onClick={handleClose}
            style={{
              borderRadius: 10,
              padding: "8px 24px",
              fontWeight: 600,
              background: "#f1f5f9",
              border: "1.5px solid #e2e8f0",
              color: "#475569",
            }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default PaymentLinkModal;
```

- [ ] **Step 2: Commit**

```bash
git add react-social/src/app/pages/College/components/PaymentLinkModal.tsx
git commit -m "feat: add PaymentLinkModal for generating Razorpay links with QR codes"
```

---

## Task 9: Add Payment Link Column to AssessmentMappingModal

**Files:**
- Modify: `react-social/src/app/pages/College/components/AssessmentMappingModal.tsx`

- [ ] **Step 1: Add import and state for PaymentLinkModal**

At the top of the file (after line 4), add:

```tsx
import PaymentLinkModal from "./PaymentLinkModal";
```

After the existing state declarations (after line 36, `const [qrVisibleToken, setQrVisibleToken] = useState<string | null>(null);`), add:

```tsx
const [paymentModalMapping, setPaymentModalMapping] = useState<any | null>(null);
```

- [ ] **Step 2: Add "Payment" column header to the table**

Find the array of column headers (line 432):
```tsx
{["Assessment", "Level", "Details", "Status", "Actions"].map((h) => (
```

Change it to:
```tsx
{["Assessment", "Level", "Details", "Status", "Payment", "Actions"].map((h) => (
```

- [ ] **Step 3: Add Payment Link cell to each table row**

After the Status `<td>` closing tag (after line 484, the `</td>` that closes the status cell), add a new `<td>` before the Actions `<td>`:

```tsx
                          <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                            <button
                              onClick={() => setPaymentModalMapping(mapping)}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                padding: "6px 14px", borderRadius: 8,
                                border: "1.5px solid #e0e7ff",
                                background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                                color: "#4338ca", fontWeight: 600, fontSize: "0.78rem",
                                cursor: "pointer", transition: "all 0.15s",
                              }}
                            >
                              <MdPayment size={14} />
                              Generate Link
                            </button>
                          </td>
```

- [ ] **Step 4: Add MdPayment import**

At line 3, change:
```tsx
import { MdContentCopy, MdDelete, MdQrCode, MdDownload } from "react-icons/md";
```
to:
```tsx
import { MdContentCopy, MdDelete, MdQrCode, MdDownload, MdPayment } from "react-icons/md";
```

- [ ] **Step 5: Add PaymentLinkModal render**

Just before the closing `</Modal>` of the QR Code Modal (before line 631), add:

```tsx
      {/* Payment Link Modal */}
      {paymentModalMapping && (
        <PaymentLinkModal
          show={!!paymentModalMapping}
          onHide={() => setPaymentModalMapping(null)}
          mappingId={paymentModalMapping.mappingId}
          assessmentName={getAssessmentName(paymentModalMapping.assessmentId)}
        />
      )}
```

- [ ] **Step 6: Commit**

```bash
git add react-social/src/app/pages/College/components/AssessmentMappingModal.tsx
git commit -m "feat: add Payment Link column and PaymentLinkModal to AssessmentMappingModal"
```

---

## Task 10: Create PaymentTrackingPage with 3 Tabs

**Files:**
- Create: `react-social/src/app/pages/PaymentTracking/PaymentTrackingPage.tsx`
- Create: `react-social/src/app/pages/PaymentTracking/components/PaymentTable.tsx`

- [ ] **Step 1: Create PaymentTable component**

```tsx
import { Badge, Button, Spinner } from "react-bootstrap";
import { MdEmail, MdNotifications } from "react-icons/md";

export interface PaymentRow {
  transactionId: number;
  razorpayPaymentId: string | null;
  razorpayLinkId: string | null;
  mappingId: number;
  assessmentId: number;
  instituteCode: number;
  amount: number;
  currency: string;
  status: string;
  paymentLinkUrl: string | null;
  shortUrl: string | null;
  studentName: string | null;
  studentEmail: string | null;
  studentPhone: string | null;
  studentDob: string | null;
  userStudentId: number | null;
  failureReason: string | null;
  welcomeEmailSent: boolean;
  nudgeEmailSent: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaymentTableProps {
  transactions: PaymentRow[];
  loading: boolean;
  statusFilter: string;
  onSendNudge: (transactionId: number) => void;
  onResendWelcome: (transactionId: number) => void;
  actionLoading: number | null;
}

const statusColors: Record<string, { bg: string; color: string }> = {
  paid: { bg: "#dcfce7", color: "#059669" },
  created: { bg: "#fef3c7", color: "#d97706" },
  failed: { bg: "#fee2e2", color: "#ef4444" },
  expired: { bg: "#f1f5f9", color: "#64748b" },
  cancelled: { bg: "#fce7f3", color: "#db2777" },
};

const PaymentTable = ({
  transactions,
  loading,
  statusFilter,
  onSendNudge,
  onResendWelcome,
  actionLoading,
}: PaymentTableProps) => {
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 0",
          color: "#64748b",
        }}
      >
        <Spinner animation="border" size="sm" style={{ marginRight: 12 }} />
        Loading transactions...
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div
        style={{
          padding: "48px 24px",
          textAlign: "center",
          border: "2px dashed #e2e8f0",
          borderRadius: 12,
          color: "#94a3b8",
        }}
      >
        No {statusFilter} transactions found.
      </div>
    );
  }

  return (
    <div
      style={{
        maxHeight: 600,
        overflowY: "auto",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {[
              "ID",
              "Student",
              "Email",
              "Phone",
              "DOB",
              "Amount",
              "Status",
              "Razorpay ID",
              "Date",
              "Actions",
            ].map((h) => (
              <th
                key={h}
                style={{
                  padding: "12px 14px",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  borderBottom: "2px solid #e2e8f0",
                  whiteSpace: "nowrap",
                  position: "sticky",
                  top: 0,
                  background: "#f8fafc",
                  zIndex: 1,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn, idx) => {
            const sc = statusColors[txn.status] || statusColors.created;
            return (
              <tr
                key={txn.transactionId}
                style={{
                  background: idx % 2 === 0 ? "#fff" : "#fafbfc",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#f0f4ff")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background =
                    idx % 2 === 0 ? "#fff" : "#fafbfc")
                }
              >
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #f1f5f9",
                    fontSize: "0.82rem",
                    color: "#64748b",
                  }}
                >
                  #{txn.transactionId}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #f1f5f9",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    color: "#1e293b",
                  }}
                >
                  {txn.studentName || "-"}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #f1f5f9",
                    fontSize: "0.82rem",
                    color: "#475569",
                  }}
                >
                  {txn.studentEmail || "-"}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #f1f5f9",
                    fontSize: "0.82rem",
                    color: "#475569",
                  }}
                >
                  {txn.studentPhone || "-"}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #f1f5f9",
                    fontSize: "0.82rem",
                    color: "#475569",
                  }}
                >
                  {txn.studentDob || "-"}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #f1f5f9",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    color: "#1e293b",
                  }}
                >
                  INR {txn.amount / 100}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <span
                    style={{
                      background: sc.bg,
                      color: sc.color,
                      padding: "4px 12px",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: "0.75rem",
                    }}
                  >
                    {txn.status.toUpperCase()}
                  </span>
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #f1f5f9",
                    fontSize: "0.75rem",
                    color: "#94a3b8",
                    fontFamily: "monospace",
                  }}
                >
                  {txn.razorpayPaymentId || txn.razorpayLinkId || "-"}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #f1f5f9",
                    fontSize: "0.78rem",
                    color: "#64748b",
                    whiteSpace: "nowrap",
                  }}
                >
                  {txn.createdAt}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div style={{ display: "flex", gap: 6 }}>
                    {/* Nudge button for failed/created/expired */}
                    {["failed", "created", "expired", "cancelled"].includes(
                      txn.status
                    ) &&
                      txn.studentEmail && (
                        <Button
                          size="sm"
                          onClick={() => onSendNudge(txn.transactionId)}
                          disabled={actionLoading === txn.transactionId}
                          style={{
                            background: "#fef3c7",
                            border: "1px solid #fcd34d",
                            color: "#92400e",
                            fontWeight: 600,
                            fontSize: "0.72rem",
                            borderRadius: 6,
                            padding: "4px 10px",
                          }}
                        >
                          {actionLoading === txn.transactionId ? (
                            <Spinner animation="border" size="sm" />
                          ) : (
                            <>
                              <MdNotifications
                                size={12}
                                style={{ marginRight: 4 }}
                              />
                              Nudge
                            </>
                          )}
                        </Button>
                      )}

                    {/* Resend welcome for paid */}
                    {txn.status === "paid" && txn.studentEmail && (
                      <Button
                        size="sm"
                        onClick={() => onResendWelcome(txn.transactionId)}
                        disabled={actionLoading === txn.transactionId}
                        style={{
                          background: "#dcfce7",
                          border: "1px solid #86efac",
                          color: "#166534",
                          fontWeight: 600,
                          fontSize: "0.72rem",
                          borderRadius: 6,
                          padding: "4px 10px",
                        }}
                      >
                        {actionLoading === txn.transactionId ? (
                          <Spinner animation="border" size="sm" />
                        ) : (
                          <>
                            <MdEmail size={12} style={{ marginRight: 4 }} />
                            Resend Welcome
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PaymentTable;
```

- [ ] **Step 2: Create PaymentTrackingPage**

```tsx
import { useEffect, useState, useCallback } from "react";
import { Tab, Tabs, Badge } from "react-bootstrap";
import PaymentTable, { PaymentRow } from "./components/PaymentTable";
import {
  getPaymentTransactions,
  sendNudgeEmail,
  resendWelcomeEmail,
} from "./API/Payment_APIs";
import { showErrorToast } from "../../utils/toast";

const PaymentTrackingPage = () => {
  const [activeTab, setActiveTab] = useState<string>("paid");
  const [transactions, setTransactions] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadTransactions = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const res = await getPaymentTransactions(
        status ? { status } : undefined
      );
      setTransactions(res.data || []);
    } catch (error) {
      console.error("Failed to load transactions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "all") {
      loadTransactions();
    } else {
      loadTransactions(activeTab);
    }
  }, [activeTab, loadTransactions]);

  const handleSendNudge = async (transactionId: number) => {
    setActionLoading(transactionId);
    try {
      await sendNudgeEmail(transactionId);
      // Refresh
      if (activeTab === "all") {
        loadTransactions();
      } else {
        loadTransactions(activeTab);
      }
    } catch (err: any) {
      showErrorToast(err.response?.data || "Failed to send nudge");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendWelcome = async (transactionId: number) => {
    setActionLoading(transactionId);
    try {
      await resendWelcomeEmail(transactionId);
      if (activeTab === "all") {
        loadTransactions();
      } else {
        loadTransactions(activeTab);
      }
    } catch (err: any) {
      showErrorToast(err.response?.data || "Failed to resend welcome email");
    } finally {
      setActionLoading(null);
    }
  };

  const getTabCount = (status: string) => {
    if (activeTab === "all") {
      return transactions.filter((t) => t.status === status).length;
    }
    return activeTab === status ? transactions.length : 0;
  };

  return (
    <div style={{ padding: "0 24px" }}>
      <div style={{ marginBottom: 28 }}>
        <h2
          style={{
            fontWeight: 800,
            fontSize: "1.5rem",
            color: "#1e293b",
            margin: 0,
          }}
        >
          Payment Tracking
        </h2>
        <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: 4 }}>
          Track all Razorpay payment transactions for assessments
        </p>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "24px 28px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <Tabs
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k || "paid")}
          className="mb-4"
        >
          <Tab
            eventKey="paid"
            title={
              <span>
                Successful{" "}
                <Badge
                  bg=""
                  style={{
                    background: "#dcfce7",
                    color: "#059669",
                    fontSize: "0.7rem",
                  }}
                >
                  {getTabCount("paid")}
                </Badge>
              </span>
            }
          />
          <Tab
            eventKey="created"
            title={
              <span>
                Pending{" "}
                <Badge
                  bg=""
                  style={{
                    background: "#fef3c7",
                    color: "#d97706",
                    fontSize: "0.7rem",
                  }}
                >
                  {getTabCount("created")}
                </Badge>
              </span>
            }
          />
          <Tab
            eventKey="failed"
            title={
              <span>
                Failed{" "}
                <Badge
                  bg=""
                  style={{
                    background: "#fee2e2",
                    color: "#ef4444",
                    fontSize: "0.7rem",
                  }}
                >
                  {getTabCount("failed")}
                </Badge>
              </span>
            }
          />
          <Tab
            eventKey="all"
            title={<span>All Transactions</span>}
          />
        </Tabs>

        <PaymentTable
          transactions={transactions}
          loading={loading}
          statusFilter={activeTab}
          onSendNudge={handleSendNudge}
          onResendWelcome={handleResendWelcome}
          actionLoading={actionLoading}
        />
      </div>
    </div>
  );
};

export default PaymentTrackingPage;
```

- [ ] **Step 3: Commit**

```bash
git add react-social/src/app/pages/PaymentTracking/
git commit -m "feat: add PaymentTrackingPage with Success/Pending/Failed tabs and PaymentTable"
```

---

## Task 11: Add Routing and Menu Item for Payment Tracking

**Files:**
- Modify: `react-social/src/app/routing/PrivateRoutes.tsx`
- Modify: `react-social/src/_metronic/layout/components/aside/AsideMenuMain.tsx`

- [ ] **Step 1: Add lazy import in PrivateRoutes.tsx**

Find the existing lazy imports at the top of `PrivateRoutes.tsx` and add:

```tsx
const PaymentTrackingPage = lazy(() => import("../pages/PaymentTracking/PaymentTrackingPage"));
```

- [ ] **Step 2: Add route definition**

Find a suitable spot in the `<Routes>` block (near the assessment routes) and add:

```tsx
            <Route
              path="/payment-tracking"
              element={
                <SuspensedView>
                  <PaymentTrackingPage />
                </SuspensedView>
              }
            />
```

- [ ] **Step 3: Add menu item in AsideMenuMain.tsx**

Find the assessment management section (around line 212-338) and add a new menu item after the existing assessment items. Look for a suitable `AsideMenuItemWithSub` section or add a standalone item:

```tsx
              {allowed("/payment-tracking") && (
                <AsideMenuItem
                  to="/payment-tracking"
                  icon="/media/icons/duotune/finance/fin002.svg"
                  title="Payment Tracking"
                  fontIcon="bi-credit-card"
                />
              )}
```

- [ ] **Step 4: Commit**

```bash
git add react-social/src/app/routing/PrivateRoutes.tsx react-social/src/_metronic/layout/components/aside/AsideMenuMain.tsx
git commit -m "feat: add payment tracking route and sidebar menu item"
```

---

## Task 12: Create Payment Status Callback Pages (Frontend)

**Files:**
- Create: `react-social/src/app/pages/PaymentTracking/PaymentStatusPage.tsx`
- Modify: `react-social/src/app/routing/PrivateRoutes.tsx` (or public routes if needed)

These are the 3 screens (success, pending, failed) that the student sees after Razorpay redirects them back.

- [ ] **Step 1: Create PaymentStatusPage**

```tsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

type PaymentStatus = "paid" | "created" | "failed" | "expired" | "cancelled" | "loading" | "error";

const statusConfig: Record<string, {
  title: string;
  subtitle: string;
  icon: string;
  gradient: string;
  textColor: string;
}> = {
  paid: {
    title: "Payment Successful!",
    subtitle: "Your assessment has been allotted. Check your email for login credentials.",
    icon: "\u2705",
    gradient: "linear-gradient(135deg, #059669 0%, #047857 100%)",
    textColor: "#059669",
  },
  created: {
    title: "Payment Pending",
    subtitle: "Your payment is being processed. Please wait or try again.",
    icon: "\u23F3",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    textColor: "#d97706",
  },
  failed: {
    title: "Payment Failed",
    subtitle: "Something went wrong with your payment. Please try again.",
    icon: "\u274C",
    gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    textColor: "#ef4444",
  },
  expired: {
    title: "Payment Link Expired",
    subtitle: "This payment link has expired. Please contact the administrator for a new link.",
    icon: "\u23F0",
    gradient: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
    textColor: "#64748b",
  },
  cancelled: {
    title: "Payment Cancelled",
    subtitle: "Your payment was cancelled. Please try again if you wish to proceed.",
    icon: "\u{1F6AB}",
    gradient: "linear-gradient(135deg, #db2777 0%, #be185d 100%)",
    textColor: "#db2777",
  },
};

const PaymentStatusPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus>("loading");
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    const linkId = searchParams.get("razorpay_payment_link_id");
    const linkStatus = searchParams.get("razorpay_payment_link_status");

    if (linkStatus) {
      setStatus(linkStatus as PaymentStatus);
    }

    // Fetch details from callback endpoint
    if (linkId) {
      const params = new URLSearchParams();
      searchParams.forEach((value, key) => params.append(key, value));

      axios
        .get(`${API_URL}/payment/webhook/callback?${params.toString()}`)
        .then((res) => {
          setDetails(res.data);
          if (res.data.status) {
            setStatus(res.data.status as PaymentStatus);
          }
        })
        .catch(() => {
          if (!linkStatus) setStatus("error");
        });
    } else if (!linkStatus) {
      setStatus("error");
    }
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "80vh",
        }}
      >
        <Spinner animation="border" />
        <p style={{ marginTop: 16, color: "#64748b" }}>
          Verifying payment status...
        </p>
      </div>
    );
  }

  const config = statusConfig[status] || statusConfig.failed;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "80vh",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 500,
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            background: config.gradient,
            borderRadius: "16px 16px 0 0",
            padding: "40px 24px",
            color: "#fff",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>{config.icon}</div>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: "1.5rem" }}>
            {config.title}
          </h2>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: "0 0 16px 16px",
            padding: "32px 24px",
            border: "1px solid #e2e8f0",
            borderTop: "none",
          }}
        >
          <p style={{ color: "#64748b", fontSize: "0.95rem", marginBottom: 24 }}>
            {config.subtitle}
          </p>

          {details && details.amount && (
            <div
              style={{
                background: "#f8fafc",
                padding: "16px",
                borderRadius: 10,
                marginBottom: 16,
              }}
            >
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                Amount: <strong style={{ color: "#1e293b" }}>INR {details.amount}</strong>
              </p>
            </div>
          )}

          {status === "failed" && (
            <p style={{ color: "#94a3b8", fontSize: "0.82rem" }}>
              If the amount was deducted, it will be refunded within 5-7 business days.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentStatusPage;
```

- [ ] **Step 2: Add the route (public, since students access this after payment)**

In `PrivateRoutes.tsx`, add the lazy import:

```tsx
const PaymentStatusPage = lazy(() => import("../pages/PaymentTracking/PaymentStatusPage"));
```

Add the route:

```tsx
            <Route
              path="/payment-status"
              element={
                <SuspensedView>
                  <PaymentStatusPage />
                </SuspensedView>
              }
            />
```

- [ ] **Step 3: Commit**

```bash
git add react-social/src/app/pages/PaymentTracking/PaymentStatusPage.tsx react-social/src/app/routing/PrivateRoutes.tsx
git commit -m "feat: add PaymentStatusPage with success/pending/failed/expired views"
```

---

## Task 13: Add Callback Base URL Config + @EnableAsync

**Files:**
- Modify: `spring-social/src/main/resources/application.yml`
- Verify: `@EnableAsync` is present on main application class

- [ ] **Step 1: Add callback-base-url under razorpay config for each profile**

In `application.yml`, under the `app.razorpay` section for each profile, add:

For dev:
```yaml
      callback-base-url: http://localhost:3000
```

For staging:
```yaml
      callback-base-url: https://staging.career-9.net
```

For production:
```yaml
      callback-base-url: https://app.career-9.net
```

- [ ] **Step 2: Verify @EnableAsync annotation**

Check if the main Spring Boot application class (`SpringSocialApplication.java` or similar) has `@EnableAsync`. If not, add it:

```java
@EnableAsync
@SpringBootApplication
public class SpringSocialApplication {
    // ...
}
```

- [ ] **Step 3: Commit**

```bash
git add spring-social/src/main/resources/application.yml spring-social/src/main/java/com/kccitm/api/SpringSocialApplication.java
git commit -m "feat: add Razorpay callback URLs and ensure @EnableAsync for payment emails"
```

---

## Task 14: Payment Link Send via Email/WhatsApp with Notification Logging

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/model/career9/PaymentNotificationLog.java`
- Create: `spring-social/src/main/java/com/kccitm/api/repository/Career9/PaymentNotificationLogRepository.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/PaymentController.java`
- Modify: `react-social/src/app/pages/PaymentTracking/API/Payment_APIs.ts`
- Modify: `react-social/src/app/pages/College/components/PaymentLinkModal.tsx`

- [ ] **Step 1: Create PaymentNotificationLog entity**

```java
package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "payment_notification_log")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class PaymentNotificationLog implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "log_id")
    private Long logId;

    // Which transaction this notification is for
    @Column(name = "transaction_id", nullable = false)
    private Long transactionId;

    // "email" or "whatsapp"
    @Column(name = "channel", nullable = false, length = 20)
    private String channel;

    // Recipient (email address or phone number)
    @Column(name = "recipient", nullable = false, length = 200)
    private String recipient;

    // "sent", "failed", "delivered"
    @Column(name = "status", length = 20, columnDefinition = "varchar(20) default 'sent'")
    private String status = "sent";

    // The payment link URL that was sent
    @Column(name = "payment_link_url", length = 500)
    private String paymentLinkUrl;

    // Amount for reference
    @Column(name = "amount")
    private Long amount;

    // Error message if failed
    @Column(name = "error_message", length = 500)
    private String errorMessage;

    // Who initiated the send (admin username)
    @Column(name = "sent_by", length = 100)
    private String sentBy;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) this.createdAt = new Date();
        if (this.status == null) this.status = "sent";
    }

    // ── Getters and Setters ──

    public Long getLogId() { return logId; }
    public void setLogId(Long logId) { this.logId = logId; }

    public Long getTransactionId() { return transactionId; }
    public void setTransactionId(Long transactionId) { this.transactionId = transactionId; }

    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }

    public String getRecipient() { return recipient; }
    public void setRecipient(String recipient) { this.recipient = recipient; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPaymentLinkUrl() { return paymentLinkUrl; }
    public void setPaymentLinkUrl(String paymentLinkUrl) { this.paymentLinkUrl = paymentLinkUrl; }

    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public String getSentBy() { return sentBy; }
    public void setSentBy(String sentBy) { this.sentBy = sentBy; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
}
```

- [ ] **Step 2: Create PaymentNotificationLogRepository**

```java
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
```

- [ ] **Step 3: Add send-via-email and send-via-whatsapp endpoints to PaymentController**

Add these imports to `PaymentController.java`:

```java
import com.kccitm.api.model.career9.PaymentNotificationLog;
import com.kccitm.api.repository.Career9.PaymentNotificationLogRepository;
import com.kccitm.api.security.UserPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
```

Add this autowired field:

```java
@Autowired
private PaymentNotificationLogRepository notificationLogRepository;
```

Add these endpoints to `PaymentController.java`:

```java
    /**
     * Send payment link to student via email.
     * POST /payment/{transactionId}/send-email
     * Body: { email: "student@example.com", studentName: "John" (optional) }
     */
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

        // Log the notification
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

            // Also update student email on the transaction if not set
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

    /**
     * Generate WhatsApp send URL for payment link.
     * POST /payment/{transactionId}/send-whatsapp
     * Body: { phone: "919876543210", studentName: "John" (optional) }
     *
     * Returns the wa.me URL for the admin to open. Also logs the send.
     */
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

        // Clean phone number — ensure it starts with country code, no spaces/dashes
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        if (cleanPhone.length() == 10) {
            cleanPhone = "91" + cleanPhone; // Default to India
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

        // Log the notification
        PaymentNotificationLog log = new PaymentNotificationLog();
        log.setTransactionId(transactionId);
        log.setChannel("whatsapp");
        log.setRecipient(cleanPhone);
        log.setPaymentLinkUrl(txn.getShortUrl());
        log.setAmount(txn.getAmount());
        log.setSentBy(currentUser != null ? currentUser.getName() : "admin");
        log.setStatus("sent");
        notificationLogRepository.save(log);

        // Update student phone on the transaction if not set
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

    /**
     * Get notification logs for a transaction.
     * GET /payment/{transactionId}/notifications
     */
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
```

- [ ] **Step 4: Add frontend API functions for send-email and send-whatsapp**

Add to `react-social/src/app/pages/PaymentTracking/API/Payment_APIs.ts`:

```typescript
// Send payment link via email
export function sendPaymentLinkEmail(
  transactionId: number,
  email: string,
  studentName?: string
) {
  return axios.post(`${API_URL}/payment/${transactionId}/send-email`, {
    email,
    studentName: studentName || "Student",
  });
}

// Generate WhatsApp send URL for payment link
export function sendPaymentLinkWhatsApp(
  transactionId: number,
  phone: string,
  studentName?: string
) {
  return axios.post(`${API_URL}/payment/${transactionId}/send-whatsapp`, {
    phone,
    studentName: studentName || "Student",
  });
}

// Get notification logs for a transaction
export function getNotificationLogs(transactionId: number) {
  return axios.get(`${API_URL}/payment/${transactionId}/notifications`);
}
```

- [ ] **Step 5: Update PaymentLinkModal to include Send Email / WhatsApp buttons**

In `react-social/src/app/pages/College/components/PaymentLinkModal.tsx`, add these imports at the top:

```tsx
import { MdEmail, MdWhatsapp } from "react-icons/md";
import {
  sendPaymentLinkEmail,
  sendPaymentLinkWhatsApp,
} from "../../PaymentTracking/API/Payment_APIs";
```

Add new state after the existing state declarations:

```tsx
const [sendModalLink, setSendModalLink] = useState<GeneratedLink | null>(null);
const [sendEmail, setSendEmail] = useState("");
const [sendPhone, setSendPhone] = useState("");
const [sendName, setSendName] = useState("");
const [sending, setSending] = useState(false);
const [sendSuccess, setSendSuccess] = useState<string>("");
```

Add a send handler function:

```tsx
const handleSendEmail = async (link: GeneratedLink) => {
  if (!sendEmail) return;
  setSending(true);
  try {
    await sendPaymentLinkEmail(link.transactionId, sendEmail, sendName || undefined);
    setSendSuccess("email");
    setTimeout(() => setSendSuccess(""), 3000);
    setSendEmail("");
    setSendName("");
  } catch (err: any) {
    setError(err.response?.data || "Failed to send email");
  } finally {
    setSending(false);
  }
};

const handleSendWhatsApp = async (link: GeneratedLink) => {
  if (!sendPhone) return;
  setSending(true);
  try {
    const res = await sendPaymentLinkWhatsApp(link.transactionId, sendPhone, sendName || undefined);
    // Open WhatsApp URL in new tab
    window.open(res.data.whatsappUrl, "_blank");
    setSendSuccess("whatsapp");
    setTimeout(() => setSendSuccess(""), 3000);
    setSendPhone("");
    setSendName("");
  } catch (err: any) {
    setError(err.response?.data || "Failed to generate WhatsApp link");
  } finally {
    setSending(false);
  }
};
```

For each generated link in the `generatedLinks.map(...)` block, after the QR code section (`{showQrFor === link.shortUrl && ...}`), add a send section:

```tsx
                  {/* Send via Email / WhatsApp */}
                  <div style={{ marginTop: 12, padding: "12px 0", borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: 8 }}>
                      Send to Student
                    </div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <Form.Control
                        type="text"
                        placeholder="Student name"
                        value={sendModalLink?.transactionId === link.transactionId ? sendName : ""}
                        onChange={(e) => { setSendModalLink(link); setSendName(e.target.value); }}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.82rem", flex: 1 }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Form.Control
                        type="email"
                        placeholder="Email address"
                        value={sendModalLink?.transactionId === link.transactionId ? sendEmail : ""}
                        onChange={(e) => { setSendModalLink(link); setSendEmail(e.target.value); }}
                        onKeyDown={(e) => e.key === "Enter" && handleSendEmail(link)}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.82rem", flex: 1 }}
                      />
                      <button
                        onClick={() => handleSendEmail(link)}
                        disabled={sending || !sendEmail}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "6px 12px", borderRadius: 8,
                          border: sendSuccess === "email" ? "1.5px solid #059669" : "1.5px solid #e2e8f0",
                          background: sendSuccess === "email" ? "#dcfce7" : "#fff",
                          color: sendSuccess === "email" ? "#059669" : "#475569",
                          fontWeight: 600, fontSize: "0.75rem", cursor: "pointer",
                        }}
                      >
                        <MdEmail size={14} />
                        {sendSuccess === "email" ? "Sent!" : "Email"}
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <Form.Control
                        type="tel"
                        placeholder="Phone (e.g. 9876543210)"
                        value={sendModalLink?.transactionId === link.transactionId ? sendPhone : ""}
                        onChange={(e) => { setSendModalLink(link); setSendPhone(e.target.value); }}
                        onKeyDown={(e) => e.key === "Enter" && handleSendWhatsApp(link)}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.82rem", flex: 1 }}
                      />
                      <button
                        onClick={() => handleSendWhatsApp(link)}
                        disabled={sending || !sendPhone}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "6px 12px", borderRadius: 8,
                          border: sendSuccess === "whatsapp" ? "1.5px solid #25D366" : "1.5px solid #e2e8f0",
                          background: sendSuccess === "whatsapp" ? "#dcfce7" : "#fff",
                          color: sendSuccess === "whatsapp" ? "#25D366" : "#475569",
                          fontWeight: 600, fontSize: "0.75rem", cursor: "pointer",
                        }}
                      >
                        <MdWhatsapp size={14} />
                        {sendSuccess === "whatsapp" ? "Opened!" : "WhatsApp"}
                      </button>
                    </div>
                  </div>
```

- [ ] **Step 6: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/model/career9/PaymentNotificationLog.java \
        spring-social/src/main/java/com/kccitm/api/repository/Career9/PaymentNotificationLogRepository.java \
        spring-social/src/main/java/com/kccitm/api/controller/career9/PaymentController.java \
        react-social/src/app/pages/PaymentTracking/API/Payment_APIs.ts \
        react-social/src/app/pages/College/components/PaymentLinkModal.tsx
git commit -m "feat: add payment link send via email/WhatsApp with notification logging"
```

---

## Summary of Complete Flow

1. **Admin generates payment link** via Assessment Mapping table → PaymentLinkModal → enters amount → Razorpay link + QR created
2. **Admin sends link to student** via:
   - Copy link / QR code (manual share)
   - **Send via Email** — enters student email + name, sends formatted email with "Pay Now" button (logged)
   - **Send via WhatsApp** — enters phone number, opens wa.me URL with pre-filled message (logged)
3. **Every send is logged** in `payment_notification_log` table with channel, recipient, timestamp, and who sent it
4. **Student pays** via Razorpay hosted page (captures email, phone, name, DOB via Razorpay notes)
5. **Razorpay webhook fires** → `PaymentWebhookController` receives callback
   - **Success**: Creates User → StudentInfo → UserStudent → StudentAssessmentMapping → sends welcome email (async)
   - **Failed**: Records failure reason, student can be nudged
   - **Expired/Cancelled**: Records status
6. **Student redirected** to `/payment-status` page showing success/pending/failed/expired screen
7. **Admin tracks** all transactions at `/payment-tracking` with 3 tabs
   - **Success tab**: Resend welcome email button
   - **Pending tab**: View pending links
   - **Failed tab**: Send nudge email button to retry payment
8. **Admin can view notification logs** per transaction (who sent what, when, via which channel)
