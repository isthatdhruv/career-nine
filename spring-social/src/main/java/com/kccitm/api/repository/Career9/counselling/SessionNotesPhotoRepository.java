package com.kccitm.api.repository.Career9.counselling;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.SessionNotesPhoto;

@Repository
public interface SessionNotesPhotoRepository extends JpaRepository<SessionNotesPhoto, Long> {

    List<SessionNotesPhoto> findByAppointmentIdOrderByCreatedAtAscIdAsc(Long appointmentId);

    List<SessionNotesPhoto> findByAppointmentIdInOrderByCreatedAtAscIdAsc(Collection<Long> appointmentIds);

    long countByAppointmentId(Long appointmentId);
}
