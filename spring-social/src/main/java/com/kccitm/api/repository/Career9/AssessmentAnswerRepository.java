package com.kccitm.api.repository.Career9;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;

@Repository
public interface AssessmentAnswerRepository extends JpaRepository<AssessmentAnswer, Long> {

    public java.util.List<AssessmentAnswer> findByUserStudent(com.kccitm.api.model.career9.UserStudent userStudent);
}
