package com.kccitm.api.controller.career9;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
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
import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.PromoCode;
import com.kccitm.api.model.career9.SchoolAssessmentConfig;
import com.kccitm.api.model.career9.SchoolRegistrationLink;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.model.career9.school.SchoolClasses;
import com.kccitm.api.model.career9.school.SchoolSections;
import com.kccitm.api.model.career9.school.SchoolSession;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.repository.Career9.PromoCodeRepository;
import com.kccitm.api.repository.Career9.SchoolAssessmentConfigRepository;
import com.kccitm.api.repository.Career9.SchoolRegistrationLinkRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.School.SchoolClassesRepository;
import com.kccitm.api.repository.Career9.School.SchoolSessionRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.service.CareerNineRollNumberService;
import com.kccitm.api.service.RazorpayService;
import com.kccitm.api.service.SmtpEmailService;

@RestController
@RequestMapping("/school-registration")
public class SchoolRegistrationController {

    private static final Logger logger = LoggerFactory.getLogger(SchoolRegistrationController.class);

    @Autowired private SchoolAssessmentConfigRepository configRepository;
    @Autowired private SchoolRegistrationLinkRepository linkRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private InstituteDetailRepository instituteDetailRepository;
    @Autowired private SchoolSessionRepository schoolSessionRepository;
    @Autowired private SchoolClassesRepository schoolClassesRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StudentInfoRepository studentInfoRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private StudentAssessmentMappingRepository studentAssessmentMappingRepository;
    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private PromoCodeRepository promoCodeRepository;
    @Autowired private RazorpayService razorpayService;
    @Autowired private SmtpEmailService emailService;
    @Autowired private CareerNineRollNumberService rollNumberService;

    @org.springframework.beans.factory.annotation.Value("${app.razorpay.callback-base-url:https://dashboard.career-9.com}")
    private String callbackBaseUrl;

    // ============ ADMIN ENDPOINTS ============

    @PostMapping("/config/create")
    public ResponseEntity<?> createConfig(@RequestBody Map<String, Object> data) {
        Integer instituteCode = (Integer) data.get("instituteCode");
        Integer sessionId = (Integer) data.get("sessionId");
        Integer classId = (Integer) data.get("classId");
        Long assessmentId = Long.valueOf(data.get("assessmentId").toString());
        Long amount = data.get("amount") != null ? Long.valueOf(data.get("amount").toString()) : null;

        // Upsert: update if exists, create if not
        Optional<SchoolAssessmentConfig> existing = configRepository
                .findByInstituteCodeAndSessionIdAndClassId(instituteCode, sessionId, classId);

        SchoolAssessmentConfig config;
        if (existing.isPresent()) {
            config = existing.get();
            config.setAssessmentId(assessmentId);
            config.setAmount(amount);
            config.setIsActive(true);
        } else {
            config = new SchoolAssessmentConfig();
            config.setInstituteCode(instituteCode);
            config.setSessionId(sessionId);
            config.setClassId(classId);
            config.setAssessmentId(assessmentId);
            config.setAmount(amount);
        }

        configRepository.save(config);
        return ResponseEntity.ok(config);
    }

