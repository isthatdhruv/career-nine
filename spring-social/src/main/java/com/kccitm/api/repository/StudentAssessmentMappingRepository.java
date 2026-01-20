package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;

public interface StudentAssessmentMappingRepository extends JpaRepository<StudentAssessmentMapping, Long> {

    StudentAssessmentMapping getByUserStudent(UserStudent userStudentId);
    
    List<StudentAssessmentMapping> findByUserStudentUserStudentId(Long userStudentId);

}
