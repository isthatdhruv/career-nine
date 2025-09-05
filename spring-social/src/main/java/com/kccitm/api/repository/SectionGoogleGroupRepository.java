package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.SectionGoogleGroup;

@Repository
public interface SectionGoogleGroupRepository extends JpaRepository<SectionGoogleGroup, Integer>{
    public List<SectionGoogleGroup> findByName(String Name);
}