    @PostMapping("/config/batch-save")
    public ResponseEntity<?> batchSaveConfigs(@RequestBody Map<String, Object> data) {
        Integer instituteCode = (Integer) data.get("instituteCode");
        Integer sessionId = (Integer) data.get("sessionId");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> configs = (List<Map<String, Object>>) data.get("configs");

        List<SchoolAssessmentConfig> saved = new ArrayList<>();
        for (Map<String, Object> c : configs) {
            Integer classId = Integer.valueOf(c.get("classId").toString());
            Long assessmentId = Long.valueOf(c.get("assessmentId").toString());
            Long amount = c.get("amount") != null ? Long.valueOf(c.get("amount").toString()) : null;

            Optional<SchoolAssessmentConfig> existing = configRepository
                    .findByInstituteCodeAndSessionIdAndClassId(instituteCode, sessionId, classId);

            SchoolAssessmentConfig config;
            if (existing.isPresent()) {
                config = existing.get();
                config.setAssessmentId(assessmentId);
                config.setAmount(amount);
                config.setIsActive(true);
            } else {
                config = new SchoolAssessmentConfig();
                config.setInstituteCode(instituteCode);
                config.setSessionId(sessionId);
                config.setClassId(classId);
                config.setAssessmentId(assessmentId);
                config.setAmount(amount);
            }
            saved.add(configRepository.save(config));
        }
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/config/by-institute/{instituteCode}/{sessionId}")
    public ResponseEntity<?> getConfigs(@PathVariable Integer instituteCode, @PathVariable Integer sessionId) {
        return ResponseEntity.ok(configRepository.findByInstituteCodeAndSessionIdOrderByClassIdAsc(instituteCode, sessionId));
    }

    @PutMapping("/config/update/{configId}")
    public ResponseEntity<?> updateConfig(@PathVariable Long configId, @RequestBody Map<String, Object> data) {
        Optional<SchoolAssessmentConfig> opt = configRepository.findById(configId);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();

        SchoolAssessmentConfig config = opt.get();
        if (data.containsKey("assessmentId")) config.setAssessmentId(Long.valueOf(data.get("assessmentId").toString()));
        if (data.containsKey("amount")) config.setAmount(data.get("amount") != null ? Long.valueOf(data.get("amount").toString()) : null);
        if (data.containsKey("isActive")) config.setIsActive((Boolean) data.get("isActive"));

        configRepository.save(config);
        return ResponseEntity.ok(config);
    }

    @DeleteMapping("/config/delete/{configId}")
    public ResponseEntity<?> deleteConfig(@PathVariable Long configId) {
        if (!configRepository.existsById(configId)) return ResponseEntity.notFound().build();
        configRepository.deleteById(configId);
        return ResponseEntity.ok("Deleted");
    }

    @PostMapping("/link/generate")
    public ResponseEntity<?> generateLink(@RequestBody Map<String, Object> data) {
        Integer instituteCode = (Integer) data.get("instituteCode");
        Integer sessionId = (Integer) data.get("sessionId");

        // Return existing link if already generated
        Optional<SchoolRegistrationLink> existing = linkRepository.findByInstituteCodeAndSessionId(instituteCode, sessionId);
        if (existing.isPresent()) {
            return ResponseEntity.ok(existing.get());
        }

        SchoolRegistrationLink link = new SchoolRegistrationLink();
        link.setInstituteCode(instituteCode);
        link.setSessionId(sessionId);
        link.setToken(UUID.randomUUID().toString());
        linkRepository.save(link);

        return ResponseEntity.ok(link);
    }

    @GetMapping("/link/by-institute/{instituteCode}/{sessionId}")
    public ResponseEntity<?> getLink(@PathVariable Integer instituteCode, @PathVariable Integer sessionId) {
        Optional<SchoolRegistrationLink> link = linkRepository.findByInstituteCodeAndSessionId(instituteCode, sessionId);
        return link.map(ResponseEntity::ok).orElse(ResponseEntity.ok().build());
    }

    @PutMapping("/link/toggle/{linkId}")
    public ResponseEntity<?> toggleLink(@PathVariable Long linkId) {
        Optional<SchoolRegistrationLink> opt = linkRepository.findById(linkId);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();

        SchoolRegistrationLink link = opt.get();
        link.setIsActive(!link.getIsActive());
        linkRepository.save(link);
        return ResponseEntity.ok(link);
    }

    // ============ PUBLIC ENDPOINTS ============

    @GetMapping("/public/info/{token}")
    public ResponseEntity<?> getSchoolInfo(@PathVariable String token) {
        Optional<SchoolRegistrationLink> linkOpt = linkRepository.findByTokenAndIsActive(token, true);
        if (!linkOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Invalid or expired registration link");
        }

        SchoolRegistrationLink link = linkOpt.get();
        Integer instituteCode = link.getInstituteCode();
        Integer sessionId = link.getSessionId();

        Map<String, Object> info = new HashMap<>();

        // Institute name
        InstituteDetail institute = instituteDetailRepository.findById(instituteCode.intValue());
        if (institute != null) {
            info.put("instituteName", institute.getInstituteName());
        }
        info.put("instituteCode", instituteCode);
        info.put("sessionId", sessionId);

        // Session year
        schoolSessionRepository.findById(sessionId).ifPresent(session -> {
            info.put("sessionYear", session.getSessionYear());
        });

        // Build class list with assessment + amount + sections
        List<SchoolAssessmentConfig> configs = configRepository
                .findByInstituteCodeAndSessionIdAndIsActiveTrue(instituteCode, sessionId);

        List<Map<String, Object>> classes = new ArrayList<>();
        for (SchoolAssessmentConfig config : configs) {
            Map<String, Object> classInfo = new HashMap<>();
            classInfo.put("classId", config.getClassId());
            classInfo.put("assessmentId", config.getAssessmentId());
            classInfo.put("amount", config.getAmount() != null ? config.getAmount() : 0);

            // Class name
            schoolClassesRepository.findById(config.getClassId()).ifPresent(sc -> {
                classInfo.put("className", sc.getClassName());

                // Sections for this class
                List<SchoolSections> sections = sc.getSchoolSections();
                List<Map<String, Object>> sectionList = new ArrayList<>();
                if (sections != null) {
                    for (SchoolSections sec : sections) {
                        Map<String, Object> secMap = new HashMap<>();
                        secMap.put("sectionId", sec.getId());
                        secMap.put("sectionName", sec.getSectionName());
                        sectionList.add(secMap);
                    }
                }
                classInfo.put("sections", sectionList);
            });

            // Assessment name
            assessmentTableRepository.findById(config.getAssessmentId()).ifPresent(a -> {
                classInfo.put("assessmentName", a.getAssessmentName());
            });

            classes.add(classInfo);
        }

        info.put("classes", classes);
        return ResponseEntity.ok(info);
    }

    @PostMapping("/public/register/{token}")
    @Transactional
    public ResponseEntity<?> registerStudent(@PathVariable String token,
            @RequestBody Map<String, Object> studentData) {

        // 1. Validate token
        Optional<SchoolRegistrationLink> linkOpt = linkRepository.findByTokenAndIsActive(token, true);
        if (!linkOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Invalid or expired registration link");
        }

        SchoolRegistrationLink link = linkOpt.get();
        Integer instituteCode = link.getInstituteCode();
        Integer sessionId = link.getSessionId();

        // 2. Extract student data
        String name = (String) studentData.get("name");
        String email = (String) studentData.get("email");
        String dobStr = (String) studentData.get("dob");
        String phone = (String) studentData.get("phone");
        String gender = (String) studentData.get("gender");
        Integer classId = studentData.get("classId") != null ? Integer.valueOf(studentData.get("classId").toString()) : null;
        Integer schoolSectionId = studentData.get("schoolSectionId") != null ? Integer.valueOf(studentData.get("schoolSectionId").toString()) : null;

        if (name == null || email == null || dobStr == null || classId == null) {
            return ResponseEntity.badRequest().body("Name, email, date of birth, and class are required");
        }

        // 3. Parse DOB
        SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
        Date dob;
        try {
            dob = sdf.parse(dobStr);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Invalid date format. Use dd-MM-yyyy");
        }

        // 4. Find config for this class → get assessmentId + amount
        Optional<SchoolAssessmentConfig> configOpt = configRepository
                .findByInstituteCodeAndSessionIdAndClassId(instituteCode, sessionId, classId);
        if (!configOpt.isPresent()) {
            return ResponseEntity.badRequest().body("No assessment mapped for the selected class");
        }

        SchoolAssessmentConfig config = configOpt.get();
        Long assessmentId = config.getAssessmentId();
        Long mappingAmount = config.getAmount();
        boolean paymentRequired = mappingAmount != null && mappingAmount > 0;

        // 5. Parse student class number (BUG FIX: always set studentClass)
        Integer studentClass = parseClassNumber(classId);

        // 6. Promo code handling
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

            promo.setCurrentUses(promo.getCurrentUses() + 1);
            promoCodeRepository.save(promo);
        }

        // 7. Duplicate check by email
        List<StudentInfo> byEmail = studentInfoRepository.findByEmailAndInstituteId(email, instituteCode);
        if (!byEmail.isEmpty()) {
            if (paymentRequired && finalAmount > 0) {
                return handleExistingStudentWithPayment(byEmail.get(0), assessmentId, instituteCode,
                        config.getConfigId(), finalAmount, originalAmount, promoCodeStr, promoDiscountPercent,
                        name, email, dob, phone);
            }
            return handleExistingStudent(byEmail.get(0), assessmentId, instituteCode);
        }

        // 8. Duplicate check by DOB + institute + class + name
        if (studentClass != null) {
            List<StudentInfo> byDob = studentInfoRepository
                    .findByStudentDobAndInstituteIdAndStudentClassAndNameIgnoreCase(dob, instituteCode, studentClass, name);
            if (!byDob.isEmpty()) {
                if (paymentRequired && finalAmount > 0) {
                    return handleExistingStudentWithPayment(byDob.get(0), assessmentId, instituteCode,
                            config.getConfigId(), finalAmount, originalAmount, promoCodeStr, promoDiscountPercent,
                            name, email, dob, phone);
                }
                return handleExistingStudent(byDob.get(0), assessmentId, instituteCode);
            }
        }

        // 9. Payment required → create payment and redirect
        if (paymentRequired && finalAmount > 0) {
            return createPaymentAndRedirect(config.getConfigId(), assessmentId, instituteCode,
                    finalAmount, originalAmount, promoCodeStr, promoDiscountPercent,
                    name, email, dob, dobStr, phone, gender, classId, schoolSectionId, studentClass);
        }

        // 10. Free path (amount=0, or 100% promo discount)
        if (paymentRequired && finalAmount != null && finalAmount == 0 && promoCodeStr != null) {
            PaymentTransaction txn = new PaymentTransaction();
            txn.setSchoolConfigId(config.getConfigId());
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

        // 11. Create student
        User user = new User((int) (Math.random() * 100000), dob);
        user.setName(name);
        user.setEmail(email);
        user.setPhone(phone);
        user = userRepository.save(user);

        String rollNumber = rollNumberService.generateNextRollNumber(instituteCode, schoolSectionId);
        if (rollNumber != null) {
            user.setCareerNineRollNumber(rollNumber);
            user = userRepository.save(user);
        }

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

        InstituteDetail institute = instituteDetailRepository.findById(instituteCode.intValue());
        UserStudent userStudent = new UserStudent(user, studentInfo, institute);
        userStudent = userStudentRepository.save(userStudent);

        StudentAssessmentMapping sam = new StudentAssessmentMapping(
                userStudent.getUserStudentId(), assessmentId);
        studentAssessmentMappingRepository.save(sam);

        // 12. Build response + send email
        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Registration successful! Please save your login credentials.");
        response.put("username", user.getUsername());
        response.put("dob", dobStr);

        String assessmentName = assessmentTableRepository.findById(assessmentId)
                .map(a -> a.getAssessmentName()).orElse("Assessment");
        sendRegistrationEmail(email, name, user.getUsername(), dobStr, assessmentName);

        return ResponseEntity.ok(response);
    }

    // ============ PRIVATE HELPERS ============

    private ResponseEntity<?> createPaymentAndRedirect(Long schoolConfigId, Long assessmentId, Integer instituteCode,
            Long finalAmountPaise, Long originalAmountPaise, String promoCodeStr, Integer promoDiscountPercent,
            String name, String email, Date dob, String dobStr, String phone, String gender,
            Integer classId, Integer schoolSectionId, Integer studentClass) {
        try {
            String assessmentName = assessmentTableRepository.findById(assessmentId)
                    .map(a -> a.getAssessmentName()).orElse("Assessment");

            String callbackUrl = callbackBaseUrl + "/payment-status";
            String referenceId = "SCHOOL-" + schoolConfigId + "-" + System.currentTimeMillis();

            Map<String, String> notes = new HashMap<>();
            notes.put("schoolConfigId", String.valueOf(schoolConfigId));
            notes.put("assessmentId", String.valueOf(assessmentId));
            notes.put("instituteCode", String.valueOf(instituteCode));
            notes.put("studentEmail", email);
            notes.put("studentName", name);
            notes.put("classId", String.valueOf(classId));
            if (schoolSectionId != null) notes.put("schoolSectionId", String.valueOf(schoolSectionId));
            if (studentClass != null) notes.put("studentClass", String.valueOf(studentClass));

            // BUG FIX: use correct key names from RazorpayService response
            Map<String, String> rzpResponse = razorpayService.createPaymentLink(
                    finalAmountPaise, "INR", assessmentName + " - Payment",
                    callbackUrl, referenceId, notes);

            PaymentTransaction txn = new PaymentTransaction();
            txn.setSchoolConfigId(schoolConfigId);
            txn.setAmount(finalAmountPaise);
            txn.setOriginalAmount(originalAmountPaise);
            txn.setAssessmentId(assessmentId);
            txn.setInstituteCode(instituteCode);
            txn.setStudentName(name);
            txn.setStudentEmail(email);
            txn.setStudentDob(dob);
            txn.setStudentPhone(phone);
            // BUG FIX: use "linkId" and "shortUrl" (not "id" / "short_url")
            txn.setRazorpayLinkId(rzpResponse.get("linkId"));
            txn.setPaymentLinkUrl(rzpResponse.get("shortUrl"));
            txn.setShortUrl(rzpResponse.get("shortUrl"));
            txn.setStatus("created");

            if (promoCodeStr != null && !promoCodeStr.trim().isEmpty()) {
                txn.setPromoCode(promoCodeStr.trim().toUpperCase());
                txn.setPromoDiscountPercent(promoDiscountPercent);
            }

            paymentTransactionRepository.save(txn);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "payment_required");
            // BUG FIX: use correct key
            response.put("paymentUrl", rzpResponse.get("shortUrl"));
            response.put("transactionId", txn.getTransactionId());
            response.put("amount", finalAmountPaise);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to create payment link: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to create payment link. Please try again.");
        }
    }

