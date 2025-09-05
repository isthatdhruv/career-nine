package com.kccitm.api.controller;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.Role;
import com.kccitm.api.model.RoleGroup;
import com.kccitm.api.model.RoleRoleGroupMapping;
import com.kccitm.api.repository.RoleGroupRepository;
import com.kccitm.api.repository.RoleRepository;
import com.kccitm.api.repository.RoleRoleGroupMappingRepository;

@RestController
public class RoleRoleGroupMappingController {

	@Autowired
	private RoleRoleGroupMappingRepository roleRoleGroupMappingRepository;

	@Autowired
	private RoleGroupRepository roleGroupRepository;

	@Autowired
	private RoleRepository roleRepository;

	@GetMapping(value = "rolerolegroupmapping/get", headers = "Accept=application/json")
	public List<RoleRoleGroupMapping> getAllRoles() {
		List<RoleRoleGroupMapping> allRoleroleGroupMapping = roleRoleGroupMappingRepository.findByDisplay(true);
		return allRoleroleGroupMapping;
	}

	@PostMapping(value = "rolerolegroupmapping/update", headers = "Accept=application/json")
	public RoleGroup updateRoleRoleGroup(@RequestBody Map<String, RoleGroup> currentRoleGroupMapping) {
		RoleGroup r = currentRoleGroupMapping.get("values");
		RoleGroup rSaved = roleGroupRepository.save(r);
		List<RoleGroup> t = roleGroupRepository.findByName(rSaved.getName());
		int roleGroupID = t.get(t.size() - 1).getId();
		List<RoleRoleGroupMapping> rrList = new ArrayList<>();
		Iterator<RoleRoleGroupMapping> rrIterators = r.getRoleRoleGroupMappings().iterator();
		while (rrIterators.hasNext()) {
			RoleRoleGroupMapping rr = new RoleRoleGroupMapping();
			int y = rrIterators.next().getId();
			List<Role> rol = roleRepository.findAll();
			rol.forEach(p -> {
				if (p.getId() == y) {
					rr.setRole(p);
					rr.setRoleGroup((long) roleGroupID);
					rr.setDisplay(true);
					rrList.add(rr);
				}
			});

		}
		int rrgmID = roleRoleGroupMappingRepository.findAll().size();
		for (RoleRoleGroupMapping rrt : rrList) {
			rrt.setId(rrgmID++);
			roleRoleGroupMappingRepository.saveAndFlush(rrt);
		}

		return roleGroupRepository.findByName(rSaved.getName()).get(0);
	}

	@PostMapping(value = "rolerolegroupmapping/update/{id}", headers = "Accept=application/json")
	public RoleGroup updateRoleRoleGroup(@RequestBody Map<String, RoleGroup> currentRoleGroupMapping,
			@PathVariable int id) {
		RoleGroup r = currentRoleGroupMapping.get("values");
		if (roleGroupRepository.findById(id) != null) {
			roleRoleGroupMappingRepository.deleteAll(roleRoleGroupMappingRepository.findByRoleGroup((long) id));
			roleGroupRepository.deleteById(id);
		}

		int dumID = roleRoleGroupMappingRepository.findAll().size(); 
		List<RoleRoleGroupMapping> rrRoleMapping = r.getRoleRoleGroupMappings();
		r.setRoleRoleGroupMappings(null);

		RoleGroup rSaved = roleGroupRepository.save(r);

		for (RoleRoleGroupMapping d : rrRoleMapping) {
			d.setId(dumID++);
			d.setRoleGroup((long) rSaved.getId());

		}
		;
		roleRoleGroupMappingRepository.saveAll(rrRoleMapping);

		return roleGroupRepository.findByName(rSaved.getName()).get(0);
	}

	@GetMapping(value = "rolerolegroupmapping/delete/{id}", headers = "Accept=application/json")
	public RoleRoleGroupMapping deleteRoleRoleGroup(@PathVariable("id") int roleGroupId) {
		RoleRoleGroupMapping roleGroup = roleRoleGroupMappingRepository.getOne(roleGroupId);
		roleGroup.setDisplay(false);
		RoleRoleGroupMapping r = roleRoleGroupMappingRepository.save(roleGroup);
		return r;
	}

}