package com.kccitm.api.repository.Career9.counselling;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.StudentCounsellorMapping;

@Repository
public interface StudentCounsellorMappingRepository extends JpaRepository<StudentCounsellorMapping, Long> {

    List<StudentCounsellorMapping> findByCounsellorIdAndIsActiveTrue(Long counsellorId);

    List<StudentCounsellorMapping> findByStudentUserStudentIdAndIsActiveTrue(Long userStudentId);

    Optional<StudentCounsellorMapping> findByCounsellorIdAndStudentUserStudentId(Long counsellorId, Long userStudentId);

    List<StudentCounsellorMapping> findByIsActiveTrue();

    List<StudentCounsellorMapping> findByAssignedById(Long userId);
}
