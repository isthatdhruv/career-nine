package com.kccitm.api.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

/**
 * Hard-deletes ONE student and every trace of their data — answers, scores,
 * reports, entitlements, counselling, demographics, memberships, logs, the
 * account rows themselves. Irreversible by design: this is the admin "delete
 * student" action (and the DPDP right-to-erasure backend).
 *
 * <p>Runs as native SQL in ONE transaction, children before parents, so a
 * missed foreign key aborts the whole purge cleanly instead of leaving a
 * half-deleted student. The login row ({@code student_user}) is handled in a
 * second, separate transaction: other tables may legitimately reference it,
 * so it is deleted when possible and PII-scrubbed when not — either way the
 * main purge has already committed.
 *
 * <p>{@code payment_transaction} rows are ANONYMIZED, not deleted — they are
 * the financial ledger (Razorpay reconciliation / accounting retention). The
 * student's name/email/DOB/phone are scrubbed and the student link cleared;
 * amounts and payment ids remain.
 */
@Service
public class StudentPurgeService {

    private static final Logger logger = LoggerFactory.getLogger(StudentPurgeService.class);

    @PersistenceContext
    private EntityManager em;

    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    /** Redis session/partial-answer state; optional so contexts without Redis still load. */
    @Autowired(required = false)
    private AssessmentSessionService assessmentSessionService;

    public static class PurgeResult {
        public final Map<String, Integer> deleted;
        public final Long userId;
        public PurgeResult(Map<String, Integer> deleted, Long userId) {
            this.deleted = deleted;
            this.userId = userId;
        }
    }

