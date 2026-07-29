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
import com.kccitm.api.model.User;
import com.kccitm.api.model.UserRoleScope;
import com.kccitm.api.repository.Career9.StudentGroupRepository;
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

    /** Optional so auth bootstrap still works if the group tables are absent. */
    @Autowired(required = false)
    StudentGroupRepository studentGroupRepository;

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
     *
     * <p>Public so the OAuth2 login path ({@code CustomOAuth2UserService}) can
     * reuse the same hydration. Both paths MUST produce a principal carrying
     * permissions/scopes/superAdmin — otherwise the token minted by the
     * success handler will have an empty {@code perms} claim and the user
     * sees Permission Denied despite valid role-group assignments.
     */
    /**
     * Unions explicit {@code user_role_scope.group_id} grants with the groups the
     * user reaches by being a contact person on them.
     *
     * <p>Two sources, on purpose. The explicit path keeps the group dimension
     * consistent with the other four and lets any staff user be group-scoped
     * without a contact-person record. The derived path means "allot a contact
     * person to a group" grants access without a second trip through
     * user-management, and can never drift out of sync with the admin list.
     *
     * <p>Deriving rather than writing a {@code user_role_scope} row on allot is
     * deliberate: scope rows hang off {@code user_role_group_mapping}, so a
     * write would have to guess which of the user's role assignments to attach
     * the grant to, and unpick it correctly on removal.
     *
     * <p><strong>Only additive.</strong> Derived rows are appended, never
     * substituted, so a user who already holds an institute-wide (group-null)
     * row stays institute-wide — {@code CurrentScopes.isGroupScoped()} sees that
     * wildcard row and leaves the strict group filter off. Being made a group
     * admin can therefore only ever widen reach, never silently narrow it.
     */
    private List<CurrentScopes.ScopeRow> withDerivedGroupScopes(
            User user, List<CurrentScopes.ScopeRow> explicit) {
        if (studentGroupRepository == null) {
            return explicit;
        }
        try {
            List<Long> derivedGroupIds = studentGroupRepository.findGroupIdsAdministeredByUser(user.getId());
            if (derivedGroupIds == null || derivedGroupIds.isEmpty()) {
                return explicit;
            }
            Set<Long> alreadyGranted = new HashSet<Long>();
            for (CurrentScopes.ScopeRow r : explicit) {
                if (r.g != null) {
                    alreadyGranted.add(r.g);
                }
            }
            List<CurrentScopes.ScopeRow> combined =
                    new ArrayList<CurrentScopes.ScopeRow>(explicit);
            for (Long groupId : derivedGroupIds) {
                if (groupId != null && alreadyGranted.add(groupId)) {
                    // Group alone — the group already implies its institute, and
                    // binding a second dim here would over-constrain the row.
                    combined.add(new CurrentScopes.ScopeRow(null, null, null, null, groupId));
                }
            }
            return combined;
        } catch (Exception e) {
            log.warn("loadUser: derived group-scope hydration failed for user={} — "
                    + "falling back to explicit scopes only", user.getId(), e);
            return explicit;
        }
    }

    public UserPrincipal hydrate(User user) {
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
                            sectionLong,
                            urs.getGroupId()));
                }
            }
            up.setScopes(withDerivedGroupScopes(user, scopes));
        } catch (Exception e) {
            // Be resilient — empty scopes are safe in log-only mode.
            log.warn("loadUser: scope hydration failed for user={} — defaulting to empty scopes",
                    user.getId(), e);
            up.setScopes(Collections.<CurrentScopes.ScopeRow>emptyList());
        }

        // Permissions: native join through user_role_group_mapping → role_role_group_mapping
        // → role → role_permission → permission, returning distinct permission codes.
        // Without this hydration the minted JWT carries an empty perms claim, which
        // makes the frontend can() gate deny every menu item for non-super-admins.
        try {
            List<String> codes = permissionRepository.findCodesForUser(user.getId());
            Set<String> perms = (codes == null || codes.isEmpty())
                    ? Collections.<String>emptySet()
                    : new HashSet<String>(codes);
            up.setPermissions(perms);
        } catch (Exception e) {
            log.warn("loadUser: permission hydration failed for user={} — defaulting to empty perms",
                    user.getId(), e);
            up.setPermissions(Collections.<String>emptySet());
        }

        // Super-admin bit. Sourced from User.is_super_admin (column added when
        // the bootstrap admin feature landed). SuperAdminBootstrapper seeds /
        // promotes the configured admin email on every boot so this stays in
        // sync with app.bootstrap.* config without manual SQL.
        up.setSuperAdmin(Boolean.TRUE.equals(user.getIsSuperAdmin()));

        return up;
    }
}
