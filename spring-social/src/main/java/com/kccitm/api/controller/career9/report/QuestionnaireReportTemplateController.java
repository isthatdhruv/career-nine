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

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.Questionaire.Questionnaire;
import com.kccitm.api.model.career9.ReportTemplate;
import com.kccitm.api.model.career9.report.QuestionnaireReportTemplate;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.ReportTemplateRepository;
import com.kccitm.api.repository.Career9.report.QuestionnaireReportTemplateRepository;

/**
 * Manages the many-to-many mapping between questionnaires and report templates,
 * including the single default per questionnaire used by report generation when
 * no explicit template id is supplied.
 *
 * <p>Default rules: the first template mapped to a questionnaire is auto-flagged
 * default; unmapping the default promotes the first remaining mapping; the
 * default can be moved explicitly via {@code PUT .../default-template}.
 */
@RestController
public class QuestionnaireReportTemplateController {

    private static final Logger logger = LoggerFactory.getLogger(QuestionnaireReportTemplateController.class);

    @Autowired private QuestionnaireReportTemplateRepository mappingRepository;
    @Autowired private ReportTemplateRepository reportTemplateRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;

    @GetMapping("/questionnaire/{qid}/templates")
    @PreAuthorize("@auth.allows('report_template.read')")
    public ResponseEntity<List<QuestionnaireTemplateMappingDto>> list(@PathVariable Long qid) {
        List<QuestionnaireTemplateMappingDto> rows = mappingRepository.findByQuestionnaireId(qid).stream()
                .map(QuestionnaireTemplateMappingDto::from).collect(Collectors.toList());
        return ResponseEntity.ok(rows);
    }

    /**
     * Templates available for an assessment = those mapped to its questionnaire.
     * Lets the Reports Hub show a picker (default preselected) without needing
     * the questionnaire id on the client.
     */
    @GetMapping("/assessment/{assessmentId}/report-templates")
    @PreAuthorize("@auth.allows('report_template.read')")
    public ResponseEntity<List<QuestionnaireTemplateMappingDto>> listForAssessment(@PathVariable Long assessmentId) {
        AssessmentTable assessment = assessmentTableRepository.findById(assessmentId).orElse(null);
        if (assessment == null || assessment.getQuestionnaire() == null) {
            return ResponseEntity.ok(java.util.Collections.emptyList());
        }
        Questionnaire q = assessment.getQuestionnaire();
        List<QuestionnaireTemplateMappingDto> rows = mappingRepository
                .findByQuestionnaireId(q.getQuestionnaireId()).stream()
                .map(QuestionnaireTemplateMappingDto::from).collect(Collectors.toList());
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/questionnaire/{qid}/templates")
    @PreAuthorize("@auth.allows('report_template.map')")
    public ResponseEntity<?> map(@PathVariable Long qid, @RequestBody QuestionnaireTemplateMapRequest req) {
        if (req == null || req.getReportTemplateId() == null) {
            return ResponseEntity.badRequest().body("reportTemplateId is required");
        }
        Optional<ReportTemplate> tplOpt = reportTemplateRepository.findById(req.getReportTemplateId());
        if (!tplOpt.isPresent()) {
            return ResponseEntity.badRequest().body("Unknown reportTemplateId: " + req.getReportTemplateId());
        }
        if (mappingRepository.findByQuestionnaireIdAndReportTemplate_Id(
                qid, req.getReportTemplateId()).isPresent()) {
            return ResponseEntity.status(409).body("Template already mapped to this questionnaire");
        }

        boolean first = !mappingRepository.existsByQuestionnaireId(qid);
        QuestionnaireReportTemplate m = new QuestionnaireReportTemplate();
        m.setQuestionnaireId(qid);
        m.setReportTemplate(tplOpt.get());
        m.setIsDefault(first); // first template mapped becomes the default
        m = mappingRepository.save(m);
        return ResponseEntity.ok(QuestionnaireTemplateMappingDto.from(m));
    }

    @DeleteMapping("/questionnaire/{qid}/templates/{templateId}")
    @PreAuthorize("@auth.allows('report_template.map')")
    public ResponseEntity<?> unmap(@PathVariable Long qid, @PathVariable Long templateId) {
        Optional<QuestionnaireReportTemplate> opt = mappingRepository
                .findByQuestionnaireIdAndReportTemplate_Id(qid, templateId);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();

        QuestionnaireReportTemplate removed = opt.get();
        boolean wasDefault = Boolean.TRUE.equals(removed.getIsDefault());
        mappingRepository.delete(removed);

        // Promote a new default if we just removed it.
        if (wasDefault) {
            List<QuestionnaireReportTemplate> remaining = mappingRepository.findByQuestionnaireId(qid);
            if (!remaining.isEmpty()) {
                QuestionnaireReportTemplate promote = remaining.get(0);
                promote.setIsDefault(true);
                mappingRepository.save(promote);
                logger.info("Promoted template {} to default for questionnaire {}",
                        promote.getReportTemplate().getReportTemplateId(), qid);
            }
        }
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/questionnaire/{qid}/default-template")
    @PreAuthorize("@auth.allows('report_template.map')")
    public ResponseEntity<?> setDefault(@PathVariable Long qid, @RequestBody QuestionnaireTemplateMapRequest req) {
        if (req == null || req.getReportTemplateId() == null) {
            return ResponseEntity.badRequest().body("reportTemplateId is required");
        }
        Optional<QuestionnaireReportTemplate> target = mappingRepository
                .findByQuestionnaireIdAndReportTemplate_Id(qid, req.getReportTemplateId());
        if (!target.isPresent()) {
            return ResponseEntity.badRequest().body("Template is not mapped to this questionnaire");
        }
        // Clear the current default, set the new one.
        for (QuestionnaireReportTemplate m : mappingRepository.findByQuestionnaireId(qid)) {
            boolean shouldBeDefault = m.getId().equals(target.get().getId());
            if (Boolean.TRUE.equals(m.getIsDefault()) != shouldBeDefault) {
                m.setIsDefault(shouldBeDefault);
                mappingRepository.save(m);
            }
        }
        return ResponseEntity.ok(QuestionnaireTemplateMappingDto.from(target.get()));
    }
}
