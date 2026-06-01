package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.RoleGroup;

@Repository
public interface RoleGroupRepository extends JpaRepository<RoleGroup, Long> {

    public List<RoleGroup> findAll();

    public List<RoleGroup> findByDisplay(Boolean display);

    public List<RoleGroup> findByName(String Name);
}