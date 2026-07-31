package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.group.StudentGroupContact;

/** The mirror image of {@link StudentGroupMemberRepository}, keyed on contact person. */
@Repository
public interface StudentGroupContactRepository extends JpaRepository<StudentGroupContact, Long> {

    List<StudentGroupContact> findByStudentGroup_Id(Long studentGroupId);

    List<StudentGroupContact> findByContactPersonId(Long contactPersonId);

    long countByStudentGroup_Id(Long studentGroupId);

    @Modifying
    void deleteByStudentGroup_IdAndContactPersonIdIn(Long studentGroupId, List<Long> contactPersonIds);

    @Modifying
    void deleteByStudentGroup_Id(Long studentGroupId);

    /** Current admins, for the idempotent-add diff. */
    @Query("SELECT c.contactPersonId FROM StudentGroupContact c WHERE c.studentGroup.id = :groupId")
    List<Long> findContactPersonIdsByGroupId(@Param("groupId") Long groupId);

    @Query("SELECT c.studentGroup.id, COUNT(c) FROM StudentGroupContact c "
         + "WHERE c.studentGroup.id IN :groupIds GROUP BY c.studentGroup.id")
    List<Object[]> countByGroupIds(@Param("groupIds") List<Long> groupIds);
}
