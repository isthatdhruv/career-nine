package com.kccitm.api.repository.Career9.counselling;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.CounsellingReminderSent;

@Repository
public interface CounsellingReminderSentRepository extends JpaRepository<CounsellingReminderSent, Long> {

    boolean existsByAppointmentIdAndAudienceAndOffsetCode(Long appointmentId, String audience, String offsetCode);
}
