package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.UserRoleScope;

/**
 * Spring Data repository for {@code user_role_scope}.
 *
 * <p>The most common Phase 15 query — "what scopes does this user have, across
 * any of their role assignments?" — walks user → user_role_group_mapping →
 * user_role_scope. The JPQL query below performs that walk in a single round-trip.
 */
@Repository
public interface UserRoleScopeRepository extends JpaRepository<UserRoleScope, Long> {

    /** Direct lookup by the parent role-assignment id (Spring Data underscore navigation). */
    List<UserRoleScope> findByUserRoleGroupMapping_Id(Integer userRoleGroupMappingId);

    /**
     * All scope grants for a user, regardless of which role-assignment they're
     * attached to. Phase 15's AuthorizationService uses this to populate the
     * caller's effective scope list once per request.
     *
     * <p>The join uses {@code user_role_group_mapping.user} which is a Long-typed
     * column (not a JPA relationship — see UserRoleGroupMapping.java for context).
     */
    @Query("SELECT urs FROM UserRoleScope urs "
         + "WHERE urs.userRoleGroupMapping.user = :userId")
    List<UserRoleScope> findAllByUserId(@Param("userId") Long userId);
}
