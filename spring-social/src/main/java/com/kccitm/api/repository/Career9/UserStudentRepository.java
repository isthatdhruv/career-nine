package com.kccitm.api.repository.Career9;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.career9.UserStudent;

public interface UserStudentRepository extends JpaRepository<UserStudent, Long> {
    Optional<UserStudent> getByUserId(Long userId);
}
