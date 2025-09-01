package com.kccitm.api.repository;

import java.util.List;

import javax.transaction.Transactional;

import org.springframework.data.jpa.repository.JpaRepository;
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

}