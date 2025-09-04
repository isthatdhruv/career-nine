
package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.UniversityMark;

@Repository
public interface UniversityMarkRepository extends JpaRepository<UniversityMark, Long> {

    public List<UniversityMark> findAll();
    // public List<UniversityMark> findByrollNoiUniversityMarks(List<Long> ids);  
}
