package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.InstituteSessionGoogleGroup;

@Repository
public interface InstituteSessionGoogleGroupRepository extends JpaRepository<InstituteSessionGoogleGroup, Integer>{
    public List<InstituteSessionGoogleGroup> findByName(String Name);
}
