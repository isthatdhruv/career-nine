package com.kccitm.api.service.b2c.report.pipeline;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.branding.InstituteBrandingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * Produces {@code report.generate} events when a WHITELABEL student completes an
 * assessment. Called (non-fatally) from both completion paths — the live async
 * processor and the bulk/admin {@code markCompletedIfFullyAnswered}.
 *
 * <p>Returns {@code true} only when it actually enqueued (student is whitelabel
 * AND has an email), so the bulk path can fall back to the legacy unbounded
 * auto-gen for everyone else.
 */
@Component
public class ReportPipelineProducer {

    private static final Logger logger = LoggerFactory.getLogger(ReportPipelineProducer.class);

    @Autowired private KafkaTemplate<String, String> kafkaTemplate;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private InstituteBrandingService brandingService;

    @Value("${report.pipeline.enabled:true}")
    private boolean enabled;

    /**
     * Enqueue a report-generation job iff the student's institute is whitelabel
     * and the student has an email address.
     *
     * @return true if a job was enqueued; false otherwise (caller may fall back
     *         to the legacy auto-gen).
     */
    public boolean enqueueIfWhitelabel(UserStudent userStudent, Long assessmentId) {
        if (!enabled || userStudent == null || assessmentId == null) {
            return false;
        }
        InstituteDetail institute = userStudent.getInstitute();
        BrandingDto brand = brandingService.forInstitute(institute);
        if (!brand.isWhitelabel()) {
            return false;
        }
        StudentInfo info = userStudent.getStudentInfo();
        String email = info != null ? info.getEmail() : null;
        if (email == null || email.trim().isEmpty()) {
            logger.warn("Report pipeline: whitelabel student {} has no email; falling back to legacy gen (assessment {})",
                    userStudent.getUserStudentId(), assessmentId);
            return false;
        }
        ReportGenerateEvent ev = new ReportGenerateEvent(
                userStudent.getUserStudentId(), assessmentId, email.trim(),
                true, brand.getSchoolName(), brand.getLogoUrl());
        try {
            kafkaTemplate.send(ReportPipelineConfig.TOPIC_GENERATE, ev.key(),
                    objectMapper.writeValueAsString(ev));
            logger.info("Report pipeline: enqueued report.generate student={} assessment={} school={}",
                    ev.userStudentId, ev.assessmentId, ev.schoolName);
        } catch (Exception e) {
            // Non-fatal: completion must never fail because of the pipeline.
            logger.error("Report pipeline: failed to enqueue report.generate student={} assessment={}: {}",
                    ev.userStudentId, ev.assessmentId, e.getMessage());
        }
        return true;
    }
}
