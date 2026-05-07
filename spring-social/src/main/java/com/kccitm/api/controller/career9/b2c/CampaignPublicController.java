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
import com.kccitm.api.model.career9.b2c.PricingTier;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.repository.Career9.PromoCodeRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentTierRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignRepository;
import com.kccitm.api.repository.Career9.b2c.PricingTierRepository;
import com.kccitm.api.repository.Career9.b2c.PromoCodeCampaignRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.service.RazorpayService;
import com.kccitm.api.service.StudentSessionService;

import java.text.SimpleDateFormat;

@RestController
@RequestMapping("/campaign/public")
public class CampaignPublicController {

    private static final Logger logger = LoggerFactory.getLogger(CampaignPublicController.class);

    @Autowired private CampaignRepository campaignRepository;
    @Autowired private CampaignAssessmentMappingRepository mappingRepository;
    @Autowired private CampaignAssessmentTierRepository tierMappingRepository;
    @Autowired private PricingTierRepository pricingTierRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private PromoCodeRepository promoCodeRepository;
    @Autowired private PromoCodeCampaignRepository promoCodeCampaignRepository;
    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private StudentInfoRepository studentInfoRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private StudentAssessmentMappingRepository studentAssessmentMappingRepository;
    @Autowired private RazorpayService razorpayService;
    @Autowired private StudentSessionService studentSessionService;
    @Autowired(required = false) private com.kccitm.api.service.b2c.EntitlementService entitlementService;

    @org.springframework.beans.factory.annotation.Value("${app.razorpay.callback-base-url:}")
    private String callbackBaseUrl;

    @GetMapping("/info/{slug}")
    public ResponseEntity<?> infoBySlug(@PathVariable String slug) {
        return buildInfo(slug, null, null);
    }

