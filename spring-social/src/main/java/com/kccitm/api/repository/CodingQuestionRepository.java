package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.CodingQuestion;

@Repository
public interface CodingQuestionRepository extends JpaRepository<CodingQuestion, Integer> {

    public List<CodingQuestion> findAll();

    // public List<CodingQuestion> findByCodingQuestion(String CodingQuestion);

    // public CodingQuestion getOne(int id);

    public Optional<CodingQuestion> findById(int id);

    public Optional<CodingQuestion> findByQuestionUrl(String url);
    // public Role findByID(int id);
}