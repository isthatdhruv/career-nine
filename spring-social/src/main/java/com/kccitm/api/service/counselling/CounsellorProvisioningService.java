package com.kccitm.api.service.counselling;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.RoleGroup;
import com.kccitm.api.model.UserRoleGroupMapping;
import com.kccitm.api.model.UserRoleScope;
import com.kccitm.api.repository.RoleGroupRepository;
import com.kccitm.api.repository.UserRoleGroupMappingRepository;
import com.kccitm.api.repository.UserRoleScopeRepository;

/**
 * Central, idempotent provisioning of counsellor authorization (Counselling Phase 1).
 *
 * <p>A counsellor logs in through the unified {@code /auth/login} cookie session, which
 * authenticates against a User row (provider = local). For the counsellor portal endpoints
 * (all {@code @auth.allows('counsellor.*' / 'counselling.*')}-guarded) to resolve, that User
 * must be mapped to the seeded {@code counsellor} role group. This service performs that
 * mapping plus an ABAC institute scope.
 *
 * <p>Mirrors {@link com.kccitm.api.service.StudentProvisioningService}. All steps are guarded
 * so re-running (on approval, on lazy self-heal at portal load, or on back-fill) never
 * duplicates rows. NOTE: unlike the student service this does NOT touch the provider marker —
 * counsellor Users keep {@code provider = local} so the standard password login path works.
 */
@Service
public class CounsellorProvisioningService {

    private static final Logger log = LoggerFactory.getLogger(CounsellorProvisioningService.class);

    /** Role-group name seeded by V20260610001. */
    public static final String COUNSELLOR_ROLE_GROUP = "counsellor";

    @Autowired
    private RoleGroupRepository roleGroupRepository;

    @Autowired
    private UserRoleGroupMappingRepository userRoleGroupMappingRepository;

    @Autowired
    private UserRoleScopeRepository userRoleScopeRepository;

    /**
     * Provision a counsellor User with the {@code counsellor} role group and an institute
     * scope (NULL institute = wildcard; counsellors map to institutes separately and the
     * counsellor.* / counselling.* permissions used by the portal are non-scoped). Idempotent.
     */
    @Transactional
    public void provision(Long userId, Integer instituteId) {
        if (userId == null) {
            return;
        }

        RoleGroup counsellorGroup = resolveCounsellorGroup();
        if (counsellorGroup == null) {
            log.warn("provision: 'counsellor' role group not found (migration V20260610001 not applied?) — "
                    + "skipping role/scope for user={}", userId);
            return;
        }

        UserRoleGroupMapping mapping = ensureCounsellorMapping(userId, counsellorGroup);
        ensureInstituteScope(mapping, instituteId);
    }

    private RoleGroup resolveCounsellorGroup() {
        List<RoleGroup> groups = roleGroupRepository.findByName(COUNSELLOR_ROLE_GROUP);
        return (groups == null || groups.isEmpty()) ? null : groups.get(0);
    }

    private UserRoleGroupMapping ensureCounsellorMapping(Long userId, RoleGroup counsellorGroup) {
        List<UserRoleGroupMapping> existing = userRoleGroupMappingRepository.findByUser(userId);
        if (existing != null) {
            for (UserRoleGroupMapping m : existing) {
                if (m.getRoleGroup() != null
                        && COUNSELLOR_ROLE_GROUP.equalsIgnoreCase(m.getRoleGroup().getName())) {
                    return m;
                }
            }
        }
        // Constructor sets display=true; first arg is ignored by the entity.
        UserRoleGroupMapping mapping = new UserRoleGroupMapping(false, userId, counsellorGroup);
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
        scope.setInstituteId(instituteId); // NULL = wildcard
        scope.setCreatedAt(LocalDateTime.now());
        userRoleScopeRepository.save(scope);
    }
}
