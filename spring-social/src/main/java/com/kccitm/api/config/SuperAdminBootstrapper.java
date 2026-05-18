package com.kccitm.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.AuthProvider;
import com.kccitm.api.model.User;
import com.kccitm.api.repository.UserRepository;

/**
 * Seeds / promotes a super-admin on every application boot. Required because
 * Career-9 has no first-user-wins flow and {@code @PreAuthorize} on the role-
 * management endpoints means a cold database has no path to bootstrap an admin.
 *
 * <p>Reads {@code app.bootstrap.superAdminEmail / Password / Name} (see
 * {@link AppProperties.Bootstrap}). On every startup:
 * <ol>
 *   <li>If the configured email resolves to an existing local-provider user,
 *       ensures {@code is_super_admin = true} and {@code is_active = true}.
 *       The password is NEVER overwritten on an existing user — once the human
 *       has changed it via a normal flow, restarts do not clobber it.</li>
 *   <li>If no such user exists, creates one with the configured password
 *       BCrypt-hashed via the same {@link PasswordEncoder} bean used by login.</li>
 * </ol>
 *
 * <p>The runner is a no-op if {@code superAdminEmail} is blank or null — set
 * it to empty in production once a real admin has been provisioned and you
 * want subsequent restarts to leave user rows alone.
 *
 * <p>{@code @Order(Ordered.HIGHEST_PRECEDENCE)} so this runs BEFORE other
 * {@code ApplicationRunner}s that may depend on a super-admin existing.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SuperAdminBootstrapper implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminBootstrapper.class);

    private final AppProperties appProperties;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public SuperAdminBootstrapper(AppProperties appProperties,
                                  UserRepository userRepository,
                                  PasswordEncoder passwordEncoder) {
        this.appProperties = appProperties;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        AppProperties.Bootstrap cfg = appProperties.getBootstrap();
        String email = cfg.getSuperAdminEmail();

        if (email == null || email.trim().isEmpty()) {
            log.info("Super-admin bootstrap skipped — app.bootstrap.superAdminEmail is blank");
            return;
        }
        email = email.trim();

        User existing = userRepository.findByEmailAndProvider(email, AuthProvider.local);
        if (existing != null) {
            boolean changed = false;
            if (!Boolean.TRUE.equals(existing.getIsSuperAdmin())) {
                existing.setIsSuperAdmin(true);
                changed = true;
            }
            if (!Boolean.TRUE.equals(existing.getIsActive())) {
                existing.setIsActive(true);
                changed = true;
            }
            if (changed) {
                userRepository.save(existing);
                log.info("Super-admin bootstrap promoted existing user {} (id={})", email, existing.getId());
            } else {
                log.info("Super-admin bootstrap verified {} is already super-admin and active", email);
            }
            return;
        }

        String rawPassword = cfg.getSuperAdminPassword();
        if (rawPassword == null || rawPassword.isEmpty()) {
            log.warn("Super-admin bootstrap cannot create {} — app.bootstrap.superAdminPassword is blank",
                    email);
            return;
        }

        User u = new User();
        u.setEmail(email);
        u.setName(cfg.getSuperAdminName() != null ? cfg.getSuperAdminName() : "Super Admin");
        u.setPassword(passwordEncoder.encode(rawPassword));
        u.setProvider(AuthProvider.local);
        u.setIsActive(true);
        u.setEmailVerified(true);
        u.setIsSuperAdmin(true);
        u.setDisplay(true);
        userRepository.save(u);

        log.info("Super-admin bootstrap created new user {} — CHANGE THE DEFAULT PASSWORD VIA THE UI", email);
    }
}
