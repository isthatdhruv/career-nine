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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
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
import com.kccitm.api.model.career9.school.SchoolClasses;
import com.kccitm.api.repository.Career9.SchoolAssessmentConfigRepository;
import com.kccitm.api.repository.Career9.School.SchoolClassesRepository;
import com.kccitm.api.service.CareerNineRollNumberService;
import com.kccitm.api.service.PaymentEmailService;
import com.kccitm.api.service.RazorpayService;

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

    @PostMapping("/razorpay")
    @Transactional
    public ResponseEntity<?> handleRazorpayWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {

        logger.info("Razorpay webhook received");

        // Reject if signature is missing or invalid
        if (signature == null || !razorpayService.verifyWebhookSignature(payload, signature)) {
            logger.warn("Invalid or missing Razorpay webhook signature");
            return ResponseEntity.status(401).body("Invalid or missing signature");
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
            return ResponseEntity.ok(Map.of("status", "error_logged"));
        }
    }

    /**
     * Public endpoint: frontend polls this to get real payment status from DB.
     * GET /payment/webhook/status/{razorpayLinkId}
     *
     * Returns the actual DB status (set by webhook), not the query param from Razorpay redirect.
     * Frontend polls until status != "created" (i.e., webhook has arrived and updated it).
     */
    @GetMapping("/status/{razorpayLinkId}")
    public ResponseEntity<?> getPaymentStatus(@PathVariable String razorpayLinkId) {
        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository
                .findByRazorpayLinkId(razorpayLinkId);

        if (!txnOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        PaymentTransaction txn = txnOpt.get();
        Map<String, Object> response = new HashMap<>();
        response.put("status", txn.getStatus());
        response.put("amount", txn.getAmount() / 100);
        response.put("transactionId", txn.getTransactionId());
        response.put("assessmentId", txn.getAssessmentId());

        String assessmentName = assessmentTableRepository.findById(txn.getAssessmentId())
                .map(a -> a.getAssessmentName()).orElse("Assessment");
        response.put("assessmentName", assessmentName);

        if ("failed".equals(txn.getStatus()) && txn.getFailureReason() != null) {
            response.put("failureReason", txn.getFailureReason());
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Public endpoint: get transaction info for registration form.
     * GET /payment/webhook/info/{transactionId}
     */
    @GetMapping("/info/{transactionId}")
    public ResponseEntity<?> getTransactionInfo(@PathVariable Long transactionId) {
        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findById(transactionId);
        if (!txnOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        PaymentTransaction txn = txnOpt.get();
        Map<String, Object> response = new HashMap<>();
        response.put("transactionId", txn.getTransactionId());
        response.put("amount", txn.getAmount() / 100);
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

        if (name == null || name.isEmpty() || email == null || email.isEmpty() || dobStr == null || dobStr.isEmpty()) {
            return ResponseEntity.badRequest().body("Name, email, and date of birth are required");
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
        txn.setStudentPhone(studentData.getOrDefault("phone", null));
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

        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findByRazorpayLinkId(linkId);
        if (!txnOpt.isPresent()) {
            logger.warn("Payment link not found in DB: {}", linkId);
            return;
        }

        PaymentTransaction txn = txnOpt.get();

        // Idempotency: skip if already processed
        if ("paid".equals(txn.getStatus())) {
            logger.info("Duplicate payment_link.paid webhook for linkId: {}, skipping", linkId);
            return;
        }

        JSONObject payment = payloadObj.getJSONObject("payment").getJSONObject("entity");
        txn.setRazorpayPaymentId(payment.getString("id"));
        if (payment.has("order_id") && !payment.isNull("order_id")) {
            txn.setRazorpayOrderId(payment.getString("order_id"));
        }
        txn.setStatus("paid");

        // Only fill from Razorpay payload if registration didn't already capture these
        if ((txn.getStudentEmail() == null || txn.getStudentEmail().isEmpty())
                && payment.has("email") && !payment.isNull("email")) {
            txn.setStudentEmail(payment.getString("email"));
        }
        if ((txn.getStudentPhone() == null || txn.getStudentPhone().isEmpty())
                && payment.has("contact") && !payment.isNull("contact")) {
            txn.setStudentPhone(payment.getString("contact"));
        }

        JSONObject notes = paymentLink.optJSONObject("notes");
        if (notes != null) {
            if ((txn.getStudentName() == null || txn.getStudentName().isEmpty())
                    && notes.has("customerName")) {
                txn.setStudentName(notes.getString("customerName"));
            }
            if (txn.getStudentDob() == null && notes.has("customerDob")) {
                try {
                    SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
                    txn.setStudentDob(sdf.parse(notes.getString("customerDob")));
                } catch (Exception e) {
                    logger.warn("Could not parse customer DOB from notes");
                }
            }
        }

        paymentTransactionRepository.save(txn);
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
                logger.error("Transaction {} has neither mappingId nor schoolConfigId", txn.getTransactionId());
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
            studentInfo.setInstituteId(instituteCode);
            studentInfo.setSchoolSectionId(sectionId);
            if (classId != null) {
                studentInfo.setStudentClass(parseClassNumber(classId));
            }
            studentInfo.setUser(user);
            studentInfo = studentInfoRepository.save(studentInfo);

            InstituteDetail institute = instituteDetailRepository.findById(instituteCode.intValue());
            UserStudent userStudent = new UserStudent(user, studentInfo, institute);
            userStudent = userStudentRepository.save(userStudent);

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
