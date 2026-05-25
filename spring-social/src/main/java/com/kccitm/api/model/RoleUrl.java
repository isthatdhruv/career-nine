package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;

/**
 * JPA entity for the {@code role_url} table — the per-role allow-list of
 * React route paths. A user can navigate to a path iff (a) at least one of
 * their roles whitelists the path (or a matching pattern) AND (b) the
 * route's existing {@code <RequirePermission perm="...">} predicate passes.
 * Intersection semantics — the URL list is a route-level gate that runs
 * alongside the permission gate, not a replacement.
 *
 * <p>Paths may be literal ({@code /students/list}), parametric
 * ({@code /students/getbyid/:id}), or wildcard-suffix ({@code /students/*}).
 * Matching happens client-side in {@code RequirePermission}; the backend
 * just stores the strings.
 */
@Entity
@Table(
    name = "role_url",
    uniqueConstraints = @UniqueConstraint(columnNames = {"role_id", "path"}),
    indexes = @Index(name = "idx_role_url_role", columnList = "role_id")
)
public class RoleUrl implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "role_id", nullable = false)
    private Integer roleId;

    @Column(name = "path", nullable = false, length = 255)
    private String path;

    public RoleUrl() { }

    public RoleUrl(Integer roleId, String path) {
        this.roleId = roleId;
        this.path = path;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Integer getRoleId() { return roleId; }
    public void setRoleId(Integer roleId) { this.roleId = roleId; }

    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }
}
