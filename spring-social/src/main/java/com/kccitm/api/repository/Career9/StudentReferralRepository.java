package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.StudentReferral;

@Repository
public interface StudentReferralRepository extends JpaRepository<StudentReferral, Long> {
    List<StudentReferral> findByReferralCodeId(Long referralCodeId);

    boolean existsByUserStudentId(Long userStudentId);
}
