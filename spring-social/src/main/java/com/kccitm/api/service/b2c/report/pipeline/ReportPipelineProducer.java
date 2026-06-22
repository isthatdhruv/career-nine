package com.kccitm.api.service.b2c.report.pipeline;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.branding.InstituteBrandingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * Produces {@code report.generate} events when a student completes an assessment.
 * Called (non-fatally) from both completion paths — the live async processor and
 * the bulk/admin {@code markCompletedIfFullyAnswered}.
 *
 * <p>Reports are generated for ALL students (the worker renders + stores every
 * report); the {@code whitelabel} flag carried on the event decides whether the
 * email stage actually mails it — only whitelabel students are emailed.
 *
 * <p>Returns {@code true} when it enqueued (so the caller does NOT also run the
 * legacy auto-gen), and {@code false} only when the pipeline is disabled or the
 * arguments are unusable, letting the caller fall back to the legacy auto-gen.
 */
@Component
public class ReportPipelineProducer {

    private static final Logger logger = LoggerFactory.getLogger(ReportPipelineProducer.class);

    @Autowired private KafkaTemplate<String, String> kafkaTemplate;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private InstituteBrandingService brandingService;
    @Autowired private UserStudentRepository userStudentRepository;

    @Value("${report.pipeline.enabled:true}")
    private boolean enabled;

    /**
     * Enqueue a report-generation job for this student. Generation runs for ALL
     * students; the {@code whitelabel} flag on the event gates only the email
     * stage. A whitelabel student with no email address still has their report
     * generated — the worker simply skips the mail.
     *
     * @return true if a job was enqueued (caller must NOT run the legacy auto-gen);
     *         false only when the pipeline is disabled or the args are unusable
     *         (caller may fall back to the legacy auto-gen).
     */
    public boolean enqueue(UserStudent userStudentArg, Long assessmentId) {
        if (!enabled || userStudentArg == null || assessmentId == null) {
            return false;
        }
        // Re-fetch with studentInfo JOIN-FETCHed. Callers reach this from @Async /
        // background threads with no open Hibernate session, so the passed entity
        // may be detached with a lazy studentInfo proxy — accessing it would throw
        // LazyInitializationException and silently suppress the enqueue. Reading the
        // @Id off a proxy is safe (no DB hit); the re-fetch fully initializes the
        // graph (institute is EAGER). Fall back to the passed entity if not found.
        Long userStudentId = userStudentArg.getUserStudentId();
        UserStudent userStudent = userStudentId == null ? userStudentArg
                : userStudentRepository.findByIdWithStudentInfo(userStudentId).orElse(userStudentArg);
        InstituteDetail institute = userStudent.getInstitute();
        BrandingDto brand = brandingService.forInstitute(institute);
        boolean whitelabel = brand.isWhitelabel();
        StudentInfo info = userStudent.getStudentInfo();
        String email = info != null ? info.getEmail() : null;
        String recipient = (email != null && !email.trim().isEmpty()) ? email.trim() : null;
        if (whitelabel && recipient == null) {
            logger.warn("Report pipeline: whitelabel student {} has no email; report will be generated but not mailed (assessment {})",
                    userStudent.getUserStudentId(), assessmentId);
        }
        ReportGenerateEvent ev = new ReportGenerateEvent(
                userStudent.getUserStudentId(), assessmentId, recipient,
                whitelabel, brand.getSchoolName(), brand.getLogoUrl());
        try {
            kafkaTemplate.send(ReportPipelineConfig.TOPIC_GENERATE, ev.key(),
                    objectMapper.writeValueAsString(ev));
            logger.info("Report pipeline: enqueued report.generate student={} assessment={} whitelabel={} school={}",
                    ev.userStudentId, ev.assessmentId, ev.whitelabel, ev.schoolName);
        } catch (Exception e) {
            // Non-fatal: completion must never fail because of the pipeline.
            logger.error("Report pipeline: failed to enqueue report.generate student={} assessment={}: {}",
                    ev.userStudentId, ev.assessmentId, e.getMessage());
        }
        return true;
    }
}
