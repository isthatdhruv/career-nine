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

}