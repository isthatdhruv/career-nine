package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.RoleUrl;

@Repository
public interface RoleUrlRepository extends JpaRepository<RoleUrl, Long> {

    /** Paths whitelisted for a single role, ordered for stable UI rendering. */
    @Query("SELECT ru.path FROM RoleUrl ru WHERE ru.roleId = :roleId ORDER BY ru.path")
    List<String> findPathsByRoleId(@Param("roleId") int roleId);

    @Modifying
    @Query("DELETE FROM RoleUrl ru WHERE ru.roleId = :roleId")
    void deleteAllByRoleId(@Param("roleId") int roleId);

    /**
     * Walks user → role-group → role → role_url to return the distinct set of
     * paths whitelisted for a user across every role they hold via any of their
     * role groups. Same join shape that
     * {@link PermissionRepository#findCodesForUser(Long)} uses, so the two
     * predicates stay in lockstep.
     *
     * <p>Filters {@code urgm.display = TRUE} (the canonical "active mapping"
     * flag) and tolerates NULL on the deeper {@code display} columns the way
     * the permission query already does.
     */
    @Query(value =
        "SELECT DISTINCT ru.path " +
        "FROM role_url ru " +
        "JOIN role r ON r.id = ru.role_id " +
        "JOIN role_role_group_mapping rrgm ON rrgm.role_id = r.id " +
        "JOIN user_role_group_mapping urgm ON urgm.role_group_id = rrgm.role_group_id " +
        "WHERE urgm.user_id = :userId " +
        "  AND urgm.display = TRUE " +
        "  AND (rrgm.display IS NULL OR rrgm.display = TRUE) " +
        "  AND (r.display IS NULL OR r.display = TRUE)",
        nativeQuery = true)
    List<String> findPathsForUser(@Param("userId") Long userId);
}
