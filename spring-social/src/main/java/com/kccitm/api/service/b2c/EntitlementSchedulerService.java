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