    @GetMapping("/info/{slug}/{assessmentId}")
    public ResponseEntity<?> infoByAssessment(@PathVariable String slug,
                                              @PathVariable Long assessmentId) {
        return buildInfo(slug, assessmentId, null);
    }

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
                long basePaise = pt.getBasePriceInr() != null ? pt.getBasePriceInr() : 0L;
                long pricePaise = t.getPriceOverrideInr() != null ? t.getPriceOverrideInr() : basePaise;
                tDto.put("basePriceInr", basePaise / 100);
                tDto.put("priceInr", pricePaise / 100);
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
        return ResponseEntity.ok(response);
    }

    @PostMapping("/register/{slug}/{assessmentId}/{tierMappingId}")
    @Transactional
    public ResponseEntity<?> register(@PathVariable String slug,
                                      @PathVariable Long assessmentId,
                                      @PathVariable Long tierMappingId,
                                      @RequestBody Map<String, Object> body) {

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
        long originalPaise = tierMapping.getPriceOverrideInr() != null
                ? tierMapping.getPriceOverrideInr()
                : (pricingTier.getBasePriceInr() != null ? pricingTier.getBasePriceInr() : 0L);

        // 3. Validate input
        String name = strFromBody(body, "name");
        String email = strFromBody(body, "email");
        String dobStr = strFromBody(body, "dob");
        String phone = strFromBody(body, "phone");
        String gender = strFromBody(body, "gender");
        String promoCodeStr = strFromBody(body, "promoCode");

        if (name == null || email == null || dobStr == null) {
            return ResponseEntity.badRequest().body("Name, email, and date of birth are required");
        }
        SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
        Date dob;
        try { dob = sdf.parse(dobStr); }
        catch (Exception e) { return ResponseEntity.badRequest().body("Invalid date format. Use dd-MM-yyyy"); }

        // 4. Apply promo code (if any)
        Long finalPaise = originalPaise;
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
            finalPaise = originalPaise * (100 - promoDiscountPercent) / 100;
            promo.setCurrentUses(promo.getCurrentUses() + 1);
            promoCodeRepository.save(promo);
            promoCodeSaved = promo.getCode();
        }

        // 5. Email-DOB duplicate check (impersonation block)
        List<StudentInfo> existingByEmail = studentInfoRepository.findByEmail(email);
        StudentInfo existing = existingByEmail.isEmpty() ? null : existingByEmail.get(0);
        if (existing != null) {
            Date existingDob = existing.getStudentDob();
            if (existingDob == null || !sameDay(existingDob, dob)) {
                return ResponseEntity.badRequest().body(java.util.Map.of(
                    "status", "error",
                    "message", "This email is already registered with a different date of birth. " +
                               "If this is your account, please use your registered date of birth."));
            }
        }

        // 6. Free path → inline-provision and return session
        if (finalPaise == 0L) {
            return provisionFreeAndRespond(campaign, mapping, tierMapping, pricingTier,
                    existing, name, email, dob, dobStr, phone, gender,
                    promoCodeSaved, promoDiscountPercent, originalPaise);
        }

        // 7. Paid path → create Razorpay payment link + PaymentTransaction
        return createPaymentAndRedirect(campaign, mapping, tierMapping, pricingTier,
                name, email, dob, dobStr, phone, gender,
                finalPaise, originalPaise, promoCodeSaved, promoDiscountPercent);
    }

    private ResponseEntity<?> provisionFreeAndRespond(Campaign campaign,
            CampaignAssessmentMapping mapping, CampaignAssessmentTier tierMapping,
            PricingTier pricingTier, StudentInfo existing,
            String name, String email, Date dob, String dobStr, String phone, String gender,
            String promoCodeSaved, Integer promoDiscountPercent, long originalPaise) {

        // Create or reuse User+StudentInfo+UserStudent
        UserStudent userStudent;
        User user;
        if (existing != null) {
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
            studentInfo.setUser(user);
            studentInfo = studentInfoRepository.save(studentInfo);

            userStudent = new UserStudent(user, studentInfo, null);
            userStudent = userStudentRepository.save(userStudent);
        }

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
        txn.setOriginalAmount(originalPaise);
        txn.setStatus("paid");
        txn.setAssessmentId(assessmentId);
        txn.setCampaignId(campaign.getCampaignId());
        txn.setCampaignAssessmentTierId(tierMapping.getId());
        txn.setStudentName(name);
        txn.setStudentEmail(email);
        txn.setStudentDob(dob);
        txn.setStudentPhone(phone);
        txn.setUserStudentId(userStudent.getUserStudentId());
        if (promoCodeSaved != null) {
            txn.setPromoCode(promoCodeSaved);
            txn.setPromoDiscountPercent(promoDiscountPercent);
        }
        txn = paymentTransactionRepository.save(txn);

        // Trigger entitlement activation (welcome email + tier service delivery)
        if (entitlementService != null) {
            try { entitlementService.activateOnPayment(txn.getTransactionId()); }
            catch (Exception e) { logger.error("Entitlement activation failed (free path) for txn {}", txn.getTransactionId(), e); }
        }

        // Build session payload
        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Registration successful! Please save your login credentials.");
        response.put("username", user.getUsername());
        response.put("dob", dobStr);
        response.putAll(studentSessionService.buildSessionPayload(userStudent.getUserStudentId()));
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<?> createPaymentAndRedirect(Campaign campaign,
            CampaignAssessmentMapping mapping, CampaignAssessmentTier tierMapping,
            PricingTier pricingTier,
            String name, String email, Date dob, String dobStr, String phone, String gender,
            long finalPaise, long originalPaise, String promoCodeSaved, Integer promoDiscountPercent) {

        try {
            String description = pricingTier.getName() + " — " + campaign.getName();
            String callbackUrl = (callbackBaseUrl == null ? "" : callbackBaseUrl) + "/payment-status";
            String referenceId = "CAM-" + campaign.getCampaignId() + "-" + tierMapping.getId() + "-" + System.currentTimeMillis();

            Map<String, String> notes = new HashMap<>();
            notes.put("campaignId", String.valueOf(campaign.getCampaignId()));
            notes.put("assessmentId", String.valueOf(mapping.getAssessmentId()));
            notes.put("campaignAssessmentTierId", String.valueOf(tierMapping.getId()));
            notes.put("studentEmail", email);
            notes.put("customerName", name);
            notes.put("customerDob", dobStr);

            Map<String, String> rzpResponse = razorpayService.createPaymentLink(
                    finalPaise, "INR", description, callbackUrl, referenceId, notes);

            PaymentTransaction txn = new PaymentTransaction();
            txn.setAmount(finalPaise);
            txn.setOriginalAmount(originalPaise);
            txn.setAssessmentId(mapping.getAssessmentId());
            txn.setCampaignId(campaign.getCampaignId());
            txn.setCampaignAssessmentTierId(tierMapping.getId());
            txn.setStudentName(name);
            txn.setStudentEmail(email);
            txn.setStudentDob(dob);
            txn.setStudentPhone(phone);
            txn.setRazorpayLinkId(rzpResponse.get("linkId"));
            txn.setPaymentLinkUrl(rzpResponse.get("shortUrl"));
            txn.setShortUrl(rzpResponse.get("shortUrl"));
            txn.setStatus("created");
            if (promoCodeSaved != null) {
                txn.setPromoCode(promoCodeSaved);
                txn.setPromoDiscountPercent(promoDiscountPercent);
            }
            txn = paymentTransactionRepository.save(txn);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "payment_required");
            response.put("paymentUrl", rzpResponse.get("shortUrl"));
            response.put("transactionId", txn.getTransactionId());
            response.put("amount", finalPaise);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to create campaign payment link", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to create payment link. Please try again.");
        }
    }

    private static String strFromBody(Map<String, Object> body, String key) {
        Object v = body.get(key);
        if (v == null) return null;
        String s = v.toString().trim();
        return s.isEmpty() ? null : s;
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
