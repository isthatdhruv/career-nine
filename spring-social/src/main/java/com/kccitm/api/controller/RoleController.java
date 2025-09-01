package com.kccitm.api.controller;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.Role;
import com.kccitm.api.repository.RoleRepository;

@RestController
public class RoleController {

	@Autowired
	private RoleRepository roleRepository;

	// @PreAuthorize("hasAuthority('Role')")
	@GetMapping(value = "/role/get", headers = "Accept=application/json")
	public List<Role> getAllRoles() {
		List<Role> roles = roleRepository.findByRole();
		return roles;
	}

	@GetMapping(value = "role/getbyid/{id}", headers = "Accept=application/json")
	public Optional<Role> getRoleById(@PathVariable("id") int roleId) {
		Optional<Role> role = roleRepository.findById(roleId);
		return role;
	}

	@PutMapping(value = "role/update")
	public List<Role> updateUser(@RequestBody Map<String, Role> inputData) {
		Role r = inputData.get("values");
		;
		roleRepository.save(r);
		return roleRepository.findByName(r.getName());

	}

	@GetMapping(value = "role/delete/{id}", headers = "Accept=application/json")
	public Role deleteUser(@PathVariable("id") int roleId) {
		Role role = roleRepository.getOne(roleId);
		role.setDisplay(false);
		Role r = roleRepository.save(role);
		return r;
	}
}
