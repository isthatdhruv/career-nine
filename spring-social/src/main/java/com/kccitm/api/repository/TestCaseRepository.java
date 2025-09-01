package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.TestCase;

@Repository
public interface TestCaseRepository extends JpaRepository<TestCase, Integer> {

    public List<TestCase> findAll();

    // public List<TestCase> findByCodingQuestionId(int codingQuestionId);

    // public List<TestCase> findByInput(String input);

    // public List<TestCase> findByOutput(String output);

    // public List<TestCase> findByLocked(Boolean locked);

    public TestCase getOne(int id);

    public Optional<TestCase> findById(int id);
    // public Role findByID(int id);
}