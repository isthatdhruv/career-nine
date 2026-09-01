package com.kccitm.api.service.counselling;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.security.TokenProvider;
import com.kccitm.api.service.b2c.LinkBuilder;

/**
 * Public, token-gated self-service booking for students who completed an
 * assessment but never booked their counselling session. An admin emails the
 * student a tokenized link (from the Manage Students page); the link opens a
 * no-login page that renders the exact ThankYouPage counselling component
 * (MappingCounsellingSection), so slot listing, PAY_LATER payment, booking and
 * the confirmation email all ride the existing public counselling pipeline.
 * This service only turns the token into the student/assessment ids that
 * component runs on.
 */
@Service
public class CounsellingBookingLinkService {

    private static final Logger logger = LoggerFactory.getLogger(CounsellingBookingLinkService.class);

    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private CounsellingAppointmentRepository appointmentRepository;
    @Autowired private TokenProvider tokenProvider;
    @Autowired private LinkBuilder linkBuilder;
    @Autowired private CounsellingNotificationService notificationService;
    @Autowired private com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository entitlementRepository;
    @Autowired private com.kccitm.api.repository.StudentAssessmentMappingRepository mappingRepository;
    /** Optional: availability check for the report-mail CTA; absent where counselling isn't wired. */
    @Autowired(required = false) private BookingService bookingService;

