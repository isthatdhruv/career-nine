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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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
import com.kccitm.api.model.career9.SchoolAssessmentTier;
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
import com.kccitm.api.repository.Career9.SchoolAssessmentTierRepository;
import com.kccitm.api.repository.Career9.SchoolRegistrationLinkRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.School.SchoolClassesRepository;
import com.kccitm.api.repository.Career9.School.SchoolSessionRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.service.branding.InstituteBrandingService;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.service.CareerNineRollNumberService;
import com.kccitm.api.service.RazorpayService;
import com.kccitm.api.service.SmtpEmailService;
import com.kccitm.api.service.StudentProvisioningService;
import com.kccitm.api.service.career9.AssessmentMappingTierService;
import com.kccitm.api.service.career9.InstituteAssessmentService;
import com.kccitm.api.service.b2c.EntitlementService;

@RestController
@RequestMapping("/school-registration")
public class SchoolRegistrationController {

    private static final Logger logger = LoggerFactory.getLogger(SchoolRegistrationController.class);

    @Autowired private SchoolAssessmentConfigRepository configRepository;
    @Autowired private SchoolAssessmentTierRepository schoolTierRepository;
    @Autowired private AssessmentMappingTierService tierService;
    @Autowired private SchoolRegistrationLinkRepository linkRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private InstituteDetailRepository instituteDetailRepository;
    @Autowired private InstituteBrandingService brandingService;
    @Autowired private SchoolSessionRepository schoolSessionRepository;
    @Autowired private SchoolClassesRepository schoolClassesRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StudentInfoRepository studentInfoRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private StudentAssessmentMappingRepository studentAssessmentMappingRepository;
    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private com.kccitm.api.service.PaymentTransactionWriter paymentTransactionWriter;
    @Autowired private PromoCodeRepository promoCodeRepository;
    @Autowired private RazorpayService razorpayService;
    @Autowired private SmtpEmailService emailService;
    @Autowired private CareerNineRollNumberService rollNumberService;
    @Autowired private StudentProvisioningService studentProvisioningService;
    @Autowired private com.kccitm.api.service.b2c.StudentInstituteMembershipService membershipService;
    @Autowired private InstituteAssessmentService instituteAssessmentService;
    @Autowired private EntitlementService entitlementService;

    @org.springframework.beans.factory.annotation.Value("${app.razorpay.callback-base-url:https://dashboard.career-9.com}")
    private String callbackBaseUrl;

    // ============ ADMIN ENDPOINTS ============

