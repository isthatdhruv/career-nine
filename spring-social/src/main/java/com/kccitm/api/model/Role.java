package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;

/**
 * The persistent class for the role database table.
 * 
 */
@Entity
@Table(name = "role")
// @NamedQuery(name = "Role.findByRole", query = "SELECT r FROM Role r WHERE
// r.display = true")
// @NamedQuery(name="Role.findAll", query="SELECT r FROM Role r")
public class Role implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private int id;

	private Boolean display;

	private String name;

	private String url;

	// bi-directional many-to-one association to RoleRoleGroupMapping
	// @OneToMany(mappedBy="role")
	// private List<RoleRoleGroupMapping> roleRoleGroupMappings;

	public Role() {
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

	public String getUrl() {
		return this.url;
	}

	public void setUrl(String url) {
		this.url = url;
	}

	// public List<RoleRoleGroupMapping> getRoleRoleGroupMappings() {
	// return this.roleRoleGroupMappings;
	// }

	// public void setRoleRoleGroupMappings(List<RoleRoleGroupMapping>
	// roleRoleGroupMappings) {
	// this.roleRoleGroupMappings = roleRoleGroupMappings;
	// }

	// public RoleRoleGroupMapping addRoleRoleGroupMapping(RoleRoleGroupMapping
	// roleRoleGroupMapping) {
	// getRoleRoleGroupMappings().add(roleRoleGroupMapping);
	// roleRoleGroupMapping.setRole(this);

	// return roleRoleGroupMapping;
	// }

	// public RoleRoleGroupMapping removeRoleRoleGroupMapping(RoleRoleGroupMapping
	// roleRoleGroupMapping) {
	// getRoleRoleGroupMappings().remove(roleRoleGroupMapping);
	// roleRoleGroupMapping.setRole(null);

	// return roleRoleGroupMapping;
	// }

}