package com.kccitm.api.controller.career9.b2c;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.PromoCode;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.b2c.Campaign;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentMapping;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentTier;
import com.kccitm.api.model.career9.b2c.CampaignClassAssessment;
import com.kccitm.api.model.career9.b2c.PricingTier;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.model.career9.counselling.CounsellingRequest;
import com.kccitm.api.model.career9.school.SchoolClasses;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.repository.Career9.PromoCodeRepository;
import com.kccitm.api.repository.Career9.School.SchoolClassesRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentTierRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignClassAssessmentRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignRepository;
import com.kccitm.api.repository.Career9.b2c.PricingTierRepository;
import com.kccitm.api.repository.Career9.b2c.PromoCodeCampaignRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.security.AuthCookieService;
import com.kccitm.api.security.TokenProvider;
import com.kccitm.api.service.RazorpayService;
import com.kccitm.api.service.StudentProvisioningService;
import com.kccitm.api.service.StudentSessionService;

import javax.servlet.http.HttpServletResponse;
import java.text.SimpleDateFormat;

@RestController
@RequestMapping("/campaign/public")
public class CampaignPublicController {

    private static final Logger logger = LoggerFactory.getLogger(CampaignPublicController.class);

    @Autowired private CampaignRepository campaignRepository;
    @Autowired private CampaignAssessmentMappingRepository mappingRepository;
    @Autowired private CampaignAssessmentTierRepository tierMappingRepository;
    @Autowired private CampaignClassAssessmentRepository classRouteRepository;
    @Autowired private SchoolClassesRepository schoolClassesRepository;
    @Autowired private PricingTierRepository pricingTierRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private PromoCodeRepository promoCodeRepository;
    @Autowired private PromoCodeCampaignRepository promoCodeCampaignRepository;
    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private com.kccitm.api.service.PaymentTransactionWriter paymentTransactionWriter;
    @Autowired private StudentInfoRepository studentInfoRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private com.kccitm.api.repository.InstituteDetailRepository instituteDetailRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private StudentAssessmentMappingRepository studentAssessmentMappingRepository;
    @Autowired private RazorpayService razorpayService;
    @Autowired private StudentSessionService studentSessionService;
    @Autowired private StudentProvisioningService studentProvisioningService;
    @Autowired private com.kccitm.api.service.b2c.StudentInstituteMembershipService membershipService;
    @Autowired(required = false) private com.kccitm.api.service.b2c.EntitlementService entitlementService;
    @Autowired(required = false) private com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository studentEntitlementRepository;
    @Autowired(required = false) private com.kccitm.api.service.b2c.LinkBuilder linkBuilder;
    @Autowired private AuthCookieService authCookieService;
    @Autowired private TokenProvider tokenProvider;
    @Autowired(required = false) private com.kccitm.api.service.counselling.BookingService bookingService;
    @Autowired(required = false) private com.kccitm.api.repository.Career9.counselling.CounsellingRequestRepository counsellingRequestRepository;
    // Optional: only present when app.email.provider=smtp. Guard for null before sending.
    @Autowired(required = false) private com.kccitm.api.service.SmtpEmailService smtpEmailService;

    // Where "forward my counselling request" notices go, and the address shown to
    // students on the thank-you page. Kept configurable; defaults to the canonical
    // public support inbox used elsewhere in the app.
    @org.springframework.beans.factory.annotation.Value("${app.support.email:support@career-9.net}")
    private String supportEmail;

    // Phase 3b — pay-before-book for EXTRA counselling sessions.
    // Fallback per-session price (INR) when the entitlement has no snapshotted price.
    @org.springframework.beans.factory.annotation.Value("${app.counselling.default-price:500}")
    private long counsellingDefaultPrice;
    // How long to hold the slot while the student completes payment (minutes).
    @org.springframework.beans.factory.annotation.Value("${app.counselling.pay-window-minutes:30}")
    private long counsellingPayWindowMinutes;
    @org.springframework.beans.factory.annotation.Value("${app.razorpay.callback-base-url:}")
    private String razorpayCallbackBaseUrl;

    @org.springframework.beans.factory.annotation.Value("${app.razorpay.callback-base-url:}")
    private String callbackBaseUrl;

    @org.springframework.beans.factory.annotation.Value("${app.auth.assessmentTokenExpirationMsec:14400000}")
    private long assessmentTokenExpirationMsec;

    // @PreAuthorize-Exempt: public b2c registration funnel — anonymous-by-design (entire controller)
    // See ControllerPreAuthorizeCoverageTest.EXCLUSIONS (15-02 / 15-06)
    @GetMapping("/info/{slug}")
    public ResponseEntity<?> infoBySlug(@PathVariable String slug) {
        return buildInfo(slug, null, null);
    }

    // @PreAuthorize-Exempt: public b2c registration funnel — anonymous-by-design (entire controller)
    // See ControllerPreAuthorizeCoverageTest.EXCLUSIONS (15-02 / 15-06)
    @GetMapping("/info/{slug}/{assessmentId}")
    public ResponseEntity<?> infoByAssessment(@PathVariable String slug,
                                              @PathVariable Long assessmentId) {
        return buildInfo(slug, assessmentId, null);
    }

    // @PreAuthorize-Exempt: public b2c registration funnel — anonymous-by-design (entire controller)
    // See ControllerPreAuthorizeCoverageTest.EXCLUSIONS (15-02 / 15-06)
    @GetMapping("/info/{slug}/{assessmentId}/{tierMappingId}")
    public ResponseEntity<?> infoByTier(@PathVariable String slug,
                                        @PathVariable Long assessmentId,
                                        @PathVariable Long tierMappingId) {
        return buildInfo(slug, assessmentId, tierMappingId);
    }

