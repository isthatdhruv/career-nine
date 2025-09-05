package com.kccitm.api.repository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.CodingProblemDifficulty;

@Repository
public interface CodingProblemDifficultyRepository  extends JpaRepository<CodingProblemDifficulty, Integer> {
     
    public List<CodingProblemDifficulty> findAll();

    public List<CodingProblemDifficulty> findBydifficultyLevel(String difficultyLevel);

    public CodingProblemDifficulty getOne(int id);

    public Optional<CodingProblemDifficulty> findById(int id);
}
