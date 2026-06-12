package com.kccitm.api.service.b2c;

import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.model.reminder.ReminderServiceType;
import com.kccitm.api.service.reminder.ReminderConfigService;

/**
 * MVP scheduler: nudge unstarted assessments. Expiry / final-report polls layer in later.
 * Runs hourly. Caps at 2 nudges per entitlement (checked via ServiceDeliveryLog history).
 */
@Service
public class EntitlementSchedulerService {

    private static final Logger logger = LoggerFactory.getLogger(EntitlementSchedulerService.class);
    private static final int MAX_NUDGES_PER_ENTITLEMENT = 2;
    private static final int FIRST_NUDGE_AFTER_HOURS = 24;

    @Autowired private StudentEntitlementRepository entitlementRepository;
    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private StudentAssessmentMappingRepository studentAssessmentMappingRepository;
    @Autowired private NotificationDispatcher notificationDispatcher;
    @Autowired private LinkBuilder linkBuilder;
    @Autowired private EntitlementService entitlementService;
    @Autowired(required = false) private ReminderConfigService reminderConfigService;

    @Scheduled(cron = "0 23 * * * *") // 23 minutes past every hour to avoid clustering
    public void nudgeUnstartedAssessments() {
        // Honour central reminder config when present (Phase: Reminder Management).
        if (reminderConfigService != null
                && !reminderConfigService.isEnabled(ReminderServiceType.ASSESSMENT_INVITE_B2C)) {
            return;
        }
        Date cutoff = hoursAgo(FIRST_NUDGE_AFTER_HOURS);
        List<StudentEntitlement> candidates = entitlementRepository.findActiveOlderThan(cutoff);
        if (candidates.isEmpty()) return;
        logger.info("B2C nudge sweep: {} candidates", candidates.size());

        for (StudentEntitlement e : candidates) {
            try {
                if (e.getUserStudentId() == null || e.getAssessmentId() == null) continue;

                long nudgesSent = notificationDispatcher.countSent(e.getEntitlementId(), "nudge");
                int cap = MAX_NUDGES_PER_ENTITLEMENT;
                if (reminderConfigService != null) {
                    Integer dynCap = reminderConfigService.getMaxSendsPerRecipient(ReminderServiceType.ASSESSMENT_INVITE_B2C);
                    if (dynCap != null && dynCap > 0) cap = dynCap;
                }
                if (nudgesSent >= cap) continue;

                Optional<StudentAssessmentMapping> samOpt = studentAssessmentMappingRepository
                        .findFirstByUserStudentUserStudentIdAndAssessmentId(
                                e.getUserStudentId(), e.getAssessmentId());
                if (samOpt.isPresent() && !"notstarted".equals(samOpt.get().getStatus())) continue;

                String email = resolveStudentEmail(e);
                if (email == null) continue;

                EntitlementService.ResendResult r = entitlementService.resendServiceLink(
                        e.getEntitlementId(), "assessment_invite", email);
                if (!r.ok) {
                    logger.warn("Nudge skipped for entitlement {}: {}", e.getEntitlementId(), r.message);
                }
            } catch (Exception ex) {
                logger.warn("Nudge sweep failed for entitlement {} (continuing)", e.getEntitlementId(), ex);
            }
        }
    }

    /**
     * EXP1: expire entitlements whose paid service window has lapsed. {@code findExpired}
     * had no caller, so dashboard/LMS access ran forever. This turns off the date-bound
     * service flags whose expiry passed, advances {@code expiresAt} to the earliest still-
     * active window (or null so the row stops re-appearing), and flips status to
     * {@code expired} only once nothing usable remains — the final report is permanent, so a
     * report-bearing entitlement stays redeemable with its dashboard/LMS switched off. The
     * per-service gates also check these dates directly (EXP2), so access stops immediately
     * rather than waiting up to an hour for this sweep.
     */
    @Scheduled(cron = "0 41 * * * *") // 41 minutes past the hour to avoid clustering with the nudge sweep
    @org.springframework.transaction.annotation.Transactional
    public void expireEntitlements() {
        Date now = new Date();
        List<StudentEntitlement> due = entitlementRepository.findExpired(now);
        if (due.isEmpty()) return;
        logger.info("B2C expiry sweep: {} entitlements past their service window", due.size());
        for (StudentEntitlement e : due) {
            try {
                if (e.getDashboardExpiresAt() != null && e.getDashboardExpiresAt().before(now)
                        && Boolean.TRUE.equals(e.getDashboardActive())) {
                    e.setDashboardActive(false);
                }
                if (e.getLmsExpiresAt() != null && e.getLmsExpiresAt().before(now)
                        && Boolean.TRUE.equals(e.getLmsActive())) {
                    e.setLmsActive(false);
                }
                Date next = null;
                if (Boolean.TRUE.equals(e.getDashboardActive())) next = earlier(next, e.getDashboardExpiresAt());
                if (Boolean.TRUE.equals(e.getLmsActive())) next = earlier(next, e.getLmsExpiresAt());
                e.setExpiresAt(next);

                boolean anyActive = Boolean.TRUE.equals(e.getFinalReportActive())
                        || Boolean.TRUE.equals(e.getDashboardActive())
                        || Boolean.TRUE.equals(e.getLmsActive())
                        || Boolean.TRUE.equals(e.getCounsellingActive());
                if (!anyActive) e.setStatus("expired");
                entitlementRepository.save(e);
            } catch (Exception ex) {
                logger.warn("Expiry sweep failed for entitlement {} (continuing)", e.getEntitlementId(), ex);
            }
        }
    }

    private static Date earlier(Date a, Date b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.before(b) ? a : b;
    }

    private String resolveStudentEmail(StudentEntitlement e) {
        if (e.getPaymentTransactionId() != null) {
            Optional<PaymentTransaction> txnOpt = paymentTransactionRepository.findById(e.getPaymentTransactionId());
            if (txnOpt.isPresent() && txnOpt.get().getStudentEmail() != null) {
                return txnOpt.get().getStudentEmail();
            }
        }
        if (e.getUserStudentId() != null) {
            Optional<UserStudent> usOpt = userStudentRepository.findById(e.getUserStudentId());
            if (usOpt.isPresent() && usOpt.get().getStudentInfo() != null) {
                return usOpt.get().getStudentInfo().getEmail();
            }
        }
        return null;
    }

    private static Date hoursAgo(int hours) {
        Calendar c = Calendar.getInstance();
        c.add(Calendar.HOUR_OF_DAY, -hours);
        return c.getTime();
    }
}
