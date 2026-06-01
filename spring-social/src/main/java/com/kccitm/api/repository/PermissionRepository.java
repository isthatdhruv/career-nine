package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Permission;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, Long> {
    Optional<Permission> findByCode(String code);

    /** Codes currently assigned to a role, ordered by code for stable UI rendering. */
    @Query(value =
        "SELECT p.code FROM permission p " +
        "JOIN role_permission rp ON rp.permission_id = p.id " +
        "WHERE rp.role_id = :roleId " +
        "ORDER BY p.code",
        nativeQuery = true)
    List<String> findCodesByRoleId(@Param("roleId") int roleId);

    /** Wipe a role's permission grants — used before re-inserting the new set in PUT. */
    @Modifying
    @Query(value = "DELETE FROM role_permission WHERE role_id = :roleId", nativeQuery = true)
    void deleteAllByRoleId(@Param("roleId") int roleId);

    /**
     * Idempotent INSERT into the role_permission join. {@code INSERT IGNORE} silently
     * drops duplicate (role_id, permission_id) collisions so callers don't have to
     * deduplicate the incoming code list. Permission codes that don't resolve to a
     * permission row are skipped because the subquery returns no row.
     */
    @Modifying
    @Query(value =
        "INSERT IGNORE INTO role_permission (role_id, permission_id) " +
        "SELECT :roleId, p.id FROM permission p WHERE p.code = :code",
        nativeQuery = true)
    void insertRolePermissionByCode(@Param("roleId") int roleId, @Param("code") String code);

    /**
     * Walk user → role-group → role → permission and return the distinct set of
     * permission codes the user holds. Native query because there is no JPA
     * relationship declared between {@code Role} and {@code Permission}; the
     * join table {@code role_permission} is accessed by raw SQL only.
     *
     * <p>Filters {@code urgm.display = TRUE} (matches the canonical filter used
     * by {@code UserRoleGroupMappingRepository.findByDisplay(true)}); leaves
     * {@code role_role_group_mapping.display} and {@code role.display}
     * permissive (NULL or TRUE) so legacy rows where the flag was never set
     * still grant their permissions.
     */
    @Query(value =
        "SELECT DISTINCT p.code " +
        "FROM permission p " +
        "JOIN role_permission rp ON rp.permission_id = p.id " +
        "JOIN role r ON r.id = rp.role_id " +
        "JOIN role_role_group_mapping rrgm ON rrgm.role_id = r.id " +
        "JOIN user_role_group_mapping urgm ON urgm.role_group_id = rrgm.role_group_id " +
        "WHERE urgm.user_id = :userId " +
        "  AND urgm.display = TRUE " +
        "  AND (rrgm.display IS NULL OR rrgm.display = TRUE) " +
        "  AND (r.display IS NULL OR r.display = TRUE)",
        nativeQuery = true)
    List<String> findCodesForUser(@Param("userId") Long userId);
}
