package com.kccitm.api.service.counselling;

import java.security.SecureRandom;
import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingCheckinOtp;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingCheckinOtpRepository;

/**
 * Session check-in OTP. When the student arrives the counsellor triggers
 * {@link #generateAndSend}; the student receives the code (WhatsApp/email),
 * reads it to the counsellor, who enters it via {@link #verify}. A successful
 * verification marks the appointment IN_PROGRESS and records attendance.
 *
 * The raw code is never stored — only a BCrypt hash — and attempts are capped.
 */
@Service
public class CheckinOtpService {

    private static final Logger logger = LoggerFactory.getLogger(CheckinOtpService.class);

    private static final int OTP_TTL_MINUTES = 15;
    private static final int MAX_ATTEMPTS = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    @Autowired
    private CounsellingCheckinOtpRepository otpRepository;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellingNotificationService notificationService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * Generates (or regenerates) the check-in OTP for an appointment and sends
     * it to the student. Returns the appointment so the caller can echo status.
     */
    @Transactional
    public CounsellingAppointment generateAndSend(Long appointmentId) {
        CounsellingAppointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("CounsellingAppointment", "id", appointmentId));

        if ("CANCELLED".equals(appt.getStatus()) || "RESCHEDULED".equals(appt.getStatus())
                || "COMPLETED".equals(appt.getStatus())) {
            throw new BadRequestException("Cannot start a session that is " + appt.getStatus() + ".");
        }
        if (appt.getCheckinVerifiedAt() != null) {
            throw new BadRequestException("This session has already been checked in.");
        }

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));

        CounsellingCheckinOtp otp = otpRepository.findByAppointmentId(appointmentId)
                .orElseGet(CounsellingCheckinOtp::new);
        otp.setAppointmentId(appointmentId);
        otp.setCodeHash(passwordEncoder.encode(code));
        otp.setExpiresAt(LocalDateTime.now().plusMinutes(OTP_TTL_MINUTES));
        otp.setAttempts(0);
        otp.setVerifiedAt(null);
        otpRepository.save(otp);

        notificationService.sendCheckinOtpToStudent(appt, code);
        logger.info("Check-in OTP issued for appointment {}", appointmentId);
        return appt;
    }

    /**
     * Verifies the code the counsellor entered. On success the appointment is
     * marked IN_PROGRESS with attendance recorded.
     */
    @Transactional
    public CounsellingAppointment verify(Long appointmentId, String code) {
        if (code == null || code.trim().isEmpty()) {
            throw new BadRequestException("Enter the code shared with the student.");
        }
        CounsellingAppointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("CounsellingAppointment", "id", appointmentId));

        CounsellingCheckinOtp otp = otpRepository.findByAppointmentId(appointmentId)
                .orElseThrow(() -> new BadRequestException("No check-in code has been generated yet. Start the session first."));

        if (otp.getVerifiedAt() != null) {
            throw new BadRequestException("This session has already been checked in.");
        }
        if (LocalDateTime.now().isAfter(otp.getExpiresAt())) {
            throw new BadRequestException("The code has expired. Please resend a new code.");
        }
        if (otp.getAttempts() >= MAX_ATTEMPTS) {
            throw new BadRequestException("Too many incorrect attempts. Please resend a new code.");
        }

        if (!passwordEncoder.matches(code.trim(), otp.getCodeHash())) {
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
        logger.info("Check-in verified for appointment {} — session started", appointmentId);
        return saved;
    }
}
