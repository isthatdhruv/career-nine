package com.kccitm.api.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.servlet.http.HttpSession;

import org.apache.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.RoleRoleGroupMapping;
import com.kccitm.api.model.User;
import com.kccitm.api.model.UserRoleGroupMapping;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.security.CurrentUser;
import com.kccitm.api.security.UserPrincipal;

@RestController
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @GetMapping("/user/me")
    // @PreAuthorize("hasAuthority('USER_ME')")
    public User getCurrentUser(@CurrentUser UserPrincipal userPrincipal) {
        User us = userRepository.findById(userPrincipal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userPrincipal.getId()));
        List<String> url = new ArrayList<String>();
        for (UserRoleGroupMapping urgm : us.getUserRoleGroupMappings()) {
            for (RoleRoleGroupMapping rrgm : urgm.getRoleGroup().getRoleRoleGroupMappings()) {
                url.add(rrgm.getRole().getUrl());
            }
        }
        us.setAuthorityUrls(url);
        return us;
    }

    // @GetMapping(value = "user/get", headers = "Accept=application/json")
    // public List<User> getAllUser() {
    // List<User> users = userRepository.findAll();
    // return users;
    // }

    @GetMapping(value = "user/get", headers = "Accept=application/json")
    public List<User> getAllRoles() {
        List<User> users = userRepository.findByDisplay(true);
        return users;
    }

    @GetMapping(value = "user/getbyid/{id}", headers = "Accept=application/json")
    public Optional<User> getRoleById(@PathVariable("id") Long userId) {
        Optional<User> user = userRepository.findById(userId);
        return user;
    }

    @PostMapping(value = "user/update", headers = "Accept=application/json")
    public List<User> updateUser(@RequestBody User currentUser) {
        userRepository.save(currentUser);
        return userRepository.findByName(currentUser.getName());
    }

    @PostMapping(value = "user/auth", headers = "Accept=application/json")
    public HashMap<String, Object> checkUser(@RequestBody User currentUser) {
        if (userRepository.findByUsernameAndDobDate(currentUser.getUsername(), currentUser.getDobDate()).isPresent()) {
            User user = userRepository.findByUsernameAndDobDate(currentUser.getUsername(), currentUser.getDobDate())
                    .get();
            if (userStudentRepository.getByUserId(user.getId()).isPresent()) {

                UserStudent userStudent = userStudentRepository.getByUserId(user.getId()).get();
                List<StudentAssessmentMapping> studentAssessmentMapping = studentAssessmentMappingRepository
                        .findByUserStudentUserStudentId(userStudent.getUserStudentId());

                HashMap<String, Object> response = new HashMap<>();
                response.put("userStudentId", userStudent.getUserStudentId());
                response.put("assessmentId", studentAssessmentMapping.get(0).getAssessmentId());
                return response;
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    @GetMapping(value = "user/delete/{id}", headers = "Accept=application/json")
    public User deleteUser(@PathVariable("id") Long userId) {
        User user = userRepository.getOne(userId);
        System.out.println(user.getName());
        user.setDisplay(false);
        User r = userRepository.save(user);
        return r;
    }
}