    private ResponseEntity<?> buildInfo(String slug, Long filterAssessmentId, Long filterTierMappingId) {
        Optional<Campaign> campaignOpt = campaignRepository.findBySlugIgnoreCaseAndIsDeletedFalse(slug);
        if (!campaignOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign not found");
        }
        Campaign c = campaignOpt.get();
        if (Boolean.FALSE.equals(c.getIsActive())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign not active");
        }
        if (c.getValidTo() != null && c.getValidTo().before(new Date())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign has expired");
        }

        Map<String, Object> campaignDto = new HashMap<>();
        campaignDto.put("campaignId", c.getCampaignId());
        campaignDto.put("name", c.getName());
        campaignDto.put("slug", c.getSlug());
        campaignDto.put("brandLogoUrl", c.getBrandLogoUrl());
        campaignDto.put("targetAudience", c.getTargetAudience());
        campaignDto.put("description", c.getDescription());
        campaignDto.put("validFrom", c.getValidFrom());
        campaignDto.put("validTo", c.getValidTo());

        String defaultPurchasePath = c.getDefaultPurchasePath();
        String defaultCounsellingModel = c.getDefaultCounsellingModel();

        List<CampaignAssessmentMapping> mappings = mappingRepository
                .findByCampaignIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(c.getCampaignId())
                .stream()
                .filter(m -> Boolean.TRUE.equals(m.getIsActive()))
                .filter(m -> filterAssessmentId == null || filterAssessmentId.equals(m.getAssessmentId()))
                .collect(java.util.stream.Collectors.toList());

        if (filterAssessmentId != null && mappings.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Assessment not in campaign");
        }

        List<Map<String, Object>> assessmentsOut = new ArrayList<>();
        for (CampaignAssessmentMapping m : mappings) {
            Optional<AssessmentTable> aOpt = assessmentTableRepository.findById(m.getAssessmentId());
            if (!aOpt.isPresent()) continue;
            AssessmentTable a = aOpt.get();
            if (Boolean.FALSE.equals(a.getIsActive())) continue;

            Map<String, Object> aDto = new HashMap<>();
            aDto.put("assessmentId", a.getId());
            aDto.put("assessmentName", a.getAssessmentName());
            aDto.put("isActive", a.getIsActive());
            aDto.put("purchasePath", m.getPurchasePath() != null ? m.getPurchasePath() : defaultPurchasePath);
            aDto.put("counsellingModel", m.getCounsellingModel() != null ? m.getCounsellingModel() : defaultCounsellingModel);
            aDto.put("description", m.getDescription());

            List<CampaignAssessmentTier> tiers = tierMappingRepository
                    .findByCampaignAssessmentMappingIdOrderByIdAsc(m.getId())
                    .stream()
                    .filter(t -> Boolean.TRUE.equals(t.getIsActive()))
                    .filter(t -> filterTierMappingId == null || filterTierMappingId.equals(t.getId()))
                    .collect(java.util.stream.Collectors.toList());

            if (filterTierMappingId != null && tiers.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Tier not in this assessment");
            }

            List<Map<String, Object>> tiersOut = new ArrayList<>();
            for (CampaignAssessmentTier t : tiers) {
                Optional<PricingTier> ptOpt = pricingTierRepository.findById(t.getPricingTierId());
                if (!ptOpt.isPresent()) continue;
                PricingTier pt = ptOpt.get();
                if (Boolean.FALSE.equals(pt.getIsActive()) || Boolean.TRUE.equals(pt.getIsDeleted())) continue;

                Map<String, Object> tDto = new HashMap<>();
                tDto.put("campaignAssessmentTierId", t.getId());
                tDto.put("tierId", pt.getTierId());
                tDto.put("name", pt.getName());
                tDto.put("description", pt.getDescription());
                long baseInr = pt.getBasePriceInr() != null ? pt.getBasePriceInr() : 0L;
                long priceInr = t.getPriceOverrideInr() != null ? t.getPriceOverrideInr() : baseInr;
                tDto.put("basePriceInr", baseInr);
                tDto.put("priceInr", priceInr);
                tDto.put("currency", pt.getCurrency());
                tDto.put("isDefault", t.getIsDefault());
                tDto.put("includesFinalReport", pt.getIncludesFinalReport());
                tDto.put("includesDashboard", pt.getIncludesDashboard());
                tDto.put("includesCounselling", pt.getIncludesCounselling());
                tDto.put("counsellingSessionCount", pt.getCounsellingSessionCount());
                tDto.put("includesLms", pt.getIncludesLms());
                tDto.put("lmsValidityDays", pt.getLmsValidityDays());
                tDto.put("dashboardValidityDays", pt.getDashboardValidityDays());
                tiersOut.add(tDto);
            }
            aDto.put("tiers", tiersOut);
            assessmentsOut.add(aDto);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("campaign", campaignDto);
        response.put("assessments", assessmentsOut);

        // Class-based registration routes. When present (and this is not an
        // assessment/tier deep-link), the student app shows a "Choose your class"
        // picker; picking a class auto-selects its assessment (and default tier /
        // price). Only routes whose assessment is COMPLETABLE are returned, so the
        // picker can never resolve to a dead end: try-first needs no tier, but
        // pay-first needs at least one active tier to charge against (e.g. an
        // assessment freshly imported from school config before tiers are set).
        if (filterAssessmentId == null) {
            java.util.Set<Long> usable = new java.util.HashSet<>();
            for (Map<String, Object> aDto : assessmentsOut) {
                Object aid = aDto.get("assessmentId");
                if (!(aid instanceof Number)) continue;
                boolean tryFirst = "B".equals(aDto.get("purchasePath"));
                Object tiersObj = aDto.get("tiers");
                boolean hasTier = tiersObj instanceof List && !((List<?>) tiersObj).isEmpty();
                if (tryFirst || hasTier) usable.add(((Number) aid).longValue());
            }
            List<Map<String, Object>> classesOut = new ArrayList<>();
            for (CampaignClassAssessment r : classRouteRepository
                    .findByCampaignIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(c.getCampaignId())) {
                if (!Boolean.TRUE.equals(r.getIsActive())) continue;
                if (r.getAssessmentId() == null || !usable.contains(r.getAssessmentId())) continue;
                SchoolClasses sc = r.getClassId() != null
                        ? schoolClassesRepository.findById(r.getClassId()).orElse(null) : null;
                if (sc == null) continue; // class deleted — skip rather than show a blank option
                Map<String, Object> cDto = new HashMap<>();
                cDto.put("classId", r.getClassId());
                cDto.put("className", sc.getClassName());
                cDto.put("assessmentId", r.getAssessmentId());
                cDto.put("sortOrder", r.getSortOrder());
                classesOut.add(cDto);
            }
            // Grade order ("Class 9" before "Class 10"); non-numeric names last, by name.
            classesOut.sort((a, b) -> {
                Integer ga = gradeOf((String) a.get("className"));
                Integer gb = gradeOf((String) b.get("className"));
                if (ga != null && gb != null) return ga.compareTo(gb);
                if (ga != null) return -1;
                if (gb != null) return 1;
                return String.valueOf(a.get("className")).compareToIgnoreCase(String.valueOf(b.get("className")));
            });
            response.put("classes", classesOut);
        }
        return ResponseEntity.ok(response);
    }

    // @PreAuthorize-Exempt: public b2c registration funnel — anonymous-by-design (entire controller)
    // See ControllerPreAuthorizeCoverageTest.EXCLUSIONS (15-02 / 15-06)
    @PostMapping("/register/{slug}/{assessmentId}/{tierMappingId}")
    @Transactional
    public ResponseEntity<?> register(@PathVariable String slug,
                                      @PathVariable Long assessmentId,
                                      @PathVariable Long tierMappingId,
                                      @RequestBody Map<String, Object> body,
                                      HttpServletResponse httpResponse) {

        // 1. Resolve campaign
        Optional<Campaign> campaignOpt = campaignRepository.findBySlugIgnoreCaseAndIsDeletedFalse(slug);
        if (!campaignOpt.isPresent() || Boolean.FALSE.equals(campaignOpt.get().getIsActive())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign not found");
        }
        Campaign campaign = campaignOpt.get();
        if (campaign.getValidTo() != null && campaign.getValidTo().before(new Date())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign has expired");
        }

        // 2. Resolve assessment-mapping + tier
        Optional<CampaignAssessmentMapping> mOpt = mappingRepository
                .findByCampaignIdAndAssessmentIdAndIsDeletedFalse(campaign.getCampaignId(), assessmentId);
        if (!mOpt.isPresent() || !Boolean.TRUE.equals(mOpt.get().getIsActive())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Assessment not in campaign");
        }
        CampaignAssessmentMapping mapping = mOpt.get();

        Optional<CampaignAssessmentTier> tOpt = tierMappingRepository.findById(tierMappingId);
        if (!tOpt.isPresent() || !Boolean.TRUE.equals(tOpt.get().getIsActive())
                || !mapping.getId().equals(tOpt.get().getCampaignAssessmentMappingId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Tier not in this assessment");
        }
        CampaignAssessmentTier tierMapping = tOpt.get();

        Optional<PricingTier> ptOpt = pricingTierRepository.findById(tierMapping.getPricingTierId());
        if (!ptOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Pricing tier not found");
        }
        PricingTier pricingTier = ptOpt.get();
        long originalInr = tierMapping.getPriceOverrideInr() != null
                ? tierMapping.getPriceOverrideInr()
                : (pricingTier.getBasePriceInr() != null ? pricingTier.getBasePriceInr() : 0L);

        // 3. Validate input
        String name = strFromBody(body, "name");
        String email = strFromBody(body, "email");
        String dobStr = strFromBody(body, "dob");
        String phone = strFromBody(body, "phone");
        String gender = strFromBody(body, "gender");
        String promoCodeStr = strFromBody(body, "promoCode");
        // Optional: the class the student picked (class-based campaigns). Persisted
        // as a grade number on StudentInfo so reports resolve the right template.
        Integer classId = intFromBody(body, "classId");

        if (name == null || email == null || dobStr == null || phone == null) {
            return ResponseEntity.badRequest().body("Name, email, phone, and date of birth are required");
        }
        if (!phone.matches("^[+]?[\\d\\s-]{7,15}$")) {
            return ResponseEntity.badRequest().body("Please enter a valid phone number (7–15 digits)");
        }
        SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
        Date dob;
        try { dob = sdf.parse(dobStr); }
        catch (Exception e) { return ResponseEntity.badRequest().body("Invalid date format. Use dd-MM-yyyy"); }

        // 4. Apply promo code (if any)
        Long finalInr = originalInr;
        Integer promoDiscountPercent = null;
        String promoCodeSaved = null;
        if (promoCodeStr != null && !promoCodeStr.trim().isEmpty()) {
            Optional<PromoCode> promoOpt = promoCodeRepository
                    .findByCodeIgnoreCaseAndIsActive(promoCodeStr.trim().toUpperCase(), true);
            if (!promoOpt.isPresent()) {
                return ResponseEntity.badRequest().body("Invalid promo code");
            }
            PromoCode promo = promoOpt.get();
            if (!promoCodeCampaignRepository.existsByPromoCodeIdAndCampaignId(promo.getId(), campaign.getCampaignId())) {
                return ResponseEntity.badRequest().body("Code not valid for this campaign");
            }
            if (promo.getExpiresAt() != null && promo.getExpiresAt().before(new Date())) {
                return ResponseEntity.badRequest().body("Promo code has expired");
            }
            if (promo.getMaxUses() != null && promo.getCurrentUses() >= promo.getMaxUses()) {
                return ResponseEntity.badRequest().body("Promo code usage limit reached");
            }
            promoDiscountPercent = promo.getDiscountPercent();
            // PROMO3: reject a discount outside [0,100] rather than letting it
            // produce a negative/over-100% charge that clamps into the free path.
            if (promoDiscountPercent == null || promoDiscountPercent < 0 || promoDiscountPercent > 100) {
                return ResponseEntity.badRequest().body("Promo code is misconfigured");
            }
            finalInr = originalInr * (100 - promoDiscountPercent) / 100;
            // A1/A2: consumption is deferred to realized redemption (paid webhook
            // success / free-commit) via atomic tryConsume — not burned here.
            promoCodeSaved = promo.getCode();
        }

        // Defensive clamp — guards against a negative priceOverrideInr. A 0-priced
        // row routes to the free-path branch below; nothing in this flow should
        // ever charge negative money.
        if (finalInr < 0L) {
            logger.warn("Promo math produced negative finalInr={} — clamping to 0", finalInr);
            finalInr = 0L;
        }

        // 5. Email-DOB duplicate check (impersonation block)
        List<StudentInfo> existingByEmail = studentInfoRepository.findByEmail(email);
        StudentInfo existing = existingByEmail.isEmpty() ? null : existingByEmail.get(0);
        if (existing != null) {
            Date existingDob = existing.getStudentDob();
            if (existingDob == null || !sameDay(existingDob, dob)) {
                return ResponseEntity.badRequest().body(
                        com.kccitm.api.util.DuplicateEmailResponse.build(existing, instituteDetailRepository));
            }
        }

        // 6. Free path → inline-provision and return session
        if (finalInr == 0L) {
            return provisionFreeAndRespond(campaign, mapping, tierMapping, pricingTier,
                    existing, name, email, dob, dobStr, phone, gender, classId,
                    promoCodeSaved, promoDiscountPercent, originalInr, httpResponse);
        }

        // 7. Paid path → create Razorpay payment link + PaymentTransaction
        return createPaymentAndRedirect(campaign, mapping, tierMapping, pricingTier,
                name, email, dob, dobStr, phone, gender, classId,
                finalInr, originalInr, promoCodeSaved, promoDiscountPercent);
    }

    /**
     * Try-First (Path B) registration: creates a pending entitlement with no tier,
     * lets the student start the assessment immediately. They pay for the report
     * later via /pay-for-report.
     */
    // @PreAuthorize-Exempt: public b2c registration funnel — anonymous-by-design (entire controller)
    // See ControllerPreAuthorizeCoverageTest.EXCLUSIONS (15-02 / 15-06)
    @PostMapping("/register-trial/{slug}/{assessmentId}")
    @Transactional
    public ResponseEntity<?> registerTrial(@PathVariable String slug,
                                           @PathVariable Long assessmentId,
                                           @RequestBody Map<String, Object> body) {

        Optional<Campaign> campaignOpt = campaignRepository.findBySlugIgnoreCaseAndIsDeletedFalse(slug);
        if (!campaignOpt.isPresent() || Boolean.FALSE.equals(campaignOpt.get().getIsActive())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign not found");
        }
        Campaign campaign = campaignOpt.get();
        if (campaign.getValidTo() != null && campaign.getValidTo().before(new Date())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign has expired");
        }

        Optional<CampaignAssessmentMapping> mOpt = mappingRepository
                .findByCampaignIdAndAssessmentIdAndIsDeletedFalse(campaign.getCampaignId(), assessmentId);
        if (!mOpt.isPresent() || !Boolean.TRUE.equals(mOpt.get().getIsActive())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Assessment not in campaign");
        }
        CampaignAssessmentMapping mapping = mOpt.get();

        String purchasePath = mapping.getPurchasePath();
        if (purchasePath == null) purchasePath = campaign.getDefaultPurchasePath();
        if (purchasePath == null) purchasePath = "B";
        if (!"B".equals(purchasePath)) {
            return ResponseEntity.badRequest().body("This assessment uses Pay-First — use the regular registration link");
        }

        String name = strFromBody(body, "name");
        String email = strFromBody(body, "email");
        String dobStr = strFromBody(body, "dob");
        String phone = strFromBody(body, "phone");
        String gender = strFromBody(body, "gender");
        Integer classId = intFromBody(body, "classId");
        Integer studentClass = parseClassNumber(classId);

        if (name == null || email == null || dobStr == null || phone == null) {
            return ResponseEntity.badRequest().body("Name, email, phone, and date of birth are required");
        }
        if (!phone.matches("^[+]?[\\d\\s-]{7,15}$")) {
            return ResponseEntity.badRequest().body("Please enter a valid phone number (7–15 digits)");
        }
        SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
        Date dob;
        try { dob = sdf.parse(dobStr); }
        catch (Exception e) { return ResponseEntity.badRequest().body("Invalid date format. Use dd-MM-yyyy"); }

        // Email-DOB impersonation block
        List<StudentInfo> existingByEmail = studentInfoRepository.findByEmail(email);
        StudentInfo existing = existingByEmail.isEmpty() ? null : existingByEmail.get(0);
        if (existing != null) {
            Date existingDob = existing.getStudentDob();
            if (existingDob == null || !sameDay(existingDob, dob)) {
                return ResponseEntity.badRequest().body(
                        com.kccitm.api.util.DuplicateEmailResponse.build(existing, instituteDetailRepository));
            }
        }

        // Find-or-create User + StudentInfo + UserStudent (mirrors provisionFreeAndRespond)
        UserStudent userStudent;
        User user;
        if (existing != null) {
            if (studentClass != null && existing.getStudentClass() == null) {
                existing.setStudentClass(studentClass);
                studentInfoRepository.save(existing);
            }
            user = existing.getUser();
            if (user == null) {
                user = new User((int) (Math.random() * 100000), dob);
                user.setName(existing.getName());
                user.setEmail(existing.getEmail());
                user = userRepository.save(user);
                existing.setUser(user);
                studentInfoRepository.save(existing);
            }
            List<UserStudent> us = userStudentRepository.findByStudentInfoId(existing.getId());
            userStudent = us.isEmpty()
                    ? userStudentRepository.save(new UserStudent(user, existing, null))
                    : us.get(0);
            if (userStudent != null) studentProvisioningService.provision(userStudent);
        } else {
            user = new User((int) (Math.random() * 100000), dob);
            user.setName(name);
            user.setEmail(email);
            user.setPhone(phone);
            user = userRepository.save(user);

            StudentInfo info = new StudentInfo();
            info.setName(name);
            info.setEmail(email);
            info.setStudentDob(dob);
            info.setPhoneNumber(phone);
            info.setGender(gender);
            info.setStudentClass(studentClass);
            info.setUser(user);
            info = studentInfoRepository.save(info);

            userStudent = userStudentRepository.save(new UserStudent(user, info, null));
            studentProvisioningService.provision(userStudent);
        }

        // Set the campaign's institute as primary + record membership.
        // No-op when campaign has no institute mapped (legacy campaign pre-backfill).
        membershipService.assignFromCampaign(userStudent, campaign, "campaign-register-trial");

        Long userStudentId = userStudent.getUserStudentId();
        Optional<StudentAssessmentMapping> samOpt = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);
        if (!samOpt.isPresent()) {
            studentAssessmentMappingRepository.save(new StudentAssessmentMapping(userStudentId, assessmentId));
        }

        String counsellingModel = mapping.getCounsellingModel();
        if (counsellingModel == null) counsellingModel = campaign.getDefaultCounsellingModel();
        if (counsellingModel == null) counsellingModel = "1";

        StudentEntitlement entitlement = entitlementService.createPending(
                userStudentId, campaign.getCampaignId(), assessmentId, "B", counsellingModel);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("entitlementId", entitlement.getEntitlementId());
        response.put("campaignId", campaign.getCampaignId());
        response.put("campaignSlug", slug);
        response.put("purchasePath", "B");
        response.put("username", user.getUsername());
        response.put("dob", dobStr);
        response.putAll(studentSessionService.buildSessionPayload(userStudentId));
        return ResponseEntity.ok(response);
    }

    /**
     * Returns campaign + assessment + student + tier info for a given pending or active
     * entitlement. Used by the thank-you page to decide what to render and by the
     * pay-for-report page to render its form.
     */
    // @PreAuthorize-Exempt: public b2c registration funnel — anonymous-by-design (entire controller)
    // See ControllerPreAuthorizeCoverageTest.EXCLUSIONS (15-02 / 15-06)
    @GetMapping("/upgrade-info/{entitlementId}")
    public ResponseEntity<?> upgradeInfo(@PathVariable Long entitlementId) {
        Optional<StudentEntitlement> eOpt = studentEntitlementRepository.findById(entitlementId);
        if (!eOpt.isPresent()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Entitlement not found");
        StudentEntitlement e = eOpt.get();

        Optional<Campaign> cOpt = campaignRepository.findById(e.getCampaignId());
        if (!cOpt.isPresent()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign not found");
        Campaign campaign = cOpt.get();

        Optional<AssessmentTable> aOpt = assessmentTableRepository.findById(e.getAssessmentId());
        if (!aOpt.isPresent()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Assessment not found");
        AssessmentTable assessment = aOpt.get();

        Optional<CampaignAssessmentMapping> mOpt = mappingRepository
                .findByCampaignIdAndAssessmentIdAndIsDeletedFalse(e.getCampaignId(), e.getAssessmentId());
        if (!mOpt.isPresent()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Mapping not found");
        CampaignAssessmentMapping mapping = mOpt.get();

        Map<String, Object> studentDto = new HashMap<>();
        Optional<UserStudent> usOpt = userStudentRepository.findById(e.getUserStudentId());
        if (usOpt.isPresent() && usOpt.get().getStudentInfo() != null) {
            StudentInfo si = usOpt.get().getStudentInfo();
            studentDto.put("name", si.getName());
            studentDto.put("email", si.getEmail());
            studentDto.put("phone", si.getPhoneNumber());
        }

        Map<String, Object> campaignDto = new HashMap<>();
        campaignDto.put("campaignId", campaign.getCampaignId());
        campaignDto.put("name", campaign.getName());
        campaignDto.put("slug", campaign.getSlug());
        campaignDto.put("brandLogoUrl", campaign.getBrandLogoUrl());

        Map<String, Object> assessmentDto = new HashMap<>();
        assessmentDto.put("assessmentId", assessment.getId());
        assessmentDto.put("assessmentName", assessment.getAssessmentName());

        boolean alreadyActive = "active".equals(e.getStatus());

        Map<String, Object> activeTier = null;
        String dashboardUrl = null;
        String finalReportUrl = null;
        if (alreadyActive && e.getCampaignAssessmentTierId() != null) {
            Optional<CampaignAssessmentTier> tOpt = tierMappingRepository.findById(e.getCampaignAssessmentTierId());
            if (tOpt.isPresent()) {
                Optional<PricingTier> ptOpt = pricingTierRepository.findById(tOpt.get().getPricingTierId());
                if (ptOpt.isPresent()) {
                    PricingTier pt = ptOpt.get();
                    activeTier = new HashMap<>();
                    activeTier.put("name", pt.getName());
                    activeTier.put("includesFinalReport", pt.getIncludesFinalReport());
                    activeTier.put("includesDashboard", pt.getIncludesDashboard());
                    activeTier.put("includesCounselling", pt.getIncludesCounselling());
                    activeTier.put("includesLms", pt.getIncludesLms());
                    if (Boolean.TRUE.equals(pt.getIncludesDashboard())
                            && e.getAccessToken() != null && linkBuilder != null) {
                        dashboardUrl = linkBuilder.dashboard(e.getAccessToken(), e.getEntitlementId());
                    }
                    if (Boolean.TRUE.equals(pt.getIncludesFinalReport())
                            && e.getAccessToken() != null && linkBuilder != null) {
                        finalReportUrl = linkBuilder.finalReport(e.getAccessToken(), e.getEntitlementId());
                    }
                }
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("entitlementId", e.getEntitlementId());
        response.put("status", e.getStatus());
        response.put("purchasePath", e.getPurchasePath());
        response.put("alreadyActive", alreadyActive);
        response.put("campaign", campaignDto);
        response.put("assessment", assessmentDto);
        response.put("student", studentDto);
        response.put("tiers", buildTierDtos(mapping.getId()));
        response.put("activeTier", activeTier);
        response.put("dashboardUrl", dashboardUrl);
        response.put("finalReportUrl", finalReportUrl);
        response.put("accessToken", e.getAccessToken());
        response.put("finalReportActive", e.getFinalReportActive());
        // Entitlement-level service flags consumed by the assessment Thank-You
        // page to drive (a) conditional outcome CTAs and (b) per-feature
        // "Add <feature>" upsell cards. Sourced from StudentEntitlement (the
        // denormalised snapshot of the PricingTier the student paid for) so
        // they reflect what THIS student actually has, not the campaign as a
        // whole. Counselling seat counts let the client gate the inline slot
        // picker on remaining sessions without a second round-trip.
        response.put("dashboardActive", e.getDashboardActive());
        response.put("counsellingActive", e.getCounsellingActive());
        response.put("counsellingSessionsTotal", e.getCounsellingSessionsTotal());
        response.put("counsellingSessionsUsed", e.getCounsellingSessionsUsed());
        response.put("careerLibraryUrl", "https://library.career-9.com");
        return ResponseEntity.ok(response);
    }

    /**
     * Path B step 3: student paid for the detailed report after taking the free
     * assessment. Creates a PaymentTransaction + Razorpay link. The webhook chain
     * (activateOnPayment) finds the existing pending entitlement and upgrades it.
     */
    // @PreAuthorize-Exempt: public b2c registration funnel — anonymous-by-design (entire controller)
    // See ControllerPreAuthorizeCoverageTest.EXCLUSIONS (15-02 / 15-06)
    @PostMapping("/pay-for-report")
    @Transactional
    public ResponseEntity<?> payForReport(@RequestBody Map<String, Object> body) {
        Long entitlementId = body.get("entitlementId") != null
                ? Long.valueOf(body.get("entitlementId").toString()) : null;
        Long campaignAssessmentTierId = body.get("campaignAssessmentTierId") != null
                ? Long.valueOf(body.get("campaignAssessmentTierId").toString()) : null;
        String promoCodeStr = strFromBody(body, "promoCode");

        if (entitlementId == null || campaignAssessmentTierId == null) {
            return ResponseEntity.badRequest().body("entitlementId and campaignAssessmentTierId are required");
        }

        Optional<StudentEntitlement> eOpt = studentEntitlementRepository.findById(entitlementId);
        if (!eOpt.isPresent()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Entitlement not found");
        StudentEntitlement entitlement = eOpt.get();
        if (!"pending".equals(entitlement.getStatus())) {
            return ResponseEntity.badRequest().body("This entitlement is already active or closed");
        }
        if (!"B".equals(entitlement.getPurchasePath())) {
            return ResponseEntity.badRequest().body("Upgrade only available for Try-First entitlements");
        }

        Optional<CampaignAssessmentTier> tOpt = tierMappingRepository.findById(campaignAssessmentTierId);
        if (!tOpt.isPresent() || !Boolean.TRUE.equals(tOpt.get().getIsActive())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Tier not found");
        }
        CampaignAssessmentTier tierMapping = tOpt.get();

        Optional<CampaignAssessmentMapping> mOpt = mappingRepository.findById(tierMapping.getCampaignAssessmentMappingId());
        if (!mOpt.isPresent()
                || !mOpt.get().getCampaignId().equals(entitlement.getCampaignId())
                || !mOpt.get().getAssessmentId().equals(entitlement.getAssessmentId())) {
            return ResponseEntity.badRequest().body("Tier does not belong to this entitlement's campaign/assessment");
        }
        CampaignAssessmentMapping mapping = mOpt.get();

        Optional<PricingTier> ptOpt = pricingTierRepository.findById(tierMapping.getPricingTierId());
        if (!ptOpt.isPresent()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Pricing tier not found");
        PricingTier pricingTier = ptOpt.get();

        long originalInr = tierMapping.getPriceOverrideInr() != null
                ? tierMapping.getPriceOverrideInr()
                : (pricingTier.getBasePriceInr() != null ? pricingTier.getBasePriceInr() : 0L);

        Long finalInr = originalInr;
        Integer promoDiscountPercent = null;
        String promoCodeSaved = null;
        if (promoCodeStr != null && !promoCodeStr.trim().isEmpty()) {
            Optional<PromoCode> promoOpt = promoCodeRepository
                    .findByCodeIgnoreCaseAndIsActive(promoCodeStr.trim().toUpperCase(), true);
            if (!promoOpt.isPresent()) return ResponseEntity.badRequest().body("Invalid promo code");
            PromoCode promo = promoOpt.get();
            if (!promoCodeCampaignRepository.existsByPromoCodeIdAndCampaignId(promo.getId(), entitlement.getCampaignId())) {
                return ResponseEntity.badRequest().body("Code not valid for this campaign");
            }
            if (promo.getExpiresAt() != null && promo.getExpiresAt().before(new Date())) {
                return ResponseEntity.badRequest().body("Promo code has expired");
            }
            if (promo.getMaxUses() != null && promo.getCurrentUses() >= promo.getMaxUses()) {
                return ResponseEntity.badRequest().body("Promo code usage limit reached");
            }
            promoDiscountPercent = promo.getDiscountPercent();
            // PROMO3: reject a discount outside [0,100] rather than letting it
            // produce a negative/over-100% charge that clamps into the free path.
            if (promoDiscountPercent == null || promoDiscountPercent < 0 || promoDiscountPercent > 100) {
                return ResponseEntity.badRequest().body("Promo code is misconfigured");
            }
            finalInr = originalInr * (100 - promoDiscountPercent) / 100;
            // A1/A2: consumption is deferred to realized redemption (paid webhook
            // success / free-commit) via atomic tryConsume — not burned here.
            promoCodeSaved = promo.getCode();
        }

        // Defensive clamp — guards against a negative priceOverrideInr. A 0-priced
        // row routes to the free-path branch below; nothing in this flow should
        // ever charge negative money.
        if (finalInr < 0L) {
            logger.warn("Promo math produced negative finalInr={} — clamping to 0", finalInr);
            finalInr = 0L;
        }

        StudentInfo studentInfo = null;
        Optional<UserStudent> usOpt = userStudentRepository.findById(entitlement.getUserStudentId());
        if (usOpt.isPresent()) studentInfo = usOpt.get().getStudentInfo();
        if (studentInfo == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Student not found");

        Optional<Campaign> cOpt = campaignRepository.findById(entitlement.getCampaignId());
        if (!cOpt.isPresent()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign not found");
        Campaign campaign = cOpt.get();

        try {
            String description = pricingTier.getName() + " — " + campaign.getName();
            String callbackUrl = (callbackBaseUrl == null ? "" : callbackBaseUrl)
                    + "/payment-status?upgrade=1&eid=" + entitlement.getEntitlementId();

            // PAY1: commit a 'created' txn BEFORE the irreversible Razorpay link
            // call so a recoverable DB record always exists first.
            PaymentTransaction txn = new PaymentTransaction();
            txn.setAmount(finalInr);
            txn.setOriginalAmount(originalInr);
            txn.setUserStudentId(entitlement.getUserStudentId());
            txn.setAssessmentId(mapping.getAssessmentId());
            txn.setCampaignId(campaign.getCampaignId());
            txn.setCampaignAssessmentTierId(tierMapping.getId());
            txn.setPurchasePath("B");
            txn.setStudentName(studentInfo.getName());
            txn.setStudentEmail(studentInfo.getEmail());
            txn.setStudentDob(studentInfo.getStudentDob());
            txn.setStudentPhone(studentInfo.getPhoneNumber());
            txn.setStatus("created");
            if (promoCodeSaved != null) {
                txn.setPromoCode(promoCodeSaved);
                txn.setPromoDiscountPercent(promoDiscountPercent);
            }
            txn = paymentTransactionWriter.saveInNewTransaction(txn);

            String referenceId = "UPG-" + entitlement.getEntitlementId() + "-" + txn.getTransactionId();

            Map<String, String> notes = new HashMap<>();
            notes.put("entitlementId", String.valueOf(entitlement.getEntitlementId()));
            notes.put("campaignId", String.valueOf(entitlement.getCampaignId()));
            notes.put("assessmentId", String.valueOf(entitlement.getAssessmentId()));
            notes.put("campaignAssessmentTierId", String.valueOf(tierMapping.getId()));
            notes.put("studentEmail", studentInfo.getEmail());
            notes.put("transactionId", String.valueOf(txn.getTransactionId()));

            Map<String, String> rzpResponse = razorpayService.createPaymentLink(
                    finalInr, "INR", description, callbackUrl, referenceId, notes);

            txn.setRazorpayLinkId(rzpResponse.get("linkId"));
            txn.setPaymentLinkUrl(rzpResponse.get("shortUrl"));
            txn.setShortUrl(rzpResponse.get("shortUrl"));
            txn = paymentTransactionWriter.saveInNewTransaction(txn);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "payment_required");
            response.put("paymentUrl", rzpResponse.get("shortUrl"));
            response.put("transactionId", txn.getTransactionId());
            response.put("amount", finalInr);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to create upgrade payment link for entitlement {}", entitlement.getEntitlementId(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to create payment link. Please try again.");
        }
    }

    /** Builds the tier DTO list for a given mapping; shared by /info and /upgrade-info. */
    private List<Map<String, Object>> buildTierDtos(Long mappingId) {
        List<Map<String, Object>> out = new ArrayList<>();
        List<CampaignAssessmentTier> tiers = tierMappingRepository
                .findByCampaignAssessmentMappingIdOrderByIdAsc(mappingId)
                .stream()
                .filter(t -> Boolean.TRUE.equals(t.getIsActive()))
                .collect(java.util.stream.Collectors.toList());
        for (CampaignAssessmentTier t : tiers) {
            Optional<PricingTier> ptOpt = pricingTierRepository.findById(t.getPricingTierId());
            if (!ptOpt.isPresent()) continue;
            PricingTier pt = ptOpt.get();
            if (Boolean.FALSE.equals(pt.getIsActive()) || Boolean.TRUE.equals(pt.getIsDeleted())) continue;

            long baseInr = pt.getBasePriceInr() != null ? pt.getBasePriceInr() : 0L;
            long priceInr = t.getPriceOverrideInr() != null ? t.getPriceOverrideInr() : baseInr;
            Map<String, Object> tDto = new HashMap<>();
            tDto.put("campaignAssessmentTierId", t.getId());
            tDto.put("tierId", pt.getTierId());
            tDto.put("name", pt.getName());
            tDto.put("description", pt.getDescription());
            tDto.put("basePriceInr", baseInr);
            tDto.put("priceInr", priceInr);
            tDto.put("currency", pt.getCurrency());
            tDto.put("isDefault", t.getIsDefault());
            tDto.put("includesFinalReport", pt.getIncludesFinalReport());
            tDto.put("includesDashboard", pt.getIncludesDashboard());
            tDto.put("includesCounselling", pt.getIncludesCounselling());
            tDto.put("counsellingSessionCount", pt.getCounsellingSessionCount());
            tDto.put("includesLms", pt.getIncludesLms());
            tDto.put("lmsValidityDays", pt.getLmsValidityDays());
            tDto.put("dashboardValidityDays", pt.getDashboardValidityDays());
            out.add(tDto);
        }
        return out;
    }

    private ResponseEntity<?> provisionFreeAndRespond(Campaign campaign,
            CampaignAssessmentMapping mapping, CampaignAssessmentTier tierMapping,
            PricingTier pricingTier, StudentInfo existing,
            String name, String email, Date dob, String dobStr, String phone, String gender,
            Integer classId,
            String promoCodeSaved, Integer promoDiscountPercent, long originalInr,
            HttpServletResponse httpResponse) {

        Integer studentClass = parseClassNumber(classId);

        // Re-check campaign expiry here. The /register entry already validated
        // it, but the form may have sat open for hours — we don't want to
        // mint an entitlement against an expired campaign.
        if (campaign.getValidTo() != null && campaign.getValidTo().before(new Date())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign has expired");
        }

        // Create or reuse User+StudentInfo+UserStudent
        UserStudent userStudent;
        User user;
        if (existing != null) {
            // Backfill the grade if we now know it and it wasn't recorded before.
            if (studentClass != null && existing.getStudentClass() == null) {
                existing.setStudentClass(studentClass);
                studentInfoRepository.save(existing);
            }
            user = existing.getUser();
            if (user == null) {
                user = new User((int) (Math.random() * 100000), dob);
                user.setName(existing.getName());
                user.setEmail(existing.getEmail());
                user = userRepository.save(user);
                existing.setUser(user);
                studentInfoRepository.save(existing);
            }
            List<UserStudent> us = userStudentRepository.findByStudentInfoId(existing.getId());
            if (us.isEmpty()) {
                UserStudent newUs = new UserStudent(user, existing, null);
                userStudent = userStudentRepository.save(newUs);
                studentProvisioningService.provision(userStudent);
            } else {
                userStudent = us.get(0);
            }
        } else {
            user = new User((int) (Math.random() * 100000), dob);
            user.setName(name);
            user.setEmail(email);
            user.setPhone(phone);
            user = userRepository.save(user);

            StudentInfo studentInfo = new StudentInfo();
            studentInfo.setName(name);
            studentInfo.setEmail(email);
            studentInfo.setStudentDob(dob);
            studentInfo.setPhoneNumber(phone);
            studentInfo.setGender(gender);
            studentInfo.setStudentClass(studentClass);
            studentInfo.setUser(user);
            studentInfo = studentInfoRepository.save(studentInfo);

            userStudent = new UserStudent(user, studentInfo, null);
            userStudent = userStudentRepository.save(userStudent);
            studentProvisioningService.provision(userStudent);
        }

        membershipService.assignFromCampaign(userStudent, campaign, "campaign-register");

        // Ensure StudentAssessmentMapping exists
        Long assessmentId = mapping.getAssessmentId();
        Optional<StudentAssessmentMapping> samOpt = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudent.getUserStudentId(), assessmentId);
        if (!samOpt.isPresent()) {
            StudentAssessmentMapping sam = new StudentAssessmentMapping(userStudent.getUserStudentId(), assessmentId);
            studentAssessmentMappingRepository.save(sam);
        }

        // Record zero-amount PaymentTransaction
        PaymentTransaction txn = new PaymentTransaction();
        txn.setAmount(0L);
        txn.setOriginalAmount(originalInr);
        txn.setStatus("paid");
        txn.setAssessmentId(assessmentId);
        txn.setCampaignId(campaign.getCampaignId());
        txn.setCampaignAssessmentTierId(tierMapping.getId());
        txn.setStudentName(name);
        txn.setStudentEmail(email);
        txn.setStudentDob(dob);
        txn.setStudentPhone(phone);
        txn.setStudentClass(studentClass);
        txn.setUserStudentId(userStudent.getUserStudentId());
        if (promoCodeSaved != null) {
            txn.setPromoCode(promoCodeSaved);
            txn.setPromoDiscountPercent(promoDiscountPercent);
        }
        txn = paymentTransactionRepository.save(txn);

        // Entitlement activation must succeed for the free path — it produces
        // the access token, sends the welcome email, and is the row the
        // thank-you page later resolves to decide what CTA to render. If it
        // fails we MUST surface that to the caller rather than silently
        // returning success: a free-path student without an entitlement has no
        // way to ever get their report.
        if (entitlementService == null) {
            logger.error("Free path: entitlementService bean unavailable for txn {}", txn.getTransactionId());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Registration partially succeeded but entitlement activation is unavailable. Contact support.");
        }
        StudentEntitlement entitlement;
        try {
            entitlement = entitlementService.activateOnPayment(txn.getTransactionId());
        } catch (Exception e) {
            logger.error("Free path entitlement activation failed for txn {}", txn.getTransactionId(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Registration failed during entitlement activation. Please contact support — your transaction reference is "
                            + txn.getTransactionId());
        }
        if (entitlement == null) {
            logger.error("Free path activateOnPayment returned null for txn {}", txn.getTransactionId());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Registration failed during entitlement activation. Please contact support — your transaction reference is "
                            + txn.getTransactionId());
        }

        // A1: the free registration is now realized — consume the promo (atomic,
        // cap-guarded). No-op when no promo was applied.
        consumePromoIfPresent(promoCodeSaved);

        // Issue the cn_at_asmnt cookie so the student is genuinely
        // authenticated server-side when they land on /allotted-assessment.
        // Without this, the assessment SPA was running purely on
        // localStorage.userStudentId trust.
        String sessionJwt = tokenProvider.createAssessmentSessionToken(
                userStudent.getUserStudentId(), mapping.getAssessmentId(), userStudent.getUserId());
        authCookieService.issueAssessmentSessionCookie(httpResponse, sessionJwt,
                (int) (assessmentTokenExpirationMsec / 1000));

        // Build session payload — keeps frontend-visible fields aligned with
        // the trial / paid-callback responses (CampaignRegisterPage looks for
        // each of these to seed localStorage before navigating).
        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Registration successful.");
        response.put("username", user.getUsername());
        response.put("dob", dobStr);
        response.put("entitlementId", entitlement.getEntitlementId());
        response.put("campaignId", campaign.getCampaignId());
        response.put("campaignSlug", campaign.getSlug());
        response.put("purchasePath", entitlement.getPurchasePath());
        response.putAll(studentSessionService.buildSessionPayload(userStudent.getUserStudentId()));
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<?> createPaymentAndRedirect(Campaign campaign,
            CampaignAssessmentMapping mapping, CampaignAssessmentTier tierMapping,
            PricingTier pricingTier,
            String name, String email, Date dob, String dobStr, String phone, String gender,
            Integer classId,
            long finalInr, long originalInr, String promoCodeSaved, Integer promoDiscountPercent) {

        // Re-check campaign expiry — see provisionFreeAndRespond comment.
        if (campaign.getValidTo() != null && campaign.getValidTo().before(new Date())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign has expired");
        }

        try {
            String description = pricingTier.getName() + " — " + campaign.getName();
            String callbackUrl = (callbackBaseUrl == null ? "" : callbackBaseUrl) + "/payment-status";

            // PAY1: commit a 'created' txn BEFORE the irreversible Razorpay link
            // call so a recoverable DB record always exists first.
            PaymentTransaction txn = new PaymentTransaction();
            txn.setAmount(finalInr);
            txn.setOriginalAmount(originalInr);
            txn.setAssessmentId(mapping.getAssessmentId());
            txn.setCampaignId(campaign.getCampaignId());
            txn.setCampaignAssessmentTierId(tierMapping.getId());
            txn.setStudentName(name);
            txn.setStudentEmail(email);
            txn.setStudentDob(dob);
            txn.setStudentPhone(phone);
            // Carry the grade to the webhook, which creates the StudentInfo for
            // pay-first registrations (class context isn't available there).
            txn.setStudentClass(parseClassNumber(classId));
            txn.setStatus("created");
            if (promoCodeSaved != null) {
                txn.setPromoCode(promoCodeSaved);
                txn.setPromoDiscountPercent(promoDiscountPercent);
            }
            txn = paymentTransactionWriter.saveInNewTransaction(txn);

            String referenceId = "CAM-" + campaign.getCampaignId() + "-" + tierMapping.getId()
                    + "-" + txn.getTransactionId();

            Map<String, String> notes = new HashMap<>();
            notes.put("campaignId", String.valueOf(campaign.getCampaignId()));
            notes.put("assessmentId", String.valueOf(mapping.getAssessmentId()));
            notes.put("campaignAssessmentTierId", String.valueOf(tierMapping.getId()));
            notes.put("studentEmail", email);
            notes.put("customerName", name);
            notes.put("customerDob", dobStr);
            notes.put("transactionId", String.valueOf(txn.getTransactionId()));

            Map<String, String> rzpResponse = razorpayService.createPaymentLink(
                    finalInr, "INR", description, callbackUrl, referenceId, notes);

            txn.setRazorpayLinkId(rzpResponse.get("linkId"));
            txn.setPaymentLinkUrl(rzpResponse.get("shortUrl"));
            txn.setShortUrl(rzpResponse.get("shortUrl"));
            txn = paymentTransactionWriter.saveInNewTransaction(txn);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "payment_required");
            response.put("paymentUrl", rzpResponse.get("shortUrl"));
            response.put("transactionId", txn.getTransactionId());
            response.put("amount", finalInr);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to create campaign payment link", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to create payment link. Please try again.");
        }
    }

    // ── Counselling — slot list + booking, tokenised public endpoints ──────────
    // These let the assessment SPA Thank-You page render an inline counselling
    // slot picker without forcing the student through the dashboard login flow.
    // Auth model: the entitlement accessToken issued at registration time is
    // the only credential — same pattern as /entitlement/redeem-token and
    // /campaign/public/pay-for-report. The token is read from the request body
    // (not the URL) to keep it out of access logs.

    /**
     * Lists available counselling slots for the entitlement's student, filtered
     * to counsellors allocated to the student's institute. Token-validated; no
     * session cookie required. Read-only.
     *
     * <p>Body: {@code { token, entitlementId, from? (yyyy-MM-dd, default=today) }}.
     * Response: {@code { slots: [...], sessionsRemaining: int }}.
     */
    // @PreAuthorize-Exempt: public b2c funnel — anonymous, gated by entitlement accessToken.
    /**
     * Resolve a SCHOOL student's counselling for the assessment thank-you page.
     * B2C students carry an entitlementId from registration; school students reach
     * the thank-you page via a fresh login and have none — so the page resolves
     * their counselling by (userStudentId, assessmentId) instead. Returns the
     * entitlement's accessToken + session counts so the existing slot picker works
     * unchanged. {@code counsellingActive:false} when there's nothing to offer.
     */
    // @PreAuthorize-Exempt: public funnel — mirrors the other /campaign/public endpoints.
    @GetMapping("/student-counselling")
    @Transactional(readOnly = true)
    public ResponseEntity<?> studentCounselling(@RequestParam Long userStudentId,
                                                @RequestParam Long assessmentId) {
        Map<String, Object> out = new HashMap<>();
        // Counselling is OFFERED for an assessment whenever the admin has assigned a
        // counsellor to it. It's an OPTIONAL add-on the student may book after finishing
        // the assessment — NOT gated on the tier's counselling toggle or session count,
        // and not auto-given. (Counsellors are mapped to assessments, not institutes.)
        boolean offered = bookingService != null && bookingService.hasCounsellorForAssessment(assessmentId);
        out.put("counsellingOffered", offered);
        if (!offered) {
            out.put("counsellingActive", false);
            // No counsellor mapped yet. If the student's package actually INCLUDED
            // counselling (entitlement has sessions), surface a "pending assignment"
            // flag so the thank-you page can forward the request to Career-9 instead
            // of silently hiding counselling. Otherwise this assessment simply has no
            // counselling and nothing extra is shown.
            boolean includedCounselling = entitlementIncludesCounselling(userStudentId, assessmentId);
            out.put("counsellingPendingAssignment", includedCounselling);
            if (includedCounselling) {
                out.put("supportEmail", supportEmail);
                boolean alreadyForwarded = counsellingRequestRepository != null
                        && counsellingRequestRepository
                                .findFirstByUserStudentIdAndAssessmentIdAndStatus(userStudentId, assessmentId, "PENDING")
                                .isPresent();
                out.put("counsellingRequestForwarded", alreadyForwarded);
            }
            return ResponseEntity.ok(out);
        }
        // Resolve any active entitlement for this (student, assessment) to obtain a booking
        // token — every provisioned student has one, regardless of counselling inclusion.
        StudentEntitlement e = null;
        if (studentEntitlementRepository != null) {
            for (StudentEntitlement cand : studentEntitlementRepository
                    .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(userStudentId, assessmentId)) {
                if ("active".equals(cand.getStatus()) && cand.getAccessToken() != null) { e = cand; break; }
            }
        }
        if (e == null) {
            out.put("counsellingActive", false);
            return ResponseEntity.ok(out);
        }
        int total = e.getCounsellingSessionsTotal() == null ? 0 : e.getCounsellingSessionsTotal();
        int used  = e.getCounsellingSessionsUsed()  == null ? 0 : e.getCounsellingSessionsUsed();
        out.put("counsellingActive", true);
        out.put("entitlementId", e.getEntitlementId());
        out.put("accessToken", e.getAccessToken());
        out.put("counsellingSessionsTotal", total);
        out.put("counsellingSessionsUsed", used);
        // If the student has already booked a session for this entitlement, tell the
        // frontend so it shows the "booked" state instead of offering booking again.
        com.kccitm.api.model.career9.counselling.CounsellingAppointment booked =
                bookingService == null ? null
                        : bookingService.findActiveAppointment(userStudentId, e.getEntitlementId());
        if (booked != null) {
            out.put("alreadyBooked", true);
            out.put("bookedAppointmentId", booked.getId());
            out.put("bookedStatus", booked.getStatus());
            if (booked.getSlot() != null) {
                if (booked.getSlot().getDate() != null)
                    out.put("bookedSlotDate", booked.getSlot().getDate().toString());
                if (booked.getSlot().getStartTime() != null)
                    out.put("bookedSlotStartTime", booked.getSlot().getStartTime().toString());
            }
            if (booked.getCounsellor() != null)
                out.put("bookedCounsellorName", booked.getCounsellor().getName());
        }
        Optional<UserStudent> usOpt = userStudentRepository.findById(userStudentId);
        if (usOpt.isPresent() && usOpt.get().getStudentInfo() != null) {
            StudentInfo si = usOpt.get().getStudentInfo();
            out.put("studentName", si.getName());
            out.put("studentEmail", si.getEmail());
            out.put("studentPhone", si.getPhoneNumber());
        }
        return ResponseEntity.ok(out);
    }

    /** True when the student has an active entitlement for this assessment that included counselling. */
    private boolean entitlementIncludesCounselling(Long userStudentId, Long assessmentId) {
        if (studentEntitlementRepository == null) return false;
        for (StudentEntitlement cand : studentEntitlementRepository
                .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(userStudentId, assessmentId)) {
            if (!"active".equals(cand.getStatus())) continue;
            Integer total = cand.getCounsellingSessionsTotal();
            if (total != null && total > 0) return true;
        }
        return false;
    }

    /**
     * Forward a student's counselling interest when no counsellor is mapped to the
     * assessment yet. Idempotent: at most one PENDING row per (student, assessment).
     * Records the request (admins action it on the Counsellor ↔ Assessment page) and
     * emails the Career-9 support inbox. Public funnel — anonymous, like the siblings.
     */
    // @PreAuthorize-Exempt: public b2c funnel (entire controller).
    @PostMapping("/counselling-request")
    @Transactional
    public ResponseEntity<?> forwardCounsellingRequest(@RequestBody Map<String, Object> body) {
        Long userStudentId = longFromBody(body, "userStudentId");
        Long assessmentId = longFromBody(body, "assessmentId");
        if (userStudentId == null || assessmentId == null) {
            return ResponseEntity.badRequest().body("userStudentId and assessmentId are required");
        }
        Map<String, Object> out = new HashMap<>();
        // A counsellor may have been assigned between page load and this call — nothing to forward.
        if (bookingService != null && bookingService.hasCounsellorForAssessment(assessmentId)) {
            out.put("status", "ASSIGNED");
            return ResponseEntity.ok(out);
        }
        if (counsellingRequestRepository == null) {
            // Persistence unavailable — acknowledge without throwing so the student still sees the notice.
            out.put("status", "PENDING");
            out.put("forwarded", false);
            return ResponseEntity.ok(out);
        }
        Optional<CounsellingRequest> existing = counsellingRequestRepository
                .findFirstByUserStudentIdAndAssessmentIdAndStatus(userStudentId, assessmentId, "PENDING");
        if (existing.isPresent()) {
            out.put("status", "PENDING");
            out.put("alreadyForwarded", true);
            return ResponseEntity.ok(out);
        }
        CounsellingRequest req = new CounsellingRequest();
        req.setUserStudentId(userStudentId);
        req.setAssessmentId(assessmentId);
        String studentName = null, studentEmail = null, studentPhone = null, instituteName = null;
        Optional<UserStudent> usOpt = userStudentRepository.findById(userStudentId);
        if (usOpt.isPresent()) {
            UserStudent us = usOpt.get();
            if (us.getInstitute() != null) {
                req.setInstituteCode(us.getInstitute().getInstituteCode());
                instituteName = us.getInstitute().getInstituteName();
            }
            if (us.getStudentInfo() != null) {
                studentName = us.getStudentInfo().getName();
                studentEmail = us.getStudentInfo().getEmail();
                studentPhone = us.getStudentInfo().getPhoneNumber();
            }
        }
        req.setStatus("PENDING");
        counsellingRequestRepository.save(req);

        String assessmentName = assessmentTableRepository.findById(assessmentId)
                .map(AssessmentTable::getAssessmentName).orElse("assessment #" + assessmentId);
        notifyCounsellingForwarded(assessmentName, studentName, studentEmail, studentPhone, instituteName);

        out.put("status", "PENDING");
        out.put("forwarded", true);
        return ResponseEntity.ok(out);
    }

    /** Best-effort email to the Career-9 team; the DB row is the source of truth. */
    private void notifyCounsellingForwarded(String assessmentName, String studentName,
            String studentEmail, String studentPhone, String instituteName) {
        if (smtpEmailService == null || supportEmail == null || supportEmail.isEmpty()) return;
        try {
            String subject = "Counselling request — " + assessmentName;
            StringBuilder b = new StringBuilder();
            b.append("A student has requested career counselling, but no counsellor is mapped to this assessment yet.\n\n");
            b.append("Assessment: ").append(assessmentName).append('\n');
            if (studentName != null)  b.append("Student: ").append(studentName).append('\n');
            if (studentEmail != null) b.append("Email: ").append(studentEmail).append('\n');
            if (studentPhone != null) b.append("Phone: ").append(studentPhone).append('\n');
            if (instituteName != null) b.append("Institute: ").append(instituteName).append('\n');
            b.append("\nAssign a counsellor on the Counsellor ↔ Assessment page to let the student book.");
            smtpEmailService.sendSimpleEmail(supportEmail, subject, b.toString());
        } catch (Exception ex) {
            // Forwarding email is best-effort — never fail the request on a mail error.
            logger.warn("Failed to email counselling request notice to {}: {}", supportEmail, ex.getMessage());
        }
    }

    @PostMapping("/counselling/slots")
    @Transactional(readOnly = true)
    public ResponseEntity<?> listCounsellingSlots(@RequestBody Map<String, Object> body) {
        String token = strFromBody(body, "token");
        Long entitlementId = longFromBody(body, "entitlementId");
        String fromStr = strFromBody(body, "from");

        // entitlementId is required so redeemAccessToken's token↔entitlement match
        // is actually enforced (it is a no-op when entitlementId is null).
        if (entitlementId == null) {
            return ResponseEntity.badRequest().body("entitlementId is required");
        }

        StudentEntitlement e = entitlementService == null
                ? null : entitlementService.redeemAccessToken(token, entitlementId);
        if (e == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid or expired token");
        }
        // Phase 3b: do NOT reject when counselling isn't included or sessions are
        // exhausted — those students can still browse slots and pay per session at
        // booking time. `remaining` is returned so the UI can show free vs paid.
        int total = e.getCounsellingSessionsTotal() == null ? 0 : e.getCounsellingSessionsTotal();
        int used  = e.getCounsellingSessionsUsed()  == null ? 0 : e.getCounsellingSessionsUsed();
        int remaining = Math.max(0, total - used);

        Optional<UserStudent> usOpt = userStudentRepository.findById(e.getUserStudentId());
        if (!usOpt.isPresent() || usOpt.get().getInstitute() == null) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Student is not allotted to an institute");
        }
        Integer instituteCode = usOpt.get().getInstitute().getInstituteCode();

        java.time.LocalDate from;
        try {
            from = (fromStr == null) ? java.time.LocalDate.now() : java.time.LocalDate.parse(fromStr);
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body("Invalid 'from' date (expected yyyy-MM-dd)");
        }

        if (bookingService == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("Counselling booking is not configured on this instance");
        }
        // Phase 4: restrict to counsellors the admin assigned to this assessment
        // (falls back to institute-only when the assessment has no assignments).
        // Includes already-taken slots so the picker can grey them out as "Booked".
        List<com.kccitm.api.model.career9.counselling.CounsellingSlot> slots =
                bookingService.getBookableSlotsForInstitute(from, instituteCode, e.getAssessmentId());

        List<Map<String, Object>> slotDtos = new ArrayList<>();
        for (com.kccitm.api.model.career9.counselling.CounsellingSlot s : slots) {
            Map<String, Object> dto = new HashMap<>();
            dto.put("slotId", s.getId());
            dto.put("date", s.getDate().toString());
            dto.put("startTime", s.getStartTime().toString());
            dto.put("endTime", s.getEndTime().toString());
            dto.put("durationMinutes", s.getDurationMinutes());
            dto.put("mode", s.getMode() != null ? s.getMode() : "ONLINE");
            // Taken by another student — shown greyed/disabled, not bookable.
            dto.put("booked", !"AVAILABLE".equals(s.getStatus()));
            if (s.getCounsellor() != null) {
                dto.put("counsellorName", s.getCounsellor().getName());
            }
            slotDtos.add(dto);
        }

        Map<String, Object> out = new HashMap<>();
        out.put("slots", slotDtos);
        out.put("sessionsRemaining", remaining);
        return ResponseEntity.ok(out);
    }

    /**
     * Books one of the slots returned by {@link #listCounsellingSlots}.
     * Decrements {@code counsellingSessionsUsed} on the entitlement in the same
     * transaction as the booking, so seat exhaustion is honoured even under
     * concurrent clicks.
     *
     * <p>Body: {@code { token, entitlementId, slotId, reason? }}.
     */
    // @PreAuthorize-Exempt: public b2c funnel — anonymous, gated by entitlement accessToken.
    @PostMapping("/counselling/book")
    @Transactional
    public ResponseEntity<?> bookCounsellingSlot(@RequestBody Map<String, Object> body) {
        String token = strFromBody(body, "token");
        Long entitlementId = longFromBody(body, "entitlementId");
        Long slotId = longFromBody(body, "slotId");
        String reason = strFromBody(body, "reason");

        // entitlementId is required so redeemAccessToken's token↔entitlement match
        // is actually enforced (it is a no-op when entitlementId is null).
        if (entitlementId == null) {
            return ResponseEntity.badRequest().body("entitlementId is required");
        }

        // Basic contact details the student fills in when booking.
        String contactName = strFromBody(body, "contactName");
        String contactEmail = strFromBody(body, "contactEmail");
        String contactPhone = strFromBody(body, "contactPhone");
        String preferredContactMethod = strFromBody(body, "preferredContactMethod");
        // Optional parent/guardian contact — confirmation + reminders go here too.
        String parentEmail = strFromBody(body, "parentEmail");
        String parentPhone = strFromBody(body, "parentPhone");

        if (slotId == null) {
            return ResponseEntity.badRequest().body("slotId is required");
        }
        if (contactName == null || contactName.trim().isEmpty()
                || contactPhone == null || contactPhone.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Contact name and phone are required");
        }

        StudentEntitlement e = entitlementService == null
                ? null : entitlementService.redeemAccessToken(token, entitlementId);
        if (e == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid or expired token");
        }
        Optional<UserStudent> usOpt = userStudentRepository.findById(e.getUserStudentId());
        if (!usOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Student not found");
        }
        UserStudent student = usOpt.get();

        if (bookingService == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("Counselling booking is not configured on this instance");
        }

        int total = e.getCounsellingSessionsTotal() == null ? 0 : e.getCounsellingSessionsTotal();
        int used  = e.getCounsellingSessionsUsed()  == null ? 0 : e.getCounsellingSessionsUsed();
        boolean tierGrantedSession = Boolean.TRUE.equals(e.getCounsellingActive()) && (total - used) > 0;
        // Counselling is a free, optional add-on for any assessment that has an assigned
        // counsellor — booking is allowed regardless of the tier's session count.
        boolean offered = bookingService.hasCounsellorForAssessment(e.getAssessmentId());

        // Only fall back to the pay-before-book flow when counselling is NOT offered for
        // this assessment AND the tier didn't include a free session.
        if (!offered && !tierGrantedSession) {
            return initiateCounsellingPayment(e, student, slotId, reason,
                    contactName, contactEmail, contactPhone, preferredContactMethod);
        }

        try {
            com.kccitm.api.service.counselling.BookingService.BookingContact contact =
                    new com.kccitm.api.service.counselling.BookingService.BookingContact(
                            contactName != null ? contactName.trim() : null,
                            contactEmail != null ? contactEmail.trim() : null,
                            contactPhone != null ? contactPhone.trim() : null,
                            preferredContactMethod != null ? preferredContactMethod.trim() : null);
            contact.parentEmail = parentEmail != null && !parentEmail.trim().isEmpty() ? parentEmail.trim() : null;
            contact.parentPhone = parentPhone != null && !parentPhone.trim().isEmpty() ? parentPhone.trim() : null;
            com.kccitm.api.model.career9.counselling.CounsellingAppointment appt =
                    bookingService.bookSlot(slotId, student, reason, contact, entitlementId);
            // Decrement the seat counter only when the tier actually granted a session;
            // free offered-counselling bookings (no tier session) don't consume a seat.
            // Runs in the same transaction as the booking via Spring's default REQUIRED
            // propagation — if the post-booking save fails, the slot transition rolls back too.
            if (tierGrantedSession) {
                entitlementService.consumeCounsellingSession(entitlementId);
            }

            Map<String, Object> out = new HashMap<>();
            out.put("appointmentId", appt.getId());
            out.put("status", appt.getStatus());
            out.put("mode", appt.getMode());
            if (appt.getMeetingLink() != null) out.put("meetingLink", appt.getMeetingLink());
            if (appt.getLocation() != null) out.put("location", appt.getLocation());
            if (appt.getSlot() != null) {
                out.put("slotDate", appt.getSlot().getDate().toString());
                out.put("slotStartTime", appt.getSlot().getStartTime().toString());
                if (appt.getSlot().getCounsellor() != null) {
                    out.put("counsellorName", appt.getSlot().getCounsellor().getName());
                }
            }
            out.put("sessionsRemaining", Math.max(0, total - used - (tierGrantedSession ? 1 : 0)));
            return ResponseEntity.ok(out);
        } catch (com.kccitm.api.exception.BadRequestException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
        } catch (RuntimeException ex) {
            logger.warn("Counselling booking failed for entitlement {}: {}", entitlementId, ex.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
        }
    }

    /**
     * Phase 3b pay-before-book: the student's entitlement does not include a free
     * counselling session, so hold the slot and return a Razorpay payment link. On
     * payment success the webhook ({@code finalizeExtraCounsellingSlot}) confirms the
     * appointment from the held slot + contact details stored on the transaction.
     */
    private ResponseEntity<?> initiateCounsellingPayment(
            com.kccitm.api.model.career9.b2c.StudentEntitlement e, UserStudent student, Long slotId,
            String reason, String contactName, String contactEmail, String contactPhone,
            String preferredContactMethod) {
        long price = (e.getCounsellingPrice() != null && e.getCounsellingPrice() > 0)
                ? e.getCounsellingPrice() : counsellingDefaultPrice;
        if (price <= 0) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Counselling is not included in your plan and no price is configured.");
        }

        // Hold the slot for the payment window (fails with 409 if already taken).
        try {
            bookingService.holdSlot(slotId, counsellingPayWindowMinutes);
        } catch (com.kccitm.api.exception.BadRequestException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
        } catch (RuntimeException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
        }

        try {
            String referenceId = "CNS-" + slotId + "-" + System.currentTimeMillis()
                    + "-" + java.util.UUID.randomUUID().toString().substring(0, 6);
            String callbackUrl = (razorpayCallbackBaseUrl != null && !razorpayCallbackBaseUrl.isEmpty())
                    ? razorpayCallbackBaseUrl + "/payment-status?ref=" + referenceId : null;
            Map<String, String> notes = new HashMap<>();
            notes.put("purpose", "COUNSELLING_EXTRA");
            notes.put("slotId", slotId.toString());
            notes.put("referenceId", referenceId);

            Map<String, String> link = razorpayService.createPaymentLink(
                    price, "INR", "Career-9: Counselling session", callbackUrl, referenceId, notes);

            com.kccitm.api.model.career9.PaymentTransaction txn =
                    new com.kccitm.api.model.career9.PaymentTransaction();
            txn.setPurpose("COUNSELLING_EXTRA");
            txn.setAmount(price);
            txn.setUserStudentId(student.getUserStudentId());
            txn.setCounsellingSlotId(slotId);
            txn.setCounsellingContactName(contactName != null ? contactName.trim() : null);
            txn.setCounsellingContactEmail(contactEmail != null ? contactEmail.trim() : null);
            txn.setCounsellingContactPhone(contactPhone != null ? contactPhone.trim() : null);
            txn.setCounsellingContactMethod(preferredContactMethod != null ? preferredContactMethod.trim() : null);
            txn.setStudentName(contactName != null ? contactName.trim() : null);
            txn.setStudentEmail(contactEmail != null ? contactEmail.trim() : null);
            txn.setStudentPhone(contactPhone != null ? contactPhone.trim() : null);
            txn.setRazorpayLinkId(link.get("linkId"));
            txn.setPaymentLinkUrl(link.get("paymentLinkUrl"));
            txn.setShortUrl(link.get("shortUrl"));
            txn.setStatus("created");
            txn = paymentTransactionRepository.save(txn);

            Map<String, Object> out = new HashMap<>();
            out.put("requiresPayment", true);
            out.put("amount", price);
            out.put("transactionId", txn.getTransactionId());
            out.put("paymentUrl", txn.getShortUrl() != null ? txn.getShortUrl() : txn.getPaymentLinkUrl());
            out.put("slotId", slotId);
            return ResponseEntity.ok(out);
        } catch (Exception ex) {
            // Payment-link creation failed — release the hold so the slot reopens immediately.
            try { bookingService.releaseHeldSlot(slotId); } catch (Exception ignore) { }
            logger.error("Counselling payment initiation failed for slot {}: {}", slotId, ex.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Could not start payment. Please try again.");
        }
    }

    private static Long longFromBody(Map<String, Object> body, String key) {
        Object v = body.get(key);
        if (v == null) return null;
        try {
            return Long.valueOf(v.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String strFromBody(Map<String, Object> body, String key) {
        Object v = body.get(key);
        if (v == null) return null;
        String s = v.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private static Integer intFromBody(Map<String, Object> body, String key) {
        Object v = body.get(key);
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).intValue();
        try { return Integer.parseInt(v.toString().trim()); }
        catch (NumberFormatException e) { return null; }
    }

    /**
     * Resolve a SchoolClasses id to its grade number (e.g. "Class 10" → 10) for
     * StudentInfo.studentClass. Mirrors the B2B AssessmentInstituteMappingController
     * logic: strip non-digits from the class name; return null for non-numeric
     * names ("Nursery"/"LKG") rather than persisting the PK as a bogus grade.
     */
    private Integer parseClassNumber(Integer classId) {
        if (classId == null) return null;
        SchoolClasses sc = schoolClassesRepository.findById(classId).orElse(null);
        return sc == null ? null : gradeOf(sc.getClassName());
    }

    /** Grade number from a class name ("Class 10" → 10); null for non-numeric names. */
    private static Integer gradeOf(String className) {
        if (className == null) return null;
        String digits = className.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) return null;
        try { return Integer.parseInt(digits); }
        catch (NumberFormatException e) { return null; }
    }

    /** Atomically consume one promo use for a realized redemption; no-op if absent/at-cap. */
    private void consumePromoIfPresent(String promoCode) {
        if (promoCode == null || promoCode.trim().isEmpty()) return;
        promoCodeRepository.findByCodeIgnoreCase(promoCode.trim().toUpperCase()).ifPresent(p -> {
            int rows = promoCodeRepository.tryConsume(p.getId());
            if (rows == 0) {
                logger.warn("Promo {} already at maxUses at redemption time — not consumed", promoCode);
            }
        });
    }

    private static boolean sameDay(Date a, Date b) {
        if (a == null || b == null) return false;
        java.util.Calendar ca = java.util.Calendar.getInstance();
        java.util.Calendar cb = java.util.Calendar.getInstance();
        ca.setTime(a);
        cb.setTime(b);
        return ca.get(java.util.Calendar.YEAR) == cb.get(java.util.Calendar.YEAR)
            && ca.get(java.util.Calendar.MONTH) == cb.get(java.util.Calendar.MONTH)
            && ca.get(java.util.Calendar.DAY_OF_MONTH) == cb.get(java.util.Calendar.DAY_OF_MONTH);
    }
}
