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

    @PostMapping("/razorpay")
    @Transactional
    public ResponseEntity<?> handleRazorpayWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {

        logger.info("Razorpay webhook received");

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
            return ResponseEntity.ok(Map.of("status", "error_logged"));
        }
    }

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

    private void handlePaymentLinkPaid(JSONObject payloadObj) {
        JSONObject paymentLink = payloadObj.getJSONObject("payment_link").getJSONObject("entity");
        String linkId = paymentLink.getString("id");

        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findByRazorpayLinkId(linkId);
        if (!txnOpt.isPresent()) {
            logger.warn("Payment link not found in DB: {}", linkId);
            return;
        }

        PaymentTransaction txn = txnOpt.get();

        JSONObject payment = payloadObj.getJSONObject("payment").getJSONObject("entity");
        txn.setRazorpayPaymentId(payment.getString("id"));
        if (payment.has("order_id") && !payment.isNull("order_id")) {
            txn.setRazorpayOrderId(payment.getString("order_id"));
        }
        txn.setStatus("paid");

        if (payment.has("email") && !payment.isNull("email")) {
            txn.setStudentEmail(payment.getString("email"));
        }
        if (payment.has("contact") && !payment.isNull("contact")) {
            txn.setStudentPhone(payment.getString("contact"));
        }

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
    }

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

            Integer sectionId = mapping.getSectionId();
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

            txn.setWelcomeEmailSent(true);
            paymentTransactionRepository.save(txn);

            logger.info("Welcome + assessment email sent to: {}", email);
        } catch (Exception e) {
            logger.error("Failed to send welcome email to: {}", email, e);
        }
    }
}
