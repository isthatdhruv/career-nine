package com.kccitm.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.repository.InstituteDetailRepository;

/**
 * One-time backfill that flips every {@code institute_detail_new} row whose
 * {@code assessment_cookie_auth_enabled} is NULL to TRUE, so that
 * {@code POST /auth/assessment-session} stops returning 404 for pre-existing
 * tenants. Rows with an explicit FALSE are preserved — admins can still opt
 * an institute out, and this runner will not stomp that choice.
 *
 * <p>Self-limiting: the count query returns 0 once every NULL is filled in, so
 * subsequent restarts short-circuit with a "nothing to do" log line.
 *
 * <p>Future inserts default to TRUE via the {@code @PrePersist} hook on
 * {@code InstituteDetail}; this runner only fixes legacy data.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class AssessmentCookieAuthBackfillRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AssessmentCookieAuthBackfillRunner.class);

    private final InstituteDetailRepository repo;

    public AssessmentCookieAuthBackfillRunner(InstituteDetailRepository repo) {
        this.repo = repo;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        long pending;
        try {
            pending = repo.countAssessmentCookieAuthMissing();
        } catch (Exception e) {
            log.warn("Assessment cookie auth backfill skipped — lookup failed "
                    + "(column missing? migration not applied yet?)", e);
            return;
        }
        if (pending == 0) {
            log.info("Assessment cookie auth backfill: nothing to do");
            return;
        }
        try {
            int updated = repo.enableAssessmentCookieAuthForAllNull();
            log.info("Assessment cookie auth backfill complete: updated={} (of {} pending)",
                    updated, pending);
        } catch (Exception e) {
            log.warn("Assessment cookie auth backfill failed mid-update — will retry on next boot", e);
        }
    }
}
