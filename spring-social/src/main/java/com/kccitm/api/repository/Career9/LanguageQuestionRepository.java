package com.kccitm.api.repository.Career9;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.LanguageQuestion;
// import com.kccitm.api.model.career9.LanguagesSupported;


@Repository
public interface LanguageQuestionRepository extends JpaRepository<LanguageQuestion, Long>{

    // LanguageQuestion save(LanguageQuestion languageQuestion);
    
}
