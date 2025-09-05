package com.kccitm.api.repository.Career9;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.Tool;

@Repository
public interface ToolRepository extends JpaRepository<Tool, Long> {

    
    // JpaRepository already provides findAll(), findById(), save(), deleteById(), etc.
}
