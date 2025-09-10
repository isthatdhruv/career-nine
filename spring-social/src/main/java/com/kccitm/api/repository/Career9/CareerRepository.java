package com.kccitm.api.repository.Career9;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.Career;

@Repository
public interface CareerRepository extends JpaRepository<Career, Long> {

   

    
}