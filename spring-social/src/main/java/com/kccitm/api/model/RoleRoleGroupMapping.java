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
     * relationship field makes the bidirectional mapping spec-correct.
     *
     * <p>{@code foreignKey = NO_CONSTRAINT}: the legacy DB has {@code role_group.id INT(11)}
     * and {@code role_role_group_mapping.role_group_id BIGINT(20)} — these were created
     * before the Java types were aligned and Hibernate {@code ddl-auto=update} cannot
     * migrate column types. Without this annotation Hibernate would try to emit
     * {@code FK ... (bigint) REFERENCES role_group (int)} on every boot, which MySQL
     * rejects with {@code CommandAcceptanceException} ("incompatible columns"). The
     * error is non-fatal — Hibernate continues — but pollutes startup logs and the
     * mapping never gets a DB-level FK regardless. Suppressing constraint generation
     * here removes the noise; referential integrity for this association is enforced
     * at the application layer (the existing {@code @ManyToOne private RoleGroup} on
     * {@link UserRoleGroupMapping} already produces a working FK on its own column).
     */
    @javax.persistence.ManyToOne(fetch = javax.persistence.FetchType.LAZY)
    @javax.persistence.JoinColumn(
            name = "role_group_id",
            insertable = false,
            updatable = false,
            foreignKey = @javax.persistence.ForeignKey(value = javax.persistence.ConstraintMode.NO_CONSTRAINT))
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