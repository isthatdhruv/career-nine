package com.kccitm.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.School;

@Repository
public interface SchoolRepository extends JpaRepository<School, Long>{  
    
}