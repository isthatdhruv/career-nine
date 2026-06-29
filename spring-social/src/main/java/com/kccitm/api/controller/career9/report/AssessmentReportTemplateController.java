package com.kccitm.api.controller.career9.report;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.ReportTemplate;
import com.kccitm.api.model.career9.report.AssessmentReportTemplate;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.ReportTemplateRepository;
import com.kccitm.api.repository.Career9.report.AssessmentReportTemplateRepository;

/**
 * Manages the many-to-many mapping between assessments and report templates,
 * including the single default per assessment used by report generation when
 * no explicit template id is supplied. Backs the Reports Hub picker and the
 * mapping admin UIs.
 *
 * <p>Default rules: the first template mapped to an assessment is auto-flagged
 * default; unmapping the default promotes the first remaining mapping; the
 * default can be moved explicitly via {@code PUT .../default-template}.
 */
@RestController
public class AssessmentReportTemplateController {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentReportTemplateController.class);

    @Autowired private AssessmentReportTemplateRepository mappingRepository;
    @Autowired private ReportTemplateRepository reportTemplateRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;

    /**
     * Templates mapped to an assessment, with the default flagged. Returns an
     * empty list for an unknown assessment.
     */
    @GetMapping("/assessment/{assessmentId}/report-templates")
    @PreAuthorize("@auth.allows('report_template.read')")
    public ResponseEntity<List<TemplateMappingDto>> listForAssessment(@PathVariable Long assessmentId) {
        List<TemplateMappingDto> rows = mappingRepository.findByAssessmentId(assessmentId).stream()
                .map(TemplateMappingDto::from).collect(Collectors.toList());
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/assessment/{assessmentId}/templates")
    @PreAuthorize("@auth.allows('report_template.map')")
    public ResponseEntity<?> map(@PathVariable Long assessmentId, @RequestBody TemplateMapRequest req) {
        if (req == null || req.getReportTemplateId() == null) {
            return ResponseEntity.badRequest().body("reportTemplateId is required");
        }
        if (!assessmentTableRepository.existsById(assessmentId)) {
            return ResponseEntity.badRequest().body("Unknown assessmentId: " + assessmentId);
        }
        Optional<ReportTemplate> tplOpt = reportTemplateRepository.findById(req.getReportTemplateId());
        if (!tplOpt.isPresent()) {
            return ResponseEntity.badRequest().body("Unknown reportTemplateId: " + req.getReportTemplateId());
        }
        if (mappingRepository.findByAssessmentIdAndReportTemplate_Id(
                assessmentId, req.getReportTemplateId()).isPresent()) {
            return ResponseEntity.status(409).body("Template already mapped to this assessment");
        }

        boolean first = !mappingRepository.existsByAssessmentId(assessmentId);
        AssessmentReportTemplate m = new AssessmentReportTemplate();
        m.setAssessmentId(assessmentId);
        m.setReportTemplate(tplOpt.get());
        m.setIsDefault(first); // first template mapped becomes the default
        m = mappingRepository.save(m);
        return ResponseEntity.ok(TemplateMappingDto.from(m));
    }

    @DeleteMapping("/assessment/{assessmentId}/templates/{templateId}")
    @PreAuthorize("@auth.allows('report_template.map')")
    public ResponseEntity<?> unmap(@PathVariable Long assessmentId, @PathVariable Long templateId) {
        Optional<AssessmentReportTemplate> opt = mappingRepository
                .findByAssessmentIdAndReportTemplate_Id(assessmentId, templateId);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();

        AssessmentReportTemplate removed = opt.get();
        boolean wasDefault = Boolean.TRUE.equals(removed.getIsDefault());
        mappingRepository.delete(removed);

        // Promote a new default if we just removed it.
        if (wasDefault) {
            List<AssessmentReportTemplate> remaining = mappingRepository.findByAssessmentId(assessmentId);
            if (!remaining.isEmpty()) {
                AssessmentReportTemplate promote = remaining.get(0);
                promote.setIsDefault(true);
                mappingRepository.save(promote);
                logger.info("Promoted template {} to default for assessment {}",
                        promote.getReportTemplate().getReportTemplateId(), assessmentId);
            }
        }
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/assessment/{assessmentId}/default-template")
    @PreAuthorize("@auth.allows('report_template.map')")
    public ResponseEntity<?> setDefault(@PathVariable Long assessmentId, @RequestBody TemplateMapRequest req) {
        if (req == null || req.getReportTemplateId() == null) {
            return ResponseEntity.badRequest().body("reportTemplateId is required");
        }
        Optional<AssessmentReportTemplate> target = mappingRepository
                .findByAssessmentIdAndReportTemplate_Id(assessmentId, req.getReportTemplateId());
        if (!target.isPresent()) {
            return ResponseEntity.badRequest().body("Template is not mapped to this assessment");
        }
        // Clear the current default, set the new one.
        for (AssessmentReportTemplate m : mappingRepository.findByAssessmentId(assessmentId)) {
            boolean shouldBeDefault = m.getId().equals(target.get().getId());
            if (Boolean.TRUE.equals(m.getIsDefault()) != shouldBeDefault) {
                m.setIsDefault(shouldBeDefault);
                mappingRepository.save(m);
            }
        }
        return ResponseEntity.ok(TemplateMappingDto.from(target.get()));
    }
}
