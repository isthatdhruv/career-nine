package com.kccitm.api.service.counselling;

import java.time.LocalDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingCheckinOtp;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingCheckinOtpRepository;

/**
 * Session check-in. The counsellor triggers {@link #beginCheckin}, the student reads their
 * code out, and the counsellor enters it via {@link #verify}. A successful verification marks
 * the appointment IN_PROGRESS and records attendance.
 *
 * <p><b>The code is the student's DOB-derived counselling OTP</b>
 * ({@link CounsellingOtpService}) — the same four digits printed on their report — rather
 * than a freshly generated random one. It is recomputed from the DOB at verification time and
 * never stored, so it cannot go stale if the DOB is corrected.
 *
 * <p>Two consequences of that choice, both deliberate and worth knowing:
 * <ul>
 *   <li>The code is <b>permanent</b>, not single-use, so a session can be checked in with it
 *       at any time. It is no longer proof that the student was present at that moment — it
 *       proves only that whoever entered it knew the code.</li>
 *   <li>Four digits is a small space, so the attempt cap below is doing real work. It is the
 *       only thing standing between a wrong guess and a brute force.</li>
 * </ul>
 *
 * <p><b>Starting a session sends nothing.</b> The student already has the code — it is
 * printed on their report — so {@link #beginCheckin} only opens the attempt window. Delivery
 * is a separate, deliberate act: {@link #sendCodeToStudent} mails and WhatsApps the code when
 * the counsellor asks for it, for the student who cannot lay hands on their report.
 */
@Service
public class CheckinOtpService {

    private static final Logger logger = LoggerFactory.getLogger(CheckinOtpService.class);

    private static final int OTP_TTL_MINUTES = 15;

    /**
     * Wrong guesses allowed before the counsellor has to restart check-in. Four digits is
     * only 10,000 possibilities and the code never changes, so this is what stops a code
     * being found by trying.
     */
    @Value("${app.counselling.checkin-max-attempts:3}")
    private int maxAttempts;

    @Autowired
    private CounsellingCheckinOtpRepository otpRepository;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    /**
     * Only used by {@link #sendCodeToStudent} — check-in itself sends nothing.
     */
    @Autowired
    private CounsellingNotificationService notificationService;

    /**
     * Slot times are IST wall-clock while the JVM runs UTC, so the window checks below must
     * go through this rather than {@code LocalDateTime.now()} — on the raw clock they land
     * 5h30m adrift of the session they are meant to be gating.
     */
    @Autowired
    private CounsellingClock clock;

    /**
     * Opens the check-in window for a session.
     *
     * <p>Nothing is generated and nothing is sent — the student already has their code, on
     * their report. All this does is reset the attempt counter and start the clock, which is
     * what bounds guessing on the four-digit space.
     */
    @Transactional
    public CounsellingAppointment beginCheckin(Long appointmentId) {
        CounsellingAppointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("CounsellingAppointment", "id", appointmentId));

        if ("CANCELLED".equals(appt.getStatus()) || "RESCHEDULED".equals(appt.getStatus())
                || "COMPLETED".equals(appt.getStatus()) || "MISSED".equals(appt.getStatus())) {
            throw new BadRequestException("Cannot start a session that is " + appt.getStatus() + ".");
        }
        if (appt.getCheckinVerifiedAt() != null) {
            throw new BadRequestException("This session has already been checked in.");
        }
        guardCheckinWindow(appt);

        // The row is purely an attempt counter, an expiry window and an "already checked in"
        // marker. No code is stored: it is recomputed from the DOB at verification time.
        CounsellingCheckinOtp otp = otpRepository.findByAppointmentId(appointmentId)
                .orElseGet(CounsellingCheckinOtp::new);
        otp.setAppointmentId(appointmentId);
        otp.setCodeHash(null);
        otp.setExpiresAt(LocalDateTime.now().plusMinutes(OTP_TTL_MINUTES));
        otp.setAttempts(0);
        otp.setVerifiedAt(null);
        otpRepository.save(otp);

