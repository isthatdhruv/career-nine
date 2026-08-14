package com.kccitm.api.service.dashboard.principal;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.PrincipalDashboardReleaseLog;
import com.kccitm.api.repository.career9.*;

/**
 * Records what a release did, step by step.
 *
 * <p><b>Every write is {@code REQUIRES_NEW}.</b> The whole point of this log is to explain
 * failures, and a scope that fails rolls its own transaction back — joining that
 * transaction would delete the record of the failure along with the failure. Each entry
 * commits on its own so the trace survives whatever happens to the work it describes.
 *
 * <p>For the same reason nothing here throws. A logger that can break a release is worse
 * than no logger, so a failed write is reported to the application log and swallowed.
 */
@Service
public class PrincipalDashboardReleaseLogger {

    private static final Logger log = LoggerFactory.getLogger(PrincipalDashboardReleaseLogger.class);

    @Autowired
    private PrincipalDashboardReleaseLogRepository repository;

    /**
     * Self-reference so the {@code REQUIRES_NEW} above actually applies.
     *
     * Spring applies transactions with a proxy; a plain {@code this.record(...)} from
     * another method in this class would bypass it and quietly join the caller's
     * transaction — exactly the failure mode this class exists to avoid.
     */
    @Autowired
    private PrincipalDashboardReleaseLogger self;

    /** A step that belongs to one cohort. */
    public void scope(String releaseId, Long instituteCode, Long assessmentId,
            String scopeKey, String scopeLabel, String step, String outcome,
            String message, Long durationMs) {
        self.write(PrincipalDashboardReleaseLog.of(releaseId, instituteCode, assessmentId,
                scopeKey, scopeLabel, step, outcome, message, durationMs));
    }

    /** A step that belongs to the run rather than to any one cohort. */
    public void run(String releaseId, Long instituteCode, Long assessmentId,
            String step, String outcome, String message) {
        self.write(PrincipalDashboardReleaseLog.of(releaseId, instituteCode, assessmentId,
                null, null, step, outcome, message, null));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(PrincipalDashboardReleaseLog entry) {
        try {
            repository.save(entry);
        } catch (Exception e) {
            // Deliberately swallowed: losing a log line is a nuisance, losing the release
            // it was describing is not.
            log.warn("Could not write release log entry {}/{}: {}",
                    entry.getReleaseId(), entry.getStep(), e.toString());
        }
    }

    @Transactional(readOnly = true)
    public List<PrincipalDashboardReleaseLog> forRelease(String releaseId) {
        return repository.findByReleaseIdOrderByIdAsc(releaseId);
    }

    @Transactional(readOnly = true)
    public List<PrincipalDashboardReleaseLog> forInstitute(Long instituteCode, int limit) {
        return repository.findByInstituteCodeOrderByIdDesc(
                instituteCode, PageRequest.of(0, Math.max(1, Math.min(limit, 1000))));
    }

    @Transactional(readOnly = true)
    public List<Object[]> runsFor(Long instituteCode, int limit) {
        return repository.findReleaseRuns(
                instituteCode, PageRequest.of(0, Math.max(1, Math.min(limit, 100))));
    }

    /**
     * The reason an exception carries, unwrapped.
     *
     * Spring and the HTTP client both wrap causes several layers deep, and the useful
     * sentence ("OpenAI returned 429") is usually at the bottom. Showing the outermost
     * message alone tends to produce "could not execute statement".
     */
    public static String describe(Throwable error) {
        if (error == null) {
            return "Unknown error";
        }
        StringBuilder sb = new StringBuilder();
        Throwable current = error;
        int depth = 0;
        while (current != null && depth < 5) {
            String message = current.getMessage();
            if (message != null && !message.isBlank()) {
                if (sb.length() > 0) {
                    sb.append(" ← ");
                }
                sb.append(current.getClass().getSimpleName()).append(": ").append(message);
            }
            current = current.getCause() == current ? null : current.getCause();
            depth++;
        }
        return sb.length() > 0 ? sb.toString() : error.getClass().getName();
    }
}
