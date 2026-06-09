package com.kccitm.api.service.dashboard.insight;

import java.util.Date;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;

/**
 * Decides whether a student's assessment Insight View is unlocked.
 *
 * <p>Single source of truth for the "report flag is green" rule from the product
 * brief: a view unlocks when the admin has released it (visibleToStudent) OR the
 * student holds an active, non-expired paid entitlement with dashboard access.
 */
@Service
public class InsightAccessService {

    @Autowired private GeneratedReportRepository generatedReportRepository;
    @Autowired private StudentEntitlementRepository studentEntitlementRepository;

    /** Outcome of the gate. */
    public static class Decision {
        public final boolean unlocked;
        /** "released" | "purchased" | "locked". */
        public final String reason;

        public Decision(boolean unlocked, String reason) {
            this.unlocked = unlocked;
            this.reason = reason;
        }
    }

    public Decision evaluate(Long userStudentId, Long assessmentId) {
        // 1. Admin released this student's report (visibleToStudent).
        List<GeneratedReport> visible = generatedReportRepository
                .findByUserStudentUserStudentIdAndVisibleToStudent(userStudentId, true);
        boolean released = visible.stream()
                .anyMatch(r -> assessmentId == null || assessmentId.equals(r.getAssessmentId()));
        if (released) {
            return new Decision(true, "released");
        }

        // 2. Active, non-expired paid entitlement granting dashboard access.
        List<StudentEntitlement> entitlements = (assessmentId != null)
                ? studentEntitlementRepository
                        .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(userStudentId, assessmentId)
                : studentEntitlementRepository.findByUserStudentIdOrderByCreatedAtDesc(userStudentId);
        Date now = new Date();
        boolean purchased = entitlements.stream().anyMatch(e ->
                "active".equals(e.getStatus())
                        && Boolean.TRUE.equals(e.getDashboardActive())
                        && (e.getDashboardExpiresAt() == null || e.getDashboardExpiresAt().after(now)));
        if (purchased) {
            return new Decision(true, "purchased");
        }

        return new Decision(false, "locked");
    }
}
