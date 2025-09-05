package com.kccitm.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.CreateQuestion;

@Repository
public interface CreateQuestionRepository extends JpaRepository<CreateQuestion, Integer> {

    // public List<CreateQuestion> findAll();

    // public List<CreateQuestion> findByQuestions(String Question);

    // public CreateQuestion getOne(int id);

    // public Optional<CreateQuestion> findById(int id);
    // public Role findByID(int id);
}