package com.kccitm.api.config;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * ONE-SHOT MIGRATION — DELETE THIS FILE AFTER A SUCCESSFUL RUN.
 *
 * <p>Promotes {@code role_group.id} from {@code INT} to {@code BIGINT} so the
 * FK from {@code role_role_group_mapping.role_group_id} (already {@code BIGINT})
 * can finally be created by Hibernate. Schema {@code ddl-auto=update} does not
 * migrate column types, hence this runner.
 *
 * <p>Workflow:
 * <ol>
 *   <li>Boot the app once — this runner executes (idempotent, safe to re-run).</li>
 *   <li>Confirm the log line {@code "RoleGroupIdTypeMigration complete"}.</li>
 *   <li>Delete this file AND remove the {@code @ForeignKey(NO_CONSTRAINT)}
 *       suppression on {@code RoleRoleGroupMapping.roleGroupRef} so Hibernate
 *       emits the proper FK on the next boot.</li>
 * </ol>
 *
 * <p>Idempotency: the first action is a {@code DATA_TYPE} probe via
 * {@code INFORMATION_SCHEMA.COLUMNS}. If {@code role_group.id} is already
 * {@code BIGINT}, the runner short-circuits and does nothing.
 *
 * <p>{@link Order} is {@code HIGHEST_PRECEDENCE - 1} so this runs strictly
 * before {@link SuperAdminBootstrapper}, which writes to the {@code user} table
 * — we want all schema mutations to settle before any bean touches data.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE - 1)
public class RoleGroupIdTypeMigration implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(RoleGroupIdTypeMigration.class);

    private final JdbcTemplate jdbc;

    public RoleGroupIdTypeMigration(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        String currentType;
        try {
            currentType = jdbc.queryForObject(
                    "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS " +
                            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'role_group' AND COLUMN_NAME = 'id'",
                    String.class);
        } catch (Exception e) {
            log.warn("RoleGroupIdTypeMigration skipped — could not probe role_group.id type: {}", e.getMessage());
            return;
        }

        if (currentType == null) {
            log.warn("RoleGroupIdTypeMigration skipped — role_group.id not found (fresh DB?). Hibernate will create it as BIGINT directly.");
            return;
        }

        if ("bigint".equalsIgnoreCase(currentType)) {
            log.info("RoleGroupIdTypeMigration skipped — role_group.id is already BIGINT (no-op).");
            return;
        }

        log.info("RoleGroupIdTypeMigration starting — role_group.id is currently {} → promoting to BIGINT", currentType);

        // 1. Find every FK in the current schema that references role_group.id and drop it.
        //    Names are auto-generated (FK<hash>), so we must look them up at runtime.
        List<Map<String, Object>> dependentFks = jdbc.queryForList(
                "SELECT TABLE_NAME, CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE " +
                        "WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'role_group' " +
                        "AND REFERENCED_COLUMN_NAME = 'id'");
        for (Map<String, Object> row : dependentFks) {
            String tableName = (String) row.get("TABLE_NAME");
            String constraintName = (String) row.get("CONSTRAINT_NAME");
            String dropSql = "ALTER TABLE `" + tableName + "` DROP FOREIGN KEY `" + constraintName + "`";
            log.info("  dropping FK: {}", dropSql);
            jdbc.execute(dropSql);
        }

        // 2. Widen the PK column on role_group itself.
        jdbc.execute("ALTER TABLE role_group MODIFY id BIGINT NOT NULL AUTO_INCREMENT");
        log.info("  widened role_group.id → BIGINT");

        // 3. Widen the referencing column on user_role_group_mapping. (The column on
        //    role_role_group_mapping.role_group_id is already BIGINT, so it's untouched.)
        jdbc.execute("ALTER TABLE user_role_group_mapping MODIFY role_group_id BIGINT");
        log.info("  widened user_role_group_mapping.role_group_id → BIGINT");

        // 4. Hibernate will re-create the FKs on next bean initialization with the now-
        //    compatible bigint↔bigint shape. No manual recreate here — letting JPA own it
        //    avoids name collisions and keeps the schema in sync with the entity graph.

        log.info("RoleGroupIdTypeMigration complete — restart with this file DELETED " +
                "and the @ForeignKey(NO_CONSTRAINT) suppression removed from RoleRoleGroupMapping.roleGroupRef.");
    }
}
