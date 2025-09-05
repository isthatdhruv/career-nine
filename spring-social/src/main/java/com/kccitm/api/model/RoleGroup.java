package com.kccitm.api.model;

import java.io.Serializable;
import java.util.List;

import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.OneToMany;
import javax.persistence.Table;

/**
 * The persistent class for the role_group database table.
 * 
 */
@Entity
@Table(name = "role_group")
// @NamedQuery(name="RoleGroup.findAll", query="SELECT r FROM RoleGroup r")
public class RoleGroup implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private int id;

	private Boolean display;

	private String name;

	// bi-directional many-to-one association to RoleRoleGroupMapping
	@OneToMany(mappedBy = "roleGroup", fetch = FetchType.EAGER)
	private List<RoleRoleGroupMapping> roleRoleGroupMappings;

	// //bi-directional many-to-one association to UserRoleGroupMapping
	// @OneToMany(mappedBy="roleGroup")
	// private List<UserRoleGroupMapping> userRoleGroupMappings;

	public RoleGroup() {
	}

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

	public String getName() {
		return this.name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public List<RoleRoleGroupMapping> getRoleRoleGroupMappings() {
		return this.roleRoleGroupMappings;
	}

	public void setRoleRoleGroupMappings(List<RoleRoleGroupMapping> roleRoleGroupMappings) {
		this.roleRoleGroupMappings = roleRoleGroupMappings;
	}

	// public RoleRoleGroupMapping addRoleRoleGroupMapping(RoleRoleGroupMapping
	// roleRoleGroupMapping) {
	// getRoleRoleGroupMappings().add(roleRoleGroupMapping);
	// roleRoleGroupMapping.setRoleGroup(this);

	// return roleRoleGroupMapping;
	// }

	// public RoleRoleGroupMapping removeRoleRoleGroupMapping(RoleRoleGroupMapping
	// roleRoleGroupMapping) {
	// getRoleRoleGroupMappings().remove(roleRoleGroupMapping);
	// roleRoleGroupMapping.setRoleGroup(null);

	// return roleRoleGroupMapping;
	// }

	// public List<UserRoleGroupMapping> getUserRoleGroupMappings() {
	// return this.userRoleGroupMappings;
	// }

	// public void setUserRoleGroupMappings(List<UserRoleGroupMapping>
	// userRoleGroupMappings) {
	// this.userRoleGroupMappings = userRoleGroupMappings;
	// }

	// public UserRoleGroupMapping addUserRoleGroupMapping(UserRoleGroupMapping
	// userRoleGroupMapping) {
	// getUserRoleGroupMappings().add(userRoleGroupMapping);
	// userRoleGroupMapping.setRoleGroup(this);

	// return userRoleGroupMapping;
	// }

	// public UserRoleGroupMapping removeUserRoleGroupMapping(UserRoleGroupMapping
	// userRoleGroupMapping) {
	// getUserRoleGroupMappings().remove(userRoleGroupMapping);
	// userRoleGroupMapping.setRoleGroup(null);

	// return userRoleGroupMapping;
	// }

}