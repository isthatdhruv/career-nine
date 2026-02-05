package com.kccitm.api.repository.Career9.School;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.school.SchoolClasses;

@Repository
public interface SchoolClassesRepository extends JpaRepository<SchoolClasses, Integer> {

    // Find all classes for a specific session
    List<SchoolClasses> findBySchoolSession_Id(Integer sessionId);
}