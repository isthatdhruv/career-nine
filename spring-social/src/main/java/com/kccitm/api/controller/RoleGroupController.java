package com.kccitm.api.controller;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.RoleGroup;
import com.kccitm.api.model.RoleRoleGroupMapping;
import com.kccitm.api.repository.RoleGroupRepository;
import com.kccitm.api.repository.RoleRepository;
import com.kccitm.api.repository.RoleRoleGroupMappingRepository;

@RestController
public class RoleGroupController {

	@Autowired
	private RoleGroupRepository roleGroupRepository;

	@Autowired
	private RoleRepository roleRepository;

	@Autowired
	private RoleRoleGroupMappingRepository roleRoleGroupMappingRepository;

	@PreAuthorize("@auth.allows('role_group.read.all')")
	@GetMapping(value = "rolegroup/get", headers = "Accept=application/json")
	public List<RoleGroup> getAllRoles() {
		List<RoleGroup> allRoleGroups = roleGroupRepository.findByDisplay(true);
		return allRoleGroups;
	}

	@PreAuthorize("@auth.allows('role_group.read')")
	@GetMapping(value = "rolegroup/getbyid/{id}", headers = "Accept=application/json")
	public Optional<RoleGroup> getRoleById(@PathVariable("id") Long roleId) {
		Optional<RoleGroup> roleGroup = roleGroupRepository.findById(roleId);
		return roleGroup;
	}

	@PreAuthorize("@auth.allows('role_group.update')")
	@PostMapping(value = "rolegroup/update", headers = "Accept=application/json")
	public RoleGroup updaterRoleGroup(@RequestBody Map<String, RoleGroup> inputData) {
		RoleGroup r = inputData.get("values");
		RoleGroup rt = roleGroupRepository.save(r);
		roleRoleGroupMappingRepository.deleteByRoleGroup(rt.getId());
		for (RoleRoleGroupMapping rty : r.getRoleRoleGroupMappings()) {
			rty.setRoleGroup(rt.getId());
		}
		roleRoleGroupMappingRepository.saveAll(r.getRoleRoleGroupMappings());
		return roleGroupRepository.findById(rt.getId()).get();
	}

	@PreAuthorize("@auth.allows('role_group.delete')")
	@GetMapping(value = "rolegroup/delete/{id}", headers = "Accept=application/json")
	public RoleGroup deleteUser(@PathVariable("id") Long roleGroupId) {
		RoleGroup roleGroup = roleGroupRepository.getOne(roleGroupId);
		roleGroup.setDisplay(false);
		RoleGroup r = roleGroupRepository.save(roleGroup);
		return r;
	}
}