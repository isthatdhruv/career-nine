package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.InstituteCourseGoogleGroup;

@Repository
public interface InstituteCourseGoogleGroupRepository extends JpaRepository<InstituteCourseGoogleGroup, Integer>{
    public List<InstituteCourseGoogleGroup> findByName(String Name);
}
