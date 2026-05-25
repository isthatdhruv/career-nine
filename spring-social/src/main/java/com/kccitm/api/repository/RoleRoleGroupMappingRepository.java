package com.kccitm.api.repository;

import java.util.List;

import javax.transaction.Transactional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.RoleRoleGroupMapping;

@Repository
public interface RoleRoleGroupMappingRepository extends JpaRepository<RoleRoleGroupMapping, Integer> {

    public List<RoleRoleGroupMapping> findAll();

    public List<RoleRoleGroupMapping> findByDisplay(Boolean display);

    public List<RoleRoleGroupMapping> findByRoleGroup(Long id);

    public RoleRoleGroupMapping getOne(int id);

    @Transactional
    public Integer deleteByRoleGroup(Long id);

    /**
     * Hard-deletes every mapping that references the given role id. Used by
     * {@code RoleController.deleteRole} to clear the FK from {@code role_role_group_mapping
     * → role} before the parent row is removed (the FK has no {@code ON DELETE CASCADE}).
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM RoleRoleGroupMapping rrgm WHERE rrgm.role.id = :roleId")
    void deleteAllByRoleId(@Param("roleId") int roleId);

}