        logger.info("Check-in window opened for appointment {}", appointmentId);
        return appt;
    }

    /**
     * Check-in stays open until the slot ends; there is no lower bound (counsellors
     * may start/join their meeting room as early as they like).
     */
    private void guardCheckinWindow(CounsellingAppointment appt) {
        CounsellingSlot slot = appt.getSlot();
        if (slot == null || slot.getDate() == null || slot.getStartTime() == null) return;

        LocalDateTime start = clock.sessionStart(slot.getDate(), slot.getStartTime());
        LocalDateTime endsAt = slot.getEndTime() != null
                ? clock.sessionStart(slot.getDate(), slot.getEndTime())
                : start.plusHours(1);
        LocalDateTime now = clock.now();

        // No lower bound: counsellors may start/join ahead of the scheduled time
        // (product decision 2026-08 — the old opens-N-minutes-before lock kept
        // counsellors out of their own meeting room). The end-of-slot bound stays:
        // a check-in after the slot proves nothing about attendance.
        if (now.isAfter(endsAt)) {
            throw new BadRequestException(
                    "This session has ended and can no longer be checked in.");
        }
    }

    /**
     * The code this student should be reading out — their DOB-derived counselling OTP.
     *
     * <p>Falls back to {@link CounsellingOtpService#DEFAULT_OTP} when no DOB is on record,
     * which is the same fallback the report uses. Note that means every student without a DOB
     * shares one code, so a missing DOB is worth chasing rather than shrugging at.
     */
    private String expectedCodeFor(CounsellingAppointment appt) {
        try {
            return CounsellingOtpService.counsellingOtpFor(
                    appt.getStudent().getStudentInfo().getStudentDob());
        } catch (Exception e) {
            logger.warn("No DOB available for appointment {} — falling back to the default code: {}",
                    appt.getId(), e.getMessage());
            return CounsellingOtpService.DEFAULT_OTP;
        }
    }

    /**
     * Sends the student their check-in code by email and WhatsApp — the counsellor's
     * "Send code to student" button.
     *
     * <p>This exists because the code lives on the report and nowhere else: a student who
     * never downloaded it, or is on a phone with the PDF on a laptop at home, has no way to
     * read it out and the session cannot be checked in at all. Sending it is the escape
     * hatch, not the normal path.
     *
     * <p><b>Not gated by the check-in window</b>, unlike {@link #beginCheckin} and
     * {@link #verify}. That window exists to stop attendance being recorded at an hour when
     * the session was not happening; sending a code records nothing, and a counsellor who
     * wants the student to have it a few minutes early should not be blocked. The code is
     * permanent anyway — withholding it for ten more minutes protects nothing.
     *
     * @return the channels that accepted it ("WhatsApp", "email"), empty if the student has
     *         neither on record or both sends failed.
     */
    public List<String> sendCodeToStudent(Long appointmentId) {
        CounsellingAppointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("CounsellingAppointment", "id", appointmentId));

        if ("CANCELLED".equals(appt.getStatus()) || "RESCHEDULED".equals(appt.getStatus())
                || "COMPLETED".equals(appt.getStatus()) || "MISSED".equals(appt.getStatus())) {
            throw new BadRequestException("Cannot send a code for a session that is " + appt.getStatus() + ".");
        }
        if (appt.getCheckinVerifiedAt() != null) {
            throw new BadRequestException("This session has already been checked in.");
        }
        if (appt.getMarkedAbsentAt() != null) {
            throw new BadRequestException(
                    "This student is marked absent for this session. Ask an administrator to correct it.");
        }

        return notificationService.sendCheckinCodeToStudent(appt, expectedCodeFor(appt));
    }

    /**
     * Verifies the code the counsellor entered against the student's DOB-derived OTP,
     * recomputed here rather than read from storage. On success the appointment is marked
     * IN_PROGRESS with attendance recorded.
     *
     * <p>The comparison happens <b>server-side only</b>. The expected code is never returned
     * to the caller — sending it to the browser to be checked there would hand the answer to
     * anyone who opened the network tab.
     */
    @Transactional
    public CounsellingAppointment verify(Long appointmentId, String code) {
        if (code == null || code.trim().isEmpty()) {
            throw new BadRequestException("Enter the code the student read out to you.");
        }
        CounsellingAppointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("CounsellingAppointment", "id", appointmentId));

        if (appt.getCheckinVerifiedAt() != null) {
            throw new BadRequestException("This session has already been checked in.");
        }
        if (appt.getMarkedAbsentAt() != null) {
            throw new BadRequestException(
                    "This student is marked absent for this session. Ask an administrator to correct it.");
        }

        guardCheckinWindow(appt);

        CounsellingCheckinOtp otp = otpRepository.findByAppointmentId(appointmentId)
                .orElseThrow(() -> new BadRequestException(
                        "No check-in has been started yet. Press Start Session first."));

        if (otp.getVerifiedAt() != null) {
            throw new BadRequestException("This session has already been checked in.");
        }
        if (LocalDateTime.now().isAfter(otp.getExpiresAt())) {
            throw new BadRequestException("The check-in window has expired. Press Start Session again.");
        }
        // Four digits is only 10,000 possibilities and the code never changes, so this cap is
        // the whole defence against simply trying them.
        if (otp.getAttempts() >= maxAttempts) {
            throw new BadRequestException("Too many incorrect attempts. Press Start Session again.");
        }

        if (!expectedCodeFor(appt).equals(code.trim())) {
            otp.setAttempts(otp.getAttempts() + 1);
            otpRepository.save(otp);
            throw new BadRequestException("Incorrect code. Please try again.");
        }

        LocalDateTime now = LocalDateTime.now();
        otp.setVerifiedAt(now);
        otpRepository.save(otp);

        appt.setStatus("IN_PROGRESS");
        appt.setSessionStartedAt(now);
        appt.setCheckinVerifiedAt(now);
        appt.setAttended(true);
        CounsellingAppointment saved = appointmentRepository.save(appt);
        logger.info("Check-in verified for appointment {} — session started, student present", appointmentId);
        return saved;
    }
}
