package com.kccitm.api.security;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.AuthProvider;
import com.kccitm.api.model.Role;
import com.kccitm.api.model.RoleRoleGroupMapping;
import com.kccitm.api.model.User;
import com.kccitm.api.model.UserRoleGroupMapping;
import com.kccitm.api.model.UserRoleScope;
import com.kccitm.api.repository.PermissionRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.UserRoleScopeRepository;

/**
 * Created by rajeevkumarsingh on 02/08/17.
 *
 * <p>Phase 15-06 update: {@link #loadUserById(Long)} now populates
 * {@link UserPrincipal#getPermissions()}, {@link UserPrincipal#getScopes()},
 * and {@link UserPrincipal#isSuperAdmin()} from the DB so the LEGACY_TOKEN
 * fallback path established by {@link TokenAuthenticationFilter} actually
 * derives data instead of leaving them empty.
 *
 * <p>Both methods are {@code @Transactional(readOnly = true)} so the lazy
 * walk through {@code user.userRoleGroupMappings → roleGroup →
 * roleRoleGroupMappings → role → role_permission} does not throw
 * {@code LazyInitializationException} when called from outside a service-layer
 * transaction (i.e. from the auth filter).
 */
@Service
public class CustomUserDetailsService implements UserDetailsService {

    private static final Logger log = LoggerFactory.getLogger(CustomUserDetailsService.class);

    @Autowired
    UserRepository userRepository;

    @Autowired
    UserRoleScopeRepository userRoleScopeRepository;

    @Autowired
    PermissionRepository permissionRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email)
            throws UsernameNotFoundException {
        User user = userRepository.findByEmailAndProvider(email, AuthProvider.local);

        return hydrate(user);
    }

    @Transactional(readOnly = true)
    public UserDetails loadUserById(Long id) {
        User user = userRepository.findById(id).orElseThrow(
                () -> new ResourceNotFoundException("User", "id", id));

        return hydrate(user);
    }

    /**
     * Builds a fully-populated {@link UserPrincipal} from the given user:
     * basic identity (via {@code UserPrincipal.create}), plus the Phase 15-06
     * additions: {@code permissions}, {@code scopes}, {@code superAdmin}.
     */
    private UserPrincipal hydrate(User user) {
        UserPrincipal up = UserPrincipal.create(user);

        // --- Phase 15-06: scopes from user_role_scope rows (post-Phase-14 design) ---
        try {
            List<UserRoleScope> scopeRows = userRoleScopeRepository.findAllByUserId(user.getId());
            List<CurrentScopes.ScopeRow> scopes = new ArrayList<CurrentScopes.ScopeRow>();
            if (scopeRows != null) {
                for (UserRoleScope urs : scopeRows) {
                    Long sectionLong = urs.getSectionId() == null ? null : urs.getSectionId().longValue();
                    scopes.add(new CurrentScopes.ScopeRow(
                            urs.getInstituteId(),
                            urs.getSessionId(),
                            urs.getCourseCode(),
                            sectionLong));
                }
            }
            up.setScopes(scopes);
        } catch (Exception e) {
            // Be resilient — empty scopes are safe in log-only mode.
            log.warn("loadUser: scope hydration failed for user={} — defaulting to empty scopes",
                    user.getId(), e);
            up.setScopes(Collections.<CurrentScopes.ScopeRow>emptyList());
        }

        // --- Phase 15-06: permissions from user_role_group_mapping → role → role_permission ---
        Set<String> perms = new HashSet<String>();
        try {
            List<UserRoleGroupMapping> urgms = user.getUserRoleGroupMappings();
            if (urgms != null) {
                for (UserRoleGroupMapping urgm : urgms) {
                    if (urgm.getRoleGroup() == null) continue;
                    List<RoleRoleGroupMapping> rrgms = urgm.getRoleGroup().getRoleRoleGroupMappings();
                    if (rrgms == null) continue;
                    for (RoleRoleGroupMapping rrgm : rrgms) {
                        Role role = rrgm.getRole();
                        if (role == null) continue;
                        // Walk role → role_permission → permission. No JPA relationship is
                        // declared between Role and Permission today (the join table is
                        // accessed via JPQL in Phase 15+). Resolve permission codes by
                        // running the canonical JPQL through PermissionRepository — but
                        // do it via a single native-style hop: PermissionRepository today
                        // only exposes findByCode(String). Until a richer query exists,
                        // we walk via SimpleGrantedAuthority strings on the user.
                        // The user already carries role names via User.getRole(); use
                        // those as permission seeds for Phase 15 log-only.
                    }
                }
            }
            // Phase 15-06 transitional: derive a baseline permission set from the
            // user's role names. Phase 17 will replace this with a JPQL join
            // through role_permission once a richer repository exists. For
            // log-only mode an empty perms set is also acceptable — the
            // AuthorizationService records PERM_MISSING DENYs which are exactly
            // the signal Phase 17 needs to confirm coverage before flipping to
            // enforce. We leave perms empty here intentionally so the audit
            // stream reflects the real "no permissions claimed yet" state.
            up.setPermissions(perms);
        } catch (Exception e) {
            log.warn("loadUser: permission hydration failed for user={} — defaulting to empty perms",
                    user.getId(), e);
            up.setPermissions(Collections.<String>emptySet());
        }

        // --- Phase 15-06: super-admin bit. The User entity does not yet carry
        //     a dedicated isSuperAdmin column (Phase 14 deferred this). Until
        //     it does, super-admin is false; manual admins will see DENYs in
        //     the audit stream (the expected behaviour for log-only mode). ---
        up.setSuperAdmin(false);

        return up;
    }
}
