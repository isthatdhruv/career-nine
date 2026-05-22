package com.kccitm.api.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.AuthProvider;
import com.kccitm.api.model.RoleGroup;
import com.kccitm.api.model.User;
import com.kccitm.api.model.UserRoleGroupMapping;
import com.kccitm.api.model.UserRoleScope;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.RoleGroupRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.UserRoleGroupMappingRepository;
import com.kccitm.api.repository.UserRoleScopeRepository;

/**
 * Central, idempotent provisioning of student authorization (R5).
 *
 * <p>Every place that creates a {@link UserStudent} routes through {@link #provision}
 * so a created student automatically receives:
 * <ol>
 *   <li>the {@code custom_student} provider marker (set only if currently null, to
 *       avoid clobbering an existing OAuth/local credential),</li>
 *   <li>a {@link UserRoleGroupMapping} to the {@code student} role group (seeded in
 *       migration V20260522001), which confers the least-privilege permission bundle,</li>
 *   <li>a {@link UserRoleScope} row scoped to the student's institute — the only ABAC
 *       dimension a student has (NULL = wildcard, e.g. B2C campaign students).</li>
 * </ol>
 *
 * <p>All steps are guarded so re-running (single, bulk, link, backfill, or lazy-on-login)
 * never duplicates rows.
 */
@Service
public class StudentProvisioningService {

    private static final Logger log = LoggerFactory.getLogger(StudentProvisioningService.class);

    /** Role-group name seeded by V20260522001. */
    public static final String STUDENT_ROLE_GROUP = "student";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleGroupRepository roleGroupRepository;

    @Autowired
    private UserRoleGroupMappingRepository userRoleGroupMappingRepository;

    @Autowired
    private UserRoleScopeRepository userRoleScopeRepository;

    /**
     * Provision from a saved {@link UserStudent} (the common case at creation sites).
     * Derives the user id and institute scope from the row.
     */
    @Transactional
    public void provision(UserStudent userStudent) {
        if (userStudent == null || userStudent.getUserId() == null) {
            return;
        }
        Integer instituteId = userStudent.getInstitute() == null
                ? null
                : userStudent.getInstitute().getInstituteCode();
        provision(userStudent.getUserId(), instituteId);
    }

    /**
     * Provision a specific user with an institute scope (NULL institute = wildcard).
     * Idempotent.
     */
    @Transactional
    public void provision(Long userId, Integer instituteId) {
        if (userId == null) {
            return;
        }

        RoleGroup studentGroup = resolveStudentGroup();
        if (studentGroup == null) {
            log.warn("provision: 'student' role group not found (migration V20260522001 not applied?) — "
                    + "skipping role/scope for user={}", userId);
            return;
        }

        normalizeProviderMarker(userId);

        UserRoleGroupMapping mapping = ensureStudentMapping(userId, studentGroup);
        ensureInstituteScope(mapping, instituteId);
    }

    private RoleGroup resolveStudentGroup() {
        List<RoleGroup> groups = roleGroupRepository.findByName(STUDENT_ROLE_GROUP);
        return (groups == null || groups.isEmpty()) ? null : groups.get(0);
    }

    /** Tag the user as a student via the provider marker, but only when unset. */
    private void normalizeProviderMarker(Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user != null && user.getProvider() == null) {
            user.setProvider(AuthProvider.custom_student);
            userRepository.save(user);
        }
    }

    private UserRoleGroupMapping ensureStudentMapping(Long userId, RoleGroup studentGroup) {
        List<UserRoleGroupMapping> existing = userRoleGroupMappingRepository.findByUser(userId);
        if (existing != null) {
            for (UserRoleGroupMapping m : existing) {
                if (m.getRoleGroup() != null
                        && STUDENT_ROLE_GROUP.equalsIgnoreCase(m.getRoleGroup().getName())) {
                    return m;
                }
            }
        }
        // Constructor sets display=true; first arg is ignored by the entity.
        UserRoleGroupMapping mapping = new UserRoleGroupMapping(false, userId, studentGroup);
        return userRoleGroupMappingRepository.save(mapping);
    }

    private void ensureInstituteScope(UserRoleGroupMapping mapping, Integer instituteId) {
        List<UserRoleScope> scopes = userRoleScopeRepository
                .findByUserRoleGroupMapping_Id(mapping.getId());
        if (scopes != null) {
            for (UserRoleScope s : scopes) {
                if (Objects.equals(s.getInstituteId(), instituteId)) {
                    return; // already scoped to this institute (or wildcard)
                }
            }
        }
        UserRoleScope scope = new UserRoleScope();
        scope.setUserRoleGroupMapping(mapping);
        scope.setInstituteId(instituteId); // NULL = wildcard (B2C students)
        scope.setCreatedAt(LocalDateTime.now());
        userRoleScopeRepository.save(scope);
    }
}
