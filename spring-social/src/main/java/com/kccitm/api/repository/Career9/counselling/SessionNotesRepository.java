package com.kccitm.api.repository.Career9.counselling;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.SessionNotes;

@Repository
public interface SessionNotesRepository extends JpaRepository<SessionNotes, Long> {

    Optional<SessionNotes> findByAppointmentId(Long appointmentId);
}
