package com.kccitm.api.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.ContactPerson;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;
import com.kccitm.api.model.ContactPersonAccessLevel;
import com.kccitm.api.model.StudentContactAssignment;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.repository.ContactPersonAccessLevelRepository;
import com.kccitm.api.repository.ContactPersonRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.repository.StudentContactAssignmentRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.School.SchoolSectionsRepository;
import com.kccitm.api.service.OdooEmailService;

@RestController
@RequestMapping("/contact-person")
public class ContactPersonController {

    @Autowired
    private ContactPersonRepository contactPersonRepository;

    @Autowired
    private ContactPersonAccessLevelRepository accessLevelRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private InstituteDetailRepository instituteDetailRepository;

    @Autowired
    private StudentContactAssignmentRepository studentContactAssignmentRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private SchoolSectionsRepository schoolSectionsRepository;

    @Autowired
    private OdooEmailService odooEmailService;

    // ============ EXISTING ENDPOINTS ============

    @GetMapping("/getAll")
    public ResponseEntity<List<ContactPerson>> getAllContactPersons() {
        List<ContactPerson> list = contactPersonRepository.findAll();
        return ResponseEntity.ok(list);
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<ContactPerson> getContactPersonById(@PathVariable("id") Long contactPersonId) {
        ContactPerson contactPerson = contactPersonRepository.findById(contactPersonId)
                .orElseThrow(() -> new ResourceNotFoundException("ContactPerson", "id", contactPersonId));
        return ResponseEntity.ok(contactPerson);
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<Void> deleteContactPerson(@PathVariable("id") Long id) {
        if (!contactPersonRepository.existsById(id)) {
            throw new ResourceNotFoundException("ContactPerson", "id", id);
        }
        contactPersonRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/create")
    public ContactPerson createContactPerson(@RequestBody ContactPerson contactPerson) {
        return contactPersonRepository.save(contactPerson);
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<?> updateContactPerson(@PathVariable Long id, @RequestBody ContactPerson body) {
        Optional<ContactPerson> opt = contactPersonRepository.findById(id);
        if (!opt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("ContactPerson not found");
        }

        ContactPerson existing = opt.get();

        existing.setName(body.getName());
        existing.setEmail(body.getEmail());
        existing.setPhoneNumber(body.getPhoneNumber());
        existing.setDesignation(body.getDesignation());
        existing.setGender(body.getGender());

        ContactPerson saved = contactPersonRepository.save(existing);
        return ResponseEntity.ok(saved);
    }

    // ============ USER-TO-COLLEGE MAPPING ENDPOINTS ============

    /**
     * Map a registered user as a contact person for an institute.
     * Auto-populates name, email, phone, designation from the User entity.
     */
    @PostMapping("/map-to-college")
    public ResponseEntity<?> mapUserToCollege(@RequestBody Map<String, Object> payload) {
        Long userId = payload.get("userId") != null ? ((Number) payload.get("userId")).longValue() : null;
        Integer instituteCode = payload.get("instituteCode") != null
                ? ((Number) payload.get("instituteCode")).intValue()
                : null;

        if (userId == null || instituteCode == null) {
            return ResponseEntity.badRequest().body("userId and instituteCode are required");
        }

        // Check if already mapped
        Optional<ContactPerson> existing = contactPersonRepository
                .findByUserIdAndInstitute_InstituteCode(userId, instituteCode);
        if (existing.isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("User is already mapped to this institute");
        }

        // Lookup user
        Optional<User> userOpt = userRepository.findById(userId);
        if (!userOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        // Lookup institute
        InstituteDetail institute = instituteDetailRepository.findById(instituteCode.intValue());
        if (institute == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Institute not found");
        }

        User user = userOpt.get();

        ContactPerson cp = new ContactPerson();
        cp.setUserId(userId);
        cp.setName(user.getName());
        cp.setEmail(user.getEmail());
        cp.setPhoneNumber(user.getPhone());
        cp.setDesignation(user.getDesignation());
        cp.setInstitute(institute);

        ContactPerson saved = contactPersonRepository.save(cp);

        // Return with institute info
        Map<String, Object> result = buildContactPersonResponse(saved);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    /**
     * Get all college mappings for a user (with access levels for each).
     */
    @GetMapping("/by-user/{userId}")
    public ResponseEntity<?> getUserCollegeMappings(@PathVariable Long userId) {
        List<ContactPerson> contacts = contactPersonRepository.findByUserId(userId);
        List<Map<String, Object>> result = new ArrayList<>();

        for (ContactPerson cp : contacts) {
            Map<String, Object> entry = buildContactPersonResponse(cp);
            List<ContactPersonAccessLevel> levels = accessLevelRepository.findByContactPersonId(cp.getId());
            entry.put("accessLevels", levels);
            result.add(entry);
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Unmap a user from a college. Deletes the ContactPerson and all its access levels.
     */
    @DeleteMapping("/unmap/{contactPersonId}")
    public ResponseEntity<?> unmapUserFromCollege(@PathVariable Long contactPersonId) {
        if (!contactPersonRepository.existsById(contactPersonId)) {
            throw new ResourceNotFoundException("ContactPerson", "id", contactPersonId);
        }

        // Delete access levels first
        accessLevelRepository.deleteByContactPersonId(contactPersonId);
        // Delete contact person
        contactPersonRepository.deleteById(contactPersonId);

        return ResponseEntity.noContent().build();
    }

    // ============ ACCESS LEVEL ENDPOINTS ============

    /**
     * Create an access level entry for a contact person.
     */
    @PostMapping("/access-level/create")
    public ResponseEntity<?> createAccessLevel(@RequestBody ContactPersonAccessLevel accessLevel) {
        if (accessLevel.getContactPersonId() == null) {
            return ResponseEntity.badRequest().body("contactPersonId is required");
        }

        if (!contactPersonRepository.existsById(accessLevel.getContactPersonId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("ContactPerson not found");
        }

        ContactPersonAccessLevel saved = accessLevelRepository.save(accessLevel);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * Get all access levels for a contact person.
     */
    @GetMapping("/access-level/by-contact/{contactPersonId}")
    public ResponseEntity<List<ContactPersonAccessLevel>> getAccessLevelsByContact(
            @PathVariable Long contactPersonId) {
        List<ContactPersonAccessLevel> levels = accessLevelRepository.findByContactPersonId(contactPersonId);
        return ResponseEntity.ok(levels);
    }

    /**
     * Delete a single access level entry.
     */
    @DeleteMapping("/access-level/delete/{id}")
    public ResponseEntity<Void> deleteAccessLevel(@PathVariable Long id) {
        if (!accessLevelRepository.existsById(id)) {
            throw new ResourceNotFoundException("ContactPersonAccessLevel", "id", id);
        }
        accessLevelRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ============ INSTITUTE CONTACT PERSONS ============

    /**
     * Get all contact persons for a given institute.
     */
    @GetMapping("/by-institute/{instituteCode}")
    public ResponseEntity<List<Map<String, Object>>> getByInstitute(
            @PathVariable int instituteCode) {
        List<ContactPerson> contacts = contactPersonRepository.findByInstitute_InstituteCode(instituteCode);
        List<Map<String, Object>> result = new ArrayList<>();
        for (ContactPerson cp : contacts) {
            result.add(buildContactPersonResponse(cp));
        }
        return ResponseEntity.ok(result);
    }

    // ============ STUDENT GROUPING ============

    /**
     * Assign a list of students to a contact person and notify them via email.
     * Body: { contactPersonId, userStudentIds: [Long...], instituteId }
     */
    @PostMapping("/assign-students")
    public ResponseEntity<?> assignStudents(@RequestBody Map<String, Object> payload) {
        Long contactPersonId = payload.get("contactPersonId") != null
                ? ((Number) payload.get("contactPersonId")).longValue() : null;
        Integer instituteId = payload.get("instituteId") != null
                ? ((Number) payload.get("instituteId")).intValue() : null;

        @SuppressWarnings("unchecked")
        List<Integer> rawIds = (List<Integer>) payload.get("userStudentIds");

        if (contactPersonId == null || rawIds == null || rawIds.isEmpty()) {
            return ResponseEntity.badRequest().body("contactPersonId and userStudentIds are required");
        }

        Optional<ContactPerson> cpOpt = contactPersonRepository.findById(contactPersonId);
        if (!cpOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("ContactPerson not found");
        }
        ContactPerson cp = cpOpt.get();

        // Save assignment records
        List<Long> userStudentIds = new ArrayList<>();
        for (Integer id : rawIds) {
            userStudentIds.add(id.longValue());
        }

        List<StudentContactAssignment> assignments = new ArrayList<>();
        for (Long userStudentId : userStudentIds) {
            StudentContactAssignment sca = new StudentContactAssignment(userStudentId, contactPersonId, instituteId);
            assignments.add(sca);
        }
        studentContactAssignmentRepository.saveAll(assignments);

        // Build student names list for email
        StringBuilder studentListHtml = new StringBuilder("<ul>");
        for (Long userStudentId : userStudentIds) {
            String name = userStudentRepository.getNameByUserID(userStudentId);
            studentListHtml.append("<li>").append(name != null ? name : "Student #" + userStudentId).append("</li>");
        }
        studentListHtml.append("</ul>");

        // Send email notification to contact person
        if (cp.getEmail() != null && !cp.getEmail().isEmpty()) {
            String instituteName = (cp.getInstitute() != null) ? cp.getInstitute().getInstituteName() : "your school";
            String subject = "Students Assigned to You – " + instituteName;
            String htmlBody = "<p>Dear " + (cp.getName() != null ? cp.getName() : "Contact Person") + ",</p>"
                    + "<p>The following " + userStudentIds.size() + " student(s) from <strong>" + instituteName
                    + "</strong> have been assigned to you as their admin:</p>"
                    + studentListHtml
                    + "<p>You can now contact these students and send them emails through the Odoo service.</p>"
                    + "<p>This is an automated notification from Career-9.</p>";
            odooEmailService.sendHtmlEmail(cp.getEmail(), subject, htmlBody);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Students assigned successfully");
        response.put("assignedCount", assignments.size());
        response.put("contactPersonName", cp.getName());
        return ResponseEntity.ok(response);
    }

    // ============ ASSIGNED STUDENTS ============

    /**
     * Get all students assigned to a contact person.
     * Returns basic student info for each assignment.
     */
    @GetMapping("/{contactPersonId}/assigned-students")
    public ResponseEntity<?> getAssignedStudents(@PathVariable Long contactPersonId) {
        if (!contactPersonRepository.existsById(contactPersonId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("ContactPerson not found");
        }

        List<StudentContactAssignment> assignments = studentContactAssignmentRepository.findByContactPersonId(contactPersonId);
        List<Map<String, Object>> result = new ArrayList<>();

        for (StudentContactAssignment sca : assignments) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("assignmentId", sca.getId());
            entry.put("userStudentId", sca.getUserStudentId());
            entry.put("instituteId", sca.getInstituteId());
            entry.put("assignedAt", sca.getAssignedAt());

            // Fetch student info via UserStudentRepository
            userStudentRepository.findById(sca.getUserStudentId()).ifPresent(us -> {
                if (us.getStudentInfo() != null) {
                    entry.put("name", us.getStudentInfo().getName());
                    entry.put("schoolRollNumber", us.getStudentInfo().getSchoolRollNumber());
                    entry.put("controlNumber", us.getStudentInfo().getControlNumber());
                    entry.put("phoneNumber", us.getStudentInfo().getPhoneNumber());
                    entry.put("email", us.getStudentInfo().getEmail());
                    entry.put("studentDob", us.getStudentInfo().getStudentDob());

                    // Resolve section name and class name from schoolSectionId
                    Integer sectionId = us.getStudentInfo().getSchoolSectionId();
                    if (sectionId != null) {
                        schoolSectionsRepository.findById(sectionId).ifPresent(sec -> {
                            entry.put("sectionName", sec.getSectionName());
                            if (sec.getSchoolClasses() != null) {
                                entry.put("className", sec.getSchoolClasses().getClassName());
                            }
                        });
                    }
                }
                if (us.getStudentInfo() != null && us.getStudentInfo().getUser() != null) {
                    entry.put("username", us.getStudentInfo().getUser().getUsername());
                }
            });

            result.add(entry);
        }

        return ResponseEntity.ok(result);
    }

    // ============ EMAIL RECIPIENTS FOR STUDENT ============

    /**
     * Get all email recipients related to a student:
     * 1. Student's own email
     * 2. Contact persons directly assigned to this student
     * 3. All contact persons of the student's institute
     */
    @Transactional(readOnly = true)
    @GetMapping("/email-recipients/{userStudentId}")
    public ResponseEntity<?> getEmailRecipients(@PathVariable Long userStudentId) {
        // Get student info
        var userStudentOpt = userStudentRepository.findById(userStudentId);
        if (!userStudentOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Student not found");
        }
        var userStudent = userStudentOpt.get();

        List<Map<String, Object>> recipients = new ArrayList<>();
        java.util.Set<String> addedEmails = new java.util.HashSet<>();

        // 1. Student email (try StudentInfo.email first, then User.email as fallback)
        if (userStudent.getStudentInfo() != null) {
            String studentEmail = userStudent.getStudentInfo().getEmail();
            String studentName = userStudent.getStudentInfo().getName();

            // Fallback to User email if StudentInfo email is empty
            if ((studentEmail == null || studentEmail.isEmpty()) && userStudent.getStudentInfo().getUser() != null) {
                studentEmail = userStudent.getStudentInfo().getUser().getEmail();
            }
            // Fallback name from User if needed
            if ((studentName == null || studentName.isEmpty()) && userStudent.getStudentInfo().getUser() != null) {
                studentName = userStudent.getStudentInfo().getUser().getName();
            }

            if (studentEmail != null && !studentEmail.isEmpty()) {
                Map<String, Object> entry = new HashMap<>();
                entry.put("email", studentEmail);
                entry.put("name", studentName != null ? studentName : "Student");
                entry.put("role", "Student");
                recipients.add(entry);
                addedEmails.add(studentEmail.toLowerCase());
            }
        }

        // 2. Contact persons assigned to this student
        List<StudentContactAssignment> assignments = studentContactAssignmentRepository.findByUserStudentId(userStudentId);
        java.util.Set<Long> addedContactPersonIds = new java.util.HashSet<>();
        for (StudentContactAssignment sca : assignments) {
            Long cpId = sca.getContactPersonId();
            if (cpId != null && !addedContactPersonIds.contains(cpId)) {
                contactPersonRepository.findById(cpId).ifPresent(cp -> {
                    if (cp.getEmail() != null && !cp.getEmail().isEmpty()
                            && !addedEmails.contains(cp.getEmail().toLowerCase())) {
                        Map<String, Object> entry = new HashMap<>();
                        entry.put("email", cp.getEmail());
                        entry.put("name", cp.getName() != null ? cp.getName() : "Contact Person");
                        entry.put("role", "Assigned Contact Person");
                        entry.put("designation", cp.getDesignation());
                        recipients.add(entry);
                        addedEmails.add(cp.getEmail().toLowerCase());
                    }
                });
                addedContactPersonIds.add(cpId);
            }
        }

        // 3. All contact persons of the student's institute
        if (userStudent.getInstitute() != null) {
            int instituteCode = userStudent.getInstitute().getInstituteCode();
            List<ContactPerson> allCps = contactPersonRepository.findByInstitute_InstituteCode(instituteCode);
            for (ContactPerson cp : allCps) {
                if (!addedContactPersonIds.contains(cp.getId())
                        && cp.getEmail() != null && !cp.getEmail().isEmpty()
                        && !addedEmails.contains(cp.getEmail().toLowerCase())) {
                    Map<String, Object> entry = new HashMap<>();
                    entry.put("email", cp.getEmail());
                    entry.put("name", cp.getName() != null ? cp.getName() : "Contact Person");
                    entry.put("role", "School Contact Person");
                    entry.put("designation", cp.getDesignation());
                    recipients.add(entry);
                    addedContactPersonIds.add(cp.getId());
                    addedEmails.add(cp.getEmail().toLowerCase());
                }
            }
        }

        return ResponseEntity.ok(recipients);
    }

    // ============ SEND REPORT EMAIL ============

    /**
     * Send a report email to selected recipients.
     * Body: { emails: [String...], subject: String, htmlContent: String, fromName: String (optional) }
     */
    @PostMapping("/send-report-email")
    public ResponseEntity<?> sendReportEmail(@RequestBody Map<String, Object> payload) {
        @SuppressWarnings("unchecked")
        List<String> emails = (List<String>) payload.get("emails");
        String subject = (String) payload.get("subject");
        String htmlContent = (String) payload.get("htmlContent");
        String fromName = (String) payload.get("fromName");

        if (emails == null || emails.isEmpty()) {
            return ResponseEntity.badRequest().body("At least one email is required");
        }
        if (subject == null || subject.isEmpty()) {
            return ResponseEntity.badRequest().body("Subject is required");
        }
        if (htmlContent == null || htmlContent.isEmpty()) {
            return ResponseEntity.badRequest().body("Email content is required");
        }

        SmtpEmailRequest request = new SmtpEmailRequest();
        request.setTo(emails);
        request.setSubject(subject);
        request.setHtmlContent(htmlContent);
        request.setFromName(fromName != null && !fromName.isEmpty() ? fromName : "Career-9");
        request.setFromEmail("notifications@career-9.com");
        odooEmailService.sendEmail(request);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Email sent successfully");
        response.put("recipientCount", emails.size());
        return ResponseEntity.ok(response);
    }

    // ============ HELPERS ============

    private Map<String, Object> buildContactPersonResponse(ContactPerson cp) {
        Map<String, Object> entry = new HashMap<>();
        entry.put("id", cp.getId());
        entry.put("userId", cp.getUserId());
        entry.put("name", cp.getName());
        entry.put("email", cp.getEmail());
        entry.put("phoneNumber", cp.getPhoneNumber());
        entry.put("designation", cp.getDesignation());
        entry.put("gender", cp.getGender());

        if (cp.getInstitute() != null) {
            Map<String, Object> inst = new HashMap<>();
            inst.put("instituteCode", cp.getInstitute().getInstituteCode());
            inst.put("instituteName", cp.getInstitute().getInstituteName());
            entry.put("institute", inst);
        }

        return entry;
    }
}
