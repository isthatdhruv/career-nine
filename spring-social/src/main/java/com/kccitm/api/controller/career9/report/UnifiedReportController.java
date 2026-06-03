package com.kccitm.api.controller.career9.report;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.security.AuthorizationService;
import com.kccitm.api.service.b2c.report.ReportResult;
import com.kccitm.api.service.b2c.report.ReportRoutingException;
import com.kccitm.api.service.b2c.report.ReportService;
import com.kccitm.api.service.b2c.report.SanityFailedException;
import com.kccitm.api.service.b2c.report.ScoresNotReadyException;

/**
 * Unified report-generation entry. Replaces the per-type
 * {@code /bet-report-data/one-click-report},
 * {@code /navigator-report-data/one-click-report},
 * {@code /pager-report-data/one-click-report} during the deprecation window
 * (those stay as thin shims that forward here — see Phase 6).
 *
 * <p>ABAC: scoped by the student's institute via
 * {@code @auth.instituteOfStudent}, so a counsellor in institute A cannot
 * generate a report for a student in institute B even if they hold the
 * permission code.
 */
@RestController
public class UnifiedReportController {

    private static final Logger logger = LoggerFactory.getLogger(UnifiedReportController.class);

    @Autowired private ReportService reportService;
    @Autowired private AuthorizationService auth;
    @Autowired private com.kccitm.api.service.b2c.report.pdf.PdfRenderEnqueueService pdfRenderEnqueueService;
    @Autowired private com.kccitm.api.repository.Career9.GeneratedReportRepository generatedReportRepository;

    @PostMapping("/generate-report-unified")
    @PreAuthorize("@auth.allows('generated_report.create', @auth.instituteOfStudent(#req.userStudentId))")
    public ResponseEntity<UnifiedReportResponse> generate(@RequestBody UnifiedReportRequest req) {
        if (req == null || req.getUserStudentId() == null || req.getAssessmentId() == null) {
            return ResponseEntity.badRequest()
                    .body(UnifiedReportResponse.failed("BAD_REQUEST",
                            "userStudentId and assessmentId are required"));
        }

        boolean force = Boolean.TRUE.equals(req.getForce());
        try {
            ReportResult r = reportService.generate(
                    req.getUserStudentId(), req.getAssessmentId(), req.getReportTemplateId(), force);
            return ResponseEntity.ok(UnifiedReportResponse.ok(
                    r.typeCode, r.subtypeCode, r.reportUrl,
                    r.calculatedAt, r.renderedAt, r.alreadyExisted,
                    r.pdfUrl, r.pdfStatus));
        } catch (ScoresNotReadyException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(UnifiedReportResponse.transient_("SCORES_NOT_READY", ex.getMessage()));
        } catch (SanityFailedException ex) {
            HttpStatus s = "NOT_COMPLETED".equals(ex.getCode())
                    ? HttpStatus.SERVICE_UNAVAILABLE
                    : HttpStatus.UNPROCESSABLE_ENTITY;
            return ResponseEntity.status(s)
                    .body(UnifiedReportResponse.failed(ex.getCode(), ex.getMessage()));
        } catch (ReportRoutingException ex) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(UnifiedReportResponse.failed("ROUTING", ex.getMessage()));
        } catch (Exception ex) {
            logger.error("Unified report generation failed for student={} assessment={}",
                    req.getUserStudentId(), req.getAssessmentId(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(UnifiedReportResponse.failed("INTERNAL", ex.getMessage()));
        }
    }

    /**
     * Bulk generation of one template for many students (same type). Never fails
     * the whole batch — returns a per-student result so the UI can show progress
     * and per-row outcomes. Each student is ABAC-checked against the caller's
     * institute (a forbidden student is reported, not generated).
     */
    @PostMapping("/generate-report-unified/bulk")
    @PreAuthorize("@auth.allows('generated_report.create')")
    public ResponseEntity<Map<String, Object>> generateBulk(@RequestBody UnifiedBulkRequest req) {
        Map<String, Object> response = new HashMap<>();
        List<Map<String, Object>> results = new ArrayList<>();
        if (req == null || req.getAssessmentId() == null
                || req.getUserStudentIds() == null || req.getUserStudentIds().isEmpty()) {
            response.put("results", results);
            return ResponseEntity.badRequest().body(response);
        }

        boolean force = Boolean.TRUE.equals(req.getForce());
        for (Long sid : req.getUserStudentIds()) {
            Map<String, Object> row = new HashMap<>();
            row.put("userStudentId", sid);
            try {
                // Per-student ABAC: only the caller's institute.
                if (!auth.allows("generated_report.create", auth.instituteOfStudent(sid))) {
                    row.put("status", "forbidden");
                    row.put("message", "Not permitted for this student's institute");
                    results.add(row);
                    continue;
                }
                ReportResult r = reportService.generate(sid, req.getAssessmentId(), req.getReportTemplateId(), force);
                row.put("status", "ok");
                row.put("reportUrl", r.reportUrl);
                row.put("pdfUrl", r.pdfUrl);
                row.put("pdfStatus", r.pdfStatus);
                row.put("code", r.subtypeCode);
                row.put("typeCode", r.typeCode);
            } catch (ScoresNotReadyException ex) {
                row.put("status", "error"); row.put("code", "SCORES_NOT_READY"); row.put("message", ex.getMessage());
            } catch (SanityFailedException ex) {
                row.put("status", "error"); row.put("code", ex.getCode()); row.put("message", ex.getMessage());
            } catch (ReportRoutingException ex) {
                row.put("status", "error"); row.put("code", "ROUTING"); row.put("message", ex.getMessage());
            } catch (Exception ex) {
                logger.error("Bulk gen failed student={} assessment={}", sid, req.getAssessmentId(), ex);
                row.put("status", "error"); row.put("code", "INTERNAL"); row.put("message", ex.getMessage());
            }
            results.add(row);
        }
        response.put("results", results);
        return ResponseEntity.ok(response);
    }

    /**
     * Re-enqueue PDF rendering for a report whose async render previously failed
     * (or to force a re-render). Resets the report to pending and refreshes its
     * single render job; the poller picks it up on the next tick.
     */
    @PostMapping("/generate-report-unified/{generatedReportId}/retry-pdf")
    @PreAuthorize("@auth.allows('generated_report.create')")
    public ResponseEntity<Map<String, Object>> retryPdf(@PathVariable Long generatedReportId) {
        return generatedReportRepository.findById(generatedReportId).map(gr -> {
            if (gr.getReportUrl() == null) {
                return ResponseEntity.badRequest().body(Map.<String, Object>of(
                        "status", "error", "message", "Report has no HTML to render"));
            }
            gr.setPdfStatus("pending");
            generatedReportRepository.save(gr);
            pdfRenderEnqueueService.enqueue(gr.getGeneratedReportId(), gr.getReportUrl());
            return ResponseEntity.ok(Map.<String, Object>of("status", "ok", "pdfStatus", "pending"));
        }).orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.<String, Object>of(
                "status", "error", "message", "Report not found")));
    }
}
