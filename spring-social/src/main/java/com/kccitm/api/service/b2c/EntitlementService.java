package com.kccitm.api.service.b2c;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Calendar;
import java.util.Date;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.b2c.Campaign;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentMapping;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentTier;
import com.kccitm.api.model.career9.b2c.PricingTier;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentTierRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignRepository;
import com.kccitm.api.repository.Career9.b2c.PricingTierRepository;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;

/**
 * Lifecycle of a StudentEntitlement: pending → active → expired/revoked/refunded.
 * All transitions and notification side-effects flow through this service.
 */
@Service
public class EntitlementService {

    private static final Logger logger = LoggerFactory.getLogger(EntitlementService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final long DEFAULT_TOKEN_TTL_DAYS = 30L;

    @Autowired private StudentEntitlementRepository entitlementRepository;
    @Autowired private CampaignRepository campaignRepository;
    @Autowired private CampaignAssessmentMappingRepository mappingRepository;
    @Autowired private CampaignAssessmentTierRepository tierMappingRepository;
    @Autowired private PricingTierRepository pricingTierRepository;
    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private NotificationDispatcher notificationDispatcher;
    @Autowired private LinkBuilder linkBuilder;

    /**
     * Path B step 1, OR Path A step 1 (pre-payment row). Returns existing pending row if one exists
     * for (userStudentId, campaignId, assessmentId) so we don't accumulate duplicates.
     */
    @Transactional
    public StudentEntitlement createPending(Long userStudentId, Long campaignId, Long assessmentId,
                                            String purchasePath, String counsellingModel) {
        if (userStudentId != null) {
            for (StudentEntitlement existing : entitlementRepository
                    .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(userStudentId, assessmentId)) {
                if ("pending".equals(existing.getStatus())
                        && (campaignId == null ? existing.getCampaignId() == null : campaignId.equals(existing.getCampaignId()))) {
                    return existing;
                }
            }
        }

        StudentEntitlement e = new StudentEntitlement();
        e.setUserStudentId(userStudentId);
        e.setCampaignId(campaignId);
        e.setAssessmentId(assessmentId);
        e.setPurchasePath(purchasePath);
        e.setCounsellingModel(counsellingModel);
        e.setStatus("pending");
        return entitlementRepository.save(e);
    }

    /**
     * Webhook-driven activation. Reads the PaymentTransaction, finds-or-creates an entitlement,
     * applies the tier feature snapshot, mints an access token, and sends the welcome email.
     */
    @Transactional
    public StudentEntitlement activateOnPayment(Long paymentTransactionId) {
        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findById(paymentTransactionId);
        if (!txnOpt.isPresent()) {
            logger.warn("activateOnPayment: txn {} not found", paymentTransactionId);
            return null;
        }
        PaymentTransaction txn = txnOpt.get();
        if (txn.getCampaignId() == null || txn.getCampaignAssessmentTierId() == null) {
            // Legacy school payment — no entitlement to create.
            return null;
        }

        StudentEntitlement entitlement = entitlementRepository.findByPaymentTransactionId(paymentTransactionId)
                .orElseGet(() -> findOrCreateForUpgrade(txn));

        applyTierSnapshot(entitlement, txn);
        entitlement.setStatus("active");
        entitlement.setGrantedAt(new Date());
        if (entitlement.getAccessToken() == null) {
            entitlement.setAccessToken(generateToken());
            entitlement.setAccessTokenExpiresAt(daysFromNow(DEFAULT_TOKEN_TTL_DAYS));
        }
        entitlement = entitlementRepository.save(entitlement);

        sendWelcomeAssessmentLink(entitlement, txn);
        return entitlement;
    }

    /**
     * Path B step 3: paid student already had a pending entitlement (created when they took the
     * free assessment). Promote it instead of creating a new one.
     */
    @Transactional
    public StudentEntitlement upgradePending(Long entitlementId, PaymentTransaction txn) {
        Optional<StudentEntitlement> opt = entitlementRepository.findById(entitlementId);
        if (!opt.isPresent()) return null;
        StudentEntitlement e = opt.get();
        e.setPaymentTransactionId(txn.getTransactionId());
        e.setCampaignAssessmentTierId(txn.getCampaignAssessmentTierId());
        applyTierSnapshot(e, txn);
        e.setStatus("active");
        e.setGrantedAt(new Date());
        if (e.getAccessToken() == null) {
            e.setAccessToken(generateToken());
            e.setAccessTokenExpiresAt(daysFromNow(DEFAULT_TOKEN_TTL_DAYS));
        }
        e = entitlementRepository.save(e);
        sendWelcomeAssessmentLink(e, txn);
        return e;
    }

    /**
     * Called from AssessmentAnswerController.submit at end of submission, fire-and-forget.
     * If the active entitlement includes a final report, mark it ready and email the link.
     */
    @Transactional
    public void onAssessmentCompleted(Long userStudentId, Long assessmentId, String studentEmail) {
        for (StudentEntitlement e : entitlementRepository
                .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(userStudentId, assessmentId)) {
            if (!"active".equals(e.getStatus()) && !"pending".equals(e.getStatus())) continue;
            String token = e.getAccessToken();
            if (token == null) {
                token = generateToken();
                e.setAccessToken(token);
                e.setAccessTokenExpiresAt(daysFromNow(DEFAULT_TOKEN_TTL_DAYS));
                entitlementRepository.save(e);
            }
            String onePagerLink = linkBuilder.onePager(token, e.getEntitlementId());

            if (Boolean.TRUE.equals(e.getFinalReportActive())) {
                String finalLink = linkBuilder.finalReport(token, e.getEntitlementId());
                String subject = "Your Career-9 final report is ready";
                String body = simpleHtml("Your full Career-9 report is ready.",
                        "View your detailed report:", finalLink, "Open final report");
                notificationDispatcher.sendEmail(e, studentEmail, "final_report", subject, body, finalLink);
            } else {
                String subject = "Your Career-9 1-pager is ready";
                String body = simpleHtml("Your free 1-page Career-9 summary is ready.",
                        "View your summary or unlock the full report from there:", onePagerLink, "Open 1-pager");
                notificationDispatcher.sendEmail(e, studentEmail, "one_pager", subject, body, onePagerLink);
            }
            return;
        }
    }

    /**
     * Public token redemption — used by every B2C deep link.
     * Returns the entitlement if the token is valid + active; null otherwise.
     */
    @Transactional
    public StudentEntitlement redeemAccessToken(String token, Long entitlementId) {
        if (token == null) return null;
        Optional<StudentEntitlement> opt = entitlementRepository.findByAccessToken(token);
        if (!opt.isPresent()) return null;
        StudentEntitlement e = opt.get();
        if (entitlementId != null && !entitlementId.equals(e.getEntitlementId())) return null;
        if (!"active".equals(e.getStatus()) && !"pending".equals(e.getStatus())) return null;
        if (e.getAccessTokenExpiresAt() != null && e.getAccessTokenExpiresAt().before(new Date())) return null;
        return e;
    }

    @Transactional
    public StudentEntitlement consumeCounsellingSession(Long entitlementId) {
        Optional<StudentEntitlement> opt = entitlementRepository.findById(entitlementId);
        if (!opt.isPresent()) return null;
        StudentEntitlement e = opt.get();
        int used = e.getCounsellingSessionsUsed() == null ? 0 : e.getCounsellingSessionsUsed();
        e.setCounsellingSessionsUsed(used + 1);
        return entitlementRepository.save(e);
    }

    @Transactional
    public StudentEntitlement revoke(Long entitlementId, String reason) {
        Optional<StudentEntitlement> opt = entitlementRepository.findById(entitlementId);
        if (!opt.isPresent()) return null;
        StudentEntitlement e = opt.get();
        e.setStatus("revoked");
        e.setDashboardActive(false);
        e.setCounsellingActive(false);
        e.setLmsActive(false);
        e.setFinalReportActive(false);
        e.setAccessTokenExpiresAt(new Date());
        logger.info("Entitlement {} revoked: {}", entitlementId, reason);
        return entitlementRepository.save(e);
    }

    @Transactional
    public StudentEntitlement extendExpiry(Long entitlementId, Date newExpiresAt) {
        Optional<StudentEntitlement> opt = entitlementRepository.findById(entitlementId);
        if (!opt.isPresent()) return null;
        StudentEntitlement e = opt.get();
        e.setExpiresAt(newExpiresAt);
        if (Boolean.TRUE.equals(e.getDashboardActive())) e.setDashboardExpiresAt(newExpiresAt);
        if (Boolean.TRUE.equals(e.getLmsActive())) e.setLmsExpiresAt(newExpiresAt);
        return entitlementRepository.save(e);
    }

    @Transactional
    public ResendResult resendServiceLink(Long entitlementId, String serviceType, String recipient) {
        Optional<StudentEntitlement> opt = entitlementRepository.findById(entitlementId);
        if (!opt.isPresent()) return new ResendResult(false, "Entitlement not found");
        StudentEntitlement e = opt.get();
        if (!"active".equals(e.getStatus())) return new ResendResult(false, "Entitlement not active");

        String token = e.getAccessToken();
        if (token == null) {
            token = generateToken();
            e.setAccessToken(token);
            e.setAccessTokenExpiresAt(daysFromNow(DEFAULT_TOKEN_TTL_DAYS));
            entitlementRepository.save(e);
        }
        Long eid = e.getEntitlementId();

        String link, subject, body;
        switch (serviceType) {
            case "assessment_invite":
                link = linkBuilder.assessmentStart(token, eid);
                subject = "Your Career-9 assessment link";
                body = simpleHtml("Here is your Career-9 assessment link.", "Take the assessment:", link, "Start assessment");
                break;
            case "one_pager":
                link = linkBuilder.onePager(token, eid);
                subject = "Your Career-9 1-pager";
                body = simpleHtml("Your 1-pager summary.", "View it:", link, "Open 1-pager");
                break;
            case "final_report":
                if (!Boolean.TRUE.equals(e.getFinalReportActive())) return new ResendResult(false, "Final report not in this tier");
                link = linkBuilder.finalReport(token, eid);
                subject = "Your Career-9 final report";
                body = simpleHtml("Your full report.", "View it:", link, "Open final report");
                break;
            case "dashboard_access":
                if (!Boolean.TRUE.equals(e.getDashboardActive())) return new ResendResult(false, "Dashboard not in this tier");
                link = linkBuilder.dashboard(token, eid);
                subject = "Your Career-9 dashboard access";
                body = simpleHtml("Open your dashboard.", "Click below:", link, "Open dashboard");
                break;
            case "counselling_book":
                if (!Boolean.TRUE.equals(e.getCounsellingActive())) return new ResendResult(false, "Counselling not in this tier");
                link = "1".equals(e.getCounsellingModel())
                        ? linkBuilder.counsellingBook(token, eid)
                        : linkBuilder.counsellingMySessions(token, eid);
                subject = "Book your Career-9 counselling session";
                body = simpleHtml("Book your counselling session.", "Pick a slot:", link, "Book session");
                break;
            case "lms_access":
                if (!Boolean.TRUE.equals(e.getLmsActive())) return new ResendResult(false, "LMS not in this tier");
                link = linkBuilder.lmsLaunch(token, eid);
                subject = "Your Career-9 LMS access";
                body = simpleHtml("Your LMS is ready.", "Launch it:", link, "Open LMS");
                break;
            default:
                return new ResendResult(false, "Unknown service type: " + serviceType);
        }
        notificationDispatcher.sendEmail(e, recipient, serviceType, subject, body, link);
        return new ResendResult(true, "Sent");
    }

    private StudentEntitlement findOrCreateForUpgrade(PaymentTransaction txn) {
        if (txn.getUserStudentId() != null) {
            for (StudentEntitlement e : entitlementRepository
                    .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(txn.getUserStudentId(), txn.getAssessmentId())) {
                if ("pending".equals(e.getStatus())
                        && (txn.getCampaignId() == null ? e.getCampaignId() == null
                                                        : txn.getCampaignId().equals(e.getCampaignId()))) {
                    e.setPaymentTransactionId(txn.getTransactionId());
                    return e;
                }
            }
        }
        StudentEntitlement e = new StudentEntitlement();
        e.setUserStudentId(txn.getUserStudentId());
        e.setCampaignId(txn.getCampaignId());
        e.setAssessmentId(txn.getAssessmentId());
        e.setPaymentTransactionId(txn.getTransactionId());
        return e;
    }

    private void applyTierSnapshot(StudentEntitlement entitlement, PaymentTransaction txn) {
        Long catId = txn.getCampaignAssessmentTierId();
        if (catId == null) return;
        Optional<CampaignAssessmentTier> catOpt = tierMappingRepository.findById(catId);
        if (!catOpt.isPresent()) return;
        CampaignAssessmentTier cat = catOpt.get();

        Optional<PricingTier> tierOpt = pricingTierRepository.findById(cat.getPricingTierId());
        if (!tierOpt.isPresent()) return;
        PricingTier tier = tierOpt.get();

        entitlement.setCampaignAssessmentTierId(catId);
        entitlement.setPricingTierId(tier.getTierId());
        entitlement.setFinalReportActive(Boolean.TRUE.equals(tier.getIncludesFinalReport()));
        entitlement.setDashboardActive(Boolean.TRUE.equals(tier.getIncludesDashboard()));
        entitlement.setCounsellingActive(Boolean.TRUE.equals(tier.getIncludesCounselling()));
        entitlement.setLmsActive(Boolean.TRUE.equals(tier.getIncludesLms()));
        entitlement.setCounsellingSessionsTotal(
                tier.getCounsellingSessionCount() != null ? tier.getCounsellingSessionCount() : 0);

        Date earliestExpiry = null;
        if (Boolean.TRUE.equals(tier.getIncludesDashboard()) && tier.getDashboardValidityDays() != null
                && tier.getDashboardValidityDays() > 0) {
            Date d = daysFromNow(tier.getDashboardValidityDays());
            entitlement.setDashboardExpiresAt(d);
            earliestExpiry = earlier(earliestExpiry, d);
        }
        if (Boolean.TRUE.equals(tier.getIncludesLms()) && tier.getLmsValidityDays() != null
                && tier.getLmsValidityDays() > 0) {
            Date d = daysFromNow(tier.getLmsValidityDays());
            entitlement.setLmsExpiresAt(d);
            earliestExpiry = earlier(earliestExpiry, d);
        }
        entitlement.setExpiresAt(earliestExpiry);

        // Resolve path/model from mapping if not already on the entitlement
        if (entitlement.getPurchasePath() == null || entitlement.getCounsellingModel() == null) {
            Optional<CampaignAssessmentMapping> mOpt = mappingRepository
                    .findByCampaignIdAndAssessmentIdAndIsDeletedFalse(txn.getCampaignId(), txn.getAssessmentId());
            Campaign campaign = txn.getCampaignId() != null
                    ? campaignRepository.findById(txn.getCampaignId()).orElse(null) : null;
            AssessmentTable a = assessmentTableRepository.findById(txn.getAssessmentId()).orElse(null);

            if (entitlement.getPurchasePath() == null) {
                String p = mOpt.map(CampaignAssessmentMapping::getPurchasePath).orElse(null);
                if (p == null && campaign != null) p = campaign.getDefaultPurchasePath();
                if (p == null && a != null) p = a.getDefaultPurchasePath();
                entitlement.setPurchasePath(p == null ? "B" : p);
            }
            if (entitlement.getCounsellingModel() == null) {
                String m = mOpt.map(CampaignAssessmentMapping::getCounsellingModel).orElse(null);
                if (m == null && campaign != null) m = campaign.getDefaultCounsellingModel();
                if (m == null && a != null) m = a.getDefaultCounsellingModel();
                entitlement.setCounsellingModel(m == null ? "1" : m);
            }
        }
    }

    private void sendWelcomeAssessmentLink(StudentEntitlement entitlement, PaymentTransaction txn) {
        String to = txn.getStudentEmail();
        if (to == null || to.isEmpty()) return;
        String link = linkBuilder.assessmentStart(entitlement.getAccessToken(), entitlement.getEntitlementId());
        String subject = "Welcome to Career-9 — start your assessment";
        String body = simpleHtml(
                "Welcome to Career-9! Your purchase is confirmed.",
                "Click below to start your assessment:",
                link,
                "Start assessment"
        );
        notificationDispatcher.sendEmail(entitlement, to, "assessment_invite", subject, body, link);
    }

    private static String simpleHtml(String greeting, String preLink, String link, String cta) {
        return "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;'>"
                + "<div style='background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:24px;border-radius:12px 12px 0 0;color:white;'>"
                + "<h2 style='margin:0;'>" + greeting + "</h2></div>"
                + "<div style='padding:24px;background:#fff;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 12px 12px;'>"
                + "<p>" + preLink + "</p>"
                + "<div style='text-align:center;margin:24px 0;'>"
                + "<a href='" + link + "' style='display:inline-block;padding:14px 32px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;'>" + cta + "</a>"
                + "</div>"
                + "<p style='color:#64748b;font-size:0.85em;margin-top:24px;'>If the button doesn't work, copy this link: " + link + "</p>"
                + "</div></div>";
    }

    private static String generateToken() {
        byte[] bytes = new byte[30];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static Date daysFromNow(long days) {
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DATE, (int) days);
        return c.getTime();
    }

    private static Date earlier(Date a, Date b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.before(b) ? a : b;
    }

    public static class ResendResult {
        public final boolean ok;
        public final String message;
        public ResendResult(boolean ok, String message) { this.ok = ok; this.message = message; }
    }
}