    /**
     * Emails the student their personal booking link.
     *
     * @return the address the link went to, for the admin's confirmation message
     */
    @Transactional
    public String sendBookingInvite(Long userStudentId) {
        UserStudent student = userStudentRepository.findByIdWithStudentInfo(userStudentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student", "id", userStudentId));

        String recipient = infoEmail(student);
        if (recipient == null || recipient.isBlank()) {
            throw new BadRequestException(
                    "No email address on file for this student, so the booking link cannot be sent.");
        }
        if (!appointmentRepository.findActiveByStudent(userStudentId).isEmpty()) {
            throw new BadRequestException(
                    "This student already has an active counselling session — nothing to book.");
        }

        String url = linkBuilder.counsellingBooking(tokenProvider.createCounsellingBookingToken(userStudentId));
        notificationService.sendBookingInviteEmail(infoName(student), recipient, url);

        logger.info("Admin sent counselling booking link for student {} to {}", userStudentId, recipient);
        return recipient;
    }

    /**
     * Context for the public booking page. The page renders the SAME counselling component the
     * thank-you page uses (MappingCounsellingSection), which drives everything — options, slot
     * picker, PAY_LATER payment, booked state — off {@code userStudentId} + {@code assessmentId}
     * against the existing public counselling endpoints. This context turns the emailed token into
     * those two ids (plus a greeting), nothing more.
     */
    @Transactional
    public Map<String, Object> getContext(String token) {
        UserStudent student = resolve(token);
        boolean actionable = appointmentRepository.findActiveByStudent(student.getUserStudentId()).isEmpty();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("actionable", actionable);
        out.put("studentName", displayName(student));
        out.put("userStudentId", student.getUserStudentId());
        Long assessmentId = resolveAssessmentId(student.getUserStudentId());
        if (assessmentId != null) out.put("assessmentId", assessmentId);
        return out;
    }

    /**
     * Report-mail CTA hook: the tokenized booking-page URL, or null when the mail
     * should not offer booking — the student already has an active appointment, or
     * counselling is neither in their tier (active/pending entitlement with sessions
     * remaining) nor offered by configuration (a counsellor assigned to the
     * assessment). Unlike {@link #sendBookingInvite} this never throws: report
     * delivery must not fail over a CTA. The booking page re-checks the appointment
     * on every open, so a link that goes stale after a thank-you-page booking just
     * shows the already-booked screen.
     */
    @Transactional(readOnly = true)
    public String bookingUrlIfEligible(Long userStudentId, Long assessmentId, Long entitlementId) {
        try {
            if (userStudentId == null) return null;
            if (!appointmentRepository.findActiveByStudent(userStudentId).isEmpty()) return null;
            if (!counsellingAvailable(userStudentId, assessmentId, entitlementId)) return null;
            return linkBuilder.counsellingBooking(tokenProvider.createCounsellingBookingToken(userStudentId));
        } catch (Exception ex) {
            logger.warn("Counselling CTA suppressed for student {}: {}", userStudentId, ex.getMessage());
            return null;
        }
    }

    private boolean counsellingAvailable(Long userStudentId, Long assessmentId, Long entitlementId) {
        java.util.List<com.kccitm.api.model.career9.b2c.StudentEntitlement> candidates;
        if (entitlementId != null) {
            candidates = entitlementRepository.findById(entitlementId)
                    .map(java.util.Collections::singletonList)
                    .orElse(java.util.Collections.emptyList());
        } else {
            candidates = entitlementRepository.findByUserStudentIdOrderByCreatedAtDesc(userStudentId);
        }
        for (com.kccitm.api.model.career9.b2c.StudentEntitlement e : candidates) {
            if (!"active".equals(e.getStatus()) && !"pending".equals(e.getStatus())) continue;
            if (assessmentId != null && e.getAssessmentId() != null
                    && !assessmentId.equals(e.getAssessmentId())) continue;
            int total = e.getCounsellingSessionsTotal() == null ? 0 : e.getCounsellingSessionsTotal();
            int used = e.getCounsellingSessionsUsed() == null ? 0 : e.getCounsellingSessionsUsed();
            if (Boolean.TRUE.equals(e.getCounsellingActive()) && total - used > 0) return true;
        }
        // Offered-counselling rule (mirrors the public booking endpoint): a counsellor
        // assigned to the assessment makes booking available regardless of the tier.
        return bookingService != null && assessmentId != null
                && bookingService.hasCounsellorForAssessment(assessmentId);
    }

    // ---- helpers ------------------------------------------------------------

    private UserStudent resolve(String token) {
        Long userStudentId = tokenProvider.getCounsellingBookingStudentId(token);
        if (userStudentId == null) {
            throw new BadRequestException("This booking link is invalid or has expired.");
        }
        return userStudentRepository.findByIdWithStudentInfo(userStudentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student", "id", userStudentId));
    }

    /**
     * The assessment whose counselling config applies — the student's latest entitlement first
     * (mirrors BookingService), latest completed assessment mapping as fallback.
     */
    private Long resolveAssessmentId(Long userStudentId) {
        try {
            Long fromEntitlement = entitlementRepository.findByUserStudentIdOrderByCreatedAtDesc(userStudentId)
                    .stream()
                    .filter(e -> e.getAssessmentId() != null)
                    .map(com.kccitm.api.model.career9.b2c.StudentEntitlement::getAssessmentId)
                    .findFirst().orElse(null);
            if (fromEntitlement != null) return fromEntitlement;
        } catch (Exception e) {
            logger.debug("Could not resolve assessment from entitlements for student {}: {}",
                    userStudentId, e.getMessage());
        }
        try {
            return mappingRepository.findByUserStudentUserStudentId(userStudentId).stream()
                    .filter(m -> "completed".equalsIgnoreCase(m.getStatus()) && m.getAssessmentId() != null)
                    .map(com.kccitm.api.model.career9.StudentAssessmentMapping::getAssessmentId)
                    .reduce((first, second) -> second) // latest
                    .orElse(null);
        } catch (Exception e) {
            logger.debug("Could not resolve assessment from mappings for student {}: {}",
                    userStudentId, e.getMessage());
            return null;
        }
    }

    private String displayName(UserStudent student) {
        String n = infoName(student);
        return n != null && !n.isBlank() ? n : "there";
    }

    private static String infoName(UserStudent s) {
        StudentInfo i = s != null ? s.getStudentInfo() : null;
        return i != null ? i.getName() : null;
    }

    private static String infoEmail(UserStudent s) {
        StudentInfo i = s != null ? s.getStudentInfo() : null;
        return i != null ? i.getEmail() : null;
    }
}
