package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.Tool;

@Repository
public interface ToolRepository extends JpaRepository<Tool, Long> {
    // Repository methods for Tool entity
    public List<Tool> findAll();

    public Tool getOne(Long id);

}
