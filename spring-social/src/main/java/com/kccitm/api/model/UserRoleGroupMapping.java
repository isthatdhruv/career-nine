package com.kccitm.api.model;

import java.io.Serializable;
import java.util.ArrayList;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.persistence.Transient;

/**
 * The persistent class for the user_role_group_mapping database table.
 * 
 */
@Entity
@Table(name = "user_role_group_mapping")
// @NamedQuery(name = "UserRoleGroupMapping.findAll", query = "SELECT u FROM
// UserRoleGroupMapping u")
public class UserRoleGroupMapping implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;
    private Boolean display;

    // bi-directional many-to-one association to StudentUser
    // @ManyToOne
    @Column(name = "user_id")
    // private User user;
    private Long user;

    // bi-directional many-to-one association to RoleGroup
    @ManyToOne
    @JoinColumn(name = "role_group_id")
    private RoleGroup roleGroup;

    @Transient
    private ArrayList<Integer> roleGroupTemp;

    public UserRoleGroupMapping(boolean b, Long user2, RoleGroup rg) {
        this.display = true;
        this.user = user2;
        this.roleGroup = rg;
    }

    public UserRoleGroupMapping() {
        
    }

    public void UserRoleGroupMapping(int id, Boolean display, Long user, RoleGroup roleGroup) {
        this.id = id;
        this.display = display;
        this.user = user;
        this.roleGroup = roleGroup;
    }

    

    // public UserRoleGroupMapping(Boolean display, Long user, RoleGroup roleGroup)
    // {
    // this.id = id;
    // this.display = display;
    // this.user = user;
    // this.roleGroup = roleGroup;
    // }

    // public UserRoleGroupMapping() {
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

    public Long getUser() {
        return this.user;
    }

    public void setUser(Long user) {
        this.user = user;
    }

    public RoleGroup getRoleGroup() {
        return this.roleGroup;
    }

    public void setRoleGroup(RoleGroup roleGroup) {
        this.roleGroup = roleGroup;
    }

    public ArrayList<Integer> getRoleGroupTemp() {
        return roleGroupTemp;
    }

    public void setRoleGroupTemp(ArrayList<Integer> roleGroupTemp) {
        this.roleGroupTemp = roleGroupTemp;
    }

}
