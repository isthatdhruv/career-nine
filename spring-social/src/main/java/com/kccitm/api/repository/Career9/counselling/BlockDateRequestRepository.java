package com.kccitm.api.repository.Career9.counselling;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.BlockDateRequest;

@Repository
public interface BlockDateRequestRepository extends JpaRepository<BlockDateRequest, Long> {

    List<BlockDateRequest> findByCounsellorId(Long counsellorId);

    List<BlockDateRequest> findByCounsellorIdAndStatus(Long counsellorId, String status);

    List<BlockDateRequest> findByStatus(String status);

    /**
     * Counsellors who must not receive a re-placement on this date.
     *
     * <p>Callers pass both {@code APPROVED} and {@code PENDING}. Approved leave is obvious;
     * pending matters too, because handing a session to someone whose leave is about to be
     * granted risks moving the same student twice.
     */
    @Query("SELECT DISTINCT b.counsellor.id FROM BlockDateRequest b "
         + "WHERE b.blockDate = :date AND b.status IN :statuses")
    List<Long> findCounsellorIdsBlockedOn(
            @Param("date") LocalDate date, @Param("statuses") List<String> statuses);
}
