package com.kccitm.api.service.career9;

import java.util.Date;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.ReferralCode;
import com.kccitm.api.model.career9.StudentReferral;
import com.kccitm.api.repository.Career9.ReferralCodeAssessmentRepository;
import com.kccitm.api.repository.Career9.ReferralCodeRepository;
import com.kccitm.api.repository.Career9.StudentReferralRepository;

/**
 * Validation + linking for referral codes. Mirrors the promo-code lifecycle:
 * validate at registration, but only consume a use (and record the student
 * linkage) at realized redemption — the free-commit, or the paid webhook.
 */
@Service
public class ReferralService {

    private static final Logger logger = LoggerFactory.getLogger(ReferralService.class);

    @Autowired private ReferralCodeRepository referralCodeRepository;
    @Autowired private ReferralCodeAssessmentRepository referralCodeAssessmentRepository;
    @Autowired private StudentReferralRepository studentReferralRepository;

    /** Outcome of validating a code against a specific assessment. */
    public static class Result {
        public final boolean valid;
        public final String message;
        public final ReferralCode referralCode;

        private Result(boolean valid, String message, ReferralCode referralCode) {
            this.valid = valid;
            this.message = message;
            this.referralCode = referralCode;
        }

        static Result ok(ReferralCode rc) { return new Result(true, null, rc); }
        static Result fail(String msg) { return new Result(false, msg, null); }
    }

    /**
     * Validate {@code code} for use in {@code assessmentId}: must exist, be active,
     * not expired, not at its usage cap, and be mapped to the assessment.
     */
    public Result validate(String code, Long assessmentId) {
        if (code == null || code.trim().isEmpty()) {
            return Result.fail("Referral code is required");
        }
        if (assessmentId == null) {
            return Result.fail("Assessment is required");
        }
        Optional<ReferralCode> opt =
                referralCodeRepository.findByCodeIgnoreCaseAndIsActive(code.trim().toUpperCase(), true);
        if (!opt.isPresent()) {
            return Result.fail("Invalid referral code");
        }
        ReferralCode rc = opt.get();
        if (rc.getExpiresAt() != null && rc.getExpiresAt().before(new Date())) {
            return Result.fail("Referral code has expired");
        }
        if (rc.getMaxUses() != null && rc.getCurrentUses() != null && rc.getCurrentUses() >= rc.getMaxUses()) {
            return Result.fail("Referral code usage limit reached");
        }
        if (!referralCodeAssessmentRepository.existsByReferralCodeIdAndAssessmentId(rc.getId(), assessmentId)) {
            return Result.fail("Referral code is not valid for this assessment");
        }
        return Result.ok(rc);
    }

    /**
     * Record that {@code userStudentId} is the referral of {@code code}, and
     * consume one use. Idempotent and rule-enforcing: a student who already has a
     * referral keeps it (one referral per student); a missing/invalid code is a
     * no-op. Safe to call from both the free-commit and the paid webhook.
     */
    public void linkStudent(Long userStudentId, String code, Long assessmentId, Integer instituteCode) {
        if (userStudentId == null || code == null || code.trim().isEmpty()) {
            return;
        }
        if (studentReferralRepository.existsByUserStudentId(userStudentId)) {
            return; // one referral per student
        }
        Optional<ReferralCode> opt = referralCodeRepository.findByCodeIgnoreCase(code.trim().toUpperCase());
        if (!opt.isPresent()) {
            logger.warn("Referral {} not found at link time for student {}", code, userStudentId);
            return;
        }
        ReferralCode rc = opt.get();

        StudentReferral link = new StudentReferral();
        link.setUserStudentId(userStudentId);
        link.setReferralCodeId(rc.getId());
        link.setAssessmentId(assessmentId);
        link.setInstituteCode(instituteCode);
        try {
            studentReferralRepository.save(link);
        } catch (Exception e) {
            // Unique(user_student_id) race — another path linked it first. Fine.
            logger.warn("Referral link skipped for student {} (already linked): {}", userStudentId, e.getMessage());
            return;
        }

        int rows = referralCodeRepository.tryConsume(rc.getId());
        if (rows == 0) {
            logger.warn("Referral {} already at maxUses at redemption time", code);
        }
    }
}
