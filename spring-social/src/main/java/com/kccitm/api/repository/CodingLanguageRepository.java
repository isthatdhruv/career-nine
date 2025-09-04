package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.CodingLanguage;




@Repository
public interface CodingLanguageRepository extends JpaRepository<CodingLanguage, Integer> {

    public List<CodingLanguage> findAll();

    // public List<CodingLanguage> findByCodingQuestionId(int codingQuestionId);

    // public List<CodingLanguage> findByLanguageId(int languageId);

    // public List<CodingLanguage> findByLanguageName(String languageName);

    public List<CodingLanguage> findByCode(String  code);

    public CodingLanguage getOne(int id);

    public Optional<CodingLanguage> findById(int id);
    // public Role findByID(int id);
}
