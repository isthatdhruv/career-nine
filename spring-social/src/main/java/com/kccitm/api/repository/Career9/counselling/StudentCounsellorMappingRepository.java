package com.kccitm.api.repository.Career9.counselling;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import javax.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.counselling.StudentCounsellorMapping;

@Repository
public interface StudentCounsellorMappingRepository extends JpaRepository<StudentCounsellorMapping, Long> {

    List<StudentCounsellorMapping> findByCounsellorIdAndIsActiveTrue(Long counsellorId);

    List<StudentCounsellorMapping> findByStudentUserStudentIdAndIsActiveTrue(Long userStudentId);

    Optional<StudentCounsellorMapping> findByCounsellorIdAndStudentUserStudentId(Long counsellorId, Long userStudentId);

    List<StudentCounsellorMapping> findByIsActiveTrue();

    List<StudentCounsellorMapping> findByAssignedById(Long userId);

    /** The student's one row (active or not). Unique since uk_scm_student. */
    Optional<StudentCounsellorMapping> findByStudentUserStudentId(Long userStudentId);

    /**
     * The student's row, locked until the calling transaction ends. Offline mark-done takes it
     * so that a double tap, or another counsellor's "Map to me" landing at the same moment,
     * queues behind the first instead of both passing the "mapped to me / not done yet" checks.
     * The upsert below writes the same row, so it waits on this lock too.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM StudentCounsellorMapping m WHERE m.student.userStudentId = :studentId")
    Optional<StudentCounsellorMapping> lockByStudent(@Param("studentId") Long studentId);

    /**
     * Maps the student to {@code counsellorId}, moving the existing row if there is one.
     *
     * <p>One statement, in its own transaction, so a bulk "Map to me" is a loop of independent
     * upserts: one bad row fails alone instead of marking a shared transaction rollback-only and
     * taking the whole batch with it. Two counsellors racing for the same unmapped student both
     * succeed in turn (last write wins) instead of one hitting the unique key.
     */
    @Modifying
    @Transactional
    @Query(value = "INSERT INTO student_counsellor_mapping "
            + "(student_id, counsellor_id, assigned_by, assigned_at, is_active) "
            + "VALUES (:studentId, :counsellorId, :assignedBy, :assignedAt, 1) "
            + "ON DUPLICATE KEY UPDATE counsellor_id = VALUES(counsellor_id), "
            + "assigned_by = VALUES(assigned_by), assigned_at = VALUES(assigned_at), is_active = 1",
            nativeQuery = true)
    int upsertActive(@Param("studentId") Long studentId, @Param("counsellorId") Long counsellorId,
                     @Param("assignedBy") Long assignedBy, @Param("assignedAt") LocalDateTime assignedAt);
}
