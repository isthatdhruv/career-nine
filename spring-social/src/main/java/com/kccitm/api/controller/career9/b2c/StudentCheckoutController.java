package com.kccitm.api.controller.career9.b2c;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentTier;
import com.kccitm.api.model.career9.b2c.PricingTier;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentTierRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignRepository;
import com.kccitm.api.repository.Career9.b2c.PricingTierRepository;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.RazorpayService;

/**
 * Self-service B2C checkout for a logged-in student to unlock their own
 * dashboard. Resolves the student's campaign + assessment from their session
 * (never trusts client-supplied ids), lists the purchasable pricing tiers that
 * include the dashboard, and creates a Razorpay payment link via the existing
 * payment pipeline. Once the student pays, the existing webhook
 * ({@code /payment/webhook/razorpay}) activates the entitlement and flips
 * {@code dashboardActive}, which the {@code InsightAccessService} gate reads.
 *
 * <p>Only requires authentication — a student can only ever act on their own
 * entitlement, so no admin {@code payment.create} permission is needed (the
 * admin-only {@code /payment/generate-campaign-link} is for staff-initiated links).
 */
@RestController
@RequestMapping("/student-checkout")
public class StudentCheckoutController {

    private static final Logger logger = LoggerFactory.getLogger(StudentCheckoutController.class);

    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private StudentEntitlementRepository studentEntitlementRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private com.kccitm.api.service.PaymentTransactionWriter paymentTransactionWriter;
    @Autowired private RazorpayService razorpayService;

    @Autowired(required = false) private CampaignRepository campaignRepository;
    @Autowired(required = false) private CampaignAssessmentMappingRepository campaignAssessmentMappingRepository;
    @Autowired(required = false) private CampaignAssessmentTierRepository campaignAssessmentTierRepository;
    @Autowired(required = false) private PricingTierRepository pricingTierRepository;

    @Value("${app.razorpay.callback-base-url:}")
    private String callbackBaseUrl;

    /** The student's campaign + assessment, resolved from their entitlement history. */
    private static class Ctx {
        Long userStudentId;
        Long campaignId;
        Long assessmentId;
        UserStudent userStudent;
    }

    // ─────────────────────── options ───────────────────────

