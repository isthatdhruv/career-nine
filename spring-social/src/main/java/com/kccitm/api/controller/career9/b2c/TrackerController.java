package com.kccitm.api.controller.career9.b2c;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.Query;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.b2c.Campaign;
import com.kccitm.api.model.career9.b2c.PricingTier;
import com.kccitm.api.model.career9.b2c.ReportGenerationLog;
import com.kccitm.api.model.career9.b2c.ServiceDeliveryLog;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignRepository;
import com.kccitm.api.repository.Career9.b2c.PricingTierRepository;
import com.kccitm.api.repository.Career9.b2c.ReportGenerationLogRepository;
import com.kccitm.api.repository.Career9.b2c.ServiceDeliveryLogRepository;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.service.b2c.ReportPreparationService;
import com.kccitm.api.service.b2c.ReportPreparationService.PreparationResult;
import com.kccitm.api.service.b2c.ReportPreparationService.ReportPreparationException;

/**
 * Backing API for the /admin/b2c/tracker page. All endpoints are admin-gated by the
 * existing JWT pipeline + Spring Security config; we don't add a new role here.
 *
 * Returns flat dicts (not entities) so the SPA gets joined campaign/tier/assessment
 * names without N+1 fetches.
 */
@RestController
@RequestMapping("/admin/tracker")
public class TrackerController {

    @PersistenceContext private EntityManager em;

    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private StudentEntitlementRepository entitlementRepository;
    @Autowired private ServiceDeliveryLogRepository serviceDeliveryLogRepository;
    @Autowired private CampaignRepository campaignRepository;
    @Autowired private PricingTierRepository pricingTierRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private StudentAssessmentMappingRepository studentAssessmentMappingRepository;
    @Autowired private ReportGenerationLogRepository reportGenerationLogRepository;
    @Autowired private ReportPreparationService reportPreparationService;
    @Autowired private com.kccitm.api.service.b2c.EntitlementService entitlementService;

    private static final int MAX_PAGE_SIZE = 200;

