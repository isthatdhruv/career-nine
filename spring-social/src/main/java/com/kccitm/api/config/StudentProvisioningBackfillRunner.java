package com.kccitm.api.config;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.service.StudentProvisioningService;

/**
 * One-time backfill of student authorization for students that pre-date the
 * provisioning surgery (R5). On boot, finds every {@link UserStudent} whose user
 * holds no mapping to the {@code student} role group and provisions it (role-group
 * mapping + institute scope) via {@link StudentProvisioningService}.
 *
 * <p>Self-limiting: the query returns empty once every student is provisioned, so
 * subsequent restarts are a near-zero-cost no-op. Provisioning is idempotent, so a
 * partial run is safe to resume. Runs AFTER {@link SuperAdminBootstrapper}.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class StudentProvisioningBackfillRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(StudentProvisioningBackfillRunner.class);

    private final UserStudentRepository userStudentRepository;
    private final StudentProvisioningService studentProvisioningService;

    public StudentProvisioningBackfillRunner(UserStudentRepository userStudentRepository,
                                             StudentProvisioningService studentProvisioningService) {
        this.userStudentRepository = userStudentRepository;
        this.studentProvisioningService = studentProvisioningService;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<UserStudent> pending;
        try {
            pending = userStudentRepository.findMissingRoleGroup(StudentProvisioningService.STUDENT_ROLE_GROUP);
        } catch (Exception e) {
            log.warn("Student provisioning backfill skipped — lookup failed (migration not applied yet?)", e);
            return;
        }
        if (pending == null || pending.isEmpty()) {
            log.info("Student provisioning backfill: nothing to do (all students provisioned)");
            return;
        }
        int ok = 0;
        int failed = 0;
        for (UserStudent us : pending) {
            try {
                studentProvisioningService.provision(us);
                ok++;
            } catch (Exception e) {
                failed++;
                log.warn("Student provisioning backfill failed for userStudentId={} (userId={})",
                        us.getUserStudentId(), us.getUserId(), e);
            }
        }
        log.info("Student provisioning backfill complete: provisioned={} failed={} (of {} pending)",
                ok, failed, pending.size());
    }
}
