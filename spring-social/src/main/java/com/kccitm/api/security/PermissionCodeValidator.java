package com.kccitm.api.security;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.ApplicationContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.RestController;

/**
 * Startup-time linter that walks every {@link RestController} bean, parses each
 * method's {@link PreAuthorize} SpEL string for {@code @auth.allows('...')}
 * literals, and fails boot if any permission-code literal is not a member of
 * the {@link PermissionCode} enum (Phase 14's catalog).
 *
 * <p>Catches the common typo class (e.g., {@code "student.reed"} instead of
 * {@code "student.read"}) at startup rather than 500-ing the first call that
 * hits the bad annotation. Plans 15-03 / 15-04 / 15-05 will sprinkle ~100+
 * {@code @PreAuthorize} annotations across controllers; this validator gives
 * them a fast feedback loop.
 *
 * <p>Defensive design: if {@link PermissionCode} is not on the classpath (e.g.,
 * during a partial-merge scenario) or its accessor methods don't match what we
 * expect (Phase 14's enum exposes {@code code()} — verified 2026-05-12), the
 * validator logs a WARN and short-circuits without failing boot. The catalog
 * must be present in production builds; the soft-fail exists only to support
 * standalone builds of this plan before Phase 14 lands in a branch.
 */
@Component
public class PermissionCodeValidator implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(PermissionCodeValidator.class);

    /**
     * Matches the quoted literal in {@code @auth.allows('code', ...)} or
     * {@code @auth.allows('code')}. We deliberately only validate quoted literal
     * codes — dynamic expressions (e.g., {@code @auth.allows(#permVar)}) can't be
     * checked at startup and are out of scope here.
     */
    private static final Pattern ALLOWS_LITERAL = Pattern.compile("@auth\\.allows\\(\\s*'([^']+)'");

    @Autowired
    private ApplicationContext ctx;

    @Override
    public void run(ApplicationArguments args) {
        Set<String> knownCodes;
        try {
            knownCodes = loadKnownCodes();
        } catch (NoClassDefFoundError | NoSuchMethodError e) {
            log.warn("PermissionCode enum not on classpath / accessor missing — skipping @PreAuthorize validation", e);
            return;
        }

        if (knownCodes.isEmpty()) {
            log.warn("PermissionCode enum loaded but produced 0 known codes — skipping @PreAuthorize validation");
            return;
        }

        List<String> errors = new ArrayList<>();
        for (Object bean : ctx.getBeansWithAnnotation(RestController.class).values()) {
            Class<?> cls = AopUtils.getTargetClass(bean);
            for (Method m : cls.getDeclaredMethods()) {
                PreAuthorize pa = m.getAnnotation(PreAuthorize.class);
                if (pa == null) continue;
                Matcher mat = ALLOWS_LITERAL.matcher(pa.value());
                while (mat.find()) {
                    String code = mat.group(1);
                    if (!knownCodes.contains(code)) {
                        errors.add(cls.getName() + "#" + m.getName()
                                + " references unknown permission code '" + code + "'");
                    }
                }
            }
        }

        if (!errors.isEmpty()) {
            String msg = "PermissionCodeValidator: " + errors.size()
                    + " unknown permission code(s) referenced in @PreAuthorize:\n  - "
                    + String.join("\n  - ", errors);
            log.error(msg);
            throw new IllegalStateException(msg);
        }
        log.info("PermissionCodeValidator: scanned {} @RestController beans — all @PreAuthorize permission codes are members of PermissionCode enum.",
                ctx.getBeansWithAnnotation(RestController.class).size());
    }

    /**
     * Pull canonical code strings from {@link PermissionCode}. Phase 14's enum
     * exposes the canonical string via {@code code()} (verified 2026-05-12 in
     * {@code spring-social/src/main/java/com/kccitm/api/security/PermissionCode.java}).
     *
     * <p>Catches both {@code NoSuchMethodError} (enum present but accessor renamed)
     * and {@code NoClassDefFoundError} (enum absent) so a partial-merge / pre-Phase-14
     * build can still boot.
     */
    private Set<String> loadKnownCodes() {
        Set<String> codes = new HashSet<>();
        for (PermissionCode pc : PermissionCode.values()) {
            codes.add(pc.code());
        }
        return codes;
    }
}