    /**
     * GET /student-checkout/dashboard-options
     * Lists the dashboard-including tiers the logged-in student can purchase for
     * their assessment. Empty list = nothing to sell (e.g. school-funded student,
     * or no campaign context).
     */
    @GetMapping("/dashboard-options")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> dashboardOptions(@AuthenticationPrincipal UserPrincipal principal) {
        if (!b2cEnabled()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("status", "b2c_disabled", "options", new ArrayList<>()));
        }
        Ctx ctx = resolveContext(principal);
        if (ctx == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("status", "not_a_student", "options", new ArrayList<>()));
        }
        Map<String, Object> body = new HashMap<>();
        body.put("campaignId", ctx.campaignId);
        body.put("assessmentId", ctx.assessmentId);
        body.put("options", ctx.campaignId == null || ctx.assessmentId == null
                ? new ArrayList<>() : listDashboardTiers(ctx.campaignId, ctx.assessmentId));
        return ResponseEntity.ok(body);
    }

    // ─────────────────────── checkout ───────────────────────

    /**
     * POST /student-checkout/dashboard-link  body: { campaignAssessmentTierId }
     * Creates a Razorpay payment link for the chosen tier, after validating it
     * belongs to the student's campaign-assessment and includes the dashboard.
     */
    @PostMapping("/dashboard-link")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> dashboardLink(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody Map<String, Object> request) {
        if (!b2cEnabled()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", "B2C not enabled"));
        }
        Ctx ctx = resolveContext(principal);
        if (ctx == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Not a student account"));
        }
        if (ctx.campaignId == null || ctx.assessmentId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "No purchasable campaign context for this student"));
        }
        Long tierId = toLong(request.get("campaignAssessmentTierId"));
        if (tierId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "campaignAssessmentTierId is required"));
        }

        try {
            var mappingOpt = campaignAssessmentMappingRepository
                    .findByCampaignIdAndAssessmentIdAndIsDeletedFalse(ctx.campaignId, ctx.assessmentId);
            if (mappingOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Assessment not part of campaign"));
            }
            Optional<CampaignAssessmentTier> tierMapOpt = campaignAssessmentTierRepository.findById(tierId);
            if (tierMapOpt.isEmpty()
                    || !mappingOpt.get().getId().equals(tierMapOpt.get().getCampaignAssessmentMappingId())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Tier does not belong to your assessment"));
            }
            Optional<PricingTier> pricingOpt = pricingTierRepository.findById(tierMapOpt.get().getPricingTierId());
            if (pricingOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Pricing tier not found"));
            }
            PricingTier pricing = pricingOpt.get();
            if (!Boolean.TRUE.equals(pricing.getIncludesDashboard())) {
                return ResponseEntity.badRequest().body(Map.of("error", "This plan does not include the dashboard"));
            }
            Long priceInr = tierMapOpt.get().getPriceOverrideInr() != null
                    ? tierMapOpt.get().getPriceOverrideInr() : pricing.getBasePriceInr();
            if (priceInr == null || priceInr <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Tier price is not set"));
            }

            // Student contact from their profile.
            StudentInfo si = ctx.userStudent.getStudentInfo();
            String studentName = si != null && si.getName() != null ? si.getName() : "Student";
            String studentEmail = si != null ? si.getEmail() : null;
            String studentPhone = si != null ? si.getPhoneNumber() : null;
            if (studentEmail == null || studentEmail.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Your profile has no email — please update it before paying"));
            }

            String assessmentName = assessmentTableRepository.findById(ctx.assessmentId)
                    .map(a -> a.getAssessmentName()).orElse("Assessment");
            String campaignName = campaignRepository.findById(ctx.campaignId)
                    .map(c -> c.getName()).orElse("Career-9");
            String description = "Career-9: " + campaignName + " — " + assessmentName + " (Dashboard)";

            // PAY1: commit a 'created' txn BEFORE the irreversible Razorpay link
            // call so a recoverable DB record always exists first.
            PaymentTransaction txn = new PaymentTransaction();
            txn.setAssessmentId(ctx.assessmentId);
            txn.setCampaignId(ctx.campaignId);
            txn.setCampaignAssessmentTierId(tierId);
            txn.setUserStudentId(ctx.userStudentId);
            txn.setAmount(priceInr);
            txn.setStudentName(studentName);
            txn.setStudentEmail(studentEmail);
            txn.setStudentPhone(studentPhone);
            txn.setStatus("created");
            txn = paymentTransactionWriter.saveInNewTransaction(txn);

            String referenceId = "DASH-" + ctx.userStudentId + "-" + tierId + "-" + txn.getTransactionId();

            // Prefer a caller-supplied return URL so the student lands back in the
            // app they checked out from (the student portal lives on a different
            // origin than the configured campaign callbackBaseUrl). Only accept
            // absolute http(s) URLs; otherwise fall back to the configured base.
            String returnUrl = request.get("returnUrl") instanceof String
                    ? ((String) request.get("returnUrl")).trim() : null;
            String callbackUrl;
            if (returnUrl != null && (returnUrl.startsWith("http://") || returnUrl.startsWith("https://"))) {
                callbackUrl = returnUrl;
            } else if (callbackBaseUrl != null && !callbackBaseUrl.isEmpty()) {
                callbackUrl = callbackBaseUrl + "/payment-status?ref=" + referenceId;
            } else {
                callbackUrl = null;
            }

            Map<String, String> notes = new HashMap<>();
            notes.put("campaignId", ctx.campaignId.toString());
            notes.put("assessmentId", ctx.assessmentId.toString());
            notes.put("campaignAssessmentTierId", tierId.toString());
            notes.put("userStudentId", ctx.userStudentId.toString());
            notes.put("referenceId", referenceId);
            notes.put("transactionId", String.valueOf(txn.getTransactionId()));

            Map<String, String> linkResult = razorpayService.createPaymentLink(
                    priceInr, "INR", description, callbackUrl, referenceId, notes);

            txn.setRazorpayLinkId(linkResult.get("linkId"));
            txn.setPaymentLinkUrl(linkResult.get("paymentLinkUrl"));
            txn.setShortUrl(linkResult.get("shortUrl"));
            txn = paymentTransactionWriter.saveInNewTransaction(txn);

            Map<String, Object> response = new HashMap<>();
            response.put("transactionId", txn.getTransactionId());
            response.put("shortUrl", txn.getShortUrl());
            response.put("razorpayLinkId", txn.getRazorpayLinkId());
            response.put("amount", priceInr);
            response.put("status", "created");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Student dashboard checkout failed for student={}", ctx.userStudentId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to start checkout: " + e.getMessage()));
        }
    }

    // ─────────────────────── helpers ───────────────────────

    private boolean b2cEnabled() {
        return campaignRepository != null && campaignAssessmentMappingRepository != null
                && campaignAssessmentTierRepository != null && pricingTierRepository != null;
    }

    /** Resolve the student + their (most recent) campaign/assessment from entitlements. */
    private Ctx resolveContext(UserPrincipal principal) {
        if (principal == null || principal.getId() == null) return null;
        UserStudent us = userStudentRepository.getByUserId(principal.getId()).orElse(null);
        if (us == null || us.getUserStudentId() == null) return null;

        Ctx ctx = new Ctx();
        ctx.userStudent = us;
        ctx.userStudentId = us.getUserStudentId();

        List<StudentEntitlement> ents = studentEntitlementRepository
                .findByUserStudentIdOrderByCreatedAtDesc(ctx.userStudentId);
        for (StudentEntitlement e : ents) {
            if (e.getCampaignId() != null && e.getAssessmentId() != null) {
                ctx.campaignId = e.getCampaignId();
                ctx.assessmentId = e.getAssessmentId();
                break;
            }
        }
        return ctx;
    }

    private List<Map<String, Object>> listDashboardTiers(Long campaignId, Long assessmentId) {
        List<Map<String, Object>> out = new ArrayList<>();
        var mappingOpt = campaignAssessmentMappingRepository
                .findByCampaignIdAndAssessmentIdAndIsDeletedFalse(campaignId, assessmentId);
        if (mappingOpt.isEmpty()) return out;
        List<CampaignAssessmentTier> tiers = campaignAssessmentTierRepository
                .findByCampaignAssessmentMappingIdAndIsActiveTrueOrderByIdAsc(mappingOpt.get().getId());
        for (CampaignAssessmentTier t : tiers) {
            PricingTier p = pricingTierRepository.findById(t.getPricingTierId()).orElse(null);
            if (p == null || !Boolean.TRUE.equals(p.getIncludesDashboard())) continue;
            Long priceInr = t.getPriceOverrideInr() != null ? t.getPriceOverrideInr() : p.getBasePriceInr();
            Map<String, Object> tier = new HashMap<>();
            tier.put("campaignAssessmentTierId", t.getId());
            tier.put("name", p.getName());
            tier.put("priceInr", priceInr);
            tier.put("includesDashboard", p.getIncludesDashboard());
            tier.put("includesFinalReport", p.getIncludesFinalReport());
            tier.put("includesCounselling", p.getIncludesCounselling());
            tier.put("counsellingSessionCount", p.getCounsellingSessionCount());
            tier.put("includesLms", p.getIncludesLms());
            tier.put("dashboardValidityDays", p.getDashboardValidityDays());
            out.add(tier);
        }
        return out;
    }

    private static Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).longValue();
        try {
            return Long.parseLong(o.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
