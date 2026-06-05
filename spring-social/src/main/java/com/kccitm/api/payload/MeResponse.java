package com.kccitm.api.payload;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Response body for {@code GET /auth/me} (Phase 18 Plan 02).
 *
 * <p>Shape mirrors the Phase-15 RBAC + ABAC claim model:
 * <ul>
 *   <li>{@code roles[]}      — string role codes from {@code GrantedAuthority}</li>
 *   <li>{@code permissions[]} — flat permission codes (RBAC)</li>
 *   <li>{@code scopes[]}     — list of scope rows; each row carries {@code i/s/c/x}
 *                             (institute / session / course / section); missing key = wildcard</li>
 *   <li>{@code superAdmin}   — true iff {@code sa} claim is set</li>
 * </ul>
 *
 * <p>When the bound JWT predates Phase 15 (no {@code perms} / {@code scopes} claims),
 * {@code permissions} and {@code scopes} are empty and {@code superAdmin} is false.
 */
public class MeResponse {
    private Long id;
    private String name;
    private String email;
    private List<String> roles;
    private List<String> permissions;
    private List<Map<String, Object>> scopes;
    /**
     * React route paths whitelisted for this user, accumulated across every
     * role they hold via any of their role groups. Used by the FE
     * {@code RequirePermission} guard for an intersection check: a route is
     * accessible iff its path matches at least one entry here AND the
     * existing permission gate passes. Empty list = no routes whitelisted
     * (deny-by-default for non-super-admin users until URLs are configured).
     */
    private List<String> urls;
    private boolean superAdmin;

    /**
     * Student-portal fields — NULL for staff/admin users. Populated only when the
     * authenticated user has a {@code UserStudent} row. The FE uses these to gate
     * the post-login flow: {@code infoCompleted=false} routes the student to the
     * one-time student-info form before the dashboard; {@code userStudentId} is
     * the target id for the profile-update PUT.
     */
    private Long userStudentId;
    private Boolean infoCompleted;

    public MeResponse() {}

    public MeResponse(Long id, String name, String email,
                      List<String> roles, List<String> permissions,
                      List<Map<String, Object>> scopes,
                      List<String> urls, boolean superAdmin) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.roles = roles != null ? roles : Collections.<String>emptyList();
        this.permissions = permissions != null ? permissions : Collections.<String>emptyList();
        this.scopes = scopes != null ? scopes : Collections.<Map<String, Object>>emptyList();
        this.urls = urls != null ? urls : Collections.<String>emptyList();
        this.superAdmin = superAdmin;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public List<String> getRoles() { return roles; }
    public void setRoles(List<String> roles) { this.roles = roles; }
    public List<String> getPermissions() { return permissions; }
    public void setPermissions(List<String> permissions) { this.permissions = permissions; }
    public List<Map<String, Object>> getScopes() { return scopes; }
    public void setScopes(List<Map<String, Object>> scopes) { this.scopes = scopes; }
    public List<String> getUrls() { return urls; }
    public void setUrls(List<String> urls) { this.urls = urls; }
    public boolean isSuperAdmin() { return superAdmin; }
    public void setSuperAdmin(boolean superAdmin) { this.superAdmin = superAdmin; }
    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }
    public Boolean getInfoCompleted() { return infoCompleted; }
    public void setInfoCompleted(Boolean infoCompleted) { this.infoCompleted = infoCompleted; }
}
