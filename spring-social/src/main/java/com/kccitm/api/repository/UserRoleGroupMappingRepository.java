package com.kccitm.api.repository;

import java.util.List;

import javax.transaction.Transactional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.UserRoleGroupMapping;

@Repository
public interface UserRoleGroupMappingRepository extends JpaRepository<UserRoleGroupMapping, Integer> {

    public List<UserRoleGroupMapping> findAll();

    public List<UserRoleGroupMapping> findByDisplay(Boolean display);

    public List<UserRoleGroupMapping> findByUser(Long id);

    public UserRoleGroupMapping getOne(int id);
    
    @Transactional
    public Integer deleteAllByUser(Long id);

    @Transactional
    public Integer deleteByUser(long id);
}
