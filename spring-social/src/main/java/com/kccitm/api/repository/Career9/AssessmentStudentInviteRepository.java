package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.AssessmentStudentInvite;

@Repository
public interface AssessmentStudentInviteRepository extends JpaRepository<AssessmentStudentInvite, Long> {

    Optional<AssessmentStudentInvite> findByToken(String token);

    List<AssessmentStudentInvite> findByInstituteCodeOrderByCreatedAtDesc(Integer instituteCode);

    List<AssessmentStudentInvite> findByUserStudentIdAndAssessmentId(Long userStudentId, Long assessmentId);
}
