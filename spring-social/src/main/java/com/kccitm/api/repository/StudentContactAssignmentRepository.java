package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.StudentContactAssignment;

@Repository
public interface StudentContactAssignmentRepository extends JpaRepository<StudentContactAssignment, Long> {

    List<StudentContactAssignment> findByContactPersonId(Long contactPersonId);

    List<StudentContactAssignment> findByUserStudentId(Long userStudentId);

    void deleteByUserStudentIdInAndContactPersonId(List<Long> userStudentIds, Long contactPersonId);

    void deleteByUserStudentId(Long userStudentId);
}
