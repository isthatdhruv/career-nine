package com.kccitm.api.service.counselling;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Date;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.CounsellingOtpGuard;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingOtpGuardRepository;

/**
 * Checks a student's counselling OTP typed by an offline counsellor, with a wrong-guess cap that
 * actually persists.
 *
 * <p><b>Why a bean of its own, in its own transaction.</b> The code is four digits derived from
 * the DOB and never changes, so the only thing between it and being found by trying is the
 * counter. {@code CheckinOtpService.verify} shows how that goes wrong: it increments, then throws
 * inside the same transaction, so the increment rolls back and the cap never fires. Here the
 * method never throws for a guessing outcome — it returns one — and runs in
 * {@code REQUIRES_NEW} on a separate bean (a same-bean call would bypass the proxy and silently
 * join the caller's transaction). The failure is therefore committed before the caller decides
 * anything, whatever the caller does next.
 *
 * <p>Rules: {@code app.counselling.checkin-max-attempts} (default 3) wrong codes within
 * {@value #WINDOW_MINUTES} minutes lock the code for {@value #LOCK_MINUTES} minutes;
 * {@value #PERMANENT_LOCK_AFTER} wrong codes in total lock it for good. A lock only stops the
 * code being <i>checked</i> — the counsellor can still record the session unverified.
 *
 * <p>A student with no DOB has no code. {@code CounsellingOtpService} falls back to "1111" for
 * them (the report prints it), which proves nothing, so such a student gets {@code NO_DOB} and
 * never {@code VERIFIED}.
 *
 * <p>Time is {@link CounsellingClock} throughout, so stored lock times are IST wall-clock like
 * every other counselling timestamp the portal shows.
 */
@Service
public class OtpGuardService {

    private static final Logger logger = LoggerFactory.getLogger(OtpGuardService.class);

    public static final int WINDOW_MINUTES = 15;
    public static final int LOCK_MINUTES = 15;
    public static final int PERMANENT_LOCK_AFTER = 10;

    public enum Status { VERIFIED, WRONG, LOCKED, NO_DOB }

    /** What the check concluded. Never an exception: see the class comment. */
    public static class Result {
        private final Status status;
        private final Integer attemptsLeft;
        private final LocalDateTime lockedUntil;
        private final boolean permanent;

        private Result(Status status, Integer attemptsLeft, LocalDateTime lockedUntil, boolean permanent) {
            this.status = status;
            this.attemptsLeft = attemptsLeft;
            this.lockedUntil = lockedUntil;
            this.permanent = permanent;
        }

        static Result verified() { return new Result(Status.VERIFIED, null, null, false); }
        static Result noDob() { return new Result(Status.NO_DOB, null, null, false); }
        static Result wrong(int attemptsLeft) { return new Result(Status.WRONG, attemptsLeft, null, false); }
        static Result locked(LocalDateTime until) { return new Result(Status.LOCKED, null, until, false); }
        static Result lockedForGood() { return new Result(Status.LOCKED, null, null, true); }

        public Status getStatus() { return status; }
        /** Wrong codes left before the next lock; set only for {@link Status#WRONG}. */
        public Integer getAttemptsLeft() { return attemptsLeft; }
        /** When a temporary lock lifts; null for a permanent lock and for every other status. */
        public LocalDateTime getLockedUntil() { return lockedUntil; }
        public boolean isPermanent() { return permanent; }
    }

    @Value("${app.counselling.checkin-max-attempts:3}")
    private int maxAttempts = 3;

    @Autowired
    private CounsellingOtpGuardRepository guardRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private CounsellingClock clock;

    /**
     * Compares {@code code} with the student's counselling OTP and records the outcome.
     *
     * @param userStudentId  the student (user_student_id)
     * @param code           what the counsellor typed; the caller only calls this when non-blank
     * @param counsellorId   who typed it, kept on the row for the audit trail
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Result check(Long userStudentId, String code, Long counsellorId) {
        String expected = expectedCodeFor(userStudentId);
        if (expected == null) return Result.noDob();

        LocalDateTime now = clock.now();
        // Always lock the row, even for a right code: a locked code must not be checked at all,
        // or a guess made during the lock would still reveal whether it was right.
        guardRepository.ensureRow(userStudentId, now);
        CounsellingOtpGuard guard = guardRepository.lockByStudentId(userStudentId)
                .orElseGet(() -> new CounsellingOtpGuard(userStudentId));

        if (guard.getTotalFailures() >= PERMANENT_LOCK_AFTER) return Result.lockedForGood();
        if (guard.getLockedUntil() != null && now.isBefore(guard.getLockedUntil())) {
            return Result.locked(guard.getLockedUntil());
        }

        if (matches(expected, code)) return Result.verified();

        // Wrong. Open a fresh window if there is none or the last one has lapsed.
        boolean windowLapsed = guard.getWindowStartedAt() == null
                || !now.isBefore(guard.getWindowStartedAt().plusMinutes(WINDOW_MINUTES));
        if (windowLapsed) {
            guard.setWindowStartedAt(now);
            guard.setFailedAttempts(1);
        } else {
            guard.setFailedAttempts(guard.getFailedAttempts() + 1);
        }
        guard.setTotalFailures(guard.getTotalFailures() + 1);
        guard.setLastFailedByCounsellorId(counsellorId);

        Result result;
        if (guard.getTotalFailures() >= PERMANENT_LOCK_AFTER) {
            result = Result.lockedForGood();
        } else if (guard.getFailedAttempts() >= maxAttempts) {
            guard.setLockedUntil(now.plusMinutes(LOCK_MINUTES));
            // The next wrong code after the lock starts a new window rather than re-locking at once.
            guard.setFailedAttempts(0);
            guard.setWindowStartedAt(null);
            result = Result.locked(guard.getLockedUntil());
        } else {
            int leftInWindow = maxAttempts - guard.getFailedAttempts();
            int leftInTotal = PERMANENT_LOCK_AFTER - guard.getTotalFailures();
            result = Result.wrong(Math.min(leftInWindow, leftInTotal));
        }
        guardRepository.save(guard);

        logger.warn("Wrong counselling OTP for student {} by counsellor {} (window {}, total {}) -> {}",
                userStudentId, counsellorId, guard.getFailedAttempts(), guard.getTotalFailures(),
                result.getStatus());
        return result;
    }

    /**
     * The student's code, or null when there is none to check against. Loaded with
     * {@code findById} (an unfiltered primary-key load) rather than JPQL: the scope filter
     * would hide every school student from a counsellor with no scope rows.
     */
    private String expectedCodeFor(Long userStudentId) {
        try {
            UserStudent student = userStudentRepository.findById(userStudentId).orElse(null);
            if (student == null || student.getStudentInfo() == null) return null;
            Date dob = student.getStudentInfo().getStudentDob();
            if (dob == null) return null;
            return CounsellingOtpService.counsellingOtpFor(dob);
        } catch (Exception e) {
            // An unreadable DOB is no DOB: the code cannot be proven either way.
            logger.warn("Could not derive the counselling OTP for student {}: {}", userStudentId, e.getMessage());
            return null;
        }
    }

    /** Constant-time compare, so response timing says nothing about how close a guess was. */
    private static boolean matches(String expected, String typed) {
        if (typed == null) return false;
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                typed.trim().getBytes(StandardCharsets.UTF_8));
    }
}
