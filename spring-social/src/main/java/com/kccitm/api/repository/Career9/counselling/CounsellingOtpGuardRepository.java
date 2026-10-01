package com.kccitm.api.repository.Career9.counselling;

import java.time.LocalDateTime;
import java.util.Optional;

import javax.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.CounsellingOtpGuard;

@Repository
public interface CounsellingOtpGuardRepository extends JpaRepository<CounsellingOtpGuard, Long> {

    /**
     * Creates the student's row if it is missing, so {@link #lockByStudentId} always has a row
     * to lock. Two counsellors checking the same student at once would otherwise both see "no
     * row", both insert, and one would fail on the primary key.
     *
     * <p>{@code ON DUPLICATE KEY UPDATE} rather than {@code INSERT IGNORE} on purpose: on an
     * existing row IGNORE takes a <i>shared</i> lock, and two transactions each holding one and
     * then asking for the exclusive lock below deadlock. The no-op update takes the exclusive
     * lock straight away, so the second caller simply waits.
     */
    @Modifying
    @Query(value = "INSERT INTO counselling_otp_guard (student_id, failed_attempts, total_failures, updated_at) "
            + "VALUES (:studentId, 0, 0, :now) ON DUPLICATE KEY UPDATE student_id = student_id",
            nativeQuery = true)
    int ensureRow(@Param("studentId") Long studentId, @Param("now") LocalDateTime now);

    /** The row, locked until the calling transaction ends. Serialises concurrent checks. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT g FROM CounsellingOtpGuard g WHERE g.studentId = :studentId")
    Optional<CounsellingOtpGuard> lockByStudentId(@Param("studentId") Long studentId);
}
