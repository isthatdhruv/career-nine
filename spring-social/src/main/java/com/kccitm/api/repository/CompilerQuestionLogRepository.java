package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.CompilerQuestionLog;

@Repository
public interface CompilerQuestionLogRepository extends JpaRepository<CompilerQuestionLog, Integer> {

    public List<CompilerQuestionLog> findAll();

    public List<CompilerQuestionLog> findByExpectedOutput(String expectedOutput);

    public CompilerQuestionLog getOne(int id);

    public Optional<CompilerQuestionLog> findById(int id);    

    // public Role findByID(int id);
}