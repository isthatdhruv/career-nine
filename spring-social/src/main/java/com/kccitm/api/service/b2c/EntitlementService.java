package com.kccitm.api.service.b2c;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.SimpleDateFormat;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.AssessmentInstituteMapping;
import com.kccitm.api.model.career9.AssessmentMappingTier;
import com.kccitm.api.model.career9.SchoolAssessmentTier;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.SchoolAssessmentTier;
import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.b2c.Campaign;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentMapping;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentTier;
import com.kccitm.api.model.career9.b2c.PricingTier;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.repository.Career9.AssessmentMappingTierRepository;
import com.kccitm.api.repository.Career9.AssessmentInstituteMappingRepository;
import com.kccitm.api.repository.Career9.SchoolAssessmentTierRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
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
    @Autowired private AssessmentMappingTierRepository assessmentMappingTierRepository;
    @Autowired private AssessmentInstituteMappingRepository instituteMappingRepository;
    @Autowired private SchoolAssessmentTierRepository schoolAssessmentTierRepository;
    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private NotificationDispatcher notificationDispatcher;
    @Autowired private LinkBuilder linkBuilder;
    @Autowired private com.kccitm.api.repository.Career9.GeneratedReportRepository generatedReportRepository;
    /** Single source of the report-mail body — legacy and resend paths render through it. */
    @Autowired private com.kccitm.api.service.b2c.report.pipeline.ReportEmailComposer reportEmailComposer;
    /** Optional: counselling CTA for the report mail; absent where counselling isn't wired. */
    @Autowired(required = false)
    private com.kccitm.api.service.counselling.CounsellingBookingLinkService counsellingBookingLinkService;

    /**
     * Mirrors {@code report.pipeline.enabled}. When the Kafka report pipeline is on,
     * the final-report "report ready" email is sent by the report-worker AFTER the
     * report is generated — with the Spaces CDN report link and the PDF — instead of
     * the legacy immediate send in {@link #onAssessmentCompleted} (which could only
     * offer the tokenized viewer link, since no PDF exists yet at completion time).
     */
    @org.springframework.beans.factory.annotation.Value("${report.pipeline.enabled:true}")
    private boolean reportPipelineEnabled;

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

        // ENT-ACT / WEL1: idempotent — a webhook retry or reconcile race that re-runs
        // activation for an entitlement already activated by THIS payment must not
        // re-snapshot or re-send the welcome email.
        if ("active".equals(entitlement.getStatus())
                && paymentTransactionId.equals(entitlement.getPaymentTransactionId())) {
            return entitlement;
        }
        // STATE1: never resurrect a revoked/refunded entitlement through a (re)payment webhook.
        if ("revoked".equals(entitlement.getStatus()) || "refunded".equals(entitlement.getStatus())) {
            logger.warn("activateOnPayment: refusing to reactivate {} entitlement {}",
                    entitlement.getStatus(), entitlement.getEntitlementId());
            return entitlement;
        }

        applyTierSnapshot(entitlement, txn);
        entitlement.setStatus("active");
        entitlement.setGrantedAt(new Date());
        if (entitlement.getAccessToken() == null) {
            entitlement.setAccessToken(generateToken());
            entitlement.setAccessTokenExpiresAt(daysFromNow(DEFAULT_TOKEN_TTL_DAYS));
        }
        entitlement = entitlementRepository.save(entitlement);

        // WEL1: send the welcome email only once (guards against re-activation / redrive).
        if (notificationDispatcher.countSent(entitlement.getEntitlementId(), "assessment_invite") == 0) {
            sendWelcomeAssessmentLink(entitlement, txn);
        }
        return entitlement;
    }

    /**
     * School (B2B) entitlement grant. The school registration funnel has no campaign
     * and no PaymentTransaction-driven activation path (activateOnPayment skips
     * campaign-less txns), so this mints/updates a campaign-less entitlement directly
     * from a {@link SchoolAssessmentTier}'s feature flags — the school equivalent of
     * {@link #applyTierSnapshot}.
     *
     * Idempotent per (userStudentId, assessmentId): reuses the most recent existing
     * entitlement for that pair so re-registration / re-runs never duplicate. Returns
     * null (no-op) when the tier unlocks nothing beyond the base assessment, so plain
     * school assessments are unaffected. Mints an access token so the assessment
     * thank-you page can resolve counselling for this student.
     */
    @Transactional
    public StudentEntitlement grantSchoolEntitlement(Long userStudentId, Long assessmentId,
            SchoolAssessmentTier tier) {
        if (userStudentId == null || assessmentId == null || tier == null) return null;

        boolean grantsAnything = Boolean.TRUE.equals(tier.getIncludesFinalReport())
                || Boolean.TRUE.equals(tier.getIncludesDashboard())
                || Boolean.TRUE.equals(tier.getIncludesCounselling())
                || Boolean.TRUE.equals(tier.getIncludesLms());
        if (!grantsAnything) return null;

        List<StudentEntitlement> existing = entitlementRepository
                .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(userStudentId, assessmentId);
        StudentEntitlement e = existing.isEmpty() ? new StudentEntitlement() : existing.get(0);

        e.setUserStudentId(userStudentId);
        e.setAssessmentId(assessmentId);
        e.setCampaignId(null); // school / B2B entitlement (no campaign)
        e.setStatus("active");
        e.setGrantedAt(new Date());
        e.setFinalReportActive(Boolean.TRUE.equals(tier.getIncludesFinalReport()));
        e.setDashboardActive(Boolean.TRUE.equals(tier.getIncludesDashboard()));
        e.setCounsellingActive(Boolean.TRUE.equals(tier.getIncludesCounselling()));
        e.setLmsActive(Boolean.TRUE.equals(tier.getIncludesLms()));
        e.setCounsellingSessionsTotal(
                tier.getCounsellingSessionCount() != null ? tier.getCounsellingSessionCount() : 0);
        if (e.getCounsellingSessionsUsed() == null) e.setCounsellingSessionsUsed(0);

        Date earliestExpiry = null;
        if (Boolean.TRUE.equals(tier.getIncludesDashboard()) && tier.getDashboardValidityDays() != null
                && tier.getDashboardValidityDays() > 0) {
            Date d = daysFromNow(tier.getDashboardValidityDays());
            e.setDashboardExpiresAt(d);
            earliestExpiry = earlier(earliestExpiry, d);
        }
        if (Boolean.TRUE.equals(tier.getIncludesLms()) && tier.getLmsValidityDays() != null
                && tier.getLmsValidityDays() > 0) {
            Date d = daysFromNow(tier.getLmsValidityDays());
            e.setLmsExpiresAt(d);
            earliestExpiry = earlier(earliestExpiry, d);
        }
        e.setExpiresAt(earliestExpiry);

        if (e.getAccessToken() == null) {
            e.setAccessToken(generateToken());
            e.setAccessTokenExpiresAt(daysFromNow(DEFAULT_TOKEN_TTL_DAYS));
        }
        // purchase_path column is length 1 — leave null for school. Self-serve booking.
        if (e.getCounsellingModel() == null) e.setCounsellingModel("1");

        StudentEntitlement saved = entitlementRepository.save(e);
        logger.info("School entitlement granted/updated: id={} userStudent={} assessment={} counselling={} sessions={}",
                saved.getEntitlementId(), userStudentId, assessmentId,
                saved.getCounsellingActive(), saved.getCounsellingSessionsTotal());
        return saved;
    }

    /**
     * Resolve the active, counselling-bearing entitlement for a (student, assessment)
     * pair — used by the assessment thank-you page for SCHOOL students, who reach it
     * via a fresh login and therefore have no entitlementId in hand. Returns the most
     * recent active entitlement that has counselling switched on, or null.
     */
    @Transactional(readOnly = true)
    public StudentEntitlement findActiveCounsellingForStudent(Long userStudentId, Long assessmentId) {
        if (userStudentId == null || assessmentId == null) return null;
        for (StudentEntitlement e : entitlementRepository
                .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(userStudentId, assessmentId)) {
            if ("active".equals(e.getStatus()) && Boolean.TRUE.equals(e.getCounsellingActive())) {
                return e;
            }
        }
        return null;
    }

    /**
     * The student's current mapping entitlement id for an assessment (any non-terminal
     * status), or null. Used to LINK a PAY_LATER counselling appointment to the
     * entitlement so the thank-you page detects "already booked" — even though
     * PAY_LATER grants no included session pool.
     */
    @Transactional(readOnly = true)
    public Long findActiveMappingEntitlementId(Long userStudentId, Long assessmentId) {
        if (userStudentId == null || assessmentId == null) return null;
        for (StudentEntitlement e : entitlementRepository
                .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(userStudentId, assessmentId)) {
            if (e.getCampaignId() == null && e.getMappingId() != null
                    && !"revoked".equals(e.getStatus()) && !"refunded".equals(e.getStatus())) {
                return e.getEntitlementId();
            }
        }
        return null;
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

    // ===== B2B (assessment-mapping) entitlements =====
    // Same StudentEntitlement + same gates as B2C, but sourced from an
    // AssessmentMappingTier and scoped by mapping_id (campaign_id stays null).
    // No email here — the B2B register/webhook paths own credential delivery
    // and auto-login. This is purely the access GRANT.

    /**
     * Activate (or upgrade) a B2B entitlement from a paid/free/upgrade PaymentTransaction
     * that carries mapping_id + mapping_tier_id. Works for first registration AND the
     * free->paid upgrade: it find-or-creates the student's B2B entitlement for the
     * assessment and UNIONs the tier's service flags (never dropping an already-granted
     * service), extending each service window to the later expiry.
     */
    @Transactional
    public StudentEntitlement activateB2BOnPayment(Long paymentTransactionId) {
        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findById(paymentTransactionId);
        if (!txnOpt.isPresent()) {
            logger.warn("activateB2BOnPayment: txn {} not found", paymentTransactionId);
            return null;
        }
        PaymentTransaction txn = txnOpt.get();
        if (txn.getMappingId() == null || txn.getMappingTierId() == null) {
            return null; // not a B2B mapping payment
        }
        Optional<AssessmentMappingTier> tierOpt =
                assessmentMappingTierRepository.findById(txn.getMappingTierId());
        if (!tierOpt.isPresent()) {
            logger.warn("activateB2BOnPayment: mapping tier {} not found", txn.getMappingTierId());
            return null;
        }
        AssessmentMappingTier tier = tierOpt.get();

        StudentEntitlement entitlement = entitlementRepository.findByPaymentTransactionId(paymentTransactionId)
                .orElseGet(() -> findOrCreateB2B(txn));

        // Idempotent: same txn already activated → no-op (webhook retry / reconcile race).
        if ("active".equals(entitlement.getStatus())
                && paymentTransactionId.equals(entitlement.getPaymentTransactionId())) {
            return entitlement;
        }
        // STATE1: never resurrect a revoked/refunded entitlement.
        if ("revoked".equals(entitlement.getStatus()) || "refunded".equals(entitlement.getStatus())) {
            logger.warn("activateB2BOnPayment: refusing to reactivate {} entitlement {}",
                    entitlement.getStatus(), entitlement.getEntitlementId());
            return entitlement;
        }

        applyMappingTierSnapshot(entitlement, tier);
        entitlement.setMappingId(txn.getMappingId());
        entitlement.setPaymentTransactionId(txn.getTransactionId());
        entitlement.setStatus("active");
        entitlement.setGrantedAt(new Date());
        if (entitlement.getAccessToken() == null) {
            entitlement.setAccessToken(generateToken());
            entitlement.setAccessTokenExpiresAt(daysFromNow(DEFAULT_TOKEN_TTL_DAYS));
        }
        return entitlementRepository.save(entitlement);
    }

    /** Latest non-terminal B2B entitlement for (student, assessment), or a fresh row. */
    private StudentEntitlement findOrCreateB2B(PaymentTransaction txn) {
        if (txn.getUserStudentId() != null) {
            for (StudentEntitlement e : entitlementRepository
                    .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(
                            txn.getUserStudentId(), txn.getAssessmentId())) {
                if (e.getCampaignId() == null
                        && !"revoked".equals(e.getStatus()) && !"refunded".equals(e.getStatus())) {
                    e.setPaymentTransactionId(txn.getTransactionId());
                    return e;
                }
            }
        }
        StudentEntitlement e = new StudentEntitlement();
        e.setUserStudentId(txn.getUserStudentId());
        e.setAssessmentId(txn.getAssessmentId());
        e.setMappingId(txn.getMappingId());
        e.setPaymentTransactionId(txn.getTransactionId());
        return e;
    }

    // ===== Legacy-school entitlements (same StudentEntitlement + same gates) =====
    // The school flow keeps its own school_assessment_config / school_assessment_tier
    // tables, but a school registration now mints the same access-grant row as the
    // per-level B2B flow so school students pass the report/dashboard/counselling/LMS
    // gates. Sourced from a SchoolAssessmentTier and scoped by school_config_id
    // (campaign_id AND mapping_id both stay null).

    /**
     * Activate (or top-up) a school entitlement from a paid/free PaymentTransaction
     * that carries school_config_id + mapping_tier_id (a school_assessment_tier id).
     * Mirrors {@link #activateB2BOnPayment} — find-or-create the student's school
     * entitlement for the assessment and UNION the tier's service flags (additive,
     * never dropping an already-granted service).
     */
    @Transactional
    public StudentEntitlement activateSchoolOnPayment(Long paymentTransactionId) {
        Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findById(paymentTransactionId);
        if (!txnOpt.isPresent()) {
            logger.warn("activateSchoolOnPayment: txn {} not found", paymentTransactionId);
            return null;
        }
        PaymentTransaction txn = txnOpt.get();
        if (txn.getSchoolConfigId() == null || txn.getMappingTierId() == null) {
            return null; // not a school payment
        }
        Optional<SchoolAssessmentTier> tierOpt =
                schoolAssessmentTierRepository.findById(txn.getMappingTierId());
        if (!tierOpt.isPresent()) {
            logger.warn("activateSchoolOnPayment: school tier {} not found", txn.getMappingTierId());
            return null;
        }
        SchoolAssessmentTier tier = tierOpt.get();

        StudentEntitlement entitlement = entitlementRepository.findByPaymentTransactionId(paymentTransactionId)
                .orElseGet(() -> findOrCreateSchool(txn));

        // Idempotent: same txn already activated → no-op (webhook retry / reconcile race).
        if ("active".equals(entitlement.getStatus())
                && paymentTransactionId.equals(entitlement.getPaymentTransactionId())) {
            return entitlement;
        }
        // STATE1: never resurrect a revoked/refunded entitlement.
        if ("revoked".equals(entitlement.getStatus()) || "refunded".equals(entitlement.getStatus())) {
            logger.warn("activateSchoolOnPayment: refusing to reactivate {} entitlement {}",
                    entitlement.getStatus(), entitlement.getEntitlementId());
            return entitlement;
        }

        applyInclusionSnapshot(entitlement, ServiceInclusions.fromSchoolTier(tier));
        entitlement.setSchoolConfigId(txn.getSchoolConfigId());
        entitlement.setPaymentTransactionId(txn.getTransactionId());
        entitlement.setStatus("active");
        entitlement.setGrantedAt(new Date());
        if (entitlement.getAccessToken() == null) {
            entitlement.setAccessToken(generateToken());
            entitlement.setAccessTokenExpiresAt(daysFromNow(DEFAULT_TOKEN_TTL_DAYS));
        }
        return entitlementRepository.save(entitlement);
    }

    /** Latest non-terminal school entitlement for (student, assessment), or a fresh row. */
    private StudentEntitlement findOrCreateSchool(PaymentTransaction txn) {
        if (txn.getUserStudentId() != null) {
            for (StudentEntitlement e : entitlementRepository
                    .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(
                            txn.getUserStudentId(), txn.getAssessmentId())) {
                if (e.getCampaignId() == null && e.getMappingId() == null
                        && !"revoked".equals(e.getStatus()) && !"refunded".equals(e.getStatus())) {
                    e.setPaymentTransactionId(txn.getTransactionId());
                    return e;
                }
            }
        }
        StudentEntitlement e = new StudentEntitlement();
        e.setUserStudentId(txn.getUserStudentId());
        e.setAssessmentId(txn.getAssessmentId());
        e.setSchoolConfigId(txn.getSchoolConfigId());
        e.setPaymentTransactionId(txn.getTransactionId());
        return e;
    }

    /** Union an AssessmentMappingTier's service flags onto the entitlement. */
    private void applyMappingTierSnapshot(StudentEntitlement e, AssessmentMappingTier tier) {
        ServiceInclusions inc = ServiceInclusions.fromMappingTier(tier);
        // PAY_LATER: counselling is purchased per-slot AFTER the assessment, so a
        // registration payment must NOT pre-activate the tier's included counselling
        // (otherwise the student would book for free instead of paying the per-slot
        // counselling fee). Every other service (report/dashboard/LMS) still activates.
        if (tier.getMappingId() != null) {
            AssessmentInstituteMapping m = instituteMappingRepository.findById(tier.getMappingId()).orElse(null);
            if (m != null && "PAY_LATER".equals(m.getPaymentTiming())) {
                inc = inc.withoutCounselling();
            }
        }
        applyInclusionSnapshot(e, inc);
        // Snapshot the per-session counselling fee so the post-assessment per-slot
        // booking flow (PAY_LATER) and any EXTRA-session purchase know the price.
        // NULL leaves the booking flow to fall back to the configurable global default.
        if (tier.getCounsellingPrice() != null) {
            e.setCounsellingPrice(tier.getCounsellingPrice());
        }
    }

    /**
     * Tier-table-agnostic view of the service inclusions a tier grants. Both the
     * per-level {@link AssessmentMappingTier} and the legacy {@link SchoolAssessmentTier}
     * project into this so a single snapshot routine serves both flows.
     */
    private static final class ServiceInclusions {
        final boolean finalReport, dashboard, counselling, lms, counsellorReleaseReport;
        final Integer dashboardValidityDays, counsellingSessionCount, lmsValidityDays;

        private ServiceInclusions(boolean finalReport, boolean dashboard, Integer dashboardValidityDays,
                                  boolean counselling, Integer counsellingSessionCount,
                                  boolean lms, Integer lmsValidityDays,
                                  boolean counsellorReleaseReport) {
            this.finalReport = finalReport;
            this.dashboard = dashboard;
            this.dashboardValidityDays = dashboardValidityDays;
            this.counselling = counselling;
            this.counsellingSessionCount = counsellingSessionCount;
            this.lms = lms;
            this.lmsValidityDays = lmsValidityDays;
            this.counsellorReleaseReport = counsellorReleaseReport;
        }

        static ServiceInclusions fromMappingTier(AssessmentMappingTier t) {
            return new ServiceInclusions(
                    Boolean.TRUE.equals(t.getIncludesFinalReport()),
                    Boolean.TRUE.equals(t.getIncludesDashboard()), t.getDashboardValidityDays(),
                    Boolean.TRUE.equals(t.getIncludesCounselling()), t.getCounsellingSessionCount(),
                    Boolean.TRUE.equals(t.getIncludesLms()), t.getLmsValidityDays(),
                    Boolean.TRUE.equals(t.getCounsellorReleaseReport()));
        }

        /**
         * The legacy school tier has no counsellor-release setting of its own, so a school
         * entitlement never holds the report — which is the behaviour those schools have
         * always had, and changing it silently would stop reports they expect.
         */
        static ServiceInclusions fromSchoolTier(SchoolAssessmentTier t) {
            return new ServiceInclusions(
                    Boolean.TRUE.equals(t.getIncludesFinalReport()),
                    Boolean.TRUE.equals(t.getIncludesDashboard()), t.getDashboardValidityDays(),
                    Boolean.TRUE.equals(t.getIncludesCounselling()), t.getCounsellingSessionCount(),
                    Boolean.TRUE.equals(t.getIncludesLms()), t.getLmsValidityDays(),
                    false);
        }

        /** Copy with counselling stripped — used to defer counselling to PAY_LATER per-slot booking. */
        ServiceInclusions withoutCounselling() {
            return new ServiceInclusions(finalReport, dashboard, dashboardValidityDays,
                    false, 0, lms, lmsValidityDays, counsellorReleaseReport);
        }
    }

    /** Union a tier's service flags onto the entitlement (additive; never drops access). */
    private void applyInclusionSnapshot(StudentEntitlement e, ServiceInclusions inc) {
        e.setFinalReportActive(Boolean.TRUE.equals(e.getFinalReportActive()) || inc.finalReport);
        e.setDashboardActive(Boolean.TRUE.equals(e.getDashboardActive()) || inc.dashboard);
        e.setCounsellingActive(Boolean.TRUE.equals(e.getCounsellingActive()) || inc.counselling);
        e.setLmsActive(Boolean.TRUE.equals(e.getLmsActive()) || inc.lms);
        // Additive like the flags above: once any tier the student holds says the report is
        // the counsellor's to release, an upgrade bought on a plainer tier must not quietly
        // start posting it out.
        e.setCounsellorReleaseReport(
                Boolean.TRUE.equals(e.getCounsellorReleaseReport()) || inc.counsellorReleaseReport);

        // A tier with the counselling toggle ON must always grant at least one
        // bookable session, even if the admin left the session-count field blank.
        // Otherwise counsellingActive=true but counsellingSessionsTotal=0, and every
        // "(total - used) > 0" gate (canBookNow, hasFreeSession, showCounsellingButton,
        // the active-counselling query) hides the slot-booking option despite
        // counselling being enabled. The toggle alone should unlock booking.
        int newSessions;
        if (inc.counselling) {
            newSessions = (inc.counsellingSessionCount != null && inc.counsellingSessionCount > 0)
                    ? inc.counsellingSessionCount
                    : 1;
        } else {
            newSessions = inc.counsellingSessionCount != null ? inc.counsellingSessionCount : 0;
        }
        int curSessions = e.getCounsellingSessionsTotal() != null ? e.getCounsellingSessionsTotal() : 0;
        e.setCounsellingSessionsTotal(Math.max(curSessions, newSessions));

        if (inc.dashboard && inc.dashboardValidityDays != null && inc.dashboardValidityDays > 0) {
            e.setDashboardExpiresAt(laterExpiry(e.getDashboardExpiresAt(), daysFromNow(inc.dashboardValidityDays)));
        }
        if (inc.lms && inc.lmsValidityDays != null && inc.lmsValidityDays > 0) {
            e.setLmsExpiresAt(laterExpiry(e.getLmsExpiresAt(), daysFromNow(inc.lmsValidityDays)));
        }

        // Overall expiry = earliest active service window (services with no window never expire).
        Date earliest = null;
        if (Boolean.TRUE.equals(e.getDashboardActive()) && e.getDashboardExpiresAt() != null) {
            earliest = earlier(earliest, e.getDashboardExpiresAt());
        }
        if (Boolean.TRUE.equals(e.getLmsActive()) && e.getLmsExpiresAt() != null) {
            earliest = earlier(earliest, e.getLmsExpiresAt());
        }
        e.setExpiresAt(earliest);
    }

    /**
     * Called from AssessmentAnswerController.submit at end of submission, fire-and-forget.
     * If the active entitlement includes a final report, mark it ready and email the link.
     *
     * <p>Unless the tier hands that decision to the counsellor. On those tiers the results are
     * meant to be explained rather than delivered, so nothing is sent here — the link goes out
     * when the counsellor presses "Send report" on the session. Nothing else about the
     * entitlement changes — the report is generated and stored exactly as before, and the
     * release is a send and nothing more.
     */
    @Transactional
    public void onAssessmentCompleted(Long userStudentId, Long assessmentId, String studentEmail) {
        for (StudentEntitlement e : entitlementRepository
                .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(userStudentId, assessmentId)) {
            if (!"active".equals(e.getStatus()) && !"pending".equals(e.getStatus())) continue;
            if (Boolean.TRUE.equals(e.getCounsellorReleaseReport())) {
                logger.info("Report held for counsellor release: student={} assessment={} entitlement={}",
                        userStudentId, assessmentId, e.getEntitlementId());
                return;
            }
            String token = e.getAccessToken();
            if (token == null) {
                token = generateToken();
                e.setAccessToken(token);
                e.setAccessTokenExpiresAt(daysFromNow(DEFAULT_TOKEN_TTL_DAYS));
                entitlementRepository.save(e);
            }
            String onePagerLink = linkBuilder.onePager(token, e.getEntitlementId());

            if (Boolean.TRUE.equals(e.getFinalReportActive())) {
                if (reportPipelineEnabled) {
                    // The report pipeline (Kafka → report-worker) sends this email once
                    // the report is generated and stored in Spaces, with the CDN report
                    // link + PDF attached — the producer stamps this entitlement on the
                    // generate event (see resolvePipelineReportEmail). Sending here too
                    // would double-mail the student with a stale viewer-only link.
                    logger.info("Final report email delegated to report pipeline: student={} assessment={} entitlement={}",
                            userStudentId, assessmentId, e.getEntitlementId());
                    return;
                }
                // Legacy fallback (pipeline disabled): immediate send with the tokenized
                // viewer link — no PDF exists yet at completion time.
                String finalLink = linkBuilder.finalReport(token, e.getEntitlementId());
                String subject = "Your Career-9 report is ready";
                String body = reportReadyEmailBody(e, finalLink, null);
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
     * Report-pipeline hook: the entitlement (if any) whose final-report email the
     * pipeline should deliver for this completion. Mirrors {@link #onAssessmentCompleted}'s
     * selection exactly: the first active/pending entitlement wins; a counsellor-release
     * tier holds the report (the pipeline's ReportReleaseGate enforces the same hold);
     * a tier without the final report gets the 1-pager email from onAssessmentCompleted
     * instead — never a pipeline email.
     */
    @Transactional(readOnly = true)
    public StudentEntitlement resolvePipelineReportEmail(Long userStudentId, Long assessmentId) {
        if (userStudentId == null || assessmentId == null) return null;
        for (StudentEntitlement e : entitlementRepository
                .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(userStudentId, assessmentId)) {
            if (!"active".equals(e.getStatus()) && !"pending".equals(e.getStatus())) continue;
            if (Boolean.TRUE.equals(e.getCounsellorReleaseReport())) return null;
            return Boolean.TRUE.equals(e.getFinalReportActive()) ? e : null;
        }
        return null;
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

    /**
     * Credits a counselling session back to an entitlement (decrements used, floored
     * at 0). Used when a booking is missed/cancelled: per the "always rebookable, no
     * forfeit" rule a session is only truly consumed on COMPLETED, so a no-show returns
     * the seat so the student can rebook.
     */
    @Transactional
    public StudentEntitlement creditBackCounsellingSession(Long entitlementId) {
        if (entitlementId == null) return null;
        Optional<StudentEntitlement> opt = entitlementRepository.findById(entitlementId);
        if (!opt.isPresent()) return null;
        StudentEntitlement e = opt.get();
        int used = e.getCounsellingSessionsUsed() == null ? 0 : e.getCounsellingSessionsUsed();
        e.setCounsellingSessionsUsed(Math.max(0, used - 1));
        return entitlementRepository.save(e);
    }

    @Transactional
    public StudentEntitlement revoke(Long entitlementId, String reason) {
        Optional<StudentEntitlement> opt = entitlementRepository.findById(entitlementId);
        if (!opt.isPresent()) return null;
        StudentEntitlement e = opt.get();
        // STATE1: idempotent — a refunded/already-revoked entitlement stays terminal.
        if ("revoked".equals(e.getStatus()) || "refunded".equals(e.getStatus())) {
            return e;
        }
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
        // STATE1: only an active entitlement can be extended — silently writing future
        // dates onto a revoked/refunded/expired row was misleading and ineffective.
        if (!"active".equals(e.getStatus())) {
            logger.warn("extendExpiry: refusing to extend {} entitlement {}", e.getStatus(), entitlementId);
            return e;
        }
        e.setExpiresAt(newExpiresAt);
        if (Boolean.TRUE.equals(e.getDashboardActive())) e.setDashboardExpiresAt(newExpiresAt);
        if (Boolean.TRUE.equals(e.getLmsActive())) e.setLmsExpiresAt(newExpiresAt);
        // Keep the access token alive at least as long as the extended service window,
        // otherwise the magic links 401 before the new expiry.
        if (e.getAccessTokenExpiresAt() == null
                || (newExpiresAt != null && e.getAccessTokenExpiresAt().before(newExpiresAt))) {
            e.setAccessTokenExpiresAt(newExpiresAt);
        }
        return entitlementRepository.save(e);
    }

    @Transactional
    public ResendResult resendServiceLink(Long entitlementId, String serviceType, String recipient) {
        Optional<StudentEntitlement> opt = entitlementRepository.findById(entitlementId);
        if (!opt.isPresent()) return new ResendResult(false, "Entitlement not found");
        StudentEntitlement e = opt.get();
        if (!"active".equals(e.getStatus())) return new ResendResult(false, "Entitlement not active");

        // Always deliver to the entitlement's OWN student — never a caller-supplied
        // recipient. These links embed a live access token (final report / dashboard
        // SSO); emailing one to an arbitrary address would exfiltrate another
        // student's report + a working bearer credential. The `recipient` arg is
        // intentionally ignored.
        String studentEmail = resolveStudentEmail(e);
        if (studentEmail == null) return new ResendResult(false, "Student has no email on file");

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
            case "final_report": {
                if (!Boolean.TRUE.equals(e.getFinalReportActive())) return new ResendResult(false, "Final report not in this tier");
                subject = "Your Career-9 report is ready";
                // Prefer the generated report's Spaces CDN links (same delivery as the
                // report-pipeline email); fall back to the tokenized viewer link when
                // no generated report exists yet.
                GeneratedReport gr = latestGeneratedReport(e.getUserStudentId(), e.getAssessmentId());
                if (gr != null) {
                    link = gr.getReportUrl();
                    body = reportReadyEmailBody(e, gr.getReportUrl(), gr.getPdfUrl());
                } else {
                    link = linkBuilder.finalReport(token, eid);
                    body = reportReadyEmailBody(e, link, null);
                }
                break;
            }
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
        notificationDispatcher.sendEmail(e, studentEmail, serviceType, subject, body, link);
        return new ResendResult(true, "Sent");
    }

    /** Resolves the entitlement's student email; null when no student/email is on file. */
    private String resolveStudentEmail(StudentEntitlement e) {
        if (e.getUserStudentId() == null) return null;
        UserStudent us = userStudentRepository.findById(e.getUserStudentId()).orElse(null);
        if (us == null || us.getStudentInfo() == null) return null;
        return us.getStudentInfo().getEmail();
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
        entitlement.setCounsellorReleaseReport(Boolean.TRUE.equals(tier.getCounsellorReleaseReport()));
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

        // Resolve credentials for the manual-login fallback: username from User,
        // DOB stringified as dd-MM-yyyy (the same format the student typed at
        // registration and that StudentLoginPage expects).
        String username = null;
        String dobStr = null;
        String displayName = txn.getStudentName() != null ? txn.getStudentName() : "there";
        if (entitlement.getUserStudentId() != null) {
            UserStudent us = userStudentRepository.findById(entitlement.getUserStudentId()).orElse(null);
            if (us != null && us.getStudentInfo() != null) {
                User u = us.getStudentInfo().getUser();
                if (u != null) username = u.getUsername();
            }
        }
        if (txn.getStudentDob() != null) {
            dobStr = new SimpleDateFormat("dd-MM-yyyy").format(txn.getStudentDob());
        }

        String magicLink = linkBuilder.assessmentStart(entitlement.getAccessToken(), entitlement.getEntitlementId());
        String manualLoginUrl = linkBuilder.manualLogin();
        String subject = "Welcome to Career-9 — start your assessment";
        String body = welcomeEmailHtml(displayName, username, dobStr, magicLink, manualLoginUrl);
        notificationDispatcher.sendEmail(entitlement, to, "assessment_invite", subject, body, magicLink);
    }

    /**
     * Flat green welcome email (approved design): white card on a neutral ground,
     * one green accent, primary magic-link button, then a quiet manual-login
     * credentials panel. Inline styles only; emoji/dashes as HTML entities so the
     * source and every mail client stay ASCII-safe.
     */
    private static String welcomeEmailHtml(String displayName, String username, String dobStr,
                                           String magicLink, String manualLoginUrl) {
        String credentialsBlock;
        if (username != null && dobStr != null) {
            credentialsBlock =
                "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;font-size:13.5px;\">"
                + "<tr><td style=\"padding:4px 0;color:#5f6f67;width:110px;\">Username</td>"
                + "<td style=\"padding:4px 0;color:#0f1f18;font-family:Consolas,'Courier New',monospace;font-weight:700;\">"
                +     username + "</td></tr>"
                + "<tr><td style=\"padding:4px 0;color:#5f6f67;\">Password</td>"
                + "<td style=\"padding:4px 0;color:#0f1f18;font-family:Consolas,'Courier New',monospace;font-weight:700;\">"
                +     dobStr
                + " <span style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
                +     "color:#8a978f;font-weight:400;\">(your date of birth)</span></td></tr>"
                + "</table>";
        } else {
            credentialsBlock =
                "<p style=\"margin:0;font-size:13.5px;line-height:1.6;color:#3d4a44;\">"
                + "Use the user ID and date of birth you provided at registration to sign in."
                + "</p>";
        }

        return ""
            + "<div style=\"background:#f3f5f4;padding:40px 16px;"
            +     "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">"
            + "<div style=\"max-width:560px;margin:0 auto;\">"

            // Wordmark above the card
            + "<div style=\"padding:0 6px 12px;\">"
            + "<span style=\"font-size:14px;font-weight:800;letter-spacing:2px;color:#059669;\">CAREER&#8209;9</span>"
            + "</div>"

            // Card, single green accent line
            + "<div style=\"background:#ffffff;border:1px solid #e3e8e5;border-radius:14px;overflow:hidden;\">"
            + "<div style=\"height:4px;background:#059669;\"></div>"
            + "<div style=\"padding:32px 32px 8px;\">"

            + "<h1 style=\"margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:700;color:#0f1f18;\">"
            +     "Welcome aboard, " + escape(displayName) + "!</h1>"
            + "<p style=\"margin:0 0 24px;font-size:15px;line-height:1.6;color:#5f6f67;\">"
            +     "Your purchase is confirmed. Your assessment is ready when you are &mdash; "
            +     "you can pause and resume anytime.</p>"

            // Primary action: magic link
            + "<p style=\"margin:0 0 14px;font-size:14px;line-height:1.6;color:#0f1f18;\">"
            +     "One click signs you in and takes you straight to your assessment:</p>"
            + "<div style=\"text-align:center;margin:0 0 26px;\">"
            + "<a href=\"" + magicLink + "\" style=\"display:inline-block;padding:14px 36px;background:#059669;"
            +     "color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;\">"
            +     "Start Assessment &rarr;</a>"
            + "</div>"

            // Divider
            + "<div style=\"border-top:1px solid #e3e8e5;text-align:center;margin:0 0 20px;\">"
            + "<span style=\"position:relative;top:-9px;background:#ffffff;padding:0 12px;"
            +     "font-size:11px;font-weight:700;letter-spacing:1.2px;color:#8a978f;\">OR SIGN IN MANUALLY</span>"
            + "</div>"

            // Credentials panel
            + "<div style=\"background:#f6f8f7;border:1px solid #e3e8e5;border-radius:10px;padding:18px 20px;margin:0 0 22px;\">"
            + "<p style=\"margin:0 0 12px;font-size:13.5px;line-height:1.6;color:#3d4a44;\">Visit "
            + "<a href=\"" + manualLoginUrl + "\" style=\"color:#059669;font-weight:700;text-decoration:none;\">"
            +     manualLoginUrl + "</a> and use:</p>"
            + credentialsBlock
            + "<p style=\"margin:12px 0 0;font-size:12px;line-height:1.6;color:#8a978f;\">"
            +     "Keep these safe &mdash; you&rsquo;ll need them to resume your assessment or open your report later.</p>"
            + "</div>"

            // Fallback raw link
            + "<p style=\"margin:0 0 28px;font-size:12px;line-height:1.6;color:#8a978f;text-align:center;\">"
            +     "If the button doesn&rsquo;t work, paste this link into your browser:<br>"
            + "<span style=\"word-break:break-all;color:#5f6f67;\">" + magicLink + "</span></p>"

            + "</div>"

            // Footer
            + "<div style=\"background:#f6f8f7;border-top:1px solid #e3e8e5;padding:14px 32px;\">"
            + "<p style=\"margin:0;font-size:11px;line-height:1.6;color:#8a978f;\">"
            +     "This is an automated message from Career&#8209;9 &mdash; please don&rsquo;t reply to this address.<br>"
            +     "&copy; Career&#8209;9. All rights reserved.</p>"
            + "</div>"

            + "</div></div></div>";
    }

    /** Minimal HTML escape for values interpolated into the email body. */
    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    /**
     * Compact template used by post-completion notifications (1-pager, final
     * report, resend flows). The welcome email uses {@link #welcomeEmailHtml}
     * because it surfaces credentials and a manual-login fallback.
     */
    /** Newest generated report with a stored Spaces URL for this student+assessment, or null. */
    private GeneratedReport latestGeneratedReport(Long userStudentId, Long assessmentId) {
        try {
            GeneratedReport best = null;
            for (GeneratedReport gr : generatedReportRepository
                    .findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)) {
                if (gr.getReportUrl() == null || gr.getReportUrl().trim().isEmpty()) continue;
                if (best == null || (gr.getUpdatedAt() != null && best.getUpdatedAt() != null
                        && gr.getUpdatedAt().after(best.getUpdatedAt()))) {
                    best = gr;
                }
            }
            return best;
        } catch (Exception ex) {
            logger.warn("Could not resolve generated report for student={} assessment={}: {}",
                    userStudentId, assessmentId, ex.getMessage());
            return null;
        }
    }

    /**
     * Report-ready body rendered through the pipeline's ReportEmailComposer, so
     * every path (pipeline, legacy immediate send, admin resend) mails the same
     * design. linkOnly is always true here — these paths never attach the PDF;
     * when a CDN pdfUrl exists it is offered as a download link instead.
     */
    private String reportReadyEmailBody(StudentEntitlement e, String reportUrl, String pdfUrl) {
        com.kccitm.api.service.b2c.report.pipeline.ReportEmailEvent ev =
                new com.kccitm.api.service.b2c.report.pipeline.ReportEmailEvent();
        ev.userStudentId = e.getUserStudentId();
        ev.assessmentId = e.getAssessmentId();
        ev.entitlementId = e.getEntitlementId();
        ev.reportUrl = reportUrl;
        ev.pdfUrl = pdfUrl;
        ev.linkOnly = true;
        ev.studentName = resolveStudentName(e);
        if (counsellingBookingLinkService != null) {
            ev.bookingUrl = counsellingBookingLinkService.bookingUrlIfEligible(
                    e.getUserStudentId(), e.getAssessmentId(), e.getEntitlementId());
        }
        return reportEmailComposer.html(ev);
    }

    /** Student's name for the email greeting; null when unavailable. */
    private String resolveStudentName(StudentEntitlement e) {
        try {
            if (e.getUserStudentId() == null) return null;
            UserStudent us = userStudentRepository.findById(e.getUserStudentId()).orElse(null);
            if (us == null || us.getStudentInfo() == null) return null;
            return us.getStudentInfo().getName();
        } catch (Exception ex) {
            return null;
        }
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

    private static Date laterExpiry(Date a, Date b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.after(b) ? a : b;
    }

    public static class ResendResult {
        public final boolean ok;
        public final String message;
        public ResendResult(boolean ok, String message) { this.ok = ok; this.message = message; }
    }
}
