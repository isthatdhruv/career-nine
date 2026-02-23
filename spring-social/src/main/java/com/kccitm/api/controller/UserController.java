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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.text.SimpleDateFormat;

import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.AuthProvider;
import com.kccitm.api.model.RoleRoleGroupMapping;
import com.kccitm.api.model.User;
import com.kccitm.api.payload.ApiResponse;
import com.kccitm.api.model.UserRoleGroupMapping;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.security.CurrentUser;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.SmtpEmailService;

@RestController
public class UserController {

    @Autowired
    private SmtpEmailService smtpEmailService;

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

    @Autowired
    private com.kccitm.api.repository.Career9.AssessmentTableRepository assessmentTableRepository;

    @PostMapping(value = "user/auth", headers = "Accept=application/json")
    public HashMap<String, Object> checkUser(@RequestBody User currentUser) {
        if (userRepository.findByUsernameAndDobDate(currentUser.getUsername(), currentUser.getDobDate()).isPresent()) {
            User user = userRepository.findByUsernameAndDobDate(currentUser.getUsername(), currentUser.getDobDate())
                    .get();
            if (userStudentRepository.getByUserId(user.getId()).isPresent()) {

                UserStudent userStudent = userStudentRepository.getByUserId(user.getId()).get();
                List<StudentAssessmentMapping> studentAssessmentMappings = studentAssessmentMappingRepository
                        .findByUserStudentUserStudentId(userStudent.getUserStudentId());

                // Build list of assessments with details
                List<Map<String, Object>> assessmentsList = new ArrayList<>();
                for (StudentAssessmentMapping mapping : studentAssessmentMappings) {
                    Map<String, Object> assessmentInfo = new HashMap<>();
                    assessmentInfo.put("assessmentId", mapping.getAssessmentId());
                    assessmentInfo.put("studentStatus", mapping.getStatus());

                    // Fetch assessment details
                    Optional<com.kccitm.api.model.career9.AssessmentTable> assessment = assessmentTableRepository
                            .findById(mapping.getAssessmentId());
                    if (assessment.isPresent()) {
                        assessmentInfo.put("assessmentName", assessment.get().getAssessmentName());
                        assessmentInfo.put("isActive", assessment.get().getIsActive());
                    } else {
                        assessmentInfo.put("assessmentName", "Unknown Assessment");
                        assessmentInfo.put("isActive", false);
                    }

                    assessmentsList.add(assessmentInfo);
                }

                HashMap<String, Object> response = new HashMap<>();
                response.put("userStudentId", userStudent.getUserStudentId());
                response.put("assessments", assessmentsList);
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

    @GetMapping(value = "user/registered-users")
    public List<Map<String, Object>> getRegisteredUsers() {
        List<User> users = userRepository.findByProviderNot(AuthProvider.custom_student);
        List<Map<String, Object>> result = new ArrayList<>();
        for (User u : users) {
            Map<String, Object> row = new HashMap<>();
            row.put("id", u.getId());
            row.put("name", u.getName());
            row.put("email", u.getEmail());
            row.put("phone", u.getPhone());
            row.put("organisation", u.getOrganisation());
            row.put("designation", u.getDesignation());
            row.put("isActive", u.getIsActive());
            row.put("provider", u.getProvider() != null ? u.getProvider().name() : null);
            if (u.getDobDate() != null) {
                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
                row.put("dob", sdf.format(u.getDobDate()));
            } else {
                row.put("dob", null);
            }
            result.add(row);
        }
        return result;
    }

    @PostMapping(value = "user/toggle-active/{id}")
    public ResponseEntity<?> toggleUserActive(@PathVariable("id") Long userId) {

        Optional<User> optionalUser = userRepository.findById(userId);
        if (!optionalUser.isPresent()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, "User not found"));
        }
        User user = optionalUser.get();
        boolean newStatus = !(user.getIsActive() != null && user.getIsActive());
        user.setIsActive(newStatus);

        try {
            userRepository.save(user);
            String subject = "Congratulations! Account Activated";
            // Send email notification
            smtpEmailService.sendSimpleEmail(user.getEmail(), subject,
                    "Your Dashboard account has been activated.\nYou can login at https://dashboard.career-9.com using your registered email and password.\n\nBest regards,\nCareer-9 Team");
        } catch (Exception e) {
        }
        return ResponseEntity.ok(new ApiResponse(true, newStatus ? "User activated" : "User deactivated"));
    }

    @PutMapping(value = "user/update-details/{id}")
    public ResponseEntity<?> updateUserDetails(@PathVariable("id") Long userId, @RequestBody Map<String, Object> body) {
        Optional<User> optionalUser = userRepository.findById(userId);
        if (!optionalUser.isPresent()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, "User not found"));
        }
        User user = optionalUser.get();

        if (body.containsKey("name"))
            user.setName((String) body.get("name"));
        if (body.containsKey("email"))
            user.setEmail((String) body.get("email"));
        if (body.containsKey("phone"))
            user.setPhone((String) body.get("phone"));
        if (body.containsKey("organisation"))
            user.setOrganisation((String) body.get("organisation"));
        if (body.containsKey("designation"))
            user.setDesignation((String) body.get("designation"));
        if (body.containsKey("isActive"))
            user.setIsActive((Boolean) body.get("isActive"));
        if (body.containsKey("dob") && body.get("dob") != null) {
            try {
                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
                user.setDobDate(sdf.parse((String) body.get("dob")));
            } catch (Exception e) {
                return ResponseEntity.status(org.springframework.http.HttpStatus.BAD_REQUEST)
                        .body(new ApiResponse(false, "Invalid date format. Use yyyy-MM-dd"));
            }
        }

        userRepository.save(user);
        return ResponseEntity.ok(new ApiResponse(true, "User details updated successfully"));
    }
}