    // no scope arg: body is raw Map; admin-only config
    @PreAuthorize("@auth.allows('school_registration.create')")
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
        // Feed the institute_assessment catalog (SSOT) — every school write enrols the
        // assessment for the institute, idempotently, so both mapping areas converge here.
        instituteAssessmentService.ensure(instituteCode, assessmentId);
        return ResponseEntity.ok(config);
    }

    // no scope arg: body is raw Map; bulk admin-only config
    @PreAuthorize("@auth.allows('school_registration.create')")
    @PostMapping("/config/batch-save")
    public ResponseEntity<?> batchSaveConfigs(@RequestBody Map<String, Object> data) {
        Integer instituteCode = (Integer) data.get("instituteCode");
        Integer sessionId = (Integer) data.get("sessionId");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> configs = (List<Map<String, Object>>) data.get("configs");

        java.util.Set<Integer> submittedClassIds = new java.util.HashSet<>();
        for (Map<String, Object> c : configs) {
            Integer classId = Integer.valueOf(c.get("classId").toString());
            Object aidObj = c.get("assessmentId");
            // A cleared class ("-- No assessment --") is either dropped from the payload
            // or sent with a null assessmentId — either way leave it OUT of the submitted
            // set so the authoritative sweep below deactivates it (B4).
            if (aidObj == null || aidObj.toString().trim().isEmpty()) {
                continue;
            }
            Long assessmentId = Long.valueOf(aidObj.toString());
            Long amount = c.get("amount") != null ? Long.valueOf(c.get("amount").toString()) : null;
            submittedClassIds.add(classId);

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
            // Feed the institute_assessment catalog (SSOT) for each saved assessment.
            instituteAssessmentService.ensure(instituteCode, assessmentId);
        }

        // B4: batch-save is authoritative for (institute, session) — deactivate every
        // existing config whose class is absent from this batch, so "unmapping" a class
        // actually stops it being registrable (previously it stayed active + payable).
        for (SchoolAssessmentConfig existing :
                configRepository.findByInstituteCodeAndSessionIdOrderByClassIdAsc(instituteCode, sessionId)) {
            if (!submittedClassIds.contains(existing.getClassId()) && Boolean.TRUE.equals(existing.getIsActive())) {
                existing.setIsActive(false);
                configRepository.save(existing);
            }
        }
        return ResponseEntity.ok(
                configRepository.findByInstituteCodeAndSessionIdOrderByClassIdAsc(instituteCode, sessionId));
    }

    @PreAuthorize("@auth.allows('school_registration.read', #instituteCode, #sessionId, null, null)")
    @GetMapping("/config/by-institute/{instituteCode}/{sessionId}")
    public ResponseEntity<?> getConfigs(@PathVariable Integer instituteCode, @PathVariable Integer sessionId) {
        return ResponseEntity.ok(configRepository.findByInstituteCodeAndSessionIdOrderByClassIdAsc(instituteCode, sessionId));
    }

    // no scope arg: update by configId; scope-filter narrows access
    @PreAuthorize("@auth.allows('school_registration.update')")
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

    // no scope arg: delete by configId; scope-filter narrows access
    @PreAuthorize("@auth.allows('school_registration.delete')")
    @DeleteMapping("/config/delete/{configId}")
    public ResponseEntity<?> deleteConfig(@PathVariable Long configId) {
        if (!configRepository.existsById(configId)) return ResponseEntity.notFound().build();
        configRepository.deleteById(configId);
        return ResponseEntity.ok("Deleted");
    }

    // no scope arg: body is raw Map; admin-only link generation
    @PreAuthorize("@auth.allows('school_registration.create')")
    @PostMapping("/link/generate")
    public ResponseEntity<?> generateLink(@RequestBody Map<String, Object> data) {
        Integer instituteCode = (Integer) data.get("instituteCode");
        Integer sessionId = (Integer) data.get("sessionId");
        Integer maxRegistrations = data.get("maxRegistrations") != null
                ? Integer.valueOf(data.get("maxRegistrations").toString())
                : 0;

        // Return existing link if already generated
        Optional<SchoolRegistrationLink> existing = linkRepository.findByInstituteCodeAndSessionId(instituteCode, sessionId);
        if (existing.isPresent()) {
            return ResponseEntity.ok(existing.get());
        }

        SchoolRegistrationLink link = new SchoolRegistrationLink();
        link.setInstituteCode(instituteCode);
        link.setSessionId(sessionId);
        link.setToken(UUID.randomUUID().toString());
        link.setMaxRegistrations(maxRegistrations);
        linkRepository.save(link);

        return ResponseEntity.ok(link);
    }

    @PreAuthorize("@auth.allows('school_registration.read', #instituteCode, #sessionId, null, null)")
    @GetMapping("/link/by-institute/{instituteCode}/{sessionId}")
    public ResponseEntity<?> getLink(@PathVariable Integer instituteCode, @PathVariable Integer sessionId) {
        Optional<SchoolRegistrationLink> link = linkRepository.findByInstituteCodeAndSessionId(instituteCode, sessionId);
        return link.map(ResponseEntity::ok).orElse(ResponseEntity.ok().build());
    }

    // no scope arg: update by linkId; scope-filter narrows access
    @PreAuthorize("@auth.allows('school_registration.update')")
    @PutMapping("/link/toggle/{linkId}")
    public ResponseEntity<?> toggleLink(@PathVariable Long linkId) {
        Optional<SchoolRegistrationLink> opt = linkRepository.findById(linkId);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();

        SchoolRegistrationLink link = opt.get();
        link.setIsActive(!link.getIsActive());
        linkRepository.save(link);
        return ResponseEntity.ok(link);
    }

    // no scope arg: update by linkId; scope-filter narrows access
    @PreAuthorize("@auth.allows('school_registration.update')")
    @PutMapping("/link/{linkId}/max-registrations")
    public ResponseEntity<?> updateMaxRegistrations(@PathVariable Long linkId, @RequestBody Map<String, Object> data) {
        Optional<SchoolRegistrationLink> opt = linkRepository.findById(linkId);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();

        Integer maxRegistrations = data.get("maxRegistrations") != null
                ? Integer.valueOf(data.get("maxRegistrations").toString())
                : 0;
        if (maxRegistrations < 0) {
            return ResponseEntity.badRequest().body("maxRegistrations cannot be negative");
        }

        SchoolRegistrationLink link = opt.get();
        link.setMaxRegistrations(maxRegistrations);
        linkRepository.save(link);
        return ResponseEntity.ok(link);
    }

    // ============ PRICING-TIER ENDPOINTS (per assessment, per session) ============

    @PreAuthorize("@auth.allows('school_registration.read', #instituteCode, #sessionId, null, null)")
    @GetMapping("/tiers/{instituteCode}/{sessionId}/{assessmentId}")
    public ResponseEntity<?> listSchoolTiers(@PathVariable Long instituteCode,
            @PathVariable Long sessionId, @PathVariable Long assessmentId) {
        return ResponseEntity.ok(schoolTierRepository
                .findByInstituteCodeAndSessionIdAndAssessmentIdOrderBySortOrderAsc(
                        instituteCode, sessionId, assessmentId));
    }

    @PreAuthorize("@auth.allows('school_registration.create')")
    @PostMapping("/tiers/{instituteCode}/{sessionId}/{assessmentId}")
    public ResponseEntity<?> createSchoolTier(@PathVariable Long instituteCode,
            @PathVariable Long sessionId, @PathVariable Long assessmentId,
            @RequestBody SchoolAssessmentTier tier) {
        if (tier.getName() == null || tier.getName().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Tier name is required");
        }
        if (tier.getDescription() == null || tier.getDescription().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Tier description is required");
        }
        if (tier.getDescription().trim().length() > 200) {
            return ResponseEntity.badRequest().body("Tier description must be 200 characters or fewer");
        }
        if (tier.getSortOrder() == null) {
            return ResponseEntity.badRequest().body("Sort order is required");
        }
        tier.setName(tier.getName().trim());
        tier.setDescription(tier.getDescription().trim());
        tier.setInstituteCode(instituteCode);
        tier.setSessionId(sessionId);
        tier.setAssessmentId(assessmentId);
        tier.setCurrentCount(0);
        return ResponseEntity.ok(schoolTierRepository.save(tier));
    }

    @PreAuthorize("@auth.allows('school_registration.update')")
    @PutMapping("/tiers/{tierId}")
    public ResponseEntity<?> updateSchoolTier(@PathVariable Long tierId,
            @RequestBody SchoolAssessmentTier updated) {
        Optional<SchoolAssessmentTier> existingOpt = schoolTierRepository.findById(tierId);
        if (!existingOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        SchoolAssessmentTier existing = existingOpt.get();
        if (updated.getName() != null) {
            String trimmed = updated.getName().trim();
            if (trimmed.isEmpty()) {
                return ResponseEntity.badRequest().body("Tier name is required");
            }
            existing.setName(trimmed);
        }
        if (updated.getDescription() != null) {
            String trimmed = updated.getDescription().trim();
            if (trimmed.isEmpty()) {
                return ResponseEntity.badRequest().body("Tier description is required");
            }
            if (trimmed.length() > 200) {
                return ResponseEntity.badRequest().body("Tier description must be 200 characters or fewer");
            }
            existing.setDescription(trimmed);
        }
        boolean priceChanged = updated.getAmount() != null
                && !updated.getAmount().equals(existing.getAmount());
        if (updated.getAmount() != null) existing.setAmount(updated.getAmount());
        if (updated.getSortOrder() != null) existing.setSortOrder(updated.getSortOrder());
        // maxRegistrations is nullable-meaningful: always copy it through
        existing.setMaxRegistrations(updated.getMaxRegistrations());
        if (updated.getIsActive() != null) existing.setIsActive(updated.getIsActive());
        // Service inclusions — copy through on every full-object PUT (booleans coerced
        // non-null; validity/count nullable = not configured / unlimited window).
        existing.setIncludesFinalReport(Boolean.TRUE.equals(updated.getIncludesFinalReport()));
        existing.setIncludesDashboard(Boolean.TRUE.equals(updated.getIncludesDashboard()));
        existing.setDashboardValidityDays(updated.getDashboardValidityDays());
        existing.setIncludesCounselling(Boolean.TRUE.equals(updated.getIncludesCounselling()));
        existing.setCounsellingSessionCount(updated.getCounsellingSessionCount());
        existing.setIncludesLms(Boolean.TRUE.equals(updated.getIncludesLms()));
        existing.setLmsValidityDays(updated.getLmsValidityDays());
        SchoolAssessmentTier saved = schoolTierRepository.save(existing);

        // A price change must not leave already-issued links payable at the old amount.
        // Cancel every outstanding "created" school link for this institute + assessment
        // so students are forced onto a freshly-priced link on their next attempt.
        if (priceChanged) {
            List<PaymentTransaction> outstanding = paymentTransactionRepository
                    .findByAssessmentIdOrderByCreatedAtDesc(saved.getAssessmentId());
            // Cancel only links priced under THIS tier. Each school txn stamps the tier id in
            // mappingTierId, so scoping by it avoids cancelling in-flight payments for other
            // sessions/classes of the same institute that share this assessment.
            outstanding.removeIf(t -> t.getSchoolConfigId() == null
                    || t.getMappingTierId() == null
                    || !t.getMappingTierId().equals(saved.getTierId()));
            cancelOutstandingLinks(outstanding);
        }
        return ResponseEntity.ok(saved);
    }

    @PreAuthorize("@auth.allows('school_registration.update')")
    @PatchMapping("/tiers/{tierId}/toggle")
    public ResponseEntity<?> toggleSchoolTier(@PathVariable Long tierId) {
        Optional<SchoolAssessmentTier> existingOpt = schoolTierRepository.findById(tierId);
        if (!existingOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        SchoolAssessmentTier existing = existingOpt.get();
        existing.setIsActive(!Boolean.TRUE.equals(existing.getIsActive()));
        return ResponseEntity.ok(schoolTierRepository.save(existing));
    }

    @PreAuthorize("@auth.allows('school_registration.delete')")
    @DeleteMapping("/tiers/{tierId}")
    public ResponseEntity<?> deleteSchoolTier(@PathVariable Long tierId) {
        if (!schoolTierRepository.existsById(tierId)) {
            return ResponseEntity.notFound().build();
        }
        schoolTierRepository.deleteById(tierId);
        return ResponseEntity.ok("Tier deleted successfully");
    }

    @PreAuthorize("@auth.allows('school_registration.update')")
    @PostMapping("/tiers/{tierId}/recount")
    public ResponseEntity<?> recountSchoolTier(@PathVariable Long tierId) {
        if (!schoolTierRepository.existsById(tierId)) {
            return ResponseEntity.notFound().build();
        }
        int newCount = tierService.recountSchoolTier(tierId);
        Map<String, Object> response = new HashMap<>();
        response.put("tierId", tierId);
        response.put("currentCount", newCount);
        return ResponseEntity.ok(response);
    }

    // ============ PUBLIC ENDPOINTS ============

    // Truly public (parity with Area A's /assessment-mapping/public/**): @PreAuthorize
    // removed so the enforce flip won't 403 the anonymous student; permitAll + CSRF-exempt
    // via PUBLIC_PATHS (/school-registration/public/**). The path token is the gate.
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
        info.put("branding", brandingService.forInstitute(institute));
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

            // Pricing comes from the active tier for this (institute, session, assessment).
            // No active tier → registration closed for that class.
            SchoolAssessmentTier activeTier = tierService.resolveActiveTierForSchoolAssessment(
                    instituteCode.longValue(), sessionId.longValue(), config.getAssessmentId());
            if (activeTier != null) {
                classInfo.put("amount", activeTier.getAmount() != null ? activeTier.getAmount() : 0);
                classInfo.put("activeTierName", activeTier.getName());
                classInfo.put("activeTierDescription", activeTier.getDescription());
                classInfo.put("registrationClosed", false);
            } else {
                classInfo.put("amount", 0);
                classInfo.put("registrationClosed", true);
            }

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

    // Truly public (parity with Area A): @PreAuthorize removed; permitAll + CSRF-exempt
    // via PUBLIC_PATHS. The path token is the gate.
    @PostMapping("/public/verify-details/{token}")
    public ResponseEntity<?> verifyDetails(@PathVariable String token,
            @RequestBody Map<String, Object> body) {

        Optional<SchoolRegistrationLink> linkOpt = linkRepository.findByTokenAndIsActive(token, true);
        if (!linkOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Invalid or expired registration link");
        }

        Integer instituteCode = linkOpt.get().getInstituteCode();
        String email = body.get("email") != null ? ((String) body.get("email")).trim() : null;
        String phone = body.get("phone") != null ? ((String) body.get("phone")).trim() : null;
        String dobStr = body.get("dob") != null ? ((String) body.get("dob")).trim() : null;

        if (email == null || email.isEmpty() || phone == null || phone.isEmpty()
                || dobStr == null || dobStr.isEmpty()) {
            return ResponseEntity.badRequest().body("email, phone and dob are all required");
        }

        SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
        Date dob;
        try {
            dob = sdf.parse(dobStr);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Invalid date format. Use dd-MM-yyyy");
        }

        long dobDay = toDayKey(dob);
        logger.info("verify-details: institute={} email='{}' phone='{}' dob='{}' dobDayKey={}",
                instituteCode, email, phone, dobStr, dobDay);

        List<StudentInfo> emailCandidates = studentInfoRepository
                .findByEmailAndInstituteId(email, instituteCode);
        List<StudentInfo> phoneCandidates = studentInfoRepository
                .findByPhoneNumberAndInstituteId(phone, instituteCode);

        logger.info("verify-details: emailCandidates={} phoneCandidates={}",
                emailCandidates.size(), phoneCandidates.size());

        StudentInfo emailMatch = pickWithMatchingDob(emailCandidates, dobDay);
        StudentInfo phoneMatch = pickWithMatchingDob(phoneCandidates, dobDay);

        logger.info("verify-details: emailMatchId={} phoneMatchId={}",
                emailMatch != null ? emailMatch.getId() : null,
                phoneMatch != null ? phoneMatch.getId() : null);

        Map<String, Object> response = new HashMap<>();

        if (emailMatch != null && phoneMatch != null
                && emailMatch.getId().equals(phoneMatch.getId())) {
            response.put("status", "already_registered");
            putCredentials(response, emailMatch, dobStr);
            return ResponseEntity.ok(response);
        }

        StudentInfo partial = emailMatch != null ? emailMatch : phoneMatch;
        if (partial != null) {
            if (emailMatch != null && phoneMatch != null) {
                logger.warn("verify-details collision: email matches student {} and phone matches student {} "
                        + "in institute {} for dob {} — returning email match",
                        emailMatch.getId(), phoneMatch.getId(), instituteCode, dobStr);
            }
            response.put("status", "partial_match");
            putCredentials(response, partial, dobStr);
            return ResponseEntity.ok(response);
        }

        response.put("status", "no_match");
        return ResponseEntity.ok(response);
    }

    private StudentInfo pickWithMatchingDob(List<StudentInfo> candidates, long dobDay) {
        for (StudentInfo si : candidates) {
            if (si.getStudentDob() != null && toDayKey(si.getStudentDob()) == dobDay) {
                return si;
            }
        }
        return null;
    }

    private long toDayKey(Date date) {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.setTime(date);
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0);
        cal.set(java.util.Calendar.MINUTE, 0);
        cal.set(java.util.Calendar.SECOND, 0);
        cal.set(java.util.Calendar.MILLISECOND, 0);
        return cal.getTimeInMillis() / 86400000L;
    }

    private void putCredentials(Map<String, Object> response, StudentInfo si, String dobStr) {
        User user = si.getUser();
        if (user != null && user.getUsername() != null) {
            response.put("username", user.getUsername());
        }
        response.put("dob", dobStr);
    }

    // Truly public (parity with Area A): @PreAuthorize removed; permitAll + CSRF-exempt
    // via PUBLIC_PATHS. The path token is the gate.
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

        if (name == null || email == null || dobStr == null || classId == null
                || phone == null || phone.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Name, email, phone, date of birth, and class are required");
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
        // A deactivated class config must not be registrable even if a client posts its classId
        // directly (getSchoolInfo hides it, but the register action has to enforce the flag too).
        if (!Boolean.TRUE.equals(config.getIsActive())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Registration is closed for the selected class");
        }
        Long assessmentId = config.getAssessmentId();

        // 4b. Resolve active pricing tier for this assessment. No active tier → registration closed.
        SchoolAssessmentTier activeTier = tierService.resolveActiveTierForSchoolAssessment(
                instituteCode.longValue(), sessionId.longValue(), assessmentId);
        if (activeTier == null) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Registration closed for this assessment");
        }
        Long activeTierId = activeTier.getTierId();
        Long mappingAmount = activeTier.getAmount() != null ? activeTier.getAmount() : 0L;
        boolean paymentRequired = mappingAmount > 0;

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
            // PROMO3: reject a discount outside [0,100].
            if (promoDiscountPercent == null || promoDiscountPercent < 0 || promoDiscountPercent > 100) {
                return ResponseEntity.badRequest().body("Promo code is misconfigured");
            }
            finalAmount = mappingAmount * (100 - promoDiscountPercent) / 100;
            // Integer (floor) division can drive a low price to 0 for a non-100% discount,
            // which would wrongly route the student onto the free path. Only a true 100%
            // discount (or a 0 base amount) may reach the free flow.
            if (promoDiscountPercent < 100 && finalAmount < 1L) {
                finalAmount = 1L;
            }
            // A1/A2: consumption deferred to realized redemption (paid webhook
            // success / free-commit) via atomic tryConsume — not burned here.
        }

        // 7. Duplicate check by email
        List<StudentInfo> byEmail = studentInfoRepository.findByEmailAndInstituteId(email, instituteCode);
        if (!byEmail.isEmpty()) {
            if (paymentRequired && finalAmount > 0) {
                return handleExistingStudentWithPayment(byEmail.get(0), assessmentId, instituteCode,
                        config.getConfigId(), activeTierId, finalAmount, originalAmount,
                        promoCodeStr, promoDiscountPercent,
                        name, email, dob, phone);
            }
            return handleExistingStudent(byEmail.get(0), assessmentId, instituteCode, activeTierId,
                    config.getConfigId(), originalAmount, promoCodeStr, promoDiscountPercent);
        }

        // 8. Duplicate check by DOB + institute + class + name
        if (studentClass != null) {
            List<StudentInfo> byDob = studentInfoRepository
                    .findByStudentDobAndInstituteIdAndStudentClassAndNameIgnoreCase(dob, instituteCode, studentClass, name);
            if (!byDob.isEmpty()) {
                if (paymentRequired && finalAmount > 0) {
                    return handleExistingStudentWithPayment(byDob.get(0), assessmentId, instituteCode,
                            config.getConfigId(), activeTierId, finalAmount, originalAmount,
                            promoCodeStr, promoDiscountPercent,
                            name, email, dob, phone);
                }
                return handleExistingStudent(byDob.get(0), assessmentId, instituteCode, activeTierId,
                        config.getConfigId(), originalAmount, promoCodeStr, promoDiscountPercent);
            }
        }

        // 9. Payment required → create payment and redirect
        if (paymentRequired && finalAmount > 0) {
            return createPaymentAndRedirect(config.getConfigId(), activeTierId, assessmentId, instituteCode,
                    finalAmount, originalAmount, promoCodeStr, promoDiscountPercent,
                    name, email, dob, dobStr, phone, gender, classId, schoolSectionId, studentClass);
        }

        // 10. Create student
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
        studentProvisioningService.provision(userStudent);
        // Write the institute-membership row so free-path students appear in the roster and are
        // manageable via the membership API (the paid webhook path already does this).
        membershipService.setPrimaryInstitute(userStudent, instituteCode, null, "school-free-provision");

        incrementSchoolTierCount(activeTierId);

        StudentAssessmentMapping sam = new StudentAssessmentMapping(
                userStudent.getUserStudentId(), assessmentId);
        studentAssessmentMappingRepository.save(sam);

        // Mint the school entitlement so this free student gets the tier's
        // report/dashboard/counselling/LMS services through the same gates as the
        // per-level B2B flow (a zero-amount "paid" txn is the ledger row + source).
        mintFreeSchoolEntitlement(userStudent.getUserStudentId(), assessmentId, instituteCode,
                config.getConfigId(), activeTierId, name, email, dob, phone,
                originalAmount, promoCodeStr, promoDiscountPercent);

        // A1: the free registration is now realized — consume the promo (atomic,
        // cap-guarded). No-op when no promo was applied.
        consumePromoIfPresent(promoCodeStr);

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

    /**
     * Per-tier atomic increment for the free-registration path. The tier resolver has already
     * verified there's capacity, but the update is guarded so a race that lost the last slot
     * is silently absorbed — the student still gets registered, the count just doesn't
     * over-shoot. recountSchoolTier() is the drift backstop.
     */
    private void incrementSchoolTierCount(Long tierId) {
        if (tierId == null) return;
        int rows = schoolTierRepository.tryIncrementCount(tierId);
        logger.info("School tier increment: tierId={}, rowsAffected={}", tierId, rows);
    }

    /**
     * Best-effort cancellation of outstanding unpaid Razorpay links. A Razorpay link is
     * an immutable price snapshot, so when a fresher link is issued (re-registration) or
     * the tier price changes, any still-"created" link must be cancelled — otherwise a
     * student can reopen an old link/email and pay the stale amount.
     *
     * <p>Only transactions our DB still considers "created" are touched, and a row is
     * marked "cancelled" locally only when the Razorpay cancel actually succeeds. A link
     * Razorpay reports as already paid/expired/cancelled simply fails the call (logged and
     * swallowed) and keeps its current local status, so a missed webhook can't be masked.
     */
    private void cancelOutstandingLinks(List<PaymentTransaction> txns) {
        for (PaymentTransaction t : txns) {
            if (!"created".equals(t.getStatus()) || t.getRazorpayLinkId() == null) continue;
            try {
                razorpayService.cancelPaymentLink(t.getRazorpayLinkId());
                t.setStatus("cancelled");
                paymentTransactionRepository.save(t);
            } catch (Exception e) {
                logger.warn("Could not cancel stale payment link {} (txn {}): {}",
                        t.getRazorpayLinkId(), t.getTransactionId(), e.getMessage());
            }
        }
    }

    private ResponseEntity<?> createPaymentAndRedirect(Long schoolConfigId, Long mappingTierId,
            Long assessmentId, Integer instituteCode,
            Long finalAmountInr, Long originalAmountInr, String promoCodeStr, Integer promoDiscountPercent,
            String name, String email, Date dob, String dobStr, String phone, String gender,
            Integer classId, Integer schoolSectionId, Integer studentClass) {
        try {
            String assessmentName = assessmentTableRepository.findById(assessmentId)
                    .map(a -> a.getAssessmentName()).orElse("Assessment");

            String callbackUrl = callbackBaseUrl + "/payment-status";

            // PAY1: commit a 'created' txn in its own transaction BEFORE the irreversible
            // Razorpay link call, so a recoverable DB record always exists first.
            PaymentTransaction txn = new PaymentTransaction();
            txn.setSchoolConfigId(schoolConfigId);
            txn.setMappingTierId(mappingTierId);
            txn.setAmount(finalAmountInr);
            txn.setOriginalAmount(originalAmountInr);
            txn.setAssessmentId(assessmentId);
            txn.setInstituteCode(instituteCode);
            txn.setStudentName(name);
            txn.setStudentEmail(email);
            txn.setStudentDob(dob);
            txn.setStudentPhone(phone);
            txn.setStatus("created");
            if (promoCodeStr != null && !promoCodeStr.trim().isEmpty()) {
                txn.setPromoCode(promoCodeStr.trim().toUpperCase());
                txn.setPromoDiscountPercent(promoDiscountPercent);
            }
            txn = paymentTransactionWriter.saveInNewTransaction(txn);

            String referenceId = "SCHOOL-" + schoolConfigId + "-" + txn.getTransactionId()
                    + "-" + java.util.UUID.randomUUID().toString().substring(0, 6);

            Map<String, String> notes = new HashMap<>();
            notes.put("schoolConfigId", String.valueOf(schoolConfigId));
            notes.put("assessmentId", String.valueOf(assessmentId));
            notes.put("instituteCode", String.valueOf(instituteCode));
            notes.put("studentEmail", email);
            notes.put("studentName", name);
            notes.put("classId", String.valueOf(classId));
            notes.put("transactionId", String.valueOf(txn.getTransactionId()));
            if (schoolSectionId != null) notes.put("schoolSectionId", String.valueOf(schoolSectionId));
            if (studentClass != null) notes.put("studentClass", String.valueOf(studentClass));

            Map<String, String> rzpResponse = razorpayService.createPaymentLink(
                    finalAmountInr, "INR", assessmentName + " - Payment",
                    callbackUrl, referenceId, notes);

            txn.setRazorpayLinkId(rzpResponse.get("linkId"));
            txn.setPaymentLinkUrl(rzpResponse.get("shortUrl"));
            txn.setShortUrl(rzpResponse.get("shortUrl"));
            txn = paymentTransactionWriter.saveInNewTransaction(txn);

            // The freshly-issued link is now the only one that should be payable. Kill any
            // older still-"created" links for this same student + assessment so a reopened
            // old link/email can't be paid at a stale price (Razorpay links are immutable
            // price snapshots — re-pricing only takes effect on a brand-new link).
            List<PaymentTransaction> prior = paymentTransactionRepository
                    .findByStudentEmailAndAssessmentId(email, assessmentId);
            final Long newTxnId = txn.getTransactionId();
            prior.removeIf(t -> t.getTransactionId().equals(newTxnId));
            cancelOutstandingLinks(prior);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "payment_required");
            // BUG FIX: use correct key
            response.put("paymentUrl", rzpResponse.get("shortUrl"));
            response.put("transactionId", txn.getTransactionId());
            response.put("amount", finalAmountInr);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to create payment link: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to create payment link. Please try again.");
        }
    }

    private ResponseEntity<?> handleExistingStudentWithPayment(StudentInfo existingStudentInfo, Long assessmentId,
            Integer instituteCode, Long schoolConfigId, Long mappingTierId,
            Long finalAmountInr, Long originalAmountInr,
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
        return createPaymentAndRedirect(schoolConfigId, mappingTierId, assessmentId, instituteCode,
                finalAmountInr, originalAmountInr, promoCodeStr, promoDiscountPercent,
                name, email, dob, dobStr, phone, null, null, null, null);
    }

    private ResponseEntity<?> handleExistingStudent(StudentInfo existingStudentInfo, Long assessmentId,
            Integer instituteCode, Long activeTierId, Long schoolConfigId,
            Long originalAmount, String promoCodeStr, Integer promoDiscountPercent) {
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
            studentProvisioningService.provision(newUs);
            membershipService.setPrimaryInstitute(newUs, instituteCode, null, "school-free-provision");
            incrementSchoolTierCount(activeTierId);
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
            // Grant the school entitlement for this newly-assigned assessment too.
            mintFreeSchoolEntitlement(userStudent.getUserStudentId(), assessmentId, instituteCode,
                    schoolConfigId, activeTierId,
                    existingStudentInfo.getName(), existingStudentInfo.getEmail(),
                    existingStudentInfo.getStudentDob(), existingStudentInfo.getPhoneNumber(),
                    originalAmount, promoCodeStr, promoDiscountPercent);
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

    /**
     * Mint (or top-up) the school StudentEntitlement for a FREE registration. Writes a
     * zero-amount "paid" PaymentTransaction (the ledger row AND the entitlement source,
     * mirroring the per-level free path) carrying school_config_id + the resolved tier id,
     * then grants the entitlement via the shared seam so the student receives the tier's
     * report/dashboard/counselling/LMS services. Always minted (even an all-false tier) —
     * the entitlement is the access record and the free→paid upgrade anchor.
     */
    private void mintFreeSchoolEntitlement(Long userStudentId, Long assessmentId, Integer instituteCode,
            Long schoolConfigId, Long activeTierId, String name, String email, Date dob, String phone,
            Long originalAmount, String promoCodeStr, Integer promoDiscountPercent) {
        if (userStudentId == null || activeTierId == null) return;
        PaymentTransaction txn = new PaymentTransaction();
        txn.setSchoolConfigId(schoolConfigId);
        txn.setMappingTierId(activeTierId);
        txn.setAmount(0L);
        txn.setOriginalAmount(originalAmount);
        if (promoCodeStr != null && !promoCodeStr.trim().isEmpty()) {
            txn.setPromoCode(promoCodeStr.trim().toUpperCase());
            txn.setPromoDiscountPercent(promoDiscountPercent);
        }
        txn.setStatus("paid");
        txn.setAssessmentId(assessmentId);
        txn.setInstituteCode(instituteCode);
        txn.setUserStudentId(userStudentId);
        txn.setStudentName(name);
        txn.setStudentEmail(email);
        txn.setStudentDob(dob);
        txn.setStudentPhone(phone);
        txn = paymentTransactionRepository.save(txn);
        entitlementService.activateSchoolOnPayment(txn.getTransactionId());
    }

    /** Atomically consume one promo use for a realized registration; no-op if absent/at-cap. */
    private void consumePromoIfPresent(String promoCode) {
        if (promoCode == null || promoCode.trim().isEmpty()) return;
        promoCodeRepository.findByCodeIgnoreCase(promoCode.trim().toUpperCase()).ifPresent(p -> {
            int rows = promoCodeRepository.tryConsume(p.getId());
            if (rows == 0) {
                logger.warn("Promo {} already at maxUses at redemption time — not consumed", promoCode);
            }
        });
    }

    private Integer parseClassNumber(Integer classId) {
        if (classId == null) return null;
        Optional<SchoolClasses> classOpt = schoolClassesRepository.findById(classId);
        if (classOpt.isPresent()) {
            String className = classOpt.get().getClassName();
            if (className != null) {
                String digits = className.replaceAll("[^0-9]", "");
                if (!digits.isEmpty()) {
                    try {
                        return Integer.parseInt(digits);
                    } catch (NumberFormatException e) {
                        logger.warn("Could not parse class number from className for classId: {}", classId);
                    }
                }
            }
        }
        // Never fall back to classId (a DB primary key) — that would corrupt studentClass.
        return null;
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
