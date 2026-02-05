package com.kccitm.api.repository.Career9.School;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.school.SchoolSections;

@Repository
public interface SchoolSectionsRepository extends JpaRepository<SchoolSections, Integer> {

    // Find all sections for a specific class
    List<SchoolSections> findBySchoolClasses_Id(Integer classId);
}