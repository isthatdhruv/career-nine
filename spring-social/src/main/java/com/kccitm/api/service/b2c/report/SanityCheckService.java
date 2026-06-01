package com.kccitm.api.service.b2c.report;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

/**
 * Pre-flight + post-calc gating for the unified report pipeline.
 *
 * <p>Split intentionally into two phases:
 * <ul>
 *   <li>{@link #existsAndComplete} — fast DB pre-check (mapping row exists and
 *       its status is {@code "completed"}). Fires before any score calc.</li>
 *   <li>{@link #evaluateSignificance} — pure function on already-computed
 *       intermediary scores. Fires after the strategy has produced
 *       intermediary scores, so significance is decided WITHOUT recomputing.</li>
 * </ul>
 *
 * <p>{@link #evaluateSignificance} returns a tri-state ({@link Verdict#OK},
 * {@link Verdict#INSUFFICIENT_BUT_RENDER}, {@link Verdict#BLOCK}) so we
 * preserve today's Navigator behavior — students who answer too few questions
 * still receive a report flagged as low-confidence rather than a 4xx error
 * (plan Risk #5). {@link Verdict#BLOCK} is reserved for the literally-no-data
 * case (every dimension at zero) and isn't observed in the existing Navigator
 * gating logic; it exists for future use.
 */
@Service
public class SanityCheckService {

    private static final Logger logger = LoggerFactory.getLogger(SanityCheckService.class);

    @Autowired private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    public enum Verdict { OK, INSUFFICIENT_BUT_RENDER, BLOCK }

    public static class SanityResult {
        public final boolean ok;
        public final String code;
        public final String reason;

        public SanityResult(boolean ok, String code, String reason) {
            this.ok = ok;
            this.code = code;
            this.reason = reason;
        }

        public static SanityResult pass() { return new SanityResult(true, "OK", null); }
        public static SanityResult fail(String code, String reason) {
            return new SanityResult(false, code, reason);
        }
    }

    public static class SignificanceResult {
        public final Verdict verdict;
        public final List<String> issues;

        public SignificanceResult(Verdict verdict, List<String> issues) {
            this.verdict = verdict;
            this.issues = issues;
        }
    }

    /**
     * Fast pre-flight. Confirms the student has a mapping row for this
     * assessment and that the mapping is in {@code "completed"} status (i.e.
     * the async submission processor has finished persisting answers).
     */
    public SanityResult existsAndComplete(Long userStudentId, Long assessmentId) {
        if (userStudentId == null || assessmentId == null) {
            return SanityResult.fail("BAD_ARGS", "userStudentId and assessmentId must be non-null");
        }

        Optional<StudentAssessmentMapping> opt = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);

        if (!opt.isPresent()) {
            return SanityResult.fail("NO_MAPPING",
                    "No StudentAssessmentMapping for student=" + userStudentId
                            + " assessment=" + assessmentId);
        }

        String status = opt.get().getStatus();
        if (status == null || !"completed".equalsIgnoreCase(status.trim())) {
            // Pager has a 1s retry window in PagerScoreSource for the async-persistence
            // race; that retry happens at the strategy layer, not here. SanityCheck is
            // a fast gate — if the mapping isn't completed yet, return NOT_COMPLETED and
            // let the controller decide (typically 503 for transient).
            return SanityResult.fail("NOT_COMPLETED",
                    "Assessment mapping status=" + status + " (expected 'completed')");
        }

        return SanityResult.pass();
    }

    /**
     * Pure function on already-computed RIASEC / Aptitude / MI score maps.
     * Mirrors the gating rules in
     * {@link com.kccitm.api.service.Navigator.NavigatorReportGenerationService}
     * lines 322-370:
     *
     * <ul>
     *   <li>Each RIASEC personality score must be >= 9.</li>
     *   <li>No more than 3 RIASEC scores may equal 1 (otherwise the response is
     *       considered random / disengaged).</li>
     *   <li>Each aptitude score must be >= 3.</li>
     *   <li>Each MI score must be >= 3.</li>
     * </ul>
     *
     * Any null/empty input map means the corresponding section wasn't part of
     * this questionnaire and is skipped (Navigator handles this gracefully —
     * we preserve that).
     *
     * @return {@link Verdict#OK} if no issues, {@link Verdict#INSUFFICIENT_BUT_RENDER}
     *         if at least one issue was found (parity with today's
     *         {@code eligible=false} behavior — still render the report),
     *         {@link Verdict#BLOCK} only if every pillar is null/empty
     *         (no data at all).
     */
    public SignificanceResult evaluateSignificance(
            Map<String, Integer> riasecScores,
            Map<String, Integer> aptitudeScores,
            Map<String, Integer> miScores) {

        List<String> issues = new ArrayList<>();

        boolean hasRiasec   = hasSignal(riasecScores);
        boolean hasAptitude = hasSignal(aptitudeScores);
        boolean hasMI       = hasSignal(miScores);

        if (!hasRiasec && !hasAptitude && !hasMI) {
            issues.add("BLOCK: no scoring data in any pillar (RIASEC, Aptitude, MI)");
            return new SignificanceResult(Verdict.BLOCK, issues);
        }

        // RIASEC: every score >= 9; no more than 3 scores of 1.
        if (hasRiasec) {
            int lowOnes = 0;
            for (Map.Entry<String, Integer> e : riasecScores.entrySet()) {
                int v = e.getValue() == null ? 0 : e.getValue();
                if (v < 9) issues.add("Personality " + e.getKey() + ": " + v + " (< 9)");
                if (v == 1) lowOnes++;
            }
            if (lowOnes > 3) {
                issues.add("DISQUALIFIED: " + lowOnes + " personality traits scoring 1 (> 3)");
            }
        }

        // Aptitude: every score >= 3.
        if (hasAptitude) {
            for (Map.Entry<String, Integer> e : aptitudeScores.entrySet()) {
                int v = e.getValue() == null ? 0 : e.getValue();
                if (v < 3) issues.add("Ability " + e.getKey() + ": " + v + " (< 3)");
            }
        }

        // MI: every score >= 3.
        if (hasMI) {
            for (Map.Entry<String, Integer> e : miScores.entrySet()) {
                int v = e.getValue() == null ? 0 : e.getValue();
                if (v < 3) issues.add("Intelligence " + e.getKey() + ": " + v + " (< 3)");
            }
        }

        Verdict verdict = issues.isEmpty() ? Verdict.OK : Verdict.INSUFFICIENT_BUT_RENDER;
        if (verdict != Verdict.OK) {
            logger.warn("SanityCheck INSUFFICIENT_BUT_RENDER: {}", issues);
        }
        return new SignificanceResult(verdict, issues);
    }

    private static boolean hasSignal(Map<String, Integer> m) {
        if (m == null || m.isEmpty()) return false;
        for (Integer v : m.values()) {
            if (v != null && v > 0) return true;
        }
        return false;
    }
}
