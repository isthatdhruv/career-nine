package com.kccitm.api.service.b2c;

import java.util.Date;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.controller.career9.BetReportDataController;
import com.kccitm.api.controller.career9.NavigatorReportDataController;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.GeneratedReport;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.b2c.ReportGenerationLog;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.GeneratedReportRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;

/**
 * Single dispatcher for post-completion report preparation. Called by both
 * the public prepare endpoint (student-facing, after they finish the
 * assessment) and the admin retry endpoint (Tracker UI). Resolves the report
 * type from {@link AssessmentTable#getReportType()}, looks up the student's
 * class from {@link StudentInfo#getStudentClass()}, and delegates to the
 * existing BET / Navigator generator chains — which already upload to DO
 * Spaces and write to {@code GeneratedReport} / per-type tables. On failure
 * it flips the unified row to {@code report_status="failed"} and writes a
 * detailed {@link ReportGenerationLog} row.
 */
@Service
public class ReportPreparationService {

    @Autowired private StudentEntitlementRepository entitlementRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private GeneratedReportRepository generatedReportRepository;
    @Autowired private ReportGenerationLogService reportGenerationLogService;
    @Autowired private BetReportDataController betReportDataController;
    @Autowired private NavigatorReportDataController navigatorReportDataController;

    public static class PreparationResult {
        public final String reportType;
        public final String reportUrl;
        public final Integer studentClassUsed;
        public final boolean success;
        public final Long logId;

        private PreparationResult(String reportType, String reportUrl,
                                  Integer studentClassUsed, boolean success, Long logId) {
            this.reportType = reportType;
            this.reportUrl = reportUrl;
            this.studentClassUsed = studentClassUsed;
            this.success = success;
            this.logId = logId;
        }
    }

    public PreparationResult prepare(Long entitlementId, Long assessmentId, String attemptType) {
        StudentEntitlement entitlement = entitlementRepository.findById(entitlementId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Entitlement " + entitlementId + " not found"));

        Long userStudentId = entitlement.getUserStudentId();
        Integer studentClass = lookupStudentClass(userStudentId);
        String reportType = resolveReportType(assessmentId);

        try {
            String reportUrl = "navigator".equals(reportType)
                    ? navigatorReportDataController.prepareAndUploadForEntitlement(userStudentId, assessmentId)
                    : betReportDataController.prepareAndUploadForEntitlement(userStudentId, assessmentId);

            entitlement.setReportPreparedAt(new Date());
            entitlementRepository.save(entitlement);

            return new PreparationResult(reportType, reportUrl, studentClass, true, null);
        } catch (RuntimeException ex) {
            markGeneratedReportFailed(userStudentId, assessmentId, reportType);
            ReportGenerationLog log = reportGenerationLogService.log(
                    entitlementId, assessmentId, reportType, studentClass, attemptType, ex);
            throw new ReportPreparationException(reportType, studentClass, log.getId(), ex);
        }
    }

    /**
     * Used by callers (e.g. {@code BetReportDataController.publicFinalReportPdf})
     * that catch their own exceptions but still want a consistent audit row.
     */
    public ReportGenerationLog recordFailure(Long entitlementId, Long assessmentId,
                                             String attemptType, Throwable err) {
        Long userStudentId = entitlementRepository.findById(entitlementId)
                .map(StudentEntitlement::getUserStudentId).orElse(null);
        Integer studentClass = lookupStudentClass(userStudentId);
        String reportType = resolveReportType(assessmentId);
        return reportGenerationLogService.log(
                entitlementId, assessmentId, reportType, studentClass, attemptType, err);
    }

    private String resolveReportType(Long assessmentId) {
        if (assessmentId == null) return "bet";
        return assessmentTableRepository.findById(assessmentId)
                .map(AssessmentTable::getReportType)
                .filter(s -> s != null && !s.trim().isEmpty())
                .map(String::toLowerCase)
                .orElse("bet");
    }

    private Integer lookupStudentClass(Long userStudentId) {
        if (userStudentId == null) return null;
        return userStudentRepository.findById(userStudentId)
                .map(UserStudent::getStudentInfo)
                .map(StudentInfo::getStudentClass)
                .orElse(null);
    }

    /**
     * Upserts the unified {@code GeneratedReport} row to {@code "failed"} so
     * the admin tracker reflects the outcome even when the per-type tables
     * (BetReportData / NavigatorReportData) were never written.
     */
    private void markGeneratedReportFailed(Long userStudentId, Long assessmentId, String reportType) {
        if (userStudentId == null || assessmentId == null || reportType == null) return;

        Optional<GeneratedReport> opt = generatedReportRepository
                .findByUserStudentUserStudentIdAndAssessmentIdAndTypeOfReport(
                        userStudentId, assessmentId, reportType);

        GeneratedReport row = opt.orElseGet(() -> {
            GeneratedReport gr = new GeneratedReport();
            UserStudent us = new UserStudent();
            us.setUserStudentId(userStudentId);
            gr.setUserStudent(us);
            gr.setAssessmentId(assessmentId);
            gr.setTypeOfReport(reportType);
            gr.setCreatedAt(new Date());
            return gr;
        });
        row.setReportStatus("failed");
        row.setReportUrl(null);
        row.setUpdatedAt(new Date());
        generatedReportRepository.save(row);
    }

    /**
     * Wraps the underlying generator exception with the metadata the
     * controller layer needs to build its 500 response — without forcing
     * controllers to inspect ReportGenerationLog rows directly.
     */
    public static class ReportPreparationException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        public final String reportType;
        public final Integer studentClassUsed;
        public final Long logId;

        public ReportPreparationException(String reportType, Integer studentClassUsed,
                                          Long logId, Throwable cause) {
            super(cause);
            this.reportType = reportType;
            this.studentClassUsed = studentClassUsed;
            this.logId = logId;
        }
    }
}
