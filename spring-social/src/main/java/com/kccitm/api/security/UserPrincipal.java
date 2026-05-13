package com.kccitm.api.security;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;

import com.kccitm.api.model.Student;
import com.kccitm.api.model.User;
import com.kccitm.api.repository.StudentRepository;

public class UserPrincipal implements OAuth2User, UserDetails {

    @Autowired
    private StudentRepository studentRepository;

    private Long id;
    private String email;
    private String password;
    private Collection<? extends GrantedAuthority> authorities;
    private Map<String, Object> attributes;
    private String googleAuthString;
    private Student studnetData;

    /**
     * Phase 15 RBAC: flat set of permission code strings derived from the
     * caller's role assignments. Populated by {@link TokenAuthenticationFilter}
     * from the JWT {@code perms[]} claim. Read by {@link AuthorizationService}
     * to short-circuit RBAC checks before walking scopes.
     */
    private Set<String> permissions = Collections.emptySet();

    /**
     * Phase 15 ABAC: flat list of scope rows aggregated across all of the
     * caller's role assignments. Populated by {@link TokenAuthenticationFilter}
     * from the JWT {@code scopes[]} claim.
     */
    private List<CurrentScopes.ScopeRow> scopes = Collections.emptyList();

    /** Phase 15: when true, {@link AuthorizationService} short-circuits to allow. */
    private boolean superAdmin = false;

    /** JWT id (UUID) — used by Phase 18's refresh-token / revocation list. */
    private String jti;

    public UserPrincipal(Long id, String email, String password, String googleAuthString,
            Collection<? extends GrantedAuthority> authorities) {
        this.id = id;
        this.email = email;
        this.password = password;
        this.authorities = authorities;
        this.googleAuthString = googleAuthString;
    }

    public static UserPrincipal create(User user) {
        List<GrantedAuthority> authorities = Collections.singletonList(new SimpleGrantedAuthority("USER_ME"));

        authorities = user.getRole();
        UserPrincipal usp = new UserPrincipal(
                user.getId(),
                user.getEmail(),
                user.getPassword(),
                user.getGoogleAuthString(),
                authorities);
        return usp;
    }

    public static UserPrincipal create(User user, Map<String, Object> attributes) {
        UserPrincipal userPrincipal = UserPrincipal.create(user);
        userPrincipal.setAttributes(attributes);

        return userPrincipal;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public Map<String, Object> getAttributes() {
        return attributes;
    }

    public void setAttributes(Map<String, Object> attributes) {
        this.attributes = attributes;
    }

    @Override
    public String getName() {
        return String.valueOf(id);
    }

    public void setGoogleAuthString(String googleAuthString) {
        this.googleAuthString = googleAuthString;
    }

    public String getGoogleAuthString() {
        return googleAuthString;
    }

    public Student getStudnetData() {
        try {
            return studentRepository.findByPersonalEmailAddress(this.email).get(0) != null
                    ? studentRepository.findByPersonalEmailAddress(this.email).get(0)
                    : new Student();
        } catch (Exception e) {
            return new Student();
        }
    }

    public void setStudnetData(Student studnetData) {
        this.studnetData = studnetData;
    }

    // ── Phase 15 RBAC + ABAC accessors ─────────────────────────────────────

    public Set<String> getPermissions() {
        return permissions;
    }

    public void setPermissions(Set<String> permissions) {
        this.permissions = permissions == null ? Collections.<String>emptySet() : permissions;
    }

    public List<CurrentScopes.ScopeRow> getScopes() {
        return scopes;
    }

    public void setScopes(List<CurrentScopes.ScopeRow> scopes) {
        this.scopes = scopes == null ? Collections.<CurrentScopes.ScopeRow>emptyList() : scopes;
    }

    public boolean isSuperAdmin() {
        return superAdmin;
    }

    public void setSuperAdmin(boolean superAdmin) {
        this.superAdmin = superAdmin;
    }

    public String getJti() {
        return jti;
    }

    public void setJti(String jti) {
        this.jti = jti;
    }
}