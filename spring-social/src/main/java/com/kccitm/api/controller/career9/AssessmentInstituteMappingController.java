package com.kccitm.api.controller.career9;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.AssessmentInstituteMapping;
import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.PromoCode;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.model.career9.school.SchoolClasses;
import com.kccitm.api.model.career9.school.SchoolSections;
import com.kccitm.api.repository.Career9.AssessmentInstituteMappingRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.repository.Career9.PromoCodeRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.School.SchoolClassesRepository;
import com.kccitm.api.repository.Career9.School.SchoolSectionsRepository;
import com.kccitm.api.repository.Career9.School.SchoolSessionRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.service.RazorpayService;
import com.kccitm.api.service.SmtpEmailService;

@RestController
@RequestMapping("/assessment-mapping")
public class AssessmentInstituteMappingController {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentInstituteMappingController.class);

    @Autowired
    private AssessmentInstituteMappingRepository mappingRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private InstituteDetailRepository instituteDetailRepository;

    @Autowired
    private SchoolSessionRepository schoolSessionRepository;

    @Autowired
    private SchoolClassesRepository schoolClassesRepository;

    @Autowired
    private SchoolSectionsRepository schoolSectionsRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentInfoRepository studentInfoRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private SmtpEmailService gmailApiEmailService;

    @Autowired
    private com.kccitm.api.service.CareerNineRollNumberService rollNumberService;

    @Autowired
    private RazorpayService razorpayService;

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Autowired
    private PromoCodeRepository promoCodeRepository;

    @org.springframework.beans.factory.annotation.Value("${app.razorpay.callback-base-url:https://dashboard.career-9.com}")
    private String callbackBaseUrl;

    // ============ ADMIN ENDPOINTS ============

    @PostMapping("/create")
    public ResponseEntity<?> createMapping(@RequestBody AssessmentInstituteMapping mapping) {
        // Validate assessment exists
        if (!assessmentTableRepository.existsById(mapping.getAssessmentId())) {
            return ResponseEntity.badRequest().body("Assessment not found");
        }

        // Generate UUID token
        mapping.setToken(UUID.randomUUID().toString());

        AssessmentInstituteMapping saved = mappingRepository.save(mapping);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/getAll")
    public List<AssessmentInstituteMapping> getAll() {
        return mappingRepository.findAll();
    }

    @GetMapping("/getByInstitute/{instituteCode}")
    public List<AssessmentInstituteMapping> getByInstitute(@PathVariable Integer instituteCode) {
        return mappingRepository.findByInstituteCode(instituteCode);
    }

    @GetMapping("/getByInstitute/{instituteCode}/assessments")
    public List<AssessmentTableRepository.AssessmentSummary> getAssessmentsByInstitute(@PathVariable Integer instituteCode) {
        return assessmentTableRepository.findAssessmentSummariesByInstitute(instituteCode);
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        return mappingRepository.findById(id)
                .map(m -> ResponseEntity.ok((Object) m))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<?> updateMapping(@PathVariable Long id,
            @RequestBody AssessmentInstituteMapping updated) {
        Optional<AssessmentInstituteMapping> existingOpt = mappingRepository.findById(id);
        if (!existingOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        AssessmentInstituteMapping existing = existingOpt.get();
        if (updated.getIsActive() != null) {
            existing.setIsActive(updated.getIsActive());
        }
        if (updated.getAmount() != null) {
            existing.setAmount(updated.getAmount());
        }

        return ResponseEntity.ok(mappingRepository.save(existing));
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> deleteMapping(@PathVariable Long id) {
        if (!mappingRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        mappingRepository.deleteById(id);
        return ResponseEntity.ok("Mapping deleted successfully");
    }

    // ============ PUBLIC ENDPOINTS ============

    @GetMapping("/public/info/{token}")
    public ResponseEntity<?> getMappingInfoByToken(@PathVariable String token) {
        Optional<AssessmentInstituteMapping> mappingOpt = mappingRepository.findByTokenAndIsActive(token, true);
        if (!mappingOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Invalid or expired assessment link");
        }

        AssessmentInstituteMapping mapping = mappingOpt.get();

        Map<String, Object> info = new HashMap<>();
        info.put("mappingLevel", mapping.getMappingLevel());
        info.put("assessmentId", mapping.getAssessmentId());
        info.put("amount", mapping.getAmount() != null ? mapping.getAmount() : 0);

        // Get assessment name
        assessmentTableRepository.findById(mapping.getAssessmentId()).ifPresent(assessment -> {
            info.put("assessmentName", assessment.getAssessmentName());
        });

        // Get institute name
        InstituteDetail institute = instituteDetailRepository.findById(mapping.getInstituteCode().intValue());
        if (institute != null) {
            info.put("instituteName", institute.getInstituteName());
        }

        // Get session/class/section info based on mapping level
        if (mapping.getSessionId() != null) {
            schoolSessionRepository.findById(mapping.getSessionId()).ifPresent(session -> {
                info.put("sessionId", session.getId());
                info.put("sessionYear", session.getSessionYear());
            });
        }

        if (mapping.getClassId() != null) {
            schoolClassesRepository.findById(mapping.getClassId()).ifPresent(schoolClass -> {
                info.put("classId", schoolClass.getId());
                info.put("className", schoolClass.getClassName());
            });
        }

        if (mapping.getSectionId() != null) {
            schoolSectionsRepository.findById(mapping.getSectionId()).ifPresent(section -> {
                info.put("sectionId", section.getId());
                info.put("sectionName", section.getSectionName());
            });
        }

        // If SESSION level, provide available classes for the session
        if ("SESSION".equals(mapping.getMappingLevel()) && mapping.getSessionId() != null) {
            List<SchoolClasses> classes = schoolClassesRepository
                    .findBySchoolSession_Id(mapping.getSessionId());
            info.put("availableClasses", classes);
        }

        // If CLASS level, provide available sections for the class
        if ("CLASS".equals(mapping.getMappingLevel()) && mapping.getClassId() != null) {
            List<SchoolSections> sections = schoolSectionsRepository
                    .findBySchoolClasses_Id(mapping.getClassId());
            info.put("availableSections", sections);
        }

        return ResponseEntity.ok(info);
    }

    @PostMapping("/public/register/{token}")
    @Transactional
    public ResponseEntity<?> registerStudentByToken(@PathVariable String token,
            @RequestBody Map<String, Object> studentData) {
        // 1. Find mapping by token
        Optional<AssessmentInstituteMapping> mappingOpt = mappingRepository.findByTokenAndIsActive(token, true);
        if (!mappingOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Invalid or expired assessment link");
        }

        AssessmentInstituteMapping mapping = mappingOpt.get();
        Long assessmentId = mapping.getAssessmentId();
        Integer instituteCode = mapping.getInstituteCode();

        // 2. Extract student data from request
        String name = (String) studentData.get("name");
        String email = (String) studentData.get("email");
        String dobStr = (String) studentData.get("dob");
        String phone = (String) studentData.get("phone");
        String gender = (String) studentData.get("gender");

        if (name == null || email == null || dobStr == null) {
            return ResponseEntity.badRequest().body("Name, email, and date of birth are required");
        }

        // Parse DOB
        SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
        Date dob;
        try {
            dob = sdf.parse(dobStr);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Invalid date format. Use dd-MM-yyyy");
        }

        // 3. Resolve class info based on mapping level
        Integer studentClass = null;
        Integer schoolSectionId = null;

        if ("SECTION".equals(mapping.getMappingLevel())) {
            schoolSectionId = mapping.getSectionId();
            if (mapping.getClassId() != null) {
                studentClass = parseClassNumber(mapping.getClassId());
            }
        } else if ("CLASS".equals(mapping.getMappingLevel())) {
            studentClass = parseClassNumber(mapping.getClassId());
            // Section is optional from request
            if (studentData.get("schoolSectionId") != null) {
                schoolSectionId = Integer.valueOf(studentData.get("schoolSectionId").toString());
            }
        } else if ("SESSION".equals(mapping.getMappingLevel())) {
            // Class and section come from request
            if (studentData.get("classId") != null) {
                Integer classId = Integer.valueOf(studentData.get("classId").toString());
                studentClass = parseClassNumber(classId);
            }
            if (studentData.get("schoolSectionId") != null) {
                schoolSectionId = Integer.valueOf(studentData.get("schoolSectionId").toString());
            }
        }

        // 4. Check if payment is required
        Long mappingAmount = mapping.getAmount(); // amount in paise
        boolean paymentRequired = mappingAmount != null && mappingAmount > 0;

        // 5. Handle promo code if provided
        String promoCodeStr = (String) studentData.get("promoCode");
        Integer promoDiscountPercent = null;
        Long originalAmount = mappingAmount;
        Long finalAmount = mappingAmount;

        if (paymentRequired && promoCodeStr != null && !promoCodeStr.trim().isEmpty()) {
            Optional<PromoCode> promoOpt = promoCodeRepository.findByCodeIgnoreCaseAndIsActive(
                    promoCodeStr.trim().toUpperCase(), true);
            if (!promoOpt.isPresent()) {
                return ResponseEntity.badRequest().body("Invalid promo code");
            }
            PromoCode promo = promoOpt.get();
            if (promo.getExpiresAt() != null && promo.getExpiresAt().before(new Date())) {
                return ResponseEntity.badRequest().body("Promo code has expired");
            }
            if (promo.getMaxUses() != null && promo.getCurrentUses() >= promo.getMaxUses()) {
                return ResponseEntity.badRequest().body("Promo code usage limit reached");
            }
            promoDiscountPercent = promo.getDiscountPercent();
            finalAmount = mappingAmount * (100 - promoDiscountPercent) / 100;

            // Increment usage
            promo.setCurrentUses(promo.getCurrentUses() + 1);
            promoCodeRepository.save(promo);
        }

        // 6. Duplicate check by EMAIL
        List<StudentInfo> byEmail = studentInfoRepository.findByEmailAndInstituteId(email, instituteCode);
        if (!byEmail.isEmpty()) {
            // If payment required, still need to handle payment for existing student
            if (paymentRequired && finalAmount > 0) {
                return handleExistingStudentWithPayment(byEmail.get(0), assessmentId, instituteCode,
                        mapping.getMappingId(), finalAmount, originalAmount, promoCodeStr, promoDiscountPercent,
                        name, email, dob, phone);
            }
            return handleExistingStudent(byEmail.get(0), assessmentId, instituteCode);
        }

        // 7. Duplicate check by DOB + institute + class + name
        if (studentClass != null) {
            List<StudentInfo> byDob = studentInfoRepository
                    .findByStudentDobAndInstituteIdAndStudentClassAndNameIgnoreCase(dob, instituteCode, studentClass, name);
            if (!byDob.isEmpty()) {
                if (paymentRequired && finalAmount > 0) {
                    return handleExistingStudentWithPayment(byDob.get(0), assessmentId, instituteCode,
                            mapping.getMappingId(), finalAmount, originalAmount, promoCodeStr, promoDiscountPercent,
                            name, email, dob, phone);
                }
                return handleExistingStudent(byDob.get(0), assessmentId, instituteCode);
            }
        }

        // 8. If payment required and finalAmount > 0, create payment transaction and redirect
        if (paymentRequired && finalAmount > 0) {
            return createPaymentAndRedirect(mapping.getMappingId(), assessmentId, instituteCode,
                    finalAmount, originalAmount, promoCodeStr, promoDiscountPercent,
                    name, email, dob, dobStr, phone, gender);
        }

        // 9. Free registration (no amount, or 100% promo discount) — create student directly
        // If 100% promo was used, record a zero-amount transaction
        if (paymentRequired && finalAmount != null && finalAmount == 0 && promoCodeStr != null) {
            PaymentTransaction txn = new PaymentTransaction();
            txn.setMappingId(mapping.getMappingId());
            txn.setAmount(0L);
            txn.setOriginalAmount(originalAmount);
            txn.setPromoCode(promoCodeStr.trim().toUpperCase());
            txn.setPromoDiscountPercent(promoDiscountPercent);
            txn.setStatus("paid");
            txn.setAssessmentId(assessmentId);
            txn.setInstituteCode(instituteCode);
            txn.setStudentName(name);
            txn.setStudentEmail(email);
            txn.setStudentDob(dob);
            txn.setStudentPhone(phone);
            paymentTransactionRepository.save(txn);
        }

        // Create User
        User user = new User((int) (Math.random() * 100000), dob);
        user.setName(name);
        user.setEmail(email);
        user.setPhone(phone);
        user = userRepository.save(user);

        // Generate and set careerNineRollNumber
        String rollNumber = rollNumberService.generateNextRollNumber(instituteCode, schoolSectionId);
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
        studentInfo.setGender(gender);
        studentInfo.setInstituteId(instituteCode);
        studentInfo.setStudentClass(studentClass);
        studentInfo.setSchoolSectionId(schoolSectionId);
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

        // Build response
        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Registration successful! Please save your login credentials.");
        response.put("username", user.getUsername());
        response.put("dob", dobStr);

        // Send registration email with credentials
        String assessmentName = assessmentTableRepository.findById(assessmentId)
                .map(a -> a.getAssessmentName()).orElse("Assessment");
        sendRegistrationEmail(email, name, user.getUsername(), dobStr, assessmentName);

        return ResponseEntity.ok(response);
    }

    /**
     * Create a PaymentTransaction and Razorpay payment link, return payment URL.
     */
    private ResponseEntity<?> createPaymentAndRedirect(Long mappingId, Long assessmentId, Integer instituteCode,
            Long finalAmountPaise, Long originalAmountPaise, String promoCodeStr, Integer promoDiscountPercent,
            String name, String email, Date dob, String dobStr, String phone, String gender) {
        try {
            String assessmentName = assessmentTableRepository.findById(assessmentId)
                    .map(a -> a.getAssessmentName()).orElse("Assessment");

            String callbackUrl = callbackBaseUrl + "/payment-status";
            String referenceId = "MAP-" + mappingId + "-" + System.currentTimeMillis();

            Map<String, String> notes = new HashMap<>();
            notes.put("mappingId", String.valueOf(mappingId));
            notes.put("assessmentId", String.valueOf(assessmentId));
            notes.put("instituteCode", String.valueOf(instituteCode));
            notes.put("studentEmail", email);
            notes.put("studentName", name);

            Map<String, String> rzpResponse = razorpayService.createPaymentLink(
                    finalAmountPaise, "INR", assessmentName + " - Payment",
                    callbackUrl, referenceId, notes);

            // Create PaymentTransaction
            PaymentTransaction txn = new PaymentTransaction();
            txn.setMappingId(mappingId);
            txn.setAmount(finalAmountPaise);
            txn.setOriginalAmount(originalAmountPaise);
            txn.setAssessmentId(assessmentId);
            txn.setInstituteCode(instituteCode);
            txn.setStudentName(name);
            txn.setStudentEmail(email);
            txn.setStudentDob(dob);
            txn.setStudentPhone(phone);
            txn.setRazorpayLinkId((String) rzpResponse.get("id"));
            txn.setPaymentLinkUrl((String) rzpResponse.get("short_url"));
            txn.setShortUrl((String) rzpResponse.get("short_url"));
            txn.setStatus("created");

            if (promoCodeStr != null && !promoCodeStr.trim().isEmpty()) {
                txn.setPromoCode(promoCodeStr.trim().toUpperCase());
                txn.setPromoDiscountPercent(promoDiscountPercent);
            }

            paymentTransactionRepository.save(txn);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "payment_required");
            response.put("paymentUrl", rzpResponse.get("short_url"));
            response.put("transactionId", txn.getTransactionId());
            response.put("amount", finalAmountPaise);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to create payment link: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to create payment link. Please try again.");
        }
    }

    /**
     * Handle existing student who needs to pay.
     */
    private ResponseEntity<?> handleExistingStudentWithPayment(StudentInfo existingStudentInfo, Long assessmentId,
            Integer instituteCode, Long mappingId, Long finalAmountPaise, Long originalAmountPaise,
            String promoCodeStr, Integer promoDiscountPercent,
            String name, String email, Date dob, String phone) {
        // Check if already assigned
        List<UserStudent> userStudents = userStudentRepository.findByStudentInfoId(existingStudentInfo.getId());
        if (!userStudents.isEmpty()) {
            UserStudent userStudent = userStudents.get(0);
            Optional<StudentAssessmentMapping> existingMapping = studentAssessmentMappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(
                            userStudent.getUserStudentId(), assessmentId);
            if (existingMapping.isPresent()) {
                Map<String, Object> response = new HashMap<>();
                response.put("status", "already_registered");
                response.put("message", "You are already registered for this assessment.");
                return ResponseEntity.ok(response);
            }
        }

        // Not yet assigned — proceed with payment
        SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
        String dobStr = sdf.format(dob);
        return createPaymentAndRedirect(mappingId, assessmentId, instituteCode,
                finalAmountPaise, originalAmountPaise, promoCodeStr, promoDiscountPercent,
                name, email, dob, dobStr, phone, null);
    }

    /**
     * Handle assigning assessment to an existing student.
     */
    private ResponseEntity<?> handleExistingStudent(StudentInfo existingStudentInfo, Long assessmentId,
            Integer instituteCode) {
        // Find UserStudent for this student
        List<UserStudent> userStudents = userStudentRepository.findByStudentInfoId(existingStudentInfo.getId());
        if (userStudents.isEmpty()) {
            // Student exists but no UserStudent — create one
            InstituteDetail institute = instituteDetailRepository.findById(instituteCode.intValue());
            User existingUser = existingStudentInfo.getUser();
            if (existingUser == null) {
                // Edge case: StudentInfo exists but no User — create User
                existingUser = new User((int) (Math.random() * 100000), existingStudentInfo.getStudentDob());
                existingUser.setName(existingStudentInfo.getName());
                existingUser.setEmail(existingStudentInfo.getEmail());
                existingUser = userRepository.save(existingUser);

                // Generate and set careerNineRollNumber
                String edgeRollNumber = rollNumberService.generateNextRollNumber(
                        instituteCode, existingStudentInfo.getSchoolSectionId());
                if (edgeRollNumber != null) {
                    existingUser.setCareerNineRollNumber(edgeRollNumber);
                    existingUser = userRepository.save(existingUser);
                }

                existingStudentInfo.setUser(existingUser);
                studentInfoRepository.save(existingStudentInfo);
            }
            UserStudent newUs = new UserStudent(existingUser, existingStudentInfo, institute);
            newUs = userStudentRepository.save(newUs);
            userStudents = List.of(newUs);
        }

        UserStudent userStudent = userStudents.get(0);

        // Check if already assigned
        Optional<StudentAssessmentMapping> existingMapping = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(
                        userStudent.getUserStudentId(), assessmentId);

        Map<String, Object> response = new HashMap<>();
        if (existingMapping.isPresent()) {
            response.put("status", "already_registered");
            response.put("message", "You are already registered for this assessment.");
        } else {
            // Assign assessment
            StudentAssessmentMapping sam = new StudentAssessmentMapping(
                    userStudent.getUserStudentId(), assessmentId);
            studentAssessmentMappingRepository.save(sam);
            response.put("status", "success");
            response.put("message", "Assessment assigned successfully. Please use your existing credentials to log in.");
        }

        // Include login credentials
        User user = existingStudentInfo.getUser();
        if (user != null) {
            response.put("username", user.getUsername());
            SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
            String dobFormatted = user.getDobDate() != null ? sdf.format(user.getDobDate()) : "";
            response.put("dob", dobFormatted);

            // Send email for newly assigned assessments (not already registered)
            if (!"already_registered".equals(response.get("status")) && existingStudentInfo.getEmail() != null) {
                String assessmentName = assessmentTableRepository.findById(assessmentId)
                        .map(a -> a.getAssessmentName()).orElse("Assessment");
                sendRegistrationEmail(existingStudentInfo.getEmail(), existingStudentInfo.getName(),
                        user.getUsername(), dobFormatted, assessmentName);
            }
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Send registration confirmation email with login credentials.
     */
    private void sendRegistrationEmail(String toEmail, String studentName, String username, String dob, String assessmentName) {
        try {
            String subject = "Registration Successful - " + assessmentName;
            String htmlContent = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                    + "<div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                    + "<h2 style='margin: 0;'>Registration Successful!</h2>"
                    + "</div>"
                    + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                    + "<p>Dear <strong>" + studentName + "</strong>,</p>"
                    + "<p>You have been successfully registered for <strong>" + assessmentName + "</strong>.</p>"
                    + "<p>Here are your login credentials:</p>"
                    + "<div style='background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;'>"
                    + "<p style='margin: 4px 0;'><strong>Username:</strong> <span style='color: #667eea; font-size: 1.1em;'>" + username + "</span></p>"
                    + "<p style='margin: 4px 0;'><strong>Password:</strong> <span style='color: #667eea; font-size: 1.1em;'>" + dob + "</span> (Your Date of Birth)</p>"
                    + "</div>"
                    + "<p style='color: #666; font-size: 0.9em;'>Please save these credentials. You will need them to log in and take the assessment.</p>"
                    + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                    + "</div>"
                    + "</div>";

            gmailApiEmailService.sendHtmlEmail(toEmail, subject, htmlContent);
            logger.info("Registration email sent to: {}", toEmail);
        } catch (Exception e) {
            logger.error("Failed to send registration email to: {}. Error: {}", toEmail, e.getMessage(), e);
            // Don't fail registration if email fails
        }
    }

    /**
     * Parse class number from SchoolClasses ID.
     * Looks up the SchoolClasses entity and tries to parse className as an integer.
     */
    private Integer parseClassNumber(Integer classId) {
        if (classId == null) return null;
        try {
            Optional<SchoolClasses> classOpt = schoolClassesRepository.findById(classId);
            if (classOpt.isPresent()) {
                String className = classOpt.get().getClassName();
                // Try to parse as integer (e.g., "10", "12")
                return Integer.parseInt(className.replaceAll("[^0-9]", ""));
            }
        } catch (NumberFormatException e) {
            logger.warn("Could not parse class number from className for classId: {}", classId);
        }
        return classId; // fallback to the ID itself
    }
}
