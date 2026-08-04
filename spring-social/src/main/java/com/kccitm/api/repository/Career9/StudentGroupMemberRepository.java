package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.group.StudentGroupMember;

@Repository
public interface StudentGroupMemberRepository extends JpaRepository<StudentGroupMember, Long> {

    List<StudentGroupMember> findByStudentGroup_Id(Long studentGroupId);

    List<StudentGroupMember> findByUserStudentId(Long userStudentId);

    long countByStudentGroup_Id(Long studentGroupId);

    @Modifying
    void deleteByStudentGroup_IdAndUserStudentIdIn(Long studentGroupId, List<Long> userStudentIds);

    @Modifying
    void deleteByStudentGroup_Id(Long studentGroupId);

    /** Current membership, for the idempotent-add diff. */
    @Query("SELECT m.userStudentId FROM StudentGroupMember m WHERE m.studentGroup.id = :groupId")
    List<Long> findUserStudentIdsByGroupId(@Param("groupId") Long groupId);

    /**
     * Group ids a student belongs to. A student may be in many groups — the
     * ABAC row filter treats a grant as matching if ANY of the student's groups
     * is in the caller's grant set.
     */
    @Query("SELECT m.studentGroup.id FROM StudentGroupMember m WHERE m.userStudentId = :userStudentId")
    List<Long> findGroupIdsByUserStudentId(@Param("userStudentId") Long userStudentId);

    /**
     * Groups that contain at least one of these students, in one query.
     *
     * <p>Used when building the principal-dashboard scope lattice: a group only
     * becomes a scope if it actually holds scoreable students, so this is fed the
     * completed-assessment roster rather than the institute's whole student list.
     */
    @Query("SELECT DISTINCT m.studentGroup.id FROM StudentGroupMember m "
         + "WHERE m.userStudentId IN :userStudentIds")
    List<Long> findDistinctGroupIdsByStudentIds(@Param("userStudentIds") List<Long> userStudentIds);

    /**
     * Member counts for a page of groups in one query rather than N — the group
     * list shows a count per row.
     */
    @Query("SELECT m.studentGroup.id, COUNT(m) FROM StudentGroupMember m "
         + "WHERE m.studentGroup.id IN :groupIds GROUP BY m.studentGroup.id")
    List<Object[]> countByGroupIds(@Param("groupIds") List<Long> groupIds);
}
