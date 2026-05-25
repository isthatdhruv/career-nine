package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;

public interface UserStudentRepository extends JpaRepository<UserStudent, Long> {
    Optional<UserStudent> getByUserId(Long userId);
    List<UserStudent> findByInstituteInstituteCode(Integer instituteCode);
    Optional<UserStudent> findByStudentInfo(StudentInfo studentInfo);
    List<UserStudent> findByStudentInfoId(Integer studentInfoId);
    List<UserStudent> findByStudentInfoIdIn(List<Integer> studentInfoIds);
    List<UserStudent> findByInstituteInstituteCodeAndStudentInfoIdIn(Integer instituteCode, List<Integer> studentInfoIds);

    @Query("SELECT aa.studentInfo.name FROM UserStudent aa " +
           "WHERE aa.userStudentId = :userStudentId " )
    String getNameByUserID(@Param("userStudentId") Long userStudentId);

    /**
     * Students whose user holds no mapping to the given role group — i.e. not yet
     * provisioned. Used by the one-time backfill runner; self-limiting (returns
     * empty once every student has been provisioned).
     */
    @Query("SELECT us FROM UserStudent us WHERE us.userId NOT IN ("
         + "SELECT urgm.user FROM UserRoleGroupMapping urgm "
         + "WHERE urgm.roleGroup.name = :groupName)")
    List<UserStudent> findMissingRoleGroup(@Param("groupName") String groupName);
}
