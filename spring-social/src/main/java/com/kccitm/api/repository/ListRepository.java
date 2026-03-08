package com.kccitm.api.repository;
import org.springframework.data.jpa.repository.JpaRepository;
import com.kccitm.api.model.List;

public interface ListRepository extends JpaRepository<List, Integer> {
    
}