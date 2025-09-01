package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.CodingPlatformProblem;

@Repository
public interface CodingPlatformProblemRepository extends JpaRepository<CodingPlatformProblem, Integer> {
    
    public List<CodingPlatformProblem> findAll();
    public Optional<CodingPlatformProblem> findById(int problemId);
}
