package com.kccitm.api.service.b2c;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.b2c.ReportGenerationLog;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.repository.Career9.b2c.ReportGenerationLogRepository;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;

/**
 * Writes ReportGenerationLog rows for failed report generation attempts.
 * Called from ReportPreparationService (prepare + retry paths) and from
 * BetReportDataController/NavigatorReportDataController's tokenised download
 * paths so the admin tracker sees every failure regardless of entry point.
 */
@Service
public class ReportGenerationLogService {

    private static final int STACK_EXCERPT_MAX_CHARS = 4000;
    private static final int ERROR_MESSAGE_MAX_CHARS = 1000;
    private static final int ERROR_CLASS_MAX_CHARS = 200;

    @Autowired
    private ReportGenerationLogRepository repository;

    @Autowired
    private StudentEntitlementRepository entitlementRepository;

    public ReportGenerationLog log(Long entitlementId,
                                   Long assessmentId,
                                   String reportType,
                                   Integer studentClassAtAttempt,
                                   String attemptType,
                                   Throwable err) {
        ReportGenerationLog row = new ReportGenerationLog();
        row.setEntitlementId(entitlementId);
        row.setAssessmentId(assessmentId);
        row.setReportType(reportType);
        row.setStudentClassAtAttempt(studentClassAtAttempt);
        row.setAttemptType(attemptType);
        row.setStatus("failed");

        if (entitlementId != null) {
            Optional<StudentEntitlement> eOpt = entitlementRepository.findById(entitlementId);
            eOpt.ifPresent(e -> {
                row.setUserStudentId(e.getUserStudentId());
                row.setCampaignId(e.getCampaignId());
            });
        }

        if (err != null) {
            row.setErrorClass(truncate(err.getClass().getName(), ERROR_CLASS_MAX_CHARS));
            row.setErrorMessage(truncate(err.getMessage(), ERROR_MESSAGE_MAX_CHARS));
            row.setStackTraceExcerpt(stackTraceExcerpt(err));
        }
        return repository.save(row);
    }

    private static String stackTraceExcerpt(Throwable err) {
        StringWriter sw = new StringWriter();
        err.printStackTrace(new PrintWriter(sw));
        String full = sw.toString();
        return full.length() > STACK_EXCERPT_MAX_CHARS
                ? full.substring(0, STACK_EXCERPT_MAX_CHARS)
                : full;
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