    private ResponseEntity<?> handleExistingStudentWithPayment(StudentInfo existingStudentInfo, Long assessmentId,
            Integer instituteCode, Long schoolConfigId, Long finalAmountPaise, Long originalAmountPaise,
            String promoCodeStr, Integer promoDiscountPercent,
            String name, String email, Date dob, String phone) {
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

        SimpleDateFormat sdfFmt = new SimpleDateFormat("dd-MM-yyyy");
        String dobStr = sdfFmt.format(dob);
        return createPaymentAndRedirect(schoolConfigId, assessmentId, instituteCode,
                finalAmountPaise, originalAmountPaise, promoCodeStr, promoDiscountPercent,
                name, email, dob, dobStr, phone, null, null, null, null);
    }

    private ResponseEntity<?> handleExistingStudent(StudentInfo existingStudentInfo, Long assessmentId,
            Integer instituteCode) {
        List<UserStudent> userStudents = userStudentRepository.findByStudentInfoId(existingStudentInfo.getId());
        if (userStudents.isEmpty()) {
            InstituteDetail institute = instituteDetailRepository.findById(instituteCode.intValue());
            User existingUser = existingStudentInfo.getUser();
            if (existingUser == null) {
                existingUser = new User((int) (Math.random() * 100000), existingStudentInfo.getStudentDob());
                existingUser.setName(existingStudentInfo.getName());
                existingUser.setEmail(existingStudentInfo.getEmail());
                existingUser = userRepository.save(existingUser);
                existingStudentInfo.setUser(existingUser);
                studentInfoRepository.save(existingStudentInfo);
            }
            UserStudent newUs = new UserStudent(existingUser, existingStudentInfo, institute);
            newUs = userStudentRepository.save(newUs);
            userStudents = List.of(newUs);
        }

        UserStudent userStudent = userStudents.get(0);
        Optional<StudentAssessmentMapping> existingMapping = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(
                        userStudent.getUserStudentId(), assessmentId);

        Map<String, Object> response = new HashMap<>();
        if (existingMapping.isPresent()) {
            response.put("status", "already_registered");
            response.put("message", "You are already registered for this assessment.");
        } else {
            StudentAssessmentMapping sam = new StudentAssessmentMapping(
                    userStudent.getUserStudentId(), assessmentId);
            studentAssessmentMappingRepository.save(sam);
            response.put("status", "success");
            response.put("message", "Assessment assigned successfully. Please use your existing credentials to log in.");
        }

        User user = existingStudentInfo.getUser();
        if (user != null) {
            response.put("username", user.getUsername());
            SimpleDateFormat sdfFmt = new SimpleDateFormat("dd-MM-yyyy");
            String dobFormatted = user.getDobDate() != null ? sdfFmt.format(user.getDobDate()) : "";
            response.put("dob", dobFormatted);

            if (!"already_registered".equals(response.get("status")) && existingStudentInfo.getEmail() != null) {
                String assessmentName = assessmentTableRepository.findById(assessmentId)
                        .map(a -> a.getAssessmentName()).orElse("Assessment");
                sendRegistrationEmail(existingStudentInfo.getEmail(), existingStudentInfo.getName(),
                        user.getUsername(), dobFormatted, assessmentName);
            }
        }

        return ResponseEntity.ok(response);
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

    private void sendRegistrationEmail(String toEmail, String studentName, String username, String dob, String assessmentName) {
        try {
            String subject = "Registration Successful - " + assessmentName;
            String htmlContent = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                    + "<div style='background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                    + "<h2 style='margin: 0;'>Registration Successful!</h2>"
                    + "</div>"
                    + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                    + "<p>Dear <strong>" + escapeHtml(studentName) + "</strong>,</p>"
                    + "<p>You have been successfully registered for <strong>" + escapeHtml(assessmentName) + "</strong>.</p>"
                    + "<p>Here are your login credentials:</p>"
                    + "<div style='background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;'>"
                    + "<p style='margin: 4px 0;'><strong>Username:</strong> <span style='color: #059669; font-size: 1.1em;'>" + escapeHtml(username) + "</span></p>"
                    + "<p style='margin: 4px 0;'><strong>Password:</strong> <span style='color: #059669; font-size: 1.1em;'>" + escapeHtml(dob) + "</span> (Your Date of Birth)</p>"
                    + "</div>"
                    + "<p style='color: #666; font-size: 0.9em;'>Please save these credentials. You will need them to log in and take the assessment.</p>"
                    + "<div style='text-align: center; margin: 24px 0;'>"
                    + "<a href='https://assessment.career-9.com/' style='display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1em;'>Go To Assessment</a>"
                    + "</div>"
                    + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                    + "</div></div>";

            emailService.sendHtmlEmail(toEmail, subject, htmlContent);
            logger.info("Registration email sent to: {}", toEmail);
        } catch (Exception e) {
            logger.error("Failed to send registration email to: {}. Error: {}", toEmail, e.getMessage(), e);
        }
    }

    private String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
