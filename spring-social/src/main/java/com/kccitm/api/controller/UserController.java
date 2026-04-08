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
import com.kccitm.api.exception.ServiceException;
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
import com.kccitm.api.service.dashboard.StudentDashboardDataService;
import com.kccitm.api.model.userDefinedModel.StudentDashboardResponse;
import com.kccitm.api.model.userDefinedModel.StudentPortalComputedData;

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

    @Autowired
    private StudentDashboardDataService studentDashboardDataService;

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

    /**
     * Student auth for dashboard: authenticates with username + DOB and returns
     * full dashboard data (profile + assessment scores) in a single response.
     */
    @PostMapping(value = "user/student-auth", headers = "Accept=application/json")
    public ResponseEntity<?> studentDashboardAuth(@RequestBody User currentUser) {
        Optional<User> userOpt = userRepository.findByUsernameAndDobDate(
                currentUser.getUsername(), currentUser.getDobDate());

        if (!userOpt.isPresent()) {
            return ResponseEntity.status(401).body(Map.of(
                    "error", "Invalid credentials",
                    "message", "Username or date of birth is incorrect"));
        }

        User user = userOpt.get();
        Optional<UserStudent> userStudentOpt = userStudentRepository.getByUserId(user.getId());

        if (!userStudentOpt.isPresent()) {
            return ResponseEntity.status(404).body(Map.of(
                    "error", "Student not found",
                    "message", "No student record found for this user"));
        }

        UserStudent userStudent = userStudentOpt.get();
        Long userStudentId = userStudent.getUserStudentId();

        // Build student profile info
        Map<String, Object> profile = new HashMap<>();
        profile.put("userStudentId", userStudentId);
        profile.put("infoCompleted", Boolean.TRUE.equals(userStudent.getInfoCompleted()));

        // Fields from User entity
        profile.put("username", user.getUsername());
        profile.put("email", user.getEmail());
        profile.put("phone", user.getPhone());
        profile.put("careerNineRollNumber", user.getCareerNineRollNumber());

        if (user.getDobDate() != null) {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("dd-MM-yyyy");
            profile.put("dob", sdf.format(user.getDobDate()));
        }

        if (userStudent.getStudentInfo() != null) {
            profile.put("name", userStudent.getStudentInfo().getName());
            profile.put("grade", userStudent.getStudentInfo().getStudentClass());
            profile.put("section", userStudent.getStudentInfo().getSchoolSectionId());
            profile.put("schoolBoard", userStudent.getStudentInfo().getSchoolBoard());
            profile.put("gender", userStudent.getStudentInfo().getGender());
        }

        if (userStudent.getInstitute() != null) {
            profile.put("instituteName", userStudent.getInstitute().getInstituteName());
            profile.put("instituteCode", userStudent.getInstitute().getInstituteCode());
        }

        // Build full dashboard data (assessment scores, answers, raw scores)
        StudentDashboardResponse dashboardData = studentDashboardDataService
                .buildDashboardData(userStudentId);

        Map<String, Object> response = new HashMap<>();
        response.put("profile", profile);
        response.put("dashboardData", dashboardData);

        return ResponseEntity.ok(response);
    }

    /**
     * Update student profile info (name, email, phone).
     * Auto-generates careerNineRollNumber if missing.
     * Sets infoCompleted = true on success.
     */
    @PutMapping(value = "student-portal/update-info/{userStudentId}")
    public ResponseEntity<?> updateStudentInfo(
            @PathVariable Long userStudentId,
            @RequestBody Map<String, String> body) {
        UserStudent userStudent = userStudentRepository.findById(userStudentId)
                .orElseThrow(() -> new ResourceNotFoundException("UserStudent", "id", userStudentId));

        User user = userRepository.findById(userStudent.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userStudent.getUserId()));

        String name = body.get("name");
        String email = body.get("email");
        String phone = body.get("phone");

        // Validate required fields
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name is required"));
        }
        if (email == null || !email.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Valid email is required"));
        }
        if (phone == null || !phone.matches("^[6-9]\\d{9}$")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Valid 10-digit Indian phone number is required"));
        }

        // Update User entity
        user.setName(name.trim());
        user.setEmail(email.trim());
        user.setPhone(phone.trim());

        // Update StudentInfo entity
        if (userStudent.getStudentInfo() != null) {
            userStudent.getStudentInfo().setName(name.trim());
            userStudent.getStudentInfo().setEmail(email.trim());
            userStudent.getStudentInfo().setPhoneNumber(phone.trim());
        }

        // Generate careerNineRollNumber if missing
        if (user.getCareerNineRollNumber() == null || user.getCareerNineRollNumber().trim().isEmpty()) {
            String rollNumber = generateRollNumber(userStudent);
            user.setCareerNineRollNumber(rollNumber);
        }

        // Mark info as completed
        userStudent.setInfoCompleted(true);

        userRepository.save(user);
        userStudentRepository.save(userStudent);

        // Return updated profile
        Map<String, Object> profile = new HashMap<>();
        profile.put("userStudentId", userStudentId);
        profile.put("name", user.getName());
        profile.put("email", user.getEmail());
        profile.put("phone", user.getPhone());
        profile.put("careerNineRollNumber", user.getCareerNineRollNumber());
        profile.put("infoCompleted", true);

        if (userStudent.getStudentInfo() != null) {
            profile.put("grade", userStudent.getStudentInfo().getStudentClass());
            profile.put("section", userStudent.getStudentInfo().getSchoolSectionId());
            profile.put("schoolBoard", userStudent.getStudentInfo().getSchoolBoard());
            profile.put("gender", userStudent.getStudentInfo().getGender());
        }
        if (userStudent.getInstitute() != null) {
            profile.put("instituteName", userStudent.getInstitute().getInstituteName());
            profile.put("instituteCode", userStudent.getInstitute().getInstituteCode());
        }
        if (user.getDobDate() != null) {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("dd-MM-yyyy");
            profile.put("dob", sdf.format(user.getDobDate()));
        }
        profile.put("username", user.getUsername());

        return ResponseEntity.ok(profile);
    }

    /**
     * Generate a unique Career-9 roll number for a student.
     * Format: C9-{class}-{section}-{seq:04d}
     * Uniqueness scoped by institute + class + section.
     */
    private String generateRollNumber(UserStudent userStudent) {
        Integer studentClass = null;
        Integer sectionId = null;
        Integer instituteId = null;

        if (userStudent.getStudentInfo() != null) {
            studentClass = userStudent.getStudentInfo().getStudentClass();
            sectionId = userStudent.getStudentInfo().getSchoolSectionId();
            instituteId = userStudent.getStudentInfo().getInstituteId();
        }

        // Fallbacks
        if (studentClass == null) studentClass = 0;
        if (sectionId == null) sectionId = 0;
        if (instituteId == null && userStudent.getInstitute() != null) {
            instituteId = userStudent.getInstitute().getInstituteCode();
        }
        if (instituteId == null) instituteId = 0;

        String prefix = "C9-" + studentClass + "-" + sectionId + "-";

        // Find all existing roll numbers for this class+section+institute
        List<String> existing = userRepository.findRollNumbersByClassAndSection(
                instituteId, studentClass, sectionId);

        // Parse the max sequence from existing roll numbers
        int maxSeq = 0;
        for (String rn : existing) {
            if (rn != null && rn.startsWith(prefix)) {
                try {
                    int seq = Integer.parseInt(rn.substring(prefix.length()));
                    maxSeq = Math.max(maxSeq, seq);
                } catch (NumberFormatException e) {
                    // skip non-standard roll numbers
                }
            }
        }

        return prefix + String.format("%04d", maxSeq + 1);
    }

    /**
     * Returns pre-computed student portal data: pillar scores, career matches,
     * CCI level, insight text, and trait tags.
     */
    @GetMapping(value = "student-portal/computed/{userStudentId}")
    public ResponseEntity<?> getComputedPortalData(@PathVariable Long userStudentId) {
        StudentPortalComputedData data = studentDashboardDataService.computePortalData(userStudentId);
        return ResponseEntity.ok(data);
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
            // Include userRoleGroupMappings so the frontend can display assigned roles
            List<Map<String, Object>> mappings = new ArrayList<>();
            if (u.getUserRoleGroupMappings() != null) {
                for (UserRoleGroupMapping mapping : u.getUserRoleGroupMappings()) {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", mapping.getId());
                    if (mapping.getRoleGroup() != null) {
                        Map<String, Object> rg = new HashMap<>();
                        rg.put("id", mapping.getRoleGroup().getId());
                        rg.put("name", mapping.getRoleGroup().getName());
                        m.put("roleGroup", rg);
                    }
                    mappings.add(m);
                }
            }
            row.put("userRoleGroupMappings", mappings);
            result.add(row);
        }
        return result;
    }

    @PostMapping(value = "user/toggle-active/{id}")
    public ResponseEntity<?> toggleUserActive(@PathVariable("id") Long userId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
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
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

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