package com.kccitm.api.service.b2c;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;

/**
 * Answers one question, in one place: may this student's finished report be mailed out yet?
 *
 * <p>Normally yes, the moment it exists. On a tier bought with the counsellor-release setting
 * on, no — the results are meant to be talked through, so the report waits until the counsellor
 * presses "Send report" on the session. Three separate senders fire when a report is generated
 * (the student's entitlement link, the pipeline's report email, and the counsellor's
 * report-ready notice), and all three must make the same call, so they all ask here rather than
 * each re-deriving it from the entitlement rows.
 *
 * <p>Read from the entitlement's own snapshot, not the tier: what mattered is what the student
 * was sold, and a tier edited after the fact must not change how a report already in flight is
 * handled.
 *
 * <p>Fails open. A lookup that throws — a detached session, a database blip — returns "not
 * held", because a report that goes out slightly too eagerly is a smaller failure than one
 * that silently never goes out at all.
 */
@Service
public class ReportReleaseGate {

    private static final Logger logger = LoggerFactory.getLogger(ReportReleaseGate.class);

    @Autowired
    private StudentEntitlementRepository entitlementRepository;

    /**
     * The same question asked from a counselling appointment, which knows the entitlement it
     * was booked against but not the assessment behind it.
     *
     * <p>Worth its own route rather than resolving the assessment first: a booking whose
     * assessment cannot be resolved would otherwise answer "not held" and quietly mail out a
     * report the tier was holding.
     */
    public boolean isHeldForEntitlement(Long entitlementId) {
        if (entitlementId == null) return false;
        try {
            return entitlementRepository.findById(entitlementId)
                    .map(e -> Boolean.TRUE.equals(e.getCounsellorReleaseReport()))
                    .orElse(false);
        } catch (Exception ex) {
            logger.warn("Could not resolve report-release setting entitlement={}: {}",
                    entitlementId, ex.getMessage());
            return false;
        }
    }

    /**
     * True when this student's report for this assessment is the counsellor's to release.
     *
     * <p>Any live entitlement saying so is enough: a student holding several for one assessment
     * (an upgrade, a re-grant) should not have the hold defeated by whichever row happens to be
     * newest.
     */
    public boolean isHeldForCounsellorRelease(Long userStudentId, Long assessmentId) {
        if (userStudentId == null || assessmentId == null) return false;
        try {
            List<StudentEntitlement> rows = entitlementRepository
                    .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(userStudentId, assessmentId);
            for (StudentEntitlement e : rows) {
                if (!"active".equals(e.getStatus()) && !"pending".equals(e.getStatus())) continue;
                if (Boolean.TRUE.equals(e.getCounsellorReleaseReport())) return true;
            }
            return false;
        } catch (Exception ex) {
            logger.warn("Could not resolve report-release setting student={} assessment={}: {}",
                    userStudentId, assessmentId, ex.getMessage());
            return false;
        }
    }
}
