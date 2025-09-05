package com.kccitm.api.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.Difficulty;

@Repository
public interface DifficultyRepository extends JpaRepository<Difficulty, Integer> {

    // public List<CreateQuestion> findAll();

    // public List<CreateQuestion> findByQuestions(String Question);

    // public CreateQuestion getOne(int id);

    // public Optional<CreateQuestion> findById(int id);
    public Optional<Difficulty> findByName(String Name);
}