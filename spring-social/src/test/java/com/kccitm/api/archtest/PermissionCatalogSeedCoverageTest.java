package com.kccitm.api.archtest;

import com.kccitm.api.security.PermissionCode;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Phase 0 (Task 0.4) — build-time enum&harr;seed parity guard.
 *
 * <p>{@link com.kccitm.api.security.PermissionCodeValidator} already fails <em>boot</em> if a
 * controller {@code @auth.allows('code')} literal is not a member of {@link PermissionCode}. It
 * does NOT verify the reverse: that every {@link PermissionCode} is actually <em>seeded</em> into
 * the {@code permission} table by a Flyway migration. A code that lives in the enum but was never
 * seeded is invisible at runtime — no role can be granted it, so once {@code auth.enforce-mode}
 * flips to {@code enforce} (Phase 6) every endpoint gated on that code 403s for non-super-admins.
 *
 * <p>This test parses the Flyway migration SQL and asserts every enum code appears in a
 * {@code INSERT INTO permission} statement. It is a build-time invariant: it needs no database and
 * no Spring context, so it runs in the same fast {@code mvn test} pass as
 * {@link ControllerPreAuthorizeCoverageTest}.
 *
 * <p><b>Not covered here (needs live data — deferred to the Phase 6 soak):</b> whether each seeded
 * code is actually <em>granted</em> to a role group used by legitimate users. See the documented
 * diagnostic query in {@code src/test/java/com/kccitm/api/archtest/README.md}.
 */
public class PermissionCatalogSeedCoverageTest {

    /** Directory holding the Flyway migrations, relative to the module root (mvn working dir). */
    private static final Path MIGRATIONS_DIR = Paths.get("src/main/resources/db/migration");

    /**
     * Captures the first column of a {@code VALUES ('code', 'description')} tuple inside a
     * {@code INSERT INTO permission} statement. Permission codes are lowercase
     * {@code resource.verb[.qualifier]} strings (letters, digits, dots, underscores). The
     * {@code (} + quote + ... + quote + {@code ,} shape avoids matching {@code code = '...'}
     * predicates in the data-driven grant statements.
     */
    private static final Pattern SEED_TUPLE = Pattern.compile("\\(\\s*'([a-z0-9_.]+)'\\s*,");

    @Test
    public void everyPermissionCodeIsSeededByAMigration() {
        assertTrue(Files.isDirectory(MIGRATIONS_DIR),
                "Flyway migration directory not found at " + MIGRATIONS_DIR.toAbsolutePath()
                        + " — run this test from the spring-social module root.");

        Set<String> seeded = collectSeededCodes();
        assertTrue(!seeded.isEmpty(),
                "Parsed 0 seeded permission codes — the SEED_TUPLE pattern or migration layout changed.");

        List<String> missing = new ArrayList<>();
        for (PermissionCode pc : PermissionCode.values()) {
            if (!seeded.contains(pc.code())) {
                missing.add(pc.name() + " (\"" + pc.code() + "\")");
            }
        }

        if (!missing.isEmpty()) {
            Collections.sort(missing);
            StringBuilder sb = new StringBuilder();
            sb.append("PermissionCode enum values missing from any 'INSERT INTO permission' seed migration (")
              .append(missing.size()).append("):\n");
            for (String m : missing) {
                sb.append("  - ").append(m).append('\n');
            }
            sb.append("\nAdd the missing code(s) to a forward-only Flyway seed migration under ")
              .append(MIGRATIONS_DIR)
              .append(" (idempotent, ON DUPLICATE KEY UPDATE) so the permission exists in the DB ")
              .append("and can be granted before auth.enforce-mode flips to enforce.");
            fail(sb.toString());
        }
    }

    /** Union of every permission code seeded across all {@code INSERT INTO permission} migrations. */
    private Set<String> collectSeededCodes() {
        Set<String> codes = new LinkedHashSet<>();
        try (Stream<Path> files = Files.walk(MIGRATIONS_DIR)) {
            files.filter(p -> p.toString().endsWith(".sql"))
                 .forEach(p -> {
                     String sql = read(p);
                     // Only scan files that seed the `permission` table. The trailing space
                     // distinguishes "INSERT INTO permission " from "INSERT INTO role_permission".
                     if (!sql.contains("INSERT INTO permission ") && !sql.contains("INSERT INTO permission(")) {
                         return;
                     }
                     Matcher mat = SEED_TUPLE.matcher(sql);
                     while (mat.find()) {
                         codes.add(mat.group(1));
                     }
                 });
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return codes;
    }

    private String read(Path p) {
        try {
            return new String(Files.readAllBytes(p), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
