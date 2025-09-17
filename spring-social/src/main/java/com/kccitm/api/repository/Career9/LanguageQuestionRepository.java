package com.kccitm.api.repository.Career9;

import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.LanguagesSupported;
import org.springframework.data.jpa.repository.JpaRepository;


@Repository
public interface LanguageQuestionRepository extends JpaRepository<LanguagesSupported, Long>{
    
}
