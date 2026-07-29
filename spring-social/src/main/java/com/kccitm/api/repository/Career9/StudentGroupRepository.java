package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.group.StudentGroup;

@Repository
public interface StudentGroupRepository extends JpaRepository<StudentGroup, Long> {

    List<StudentGroup> findByInstitute_InstituteCodeAndActiveTrueOrderByNameAsc(Integer instituteCode);

    List<StudentGroup> findByInstitute_InstituteCodeOrderByNameAsc(Integer instituteCode);

    /** Name uniqueness check — the DB unique key is case-sensitive, this is not. */
    Optional<StudentGroup> findByInstitute_InstituteCodeAndNameIgnoreCase(
            Integer instituteCode, String name);

    /**
     * "Groups I administer" — resolved through the join table, since a contact
     * person may administer many groups and a group may have many admins.
     */
    @Query("SELECT c.studentGroup FROM StudentGroupContact c "
         + "WHERE c.contactPersonId = :contactPersonId AND c.studentGroup.active = true "
         + "ORDER BY c.studentGroup.name ASC")
    List<StudentGroup> findActiveByContactPersonId(@Param("contactPersonId") Long contactPersonId);

    /**
     * Group ids a user may reach by virtue of being a contact person on them.
     * Feeds the derived half of the group ABAC dimension — see
     * {@code CustomUserDetailsService} scope hydration. Only active groups
     * grant access; deactivating a group revokes it.
     */
    @Query("SELECT c.studentGroup.id FROM StudentGroupContact c, ContactPerson cp "
         + "WHERE cp.id = c.contactPersonId AND cp.userId = :userId "
         + "AND c.studentGroup.active = true")
    List<Long> findGroupIdsAdministeredByUser(@Param("userId") Long userId);
}
