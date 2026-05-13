package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.ManyToOne;
import javax.persistence.Table;

/**
 * The persistent class for the role_role_group_mapping database table.
 * 
 */
@Entity

@Table(name = "role_role_group_mapping")
// @NamedQuery(name = "RoleRoleGroupMapping.findAll", query = "SELECT r FROM
// RoleRoleGroupMapping r")
public class RoleRoleGroupMapping implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    private Boolean display;
    // bi-directional many-to-one association to Role
    @ManyToOne
    private Role role;

    // bi-directional many-to-one association to RoleGroup
    // @ManyToOne
    @Column(name = "role_group_id")
    private Long roleGroup;

    /**
     * Read-only navigation handle for the role group (Phase 14 — bug B4 partial fix).
     * Maps to the SAME {@code role_group_id} column as the {@link #roleGroup} Long
     * above via {@code insertable=false, updatable=false}. Existing callsites
     * that use {@code getRoleGroup()}/{@code setRoleGroup(Long)} are unaffected.
     *
     * <p>The previous {@code @OneToMany(mappedBy = "roleGroup")} on
     * {@link RoleGroup#roleRoleGroupMappings} was JPA-spec non-compliant
     * (pointed at a Long column, not a {@code @ManyToOne} relationship field)
     * but tolerated by Hibernate 5.x. Pointing {@code mappedBy} at this real
     * relationship field makes the bidirectional mapping spec-correct. Phase 15
     * will use this for {@code AuthorizationService} traversal.
     */
    @javax.persistence.ManyToOne(fetch = javax.persistence.FetchType.LAZY)
    @javax.persistence.JoinColumn(name = "role_group_id", insertable = false, updatable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private RoleGroup roleGroupRef;

    // public RoleRoleGroupMapping(int i, Role role2) {
    // this.roleGroup = (long) i;
    // this.display = true;
    // this.role = role2;
    // }

    public int getId() {
        return this.id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public Boolean getDisplay() {
        return this.display;
    }

    public void setDisplay(Boolean display) {
        this.display = display;
    }

    public Role getRole() {
        return this.role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public Long getRoleGroup() {
        return this.roleGroup;
    }

    public void setRoleGroup(Long roleGroup) {
        this.roleGroup = roleGroup;
    }

    /** @see #roleGroupRef */
    public RoleGroup getRoleGroupRef() {
        return this.roleGroupRef;
    }

}