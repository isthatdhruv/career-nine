package com.kccitm.api.controller.career9;

import java.nio.charset.StandardCharsets;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
import com.kccitm.api.model.career9.SchoolAssessmentConfig;
import com.kccitm.api.model.career9.SchoolRegistrationLink;
import com.kccitm.api.model.career9.school.SchoolClasses;
import com.kccitm.api.repository.Career9.SchoolAssessmentConfigRepository;
import com.kccitm.api.repository.Career9.SchoolRegistrationLinkRepository;
import com.kccitm.api.service.b2c.StudentInstituteMembershipService;
import com.kccitm.api.repository.Career9.School.SchoolClassesRepository;
import com.kccitm.api.security.AuthCookieService;
import com.kccitm.api.security.TokenProvider;
import com.kccitm.api.service.CareerNineRollNumberService;
import com.kccitm.api.service.PaymentEmailService;
import com.kccitm.api.service.RazorpayService;
import com.kccitm.api.service.StudentProvisioningService;

import javax.servlet.http.HttpServletResponse;

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
    @Autowired private PaymentEmailService paymentEmailService;
    @Autowired private SchoolClassesRepository schoolClassesRepository;
    @Autowired private SchoolAssessmentConfigRepository schoolAssessmentConfigRepository;
    @Autowired private SchoolRegistrationLinkRepository schoolRegistrationLinkRepository;
    @Autowired private StudentInstituteMembershipService membershipService;
    @Autowired private StudentProvisioningService studentProvisioningService;

    @Autowired(required = false)
    private com.kccitm.api.service.b2c.EntitlementService entitlementService;

    @Autowired
    private com.kccitm.api.service.StudentSessionService studentSessionService;

    @Autowired private AuthCookieService authCookieService;
    @Autowired private TokenProvider tokenProvider;

    @org.springframework.beans.factory.annotation.Value("${app.auth.assessmentTokenExpirationMsec:14400000}")
    private long assessmentTokenExpirationMsec;

    // @PreAuthorize-Exempt: Razorpay HMAC signature auth, not user JWT — anonymous-by-design
    // See ControllerPreAuthorizeCoverageTest.EXCLUSIONS (15-02 / 15-06)
    @PostMapping("/razorpay")
    @Transactional
    public ResponseEntity<?> handleRazorpayWebhook(
            @RequestBody byte[] payloadBytes,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {

        logger.info("Razorpay webhook received");

        // Sign the exact bytes Razorpay sent — reading as @RequestBody String
        // round-trips through StringHttpMessageConverter which can re-encode
        // with the wrong charset and break HMAC equality.
        if (signature == null || !razorpayService.verifyWebhookSignature(payloadBytes, signature)) {
            logger.warn("Invalid or missing Razorpay webhook signature");
            return ResponseEntity.status(401).body("Invalid or missing signature");
        }

        String payload = new String(payloadBytes, StandardCharsets.UTF_8);

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
            // Return 500 so Razorpay retries the webhook on transient failures.
            // Idempotency is enforced by the pessimistic row-lock +
            // status="paid" early-exit in markPaidAndProvision — a retry on a
            // payment we already provisioned is safe and observable in logs.
            logger.error("Error processing Razorpay webhook — returning 500 to request retry", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error_retry_requested"));
        }
    }

    /**
     * Public endpoint: frontend polls this to get real payment status from DB.
     * GET /payment/webhook/status/{razorpayLinkId}
     *
     * Returns the actual DB status (set by webhook), not the query param from Razorpay redirect.
     * Frontend polls until status != "created" (i.e., webhook has arrived and updated it).
     *
     * When called with {@code ?reconcile=1}, and the DB still shows "created"
     * (i.e. webhook hasn't landed yet), we synchronously ask Razorpay for the
     * authoritative state of the payment link and run the same mark-paid +
     * provision pipeline the webhook would have. This is the safety net for
     * the redirect-after-payment hop on environments where the webhook is
     * misconfigured or delayed — the student lands on /payment-status, the
     * page calls this with reconcile=1, and gets a real "paid" answer back
     * within the same request instead of timing out the poll.
     */
    @PreAuthorize("@auth.allows('payment_webhook.read')")
    @GetMapping("/status/{razorpayLinkId}")
    public ResponseEntity<?> getPaymentStatus(@PathVariable String razorpayLinkId,
                                              @RequestParam(value = "reconcile", required = false) String reconcile,
                                              HttpServletResponse httpResponse) {
        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository
                .findByRazorpayLinkId(razorpayLinkId);

        if (!txnOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        PaymentTransaction txn = txnOpt.get();

        // Reconcile against Razorpay if the caller asked and the DB still
        // hasn't been flipped by the webhook. Cheap to skip when txn is
        // already in a terminal state so we don't hammer Razorpay on every
        // poll.
        if ("1".equals(reconcile) && "created".equals(txn.getStatus())) {
            try {
                org.json.JSONObject link = razorpayService.fetchPaymentLink(razorpayLinkId);
                String razorpayStatus = link.optString("status", null);
                if ("paid".equals(razorpayStatus)) {
                    org.json.JSONObject paymentEntity = pickPaidPaymentFromLink(link);
                    markPaidAndProvision(txn, paymentEntity, link.optJSONObject("notes"));
                    txn = paymentTransactionRepository.findById(txn.getTransactionId()).orElse(txn);
                } else if ("expired".equals(razorpayStatus) || "cancelled".equals(razorpayStatus)) {
                    txn.setStatus(razorpayStatus);
                    paymentTransactionRepository.save(txn);
                }
            } catch (Exception e) {
                // Reconciliation is best-effort; on Razorpay errors we fall
                // through and return the DB state so the frontend keeps
                // polling (webhook may still land).
                logger.warn("Reconcile against Razorpay failed for link {}: {}", razorpayLinkId, e.getMessage());
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("status", txn.getStatus());
        response.put("amount", txn.getAmount());
        response.put("transactionId", txn.getTransactionId());
        response.put("assessmentId", txn.getAssessmentId());

        String assessmentName = assessmentTableRepository.findById(txn.getAssessmentId())
                .map(a -> a.getAssessmentName()).orElse("Assessment");
        response.put("assessmentName", assessmentName);

        if ("failed".equals(txn.getStatus()) && txn.getFailureReason() != null) {
            response.put("failureReason", txn.getFailureReason());
        }

        // Include the session payload whenever the txn already knows which
        // student it belongs to. For Path B upgrade txns, userStudentId is
        // stamped on the row before the Razorpay redirect, so this lets the
        // /payment-status page build a self-contained redirect URL
        // ("/studentAssessment/completed?e=…&userStudentId=…&assessmentId=…")
        // from the very first poll — without waiting for the webhook to flip
        // status to "paid". The auto-login branch on the frontend still gates
        // on status==="paid", so this widening is safe.
        if (txn.getUserStudentId() != null) {
            response.putAll(studentSessionService.buildSessionPayload(txn.getUserStudentId()));

            // Mint and write the cn_at_asmnt cookie ONLY once the txn is in a
            // terminal "paid" state. Until then the caller might still be
            // polling on a created txn (and we don't want to issue a session
            // cookie for an unconfirmed payment). The assessment SPA reads the
            // response body to decide when to navigate; the cookie attaches in
            // the same response so /allotted-assessment can authenticate on
            // its very first request.
            if ("paid".equals(txn.getStatus()) && txn.getAssessmentId() != null) {
                String sessionJwt = tokenProvider.createAssessmentSessionToken(
                        txn.getUserStudentId(), txn.getAssessmentId());
                authCookieService.issueAssessmentSessionCookie(httpResponse, sessionJwt,
                        (int) (assessmentTokenExpirationMsec / 1000));
            }
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Picks the first captured/authorized payment from a payment-link entity.
     * Mirrors the helper used by the admin Tracker's check-status flow.
     */
    private org.json.JSONObject pickPaidPaymentFromLink(org.json.JSONObject link) {
        org.json.JSONArray payments = link.optJSONArray("payments");
        if (payments == null) return null;
        for (int i = 0; i < payments.length(); i++) {
            org.json.JSONObject p = payments.optJSONObject(i);
            if (p == null) continue;
            String s = p.optString("status", "");
            if ("captured".equals(s) || "authorized".equals(s)) return p;
        }
        return payments.length() > 0 ? payments.optJSONObject(0) : null;
    }

    /**
     * Public endpoint: get transaction info for registration form.
     * GET /payment/webhook/info/{transactionId}
     */
    @PreAuthorize("@auth.allows('payment_webhook.read')")
    @GetMapping("/info/{transactionId}")
    public ResponseEntity<?> getTransactionInfo(@PathVariable Long transactionId) {
        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findById(transactionId);
        if (!txnOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        PaymentTransaction txn = txnOpt.get();
        Map<String, Object> response = new HashMap<>();
        response.put("transactionId", txn.getTransactionId());
        response.put("amount", txn.getAmount());
        response.put("status", txn.getStatus());
        response.put("shortUrl", txn.getShortUrl());

        String assessmentName = assessmentTableRepository.findById(txn.getAssessmentId())
                .map(a -> a.getAssessmentName()).orElse("Assessment");
        response.put("assessmentName", assessmentName);

        // Get institute name
        if (txn.getInstituteCode() != null) {
            InstituteDetail institute = instituteDetailRepository.findById(txn.getInstituteCode().intValue());
            if (institute != null) {
                response.put("instituteName", institute.getInstituteName());
            }
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Public endpoint: student submits registration details before payment.
     * POST /payment/webhook/register/{transactionId}
     * Body: { name, email, dob (dd-MM-yyyy), phone, gender, studentClass }
     */
    // payment.update not in enum; use payment.create (creating pre-payment student-detail record)
    @PreAuthorize("@auth.allows('payment.create')")
    @PostMapping("/register/{transactionId}")
    public ResponseEntity<?> registerStudentDetails(
            @PathVariable Long transactionId,
            @RequestBody Map<String, String> studentData) {

        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findById(transactionId);
        if (!txnOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        PaymentTransaction txn = txnOpt.get();

        // Validate required fields
        String name = studentData.get("name");
        String email = studentData.get("email");
        String dobStr = studentData.get("dob");
        String phone = studentData.get("phone");

        if (name == null || name.isEmpty()
                || email == null || email.isEmpty()
                || dobStr == null || dobStr.isEmpty()
                || phone == null || phone.isEmpty()) {
            return ResponseEntity.badRequest().body("Name, email, phone, and date of birth are required");
        }

        // Parse DOB
        try {
            SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
            txn.setStudentDob(sdf.parse(dobStr));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Invalid date format. Use dd-MM-yyyy");
        }

        txn.setStudentName(name);
        txn.setStudentEmail(email);
        txn.setStudentPhone(phone);
        paymentTransactionRepository.save(txn);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "registered");
        response.put("paymentUrl", txn.getShortUrl());
        response.put("transactionId", txn.getTransactionId());

        return ResponseEntity.ok(response);
    }

    private void handlePaymentLinkPaid(JSONObject payloadObj) {
        JSONObject paymentLink = payloadObj.getJSONObject("payment_link").getJSONObject("entity");
        String linkId = paymentLink.getString("id");

        // Use the pessimistic-write finder so two concurrent webhook
        // deliveries for the same link serialise here. The status-based
        // early-return inside markPaidAndProvision then ensures only the
        // first delivery actually provisions the student.
        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findByRazorpayLinkIdForUpdate(linkId);
        if (!txnOpt.isPresent()) {
            logger.warn("Payment link not found in DB: {}", linkId);
            return;
        }

        PaymentTransaction txn = txnOpt.get();
        JSONObject payment = payloadObj.getJSONObject("payment").getJSONObject("entity");
        markPaidAndProvision(txn, payment, paymentLink.optJSONObject("notes"));
    }

    /**
     * Shared "mark-paid + provision student + activate entitlement" path.
     * Used by:
     *   - the {@code payment_link.paid} webhook (real-time, primary)
     *   - the admin "Check status" action on the B2C Tracker, which fetches
     *     Razorpay's view of a stuck transaction and reconciles when the
     *     webhook was missed/delayed
     *
     * Idempotent: returns immediately when the txn is already marked paid.
     * Inputs may be partial — paymentEntity / notes are optional. When
     * Razorpay reports a paid link without a matching payment object (rare,
     * old links), we still mark the txn paid and provision so the student
     * isn't stuck.
     */
    @Transactional
    public boolean markPaidAndProvision(PaymentTransaction txn,
                                        JSONObject paymentEntity,
                                        JSONObject linkNotes) {
        if ("paid".equals(txn.getStatus())) {
            logger.info("markPaidAndProvision: txn {} already paid, skipping", txn.getTransactionId());
            return false;
        }

        if (paymentEntity != null) {
            if (paymentEntity.has("id") && !paymentEntity.isNull("id")) {
                txn.setRazorpayPaymentId(paymentEntity.getString("id"));
            }
            if (paymentEntity.has("order_id") && !paymentEntity.isNull("order_id")) {
                txn.setRazorpayOrderId(paymentEntity.getString("order_id"));
            }
            if ((txn.getStudentEmail() == null || txn.getStudentEmail().isEmpty())
                    && paymentEntity.has("email") && !paymentEntity.isNull("email")) {
                txn.setStudentEmail(paymentEntity.getString("email"));
            }
            if ((txn.getStudentPhone() == null || txn.getStudentPhone().isEmpty())
                    && paymentEntity.has("contact") && !paymentEntity.isNull("contact")) {
                txn.setStudentPhone(paymentEntity.getString("contact"));
            }
        }

        if (linkNotes != null) {
            if ((txn.getStudentName() == null || txn.getStudentName().isEmpty())
                    && linkNotes.has("customerName")) {
                txn.setStudentName(linkNotes.getString("customerName"));
            }
            if (txn.getStudentDob() == null && linkNotes.has("customerDob")) {
                try {
                    SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
                    txn.setStudentDob(sdf.parse(linkNotes.getString("customerDob")));
                } catch (Exception e) {
                    logger.warn("Could not parse customer DOB from notes");
                }
            }
        }

        txn.setStatus("paid");
        paymentTransactionRepository.save(txn);

        // Branch: B2C (campaign-linked) vs legacy school payment.
        if (txn.getCampaignId() != null && txn.getCampaignAssessmentTierId() != null) {
            provisionB2CStudentAndEntitlement(txn);
        } else {
            createStudentAndAllotAssessment(txn);
        }
        return true;
    }

    private void provisionB2CStudentAndEntitlement(PaymentTransaction txn) {
        try {
            Long assessmentId = txn.getAssessmentId();
            if (assessmentId == null) {
                logger.error("B2C txn {} missing assessmentId", txn.getTransactionId());
                return;
            }

            String email = txn.getStudentEmail();
            String name = txn.getStudentName() != null ? txn.getStudentName() : "Student";
            Date dob = txn.getStudentDob() != null ? txn.getStudentDob() : new Date();
            String phone = txn.getStudentPhone();

            // Look up an existing student globally (no instituteCode for B2C).
            UserStudent userStudent = null;
            if (email != null) {
                List<StudentInfo> existing = studentInfoRepository.findByEmail(email);
                if (existing != null && !existing.isEmpty()) {
                    StudentInfo info = existing.get(0);
                    List<UserStudent> us = userStudentRepository.findByStudentInfoId(info.getId());
                    if (!us.isEmpty()) userStudent = us.get(0);
                }
            }

            if (userStudent == null) {
                User user = new User((int) (Math.random() * 100000), dob);
                user.setName(name);
                user.setEmail(email);
                user.setPhone(phone);
                user = userRepository.save(user);

                StudentInfo studentInfo = new StudentInfo();
                studentInfo.setName(name);
                studentInfo.setEmail(email);
                studentInfo.setStudentDob(dob);
                studentInfo.setPhoneNumber(phone);
                studentInfo.setUser(user);
                studentInfo = studentInfoRepository.save(studentInfo);

                userStudent = new UserStudent(user, studentInfo, null);
                userStudent = userStudentRepository.save(userStudent);
                studentProvisioningService.provision(userStudent);
            }

            // Ensure StudentAssessmentMapping exists so they can take the assessment.
            Optional<StudentAssessmentMapping> samOpt = studentAssessmentMappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudent.getUserStudentId(), assessmentId);
            if (!samOpt.isPresent()) {
                StudentAssessmentMapping sam = new StudentAssessmentMapping(userStudent.getUserStudentId(), assessmentId);
                studentAssessmentMappingRepository.save(sam);
            }

            txn.setUserStudentId(userStudent.getUserStudentId());
            paymentTransactionRepository.save(txn);

            // Now activate the entitlement — sends welcome + assessment link with token.
            if (entitlementService != null) {
                entitlementService.activateOnPayment(txn.getTransactionId());
            }

            logger.info("B2C student provisioned + entitlement activated. UserStudentId: {}, TxnId: {}",
                    userStudent.getUserStudentId(), txn.getTransactionId());

        } catch (Exception e) {
            logger.error("B2C provisioning failed for txn {}", txn.getTransactionId(), e);
            txn.setStatus("paid_provisioning_failed");
            txn.setFailureReason("B2C provisioning failed: " + e.getMessage());
            paymentTransactionRepository.save(txn);
        }
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

        // Send automated notification for expired/cancelled
        if (txn.getStudentEmail() != null && !txn.getStudentEmail().isEmpty()) {
            String assessmentName = assessmentTableRepository.findById(txn.getAssessmentId())
                    .map(a -> a.getAssessmentName()).orElse("Assessment");
            paymentEmailService.sendFailedOrPendingEmail(txn, assessmentName, status);
        }
    }

    private void handlePaymentFailed(JSONObject payloadObj) {
        JSONObject payment = payloadObj.getJSONObject("payment").getJSONObject("entity");
        String paymentId = payment.getString("id");

        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findByRazorpayPaymentId(paymentId);

        if (!txnOpt.isPresent()) {
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

        // Don't overwrite a successful payment with a failed retry
        if ("paid".equals(txn.getStatus())) {
            logger.info("Ignoring failed payment event for already-paid transaction: {}", txn.getTransactionId());
            return;
        }

        txn.setStatus("failed");
        txn.setRazorpayPaymentId(paymentId);

        if (payment.has("error_description") && !payment.isNull("error_description")) {
            txn.setFailureReason(payment.getString("error_description"));
        } else if (payment.has("error_reason") && !payment.isNull("error_reason")) {
            txn.setFailureReason(payment.getString("error_reason"));
        }

        if (payment.has("email") && !payment.isNull("email")) {
            txn.setStudentEmail(payment.getString("email"));
        }
        if (payment.has("contact") && !payment.isNull("contact")) {
            txn.setStudentPhone(payment.getString("contact"));
        }

        paymentTransactionRepository.save(txn);
        logger.info("Payment {} marked as failed. Reason: {}", paymentId, txn.getFailureReason());

        // Send automated notification for failed payment
        if (txn.getStudentEmail() != null && !txn.getStudentEmail().isEmpty()) {
            String assessmentName = assessmentTableRepository.findById(txn.getAssessmentId())
                    .map(a -> a.getAssessmentName()).orElse("Assessment");
            paymentEmailService.sendFailedOrPendingEmail(txn, assessmentName, "failed");
        }
    }

    private void createStudentAndAllotAssessment(PaymentTransaction txn) {
        try {
            Long assessmentId;
            Integer instituteCode;
            Integer sectionId;
            Integer classId;

            // Resolve source: school config or assessment-institute mapping
            if (txn.getSchoolConfigId() != null) {
                Optional<SchoolAssessmentConfig> configOpt = schoolAssessmentConfigRepository.findById(txn.getSchoolConfigId());
                if (!configOpt.isPresent()) {
                    logger.error("SchoolAssessmentConfig not found for transaction: {}", txn.getTransactionId());
                    return;
                }
                SchoolAssessmentConfig config = configOpt.get();
                assessmentId = config.getAssessmentId();
                instituteCode = config.getInstituteCode();
                classId = config.getClassId();
                sectionId = null;
            } else if (txn.getMappingId() != null) {
                Optional<AssessmentInstituteMapping> mappingOpt = mappingRepository.findById(txn.getMappingId());
                if (!mappingOpt.isPresent()) {
                    logger.error("Mapping not found for transaction: {}", txn.getTransactionId());
                    return;
                }
                AssessmentInstituteMapping mapping = mappingOpt.get();
                assessmentId = mapping.getAssessmentId();
                instituteCode = mapping.getInstituteCode();
                classId = mapping.getClassId();
                sectionId = mapping.getSectionId();
            } else {
                logger.error("Transaction {} has neither mappingId, schoolConfigId, nor campaignId", txn.getTransactionId());
                return;
            }

            String email = txn.getStudentEmail();
            String name = txn.getStudentName() != null ? txn.getStudentName() : "Student";
            Date dob = txn.getStudentDob() != null ? txn.getStudentDob() : new Date();
            String phone = txn.getStudentPhone();

            if (email != null) {
                List<StudentInfo> byEmail = studentInfoRepository.findByEmailAndInstituteId(email, instituteCode);
                if (!byEmail.isEmpty()) {
                    handleExistingStudentPayment(byEmail.get(0), assessmentId, instituteCode, txn);
                    return;
                }
            }

            User user = new User((int) (Math.random() * 100000), dob);
            user.setName(name);
            user.setEmail(email);
            user.setPhone(phone);
            user = userRepository.save(user);

            String rollNumber = rollNumberService.generateNextRollNumber(instituteCode, sectionId);
            if (rollNumber != null) {
                user.setCareerNineRollNumber(rollNumber);
                user = userRepository.save(user);
            }

            StudentInfo studentInfo = new StudentInfo();
            studentInfo.setName(name);
            studentInfo.setEmail(email);
            studentInfo.setStudentDob(dob);
            studentInfo.setPhoneNumber(phone);
            studentInfo.setSchoolSectionId(sectionId);
            if (classId != null) {
                studentInfo.setStudentClass(parseClassNumber(classId));
            }
            studentInfo.setUser(user);
            studentInfo = studentInfoRepository.save(studentInfo);

            UserStudent userStudent = new UserStudent(user, studentInfo, null);
            userStudent = userStudentRepository.save(userStudent);
            studentProvisioningService.provision(userStudent);

            membershipService.setPrimaryInstitute(userStudent, instituteCode, null, "payment-provision");

            tryIncrementSchoolLink(txn);

            StudentAssessmentMapping sam = new StudentAssessmentMapping(
                    userStudent.getUserStudentId(), assessmentId);
            studentAssessmentMappingRepository.save(sam);

            txn.setUserStudentId(userStudent.getUserStudentId());
            paymentTransactionRepository.save(txn);

            String assessmentName = assessmentTableRepository.findById(assessmentId)
                    .map(a -> a.getAssessmentName()).orElse("Assessment");
            SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
            String dobStr = sdf.format(dob);

            paymentEmailService.sendWelcomeEmail(email, name, user.getUsername(), dobStr, assessmentName, txn);

            logger.info("Student created and assessment allotted via payment. UserStudentId: {}, TransactionId: {}",
                    userStudent.getUserStudentId(), txn.getTransactionId());

        } catch (Exception e) {
            logger.error("Failed to create student after payment. TransactionId: {}", txn.getTransactionId(), e);
            txn.setStatus("paid_provisioning_failed");
            txn.setFailureReason("Student creation failed: " + e.getMessage());
            paymentTransactionRepository.save(txn);
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
            studentProvisioningService.provision(newUs);
            tryIncrementSchoolLink(txn);
            userStudents = List.of(newUs);
        }

        UserStudent userStudent = userStudents.get(0);

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

        User user = existingStudent.getUser();
        if (user != null && existingStudent.getEmail() != null) {
            String assessmentName = assessmentTableRepository.findById(assessmentId)
                    .map(a -> a.getAssessmentName()).orElse("Assessment");
            SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
            String dobStr = user.getDobDate() != null ? sdf.format(user.getDobDate()) : "";
            paymentEmailService.sendWelcomeEmail(existingStudent.getEmail(), existingStudent.getName(),
                    user.getUsername(), dobStr, assessmentName, txn);
        }

        logger.info("Existing student assigned assessment via payment. UserStudentId: {}", userStudent.getUserStudentId());
    }

    private void tryIncrementSchoolLink(PaymentTransaction txn) {
        if (txn == null || txn.getSchoolConfigId() == null) return;
        Optional<SchoolAssessmentConfig> configOpt = schoolAssessmentConfigRepository.findById(txn.getSchoolConfigId());
        if (!configOpt.isPresent()) return;
        SchoolAssessmentConfig config = configOpt.get();
        Optional<SchoolRegistrationLink> linkOpt = schoolRegistrationLinkRepository
                .findByInstituteCodeAndSessionId(config.getInstituteCode(), config.getSessionId());
        if (!linkOpt.isPresent()) return;
        Long linkId = linkOpt.get().getLinkId();
        int rows = schoolRegistrationLinkRepository.tryIncrementCount(linkId);
        logger.info("School link increment (webhook): linkId={}, rowsAffected={}", linkId, rows);
        if (rows == 0) {
            logger.warn("Cap already hit on SchoolRegistrationLink {} when processing payment txn {}; allowing this paid registration through.",
                    linkId, txn.getTransactionId());
            return;
        }
        schoolRegistrationLinkRepository.findById(linkId).ifPresent(refreshed -> {
            int max = refreshed.getMaxRegistrations() != null ? refreshed.getMaxRegistrations() : 0;
            int current = refreshed.getCurrentCount() != null ? refreshed.getCurrentCount() : 0;
            if (max > 0 && current >= max) {
                refreshed.setIsActive(false);
                schoolRegistrationLinkRepository.save(refreshed);
                logger.info("School link {} hit cap ({}/{}) via webhook, deactivated", linkId, current, max);
            }
        });
    }

    private Integer parseClassNumber(Integer classId) {
        if (classId == null) return null;
        try {
            Optional<SchoolClasses> classOpt = schoolClassesRepository.findById(classId);
            if (classOpt.isPresent()) {
                String className = classOpt.get().getClassName();
                return Integer.parseInt(className.replaceAll("[^0-9]", ""));
            }
        } catch (NumberFormatException e) {
            logger.warn("Could not parse class number from className for classId: {}", classId);
        }
        return classId;
    }

}
