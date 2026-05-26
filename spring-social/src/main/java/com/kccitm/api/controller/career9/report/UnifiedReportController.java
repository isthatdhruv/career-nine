package com.kccitm.api.controller.career9.report;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

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
            ReportResult r = reportService.generate(req.getUserStudentId(), req.getAssessmentId(), force);
            return ResponseEntity.ok(UnifiedReportResponse.ok(
                    r.typeCode, r.subtypeCode, r.reportUrl,
                    r.calculatedAt, r.renderedAt, r.alreadyExisted));
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
}
