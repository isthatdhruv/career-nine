package com.kccitm.api.repository.Career9;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.LanguageOption;

@Repository
public interface LanguageOptionRepository extends JpaRepository<LanguageOption, Long>{
    
}