    @GetMapping("/payments")
    public ResponseEntity<?> getPayments(@RequestParam(required = false) Long campaignId,
                                         @RequestParam(required = false) String status,
                                         @RequestParam(required = false) String from,
                                         @RequestParam(required = false) String to,
                                         @RequestParam(required = false) String q,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "50") int size) {
        size = clampPageSize(size);

        StringBuilder jpql = new StringBuilder("SELECT t FROM PaymentTransaction t WHERE 1=1");
        StringBuilder countJpql = new StringBuilder("SELECT COUNT(t) FROM PaymentTransaction t WHERE 1=1");

        Map<String, Object> params = new HashMap<>();
        if (campaignId != null) {
            jpql.append(" AND t.campaignId = :campaignId");
            countJpql.append(" AND t.campaignId = :campaignId");
            params.put("campaignId", campaignId);
        }
        if (status != null && !status.isEmpty()) {
            jpql.append(" AND t.status = :status");
            countJpql.append(" AND t.status = :status");
            params.put("status", status);
        }
        Date fromDate = parseDate(from);
        Date toDate = parseDate(to);
        if (fromDate != null) {
            jpql.append(" AND t.createdAt >= :fromDate");
            countJpql.append(" AND t.createdAt >= :fromDate");
            params.put("fromDate", fromDate);
        }
        if (toDate != null) {
            jpql.append(" AND t.createdAt <= :toDate");
            countJpql.append(" AND t.createdAt <= :toDate");
            params.put("toDate", endOfDay(toDate));
        }
        if (q != null && !q.trim().isEmpty()) {
            jpql.append(" AND (LOWER(t.studentName) LIKE :q OR LOWER(t.studentEmail) LIKE :q OR t.studentPhone LIKE :q)");
            countJpql.append(" AND (LOWER(t.studentName) LIKE :q OR LOWER(t.studentEmail) LIKE :q OR t.studentPhone LIKE :q)");
            params.put("q", "%" + q.trim().toLowerCase() + "%");
        }
        jpql.append(" ORDER BY t.createdAt DESC");

        Query query = em.createQuery(jpql.toString());
        params.forEach(query::setParameter);
        query.setFirstResult(page * size);
        query.setMaxResults(size);
        @SuppressWarnings("unchecked")
        List<PaymentTransaction> txns = query.getResultList();

        Query countQ = em.createQuery(countJpql.toString());
        params.forEach(countQ::setParameter);
        long total = ((Number) countQ.getSingleResult()).longValue();

        List<Map<String, Object>> rows = new ArrayList<>();
        for (PaymentTransaction t : txns) {
            Map<String, Object> row = new HashMap<>();
            row.put("transactionId", t.getTransactionId());
            row.put("createdAt", t.getCreatedAt());
            row.put("studentName", t.getStudentName());
            row.put("studentEmail", t.getStudentEmail());
            row.put("studentPhone", t.getStudentPhone());
            row.put("userStudentId", t.getUserStudentId());
            row.put("amount", t.getAmount());
            row.put("originalAmount", t.getOriginalAmount());
            row.put("currency", t.getCurrency());
            row.put("status", t.getStatus());
            row.put("promoCode", t.getPromoCode());
            row.put("purchasePath", t.getPurchasePath());
            row.put("paymentLinkUrl", t.getPaymentLinkUrl());
            row.put("shortUrl", t.getShortUrl());
            row.put("razorpayPaymentId", t.getRazorpayPaymentId());

            row.put("campaignId", t.getCampaignId());
            row.put("campaignName", t.getCampaignId() != null
                    ? campaignRepository.findById(t.getCampaignId()).map(Campaign::getName).orElse(null)
                    : null);
            row.put("assessmentId", t.getAssessmentId());
            row.put("assessmentName", t.getAssessmentId() != null
                    ? assessmentTableRepository.findById(t.getAssessmentId()).map(AssessmentTable::getAssessmentName).orElse(null)
                    : null);

            // Find linked entitlement (most-recent one for this txn)
            Optional<StudentEntitlement> eOpt = entitlementRepository.findByPaymentTransactionId(t.getTransactionId());
            row.put("entitlementId", eOpt.map(StudentEntitlement::getEntitlementId).orElse(null));
            row.put("entitlementStatus", eOpt.map(StudentEntitlement::getStatus).orElse(null));
            row.put("finalReportActive", eOpt.map(StudentEntitlement::getFinalReportActive).orElse(null));

            // Tier name
            Long tierId = eOpt.map(StudentEntitlement::getPricingTierId).orElse(null);
            row.put("tierName", tierId != null
                    ? pricingTierRepository.findById(tierId).map(PricingTier::getName).orElse(null)
                    : null);

            row.put("assessmentStatus", lookupAssessmentStatus(t.getUserStudentId(), t.getAssessmentId()));
            attachInstitute(row, t.getUserStudentId());
            row.put("lastReportError", latestReportError(eOpt.map(StudentEntitlement::getEntitlementId).orElse(null)));
            rows.add(row);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("rows", rows);
        response.put("total", total);
        response.put("page", page);
        response.put("size", size);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/allotments")
    public ResponseEntity<?> getAllotments(@RequestParam(required = false) Long campaignId,
                                           @RequestParam(required = false) String status,
                                           @RequestParam(required = false) String from,
                                           @RequestParam(required = false) String to,
                                           @RequestParam(required = false) String q,
                                           @RequestParam(defaultValue = "false") boolean includeLeads,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "50") int size) {
        size = clampPageSize(size);

        StringBuilder jpql = new StringBuilder("SELECT e FROM StudentEntitlement e WHERE 1=1");
        StringBuilder countJpql = new StringBuilder("SELECT COUNT(e) FROM StudentEntitlement e WHERE 1=1");
        Map<String, Object> params = new HashMap<>();

        if (!includeLeads) {
            jpql.append(" AND e.pricingTierId IS NOT NULL");
            countJpql.append(" AND e.pricingTierId IS NOT NULL");
        }
        if (campaignId != null) {
            jpql.append(" AND e.campaignId = :campaignId");
            countJpql.append(" AND e.campaignId = :campaignId");
            params.put("campaignId", campaignId);
        }
        if (status != null && !status.isEmpty()) {
            jpql.append(" AND e.status = :status");
            countJpql.append(" AND e.status = :status");
            params.put("status", status);
        }
        Date fromDate = parseDate(from);
        Date toDate = parseDate(to);
        if (fromDate != null) {
            jpql.append(" AND e.createdAt >= :fromDate");
            countJpql.append(" AND e.createdAt >= :fromDate");
            params.put("fromDate", fromDate);
        }
        if (toDate != null) {
            jpql.append(" AND e.createdAt <= :toDate");
            countJpql.append(" AND e.createdAt <= :toDate");
            params.put("toDate", endOfDay(toDate));
        }
        jpql.append(" ORDER BY e.createdAt DESC");

        Query query = em.createQuery(jpql.toString());
        params.forEach(query::setParameter);
        query.setFirstResult(page * size);
        query.setMaxResults(size);
        @SuppressWarnings("unchecked")
        List<StudentEntitlement> ents = query.getResultList();

        Query countQ = em.createQuery(countJpql.toString());
        params.forEach(countQ::setParameter);
        long total = ((Number) countQ.getSingleResult()).longValue();

        List<Map<String, Object>> rows = new ArrayList<>();
        for (StudentEntitlement e : ents) {
            Map<String, Object> row = entitlementToRow(e);
            if (q != null && !q.trim().isEmpty()) {
                String qq = q.trim().toLowerCase();
                String name = row.get("studentName") != null ? row.get("studentName").toString().toLowerCase() : "";
                String email = row.get("studentEmail") != null ? row.get("studentEmail").toString().toLowerCase() : "";
                String phone = row.get("studentPhone") != null ? row.get("studentPhone").toString() : "";
                if (!name.contains(qq) && !email.contains(qq) && !phone.contains(qq)) continue;
            }
            rows.add(row);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("rows", rows);
        response.put("total", total);
        response.put("page", page);
        response.put("size", size);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/allotments/{id}")
    public ResponseEntity<?> getAllotmentDetail(@PathVariable Long id) {
        Optional<StudentEntitlement> opt = entitlementRepository.findById(id);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        StudentEntitlement e = opt.get();

        Map<String, Object> response = entitlementToRow(e);

        if (e.getUserStudentId() != null && e.getAssessmentId() != null) {
            Optional<StudentAssessmentMapping> samOpt = studentAssessmentMappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(e.getUserStudentId(), e.getAssessmentId());
            if (samOpt.isPresent()) {
                Map<String, Object> sam = new HashMap<>();
                sam.put("status", samOpt.get().getStatus());
                sam.put("persistenceState", samOpt.get().getPersistenceState());
                sam.put("resetCount", samOpt.get().getResetCount());
                sam.put("feedbackRating", samOpt.get().getFeedbackRating());
                response.put("assessment", sam);
            }
        }

        if (e.getPaymentTransactionId() != null) {
            Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findById(e.getPaymentTransactionId());
            txnOpt.ifPresent(t -> response.put("payment", t));
        }

        List<ServiceDeliveryLog> comms = serviceDeliveryLogRepository.findByEntitlementIdOrderByCreatedAtDesc(id);
        response.put("communications", comms);

        List<ReportGenerationLog> errs = reportGenerationLogRepository.findByEntitlementIdOrderByCreatedAtDesc(id);
        List<Map<String, Object>> errRows = new ArrayList<>();
        for (ReportGenerationLog log : errs) errRows.add(reportErrorToRow(log));
        response.put("reportErrors", errRows);
        return ResponseEntity.ok(response);
    }

    // ═══════════════════════ REPORT ERRORS ═══════════════════════

    @GetMapping("/report-errors")
    public ResponseEntity<?> getReportErrors(@RequestParam(required = false) Long campaignId,
                                             @RequestParam(required = false) String from,
                                             @RequestParam(required = false) String to,
                                             @RequestParam(required = false) String q,
                                             @RequestParam(defaultValue = "failed") String status,
                                             @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "50") int size) {
        size = clampPageSize(size);

        StringBuilder jpql = new StringBuilder("SELECT l FROM ReportGenerationLog l WHERE 1=1");
        StringBuilder countJpql = new StringBuilder("SELECT COUNT(l) FROM ReportGenerationLog l WHERE 1=1");
        Map<String, Object> params = new HashMap<>();

        if (status != null && !status.isEmpty() && !"all".equalsIgnoreCase(status)) {
            jpql.append(" AND l.status = :status");
            countJpql.append(" AND l.status = :status");
            params.put("status", status);
        }
        if (campaignId != null) {
            jpql.append(" AND l.campaignId = :campaignId");
            countJpql.append(" AND l.campaignId = :campaignId");
            params.put("campaignId", campaignId);
        }
        Date fromDate = parseDate(from);
        Date toDate = parseDate(to);
        if (fromDate != null) {
            jpql.append(" AND l.createdAt >= :fromDate");
            countJpql.append(" AND l.createdAt >= :fromDate");
            params.put("fromDate", fromDate);
        }
        if (toDate != null) {
            jpql.append(" AND l.createdAt <= :toDate");
            countJpql.append(" AND l.createdAt <= :toDate");
            params.put("toDate", endOfDay(toDate));
        }
        jpql.append(" ORDER BY l.createdAt DESC");

        Query query = em.createQuery(jpql.toString());
        params.forEach(query::setParameter);
        query.setFirstResult(page * size);
        query.setMaxResults(size);
        @SuppressWarnings("unchecked")
        List<ReportGenerationLog> logs = query.getResultList();

        Query countQ = em.createQuery(countJpql.toString());
        params.forEach(countQ::setParameter);
        long total = ((Number) countQ.getSingleResult()).longValue();

        List<Map<String, Object>> rows = new ArrayList<>();
        for (ReportGenerationLog log : logs) {
            Map<String, Object> row = reportErrorToRow(log);
            if (q != null && !q.trim().isEmpty()) {
                String qq = q.trim().toLowerCase();
                String name = row.get("studentName") != null ? row.get("studentName").toString().toLowerCase() : "";
                String email = row.get("studentEmail") != null ? row.get("studentEmail").toString().toLowerCase() : "";
                String errMsg = row.get("errorMessage") != null ? row.get("errorMessage").toString().toLowerCase() : "";
                if (!name.contains(qq) && !email.contains(qq) && !errMsg.contains(qq)) continue;
            }
            rows.add(row);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("rows", rows);
        response.put("total", total);
        response.put("page", page);
        response.put("size", size);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/report-errors/{logId}/retry")
    public ResponseEntity<?> retryReport(@PathVariable Long logId,
                                         @RequestBody(required = false) Map<String, Object> body) {
        Optional<ReportGenerationLog> opt = reportGenerationLogRepository.findById(logId);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        ReportGenerationLog log = opt.get();
        if (!"failed".equals(log.getStatus())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("status", "error", "message", "Log is not in failed state"));
        }

        String resolvedBy = body != null && body.get("resolvedBy") != null
                ? body.get("resolvedBy").toString() : "admin";

        try {
            PreparationResult result = reportPreparationService.prepare(
                    log.getEntitlementId(), log.getAssessmentId(), "retry");

            log.setStatus("resolved");
            log.setResolvedAt(new Date());
            log.setResolvedBy(resolvedBy);
            reportGenerationLogRepository.save(log);

            String recipient = lookupStudentEmail(log.getUserStudentId());
            boolean emailed = false;
            String emailMessage = null;
            if (recipient != null && !recipient.isEmpty()) {
                com.kccitm.api.service.b2c.EntitlementService.ResendResult r =
                        entitlementService.resendServiceLink(
                                log.getEntitlementId(), "final_report", recipient);
                emailed = r.ok;
                emailMessage = r.message;
            } else {
                emailMessage = "Student email not on file — admin must forward report manually";
            }

            Map<String, Object> response = new HashMap<>();
            response.put("status", "resolved");
            response.put("logId", logId);
            response.put("reportType", result.reportType);
            response.put("reportUrl", result.reportUrl);
            response.put("studentClassUsed", result.studentClassUsed);
            response.put("emailed", emailed);
            response.put("emailMessage", emailMessage);
            return ResponseEntity.ok(response);
        } catch (ReportPreparationException ex) {
            Map<String, Object> response = new HashMap<>();
            response.put("status", "failed");
            response.put("logId", ex.logId);
            response.put("reportType", ex.reportType);
            response.put("studentClassUsed", ex.studentClassUsed);
            response.put("message", ex.getCause() != null ? ex.getCause().getMessage() : ex.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    @PostMapping("/report-errors/{logId}/dismiss")
    public ResponseEntity<?> dismissReport(@PathVariable Long logId,
                                           @RequestBody(required = false) Map<String, Object> body) {
        Optional<ReportGenerationLog> opt = reportGenerationLogRepository.findById(logId);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        ReportGenerationLog log = opt.get();
        if (!"failed".equals(log.getStatus())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("status", "error", "message", "Log is not in failed state"));
        }
        String resolvedBy = body != null && body.get("resolvedBy") != null
                ? body.get("resolvedBy").toString() : "admin";
        String note = body != null && body.get("note") != null ? body.get("note").toString() : null;

        log.setStatus("resolved");
        log.setResolvedAt(new Date());
        log.setResolvedBy(resolvedBy);
        log.setResolutionNote(note);
        reportGenerationLogRepository.save(log);

        return ResponseEntity.ok(Map.of("status", "dismissed", "logId", logId));
    }

    private String lookupStudentEmail(Long userStudentId) {
        if (userStudentId == null) return null;
        return userStudentRepository.findById(userStudentId)
                .map(UserStudent::getStudentInfo)
                .map(StudentInfo::getEmail)
                .orElse(null);
    }

    @GetMapping("/service-activity")
    public ResponseEntity<?> getServiceActivity(@RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "100") int size) {
        size = clampPageSize(size);
        Query q = em.createQuery(
                "SELECT s FROM ServiceDeliveryLog s ORDER BY s.createdAt DESC");
        q.setFirstResult(page * size);
        q.setMaxResults(size);
        return ResponseEntity.ok(q.getResultList());
    }

    @GetMapping("/summary")
    public ResponseEntity<?> getSummary(@RequestParam(required = false) Long campaignId,
                                        @RequestParam(required = false) String from,
                                        @RequestParam(required = false) String to) {
        Date fromDate = parseDate(from);
        Date toDate = parseDate(to);

        Map<String, Object> response = new HashMap<>();
        response.put("totalRevenue", aggregateRevenue(campaignId, fromDate, toDate, "paid"));
        response.put("paidCount", aggregateCount("PaymentTransaction", "campaignId", campaignId, "status", "paid", "createdAt", fromDate, toDate));
        response.put("refundCount", aggregateCount("PaymentTransaction", "campaignId", campaignId, "status", "refunded", "createdAt", fromDate, toDate));
        response.put("createdCount", aggregateCount("PaymentTransaction", "campaignId", campaignId, "status", "created", "createdAt", fromDate, toDate));
        response.put("activeEntitlements", aggregateCount("StudentEntitlement", "campaignId", campaignId, "status", "active", "createdAt", fromDate, toDate));

        // Expiring within 7 days
        Date in7 = new Date(System.currentTimeMillis() + 7L * 24 * 3600 * 1000);
        StringBuilder jpql = new StringBuilder(
                "SELECT COUNT(e) FROM StudentEntitlement e WHERE e.status = 'active' AND e.expiresAt IS NOT NULL AND e.expiresAt <= :in7");
        Map<String, Object> p = new HashMap<>();
        p.put("in7", in7);
        if (campaignId != null) {
            jpql.append(" AND e.campaignId = :campaignId");
            p.put("campaignId", campaignId);
        }
        Query exp = em.createQuery(jpql.toString());
        p.forEach(exp::setParameter);
        response.put("expiringIn7Days", ((Number) exp.getSingleResult()).longValue());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/payments/{transactionId}/resend-link")
    public ResponseEntity<?> resendPaymentLink(@PathVariable Long transactionId,
                                               @RequestBody(required = false) Map<String, Object> body) {
        Optional<PaymentTransaction> opt = paymentTransactionRepository.findById(transactionId);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        // Pulls into the existing PaymentEmailService is wired through the regular nudge endpoint;
        // here we just return the link for the admin to copy/share.
        Map<String, Object> response = new HashMap<>();
        response.put("transactionId", transactionId);
        response.put("paymentLinkUrl", opt.get().getShortUrl());
        response.put("status", opt.get().getStatus());
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> entitlementToRow(StudentEntitlement e) {
        Map<String, Object> row = new HashMap<>();
        row.put("entitlementId", e.getEntitlementId());
        row.put("status", e.getStatus());
        row.put("grantedAt", e.getGrantedAt());
        row.put("createdAt", e.getCreatedAt());
        row.put("expiresAt", e.getExpiresAt());
        row.put("purchasePath", e.getPurchasePath());
        row.put("counsellingModel", e.getCounsellingModel());
        row.put("dashboardActive", e.getDashboardActive());
        row.put("dashboardExpiresAt", e.getDashboardExpiresAt());
        row.put("counsellingActive", e.getCounsellingActive());
        row.put("counsellingSessionsTotal", e.getCounsellingSessionsTotal());
        row.put("counsellingSessionsUsed", e.getCounsellingSessionsUsed());
        row.put("lmsActive", e.getLmsActive());
        row.put("lmsExpiresAt", e.getLmsExpiresAt());
        row.put("finalReportActive", e.getFinalReportActive());

        row.put("campaignId", e.getCampaignId());
        row.put("campaignName", e.getCampaignId() != null
                ? campaignRepository.findById(e.getCampaignId()).map(Campaign::getName).orElse(null) : null);
        row.put("assessmentId", e.getAssessmentId());
        row.put("assessmentName", e.getAssessmentId() != null
                ? assessmentTableRepository.findById(e.getAssessmentId()).map(AssessmentTable::getAssessmentName).orElse(null) : null);
        row.put("pricingTierId", e.getPricingTierId());
        row.put("tierName", e.getPricingTierId() != null
                ? pricingTierRepository.findById(e.getPricingTierId()).map(PricingTier::getName).orElse(null) : null);

        row.put("paymentTransactionId", e.getPaymentTransactionId());
        if (e.getPaymentTransactionId() != null) {
            paymentTransactionRepository.findById(e.getPaymentTransactionId()).ifPresent(t -> {
                row.put("paidAmount", t.getAmount());
                row.put("paymentStatus", t.getStatus());
                if (row.get("studentName") == null) row.put("studentName", t.getStudentName());
                if (row.get("studentEmail") == null) row.put("studentEmail", t.getStudentEmail());
                if (row.get("studentPhone") == null) row.put("studentPhone", t.getStudentPhone());
            });
        }
        if (e.getUserStudentId() != null) {
            Optional<UserStudent> us = userStudentRepository.findById(e.getUserStudentId());
            if (us.isPresent() && us.get().getStudentInfo() != null) {
                if (row.get("studentName") == null) row.put("studentName", us.get().getStudentInfo().getName());
                if (row.get("studentEmail") == null) row.put("studentEmail", us.get().getStudentInfo().getEmail());
                if (row.get("studentPhone") == null) row.put("studentPhone", us.get().getStudentInfo().getPhoneNumber());
            }
        }
        row.put("userStudentId", e.getUserStudentId());
        row.put("assessmentStatus", lookupAssessmentStatus(e.getUserStudentId(), e.getAssessmentId()));
        attachInstitute(row, e.getUserStudentId());
        row.put("lastReportError", latestReportError(e.getEntitlementId()));
        return row;
    }

    /**
     * Latest unresolved report-generation error for an entitlement, or null
     * if none. Used by both list endpoints so the SPA can render the inline
     * "⚠ Report error" badge without extra round-trips.
     */
    private Map<String, Object> latestReportError(Long entitlementId) {
        if (entitlementId == null) return null;
        return reportGenerationLogRepository
                .findFirstByEntitlementIdAndStatusOrderByCreatedAtDesc(entitlementId, "failed")
                .map(log -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("logId", log.getId());
                    m.put("message", log.getErrorMessage());
                    m.put("createdAt", log.getCreatedAt());
                    m.put("reportType", log.getReportType());
                    return m;
                })
                .orElse(null);
    }

    private Map<String, Object> reportErrorToRow(ReportGenerationLog log) {
        Map<String, Object> row = new HashMap<>();
        row.put("logId", log.getId());
        row.put("entitlementId", log.getEntitlementId());
        row.put("userStudentId", log.getUserStudentId());
        row.put("campaignId", log.getCampaignId());
        row.put("assessmentId", log.getAssessmentId());
        row.put("reportType", log.getReportType());
        row.put("studentClassAtAttempt", log.getStudentClassAtAttempt());
        row.put("attemptType", log.getAttemptType());
        row.put("status", log.getStatus());
        row.put("errorClass", log.getErrorClass());
        row.put("errorMessage", log.getErrorMessage());
        row.put("createdAt", log.getCreatedAt());
        row.put("resolvedAt", log.getResolvedAt());
        row.put("resolvedBy", log.getResolvedBy());
        row.put("resolutionNote", log.getResolutionNote());

        if (log.getCampaignId() != null) {
            campaignRepository.findById(log.getCampaignId()).ifPresent(c ->
                    row.put("campaignName", c.getName()));
        }
        if (log.getAssessmentId() != null) {
            assessmentTableRepository.findById(log.getAssessmentId()).ifPresent(a ->
                    row.put("assessmentName", a.getAssessmentName()));
        }
        if (log.getUserStudentId() != null) {
            userStudentRepository.findById(log.getUserStudentId()).ifPresent(us -> {
                StudentInfo si = us.getStudentInfo();
                if (si != null) {
                    row.put("studentName", si.getName());
                    row.put("studentEmail", si.getEmail());
                }
            });
        }
        return row;
    }

    /**
     * Adds the student's primary institute (code + name) to a tracker row so
     * the SPA can render it without an extra round-trip per row.
     */
    private void attachInstitute(Map<String, Object> row, Long userStudentId) {
        if (userStudentId == null) return;
        userStudentRepository.findById(userStudentId).ifPresent(us -> {
            if (us.getInstitute() != null) {
                row.put("instituteCode", us.getInstitute().getInstituteCode());
                row.put("instituteName", us.getInstitute().getInstituteName());
            }
        });
    }

    private String lookupAssessmentStatus(Long userStudentId, Long assessmentId) {
        if (userStudentId == null || assessmentId == null) return null;
        return studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .map(StudentAssessmentMapping::getStatus)
                .orElse("notstarted");
    }

    private Long aggregateRevenue(Long campaignId, Date from, Date to, String status) {
        StringBuilder jpql = new StringBuilder(
                "SELECT COALESCE(SUM(t.amount), 0) FROM PaymentTransaction t WHERE t.status = :status");
        Map<String, Object> p = new HashMap<>();
        p.put("status", status);
        if (campaignId != null) { jpql.append(" AND t.campaignId = :campaignId"); p.put("campaignId", campaignId); }
        if (from != null) { jpql.append(" AND t.createdAt >= :from"); p.put("from", from); }
        if (to != null) { jpql.append(" AND t.createdAt <= :to"); p.put("to", endOfDay(to)); }
        Query q = em.createQuery(jpql.toString());
        p.forEach(q::setParameter);
        Object result = q.getSingleResult();
        return result == null ? 0L : ((Number) result).longValue();
    }

    private long aggregateCount(String entityName, String campaignField, Long campaignId,
                                String statusField, String statusValue,
                                String dateField, Date from, Date to) {
        StringBuilder jpql = new StringBuilder("SELECT COUNT(e) FROM ").append(entityName)
                .append(" e WHERE e.").append(statusField).append(" = :status");
        Map<String, Object> p = new HashMap<>();
        p.put("status", statusValue);
        if (campaignId != null) {
            jpql.append(" AND e.").append(campaignField).append(" = :campaignId");
            p.put("campaignId", campaignId);
        }
        if (from != null) {
            jpql.append(" AND e.").append(dateField).append(" >= :from");
            p.put("from", from);
        }
        if (to != null) {
            jpql.append(" AND e.").append(dateField).append(" <= :to");
            p.put("to", endOfDay(to));
        }
        Query q = em.createQuery(jpql.toString());
        p.forEach(q::setParameter);
        return ((Number) q.getSingleResult()).longValue();
    }

    private static int clampPageSize(int size) {
        if (size < 1) return 50;
        return Math.min(size, MAX_PAGE_SIZE);
    }

    private static Date parseDate(String s) {
        if (s == null || s.isEmpty()) return null;
        try { return new SimpleDateFormat("dd-MM-yyyy").parse(s); }
        catch (Exception e) { return null; }
    }

    private static Date endOfDay(Date d) {
        if (d == null) return null;
        return new Date(d.getTime() + (24L * 3600L * 1000L) - 1);
    }
}