    @Transactional
    public PurgeResult purge(Long userStudentId) {
        UserStudent us = userStudentRepository.findById(userStudentId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found: " + userStudentId));
        Long userId = us.getUserId();
        Integer studentInfoId = us.getStudentInfo() != null ? us.getStudentInfo().getId() : null;

        // Clear Redis first (partial answers, retry state) so nothing flushes a
        // deleted student's answers back into MySQL after the purge commits.
        if (assessmentSessionService != null) {
            for (StudentAssessmentMapping m : studentAssessmentMappingRepository
                    .findByUserStudentUserStudentId(userStudentId)) {
                try {
                    assessmentSessionService.clearAllForMapping(userStudentId, m.getAssessmentId());
                } catch (Exception e) {
                    logger.warn("Purge: Redis clear failed for student={} assessment={} (continuing): {}",
                            userStudentId, m.getAssessmentId(), e.getMessage());
                }
            }
        }

        Map<String, Integer> counts = new LinkedHashMap<>();

        // ── Counselling (children of appointments first) ─────────────────────
        joinDelete(counts, "session_notes",
                "DELETE t FROM session_notes t JOIN counselling_appointment ca ON t.appointment_id = ca.id WHERE ca.student_id = :id", userStudentId);
        joinDelete(counts, "counselling_checkin_otp",
                "DELETE t FROM counselling_checkin_otp t JOIN counselling_appointment ca ON t.appointment_id = ca.id WHERE ca.student_id = :id", userStudentId);
        joinDelete(counts, "appointment_audit_log",
                "DELETE t FROM appointment_audit_log t JOIN counselling_appointment ca ON t.appointment_id = ca.id WHERE ca.student_id = :id", userStudentId);
        joinDelete(counts, "counselling_reminder_sent",
                "DELETE t FROM counselling_reminder_sent t JOIN counselling_appointment ca ON t.appointment_id = ca.id WHERE ca.student_id = :id", userStudentId);
        delete(counts, "counselling_rating", "student_id", userStudentId);
        delete(counts, "counselling_payment", "student_id", userStudentId);
        delete(counts, "counselling_appointment", "student_id", userStudentId);
        delete(counts, "student_counsellor_mapping", "student_id", userStudentId);
        delete(counts, "counselling_request", "user_student_id", userStudentId);
        if (userId != null) {
            delete(counts, "counselling_notification", "user_id", userId);
        }

        // ── Assessment data ──────────────────────────────────────────────────
        joinDelete(counts, "assessment_raw_score",
                "DELETE t FROM assessment_raw_score t JOIN student_assessment_mapping sam ON t.student_assessment_id = sam.student_assessment_id WHERE sam.user_student_id = :id", userStudentId);
        delete(counts, "assessment_answer", "user_student_id", userStudentId);
        delete(counts, "assessment_proctoring_question_log", "user_student_id", userStudentId);
        delete(counts, "assessment_submission_failure", "user_student_id", userStudentId);
        delete(counts, "assessment_admin_action", "user_student_id", userStudentId);
        delete(counts, "student_assessment_mapping", "user_student_id", userStudentId);

        // ── Reports and scores ───────────────────────────────────────────────
        delete(counts, "generated_report", "user_student_id", userStudentId);
        delete(counts, "bet_report_data", "user_student_id", userStudentId);
        delete(counts, "navigator_report_data", "user_student_id", userStudentId);
        delete(counts, "calculated_report_data", "user_student_id", userStudentId);
        delete(counts, "general_assessment_result", "user_student_id", userStudentId);
        delete(counts, "intermediary_scores", "user_student_id", userStudentId);
        delete(counts, "report_generation_log", "user_student_id", userStudentId);

        // ── B2C ──────────────────────────────────────────────────────────────
        delete(counts, "service_delivery_log", "user_student_id", userStudentId);
        delete(counts, "student_entitlements", "user_student_id", userStudentId);
        delete(counts, "student_referral", "user_student_id", userStudentId);

        // ── Comms / misc ─────────────────────────────────────────────────────
        delete(counts, "email_send_log", "user_student_id", userStudentId);
        delete(counts, "reminder_delivery_log", "user_student_id", userStudentId);
        delete(counts, "reminder_suppression", "user_student_id", userStudentId);
        delete(counts, "assessment_student_invite", "user_student_id", userStudentId);
        delete(counts, "student_group_member", "user_student_id", userStudentId);
        delete(counts, "student_contact_assignment", "user_student_id", userStudentId);
        delete(counts, "firebase_student_extra_data", "user_student_id", userStudentId);
        delete(counts, "student_demographic_response", "user_student_id", userStudentId);
        delete(counts, "user_student_institute_history", "user_student_id", userStudentId);

        // ── Financial ledger: anonymize, never delete ────────────────────────
        int txns = em.createNativeQuery(
                "UPDATE payment_transaction SET user_student_id = NULL, student_name = '[deleted]', "
                        + "student_email = NULL, student_dob = NULL, student_phone = NULL "
                        + "WHERE user_student_id = :id")
                .setParameter("id", userStudentId)
                .executeUpdate();
        counts.put("payment_transaction (anonymized)", txns);

        // ── Core rows last (user_student before student_info: FK direction) ──
        delete(counts, "user_student", "user_student_id", userStudentId);
        if (studentInfoId != null) {
            int n = em.createNativeQuery("DELETE FROM student_info WHERE id = :id")
                    .setParameter("id", studentInfoId).executeUpdate();
            counts.put("student_info", n);
        }

        logger.info("Student purge committed: userStudentId={} studentInfoId={} userId={} counts={}",
                userStudentId, studentInfoId, userId, counts);
        return new PurgeResult(counts, userId);
    }

    /**
     * Phase 2a, own transaction: remove the login row. Runs after the main purge
     * has committed. A failure here (something this service does not know about
     * still references the row) rolls back only this transaction — the caller
     * then falls back to {@link #scrubUser}, because an orphaned anonymous login
     * row is acceptable while a rolled-back purge is not. Split into two methods
     * (not try/catch in one) since a failed statement poisons its transaction.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean tryDeleteUser(Long userId) {
        if (userId == null) return true;
        return em.createNativeQuery("DELETE FROM student_user WHERE id = :id")
                .setParameter("id", userId).executeUpdate() >= 0;
    }

    /** Phase 2b fallback: PII-scrub the login row that could not be deleted. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void scrubUser(Long userId) {
        if (userId == null) return;
        em.createNativeQuery(
                "UPDATE student_user SET name = '[deleted]', email = NULL, phone = NULL WHERE id = :id")
                .setParameter("id", userId).executeUpdate();
    }

    private void delete(Map<String, Integer> counts, String table, String column, Long id) {
        int n = em.createNativeQuery("DELETE FROM " + table + " WHERE " + column + " = :id")
                .setParameter("id", id)
                .executeUpdate();
        counts.put(table, n);
    }

    private void joinDelete(Map<String, Integer> counts, String label, String sql, Long id) {
        int n = em.createNativeQuery(sql).setParameter("id", id).executeUpdate();
        counts.put(label, n);
    }
}
