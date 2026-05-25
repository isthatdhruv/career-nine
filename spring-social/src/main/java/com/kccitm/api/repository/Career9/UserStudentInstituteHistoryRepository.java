package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.UserStudentInstituteHistory;

@Repository
public interface UserStudentInstituteHistoryRepository
        extends JpaRepository<UserStudentInstituteHistory, Long> {

    Optional<UserStudentInstituteHistory> findByUserStudentIdAndInstituteCode(
            Long userStudentId, Integer instituteCode);

    List<UserStudentInstituteHistory> findByUserStudentIdOrderByAddedAtDesc(Long userStudentId);

    List<UserStudentInstituteHistory> findByInstituteCodeAndIsDroppedFalse(Integer instituteCode);

    List<UserStudentInstituteHistory> findByInstituteCode(Integer instituteCode);
}
