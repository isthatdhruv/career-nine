package com.kccitm.api.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.Group;
import com.kccitm.api.repository.GroupRepository;




@RestController
public class GroupController {
    
    @Autowired
	private GroupRepository groupRepository;


    @GetMapping(value = "group/get", headers = "Accept=application/json")
	public List<Group> getAllGroup() {
		List<Group> allGroup = groupRepository.findAll();
		return allGroup;
	}

	@GetMapping(value = "group/getbyid/{id}", headers = "Accept=application/json")
	public Group getRoleById(@PathVariable("id") int id) {
		Group Group = groupRepository.findById(id);
		return Group;
    }


    @GetMapping(value = "group/delete/{id}", headers = "Accept=application/json")
	public Group deleteUser(@PathVariable("id") int id) {
		Group Group = groupRepository.getOne(id);
		Group g = groupRepository.save(Group);
		return g;
	}

}
