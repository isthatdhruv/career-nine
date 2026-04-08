package com.kccitm.api.controller;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

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
import com.kccitm.api.model.career9.BetReportData;
import com.kccitm.api.model.career9.NavigatorReportData;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.repository.ContactPersonAccessLevelRepository;
import com.kccitm.api.repository.ContactPersonRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.repository.StudentContactAssignmentRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.BetReportDataRepository;
import com.kccitm.api.repository.Career9.NavigatorReportDataRepository;
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

    @Autowired
    private NavigatorReportDataRepository navigatorReportDataRepository;

    @Autowired
    private BetReportDataRepository betReportDataRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

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
    public ResponseEntity<?> createContactPerson(
            @RequestBody ContactPerson contactPerson,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Integer instituteCode) {
        if (instituteCode != null) {
            InstituteDetail institute = instituteDetailRepository.findById(instituteCode.intValue());
            if (institute == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Institute not found");
            }
            contactPerson.setInstitute(institute);
        }
        ContactPerson saved = contactPersonRepository.save(contactPerson);
        return ResponseEntity.ok(saved);
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
     * 1. Student's own email (from StudentInfo, fallback to User)
     * 2. Contact persons directly assigned to this student
     * 3. All contact persons of the student's institute
     */
    @Transactional(readOnly = true)
    @GetMapping("/email-recipients/{userStudentId}")
    public ResponseEntity<?> getEmailRecipients(@PathVariable Long userStudentId) {
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

            if ((studentEmail == null || studentEmail.isEmpty()) && userStudent.getStudentInfo().getUser() != null) {
                studentEmail = userStudent.getStudentInfo().getUser().getEmail();
            }
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

    // ============ SEND REPORTS TO CONTACT PERSON ============

    /**
     * Download student reports from DO Spaces, bundle them into a ZIP file,
     * and email the ZIP as an attachment to the contact person.
     * Body: { contactPersonId, assessmentId, reportType: "navigator" | "bet" }
     */
    @PostMapping("/send-reports")
    public ResponseEntity<?> sendReportsToContactPerson(@RequestBody Map<String, Object> payload) {
        Long contactPersonId = payload.get("contactPersonId") != null
                ? ((Number) payload.get("contactPersonId")).longValue() : null;
        Long assessmentId = payload.get("assessmentId") != null
                ? ((Number) payload.get("assessmentId")).longValue() : null;
        String reportType = payload.get("reportType") != null
                ? payload.get("reportType").toString() : null;

        if (contactPersonId == null || assessmentId == null || reportType == null) {
            return ResponseEntity.badRequest().body("contactPersonId, assessmentId, and reportType are required");
        }

        Optional<ContactPerson> cpOpt = contactPersonRepository.findById(contactPersonId);
        if (!cpOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("ContactPerson not found");
        }
        ContactPerson cp = cpOpt.get();

        if (cp.getEmail() == null || cp.getEmail().isEmpty()) {
            return ResponseEntity.badRequest().body("Contact person does not have an email address");
        }

        // Get students assigned to this contact person
        List<StudentContactAssignment> assignments = studentContactAssignmentRepository
                .findByContactPersonId(contactPersonId);
        if (assignments.isEmpty()) {
            return ResponseEntity.badRequest().body("No students assigned to this contact person");
        }

        List<Long> studentIds = new ArrayList<>();
        for (StudentContactAssignment sca : assignments) {
            studentIds.add(sca.getUserStudentId());
        }

        // Collect report URLs based on report type
        List<Map<String, String>> reportEntries = new ArrayList<>();
        int noReportCount = 0;

        if ("navigator".equalsIgnoreCase(reportType)) {
            for (Long studentId : studentIds) {
                Optional<NavigatorReportData> reportOpt = navigatorReportDataRepository
                        .findByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId);
                if (reportOpt.isPresent() && reportOpt.get().getReportUrl() != null
                        && !reportOpt.get().getReportUrl().isEmpty()) {
                    NavigatorReportData report = reportOpt.get();
                    Map<String, String> entry = new HashMap<>();
                    entry.put("studentName", report.getStudentName() != null ? report.getStudentName() : "Student_" + studentId);
                    entry.put("reportUrl", report.getReportUrl());
                    reportEntries.add(entry);
                } else {
                    noReportCount++;
                }
            }
        } else if ("bet".equalsIgnoreCase(reportType)) {
            for (Long studentId : studentIds) {
                Optional<BetReportData> reportOpt = betReportDataRepository
                        .findByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId);
                if (reportOpt.isPresent() && reportOpt.get().getReportUrl() != null
                        && !reportOpt.get().getReportUrl().isEmpty()) {
                    BetReportData report = reportOpt.get();
                    Map<String, String> entry = new HashMap<>();
                    entry.put("studentName", report.getStudentName() != null ? report.getStudentName() : "Student_" + studentId);
                    entry.put("reportUrl", report.getReportUrl());
                    reportEntries.add(entry);
                } else {
                    noReportCount++;
                }
            }
        } else {
            return ResponseEntity.badRequest().body("reportType must be 'navigator' or 'bet'");
        }

        if (reportEntries.isEmpty()) {
            return ResponseEntity.badRequest().body("No generated reports found for the assigned students in this assessment");
        }

        String reportTypeLabel = "navigator".equalsIgnoreCase(reportType) ? "Navigator" : "BET";
        String instituteName = (cp.getInstitute() != null) ? cp.getInstitute().getInstituteName() : "your school";

        // Download each report from DO Spaces and build a ZIP in memory
        ByteArrayOutputStream zipBaos = new ByteArrayOutputStream();
        int downloadedCount = 0;
        List<String> failedDownloads = new ArrayList<>();

        try (ZipOutputStream zipOut = new ZipOutputStream(zipBaos)) {
            for (Map<String, String> entry : reportEntries) {
                String studentName = entry.get("studentName").replaceAll("[^a-zA-Z0-9_\\- ]", "").trim();
                String reportUrl = entry.get("reportUrl");
                String fileName = studentName.replaceAll("\\s+", "_") + "_" + reportTypeLabel + "_Report.html";

                try {
                    URL url = new URL(reportUrl);
                    try (InputStream in = url.openStream()) {
                        zipOut.putNextEntry(new ZipEntry(fileName));
                        byte[] buffer = new byte[8192];
                        int bytesRead;
                        while ((bytesRead = in.read(buffer)) != -1) {
                            zipOut.write(buffer, 0, bytesRead);
                        }
                        zipOut.closeEntry();
                        downloadedCount++;
                    }
                } catch (Exception e) {
                    failedDownloads.add(entry.get("studentName"));
                }
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to create ZIP file: " + e.getMessage());
        }

        if (downloadedCount == 0) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Could not download any report files from storage");
        }

        // Get assessment name
        String assessmentName = "Assessment";
        Optional<com.kccitm.api.model.career9.AssessmentTable> oldAssessmentOpt = assessmentTableRepository.findById(assessmentId);
        if (oldAssessmentOpt.isPresent()) {
            assessmentName = oldAssessmentOpt.get().getAssessmentName();
        }

        // Build email body
        String contactName = cp.getName() != null ? cp.getName() : "Contact Person";
        String htmlContent = buildReportEmailHtml(
                contactName, instituteName, assessmentName, reportTypeLabel,
                downloadedCount, noReportCount, reportEntries, failedDownloads
        );

        // Send email with ZIP attachment
        String subject = reportTypeLabel + " Reports | " + assessmentName + " | " + instituteName + " – Career-9";
        String zipFileName = reportTypeLabel + "_Reports_" + instituteName.replaceAll("[^a-zA-Z0-9]", "_") + ".zip";

        SmtpEmailRequest emailRequest = new SmtpEmailRequest();
        emailRequest.setTo(Arrays.asList(cp.getEmail()));
        emailRequest.setSubject(subject);
        emailRequest.setHtmlContent(htmlContent);
        emailRequest.setAttachments(Arrays.asList(
                new SmtpEmailRequest.EmailAttachment(zipFileName, zipBaos.toByteArray(), "application/zip")
        ));
        odooEmailService.sendEmail(emailRequest);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Reports ZIP sent successfully to " + cp.getEmail());
        response.put("reportsSent", downloadedCount);
        response.put("reportsNotAvailable", noReportCount);
        response.put("downloadFailed", failedDownloads.size());
        response.put("contactPersonName", cp.getName());
        response.put("contactPersonEmail", cp.getEmail());
        return ResponseEntity.ok(response);
    }

    /**
     * Get report availability for students assigned to a contact person.
     * Returns which students have generated reports for a given assessment.
     */
    @GetMapping("/{contactPersonId}/report-status/{assessmentId}")
    public ResponseEntity<?> getReportStatus(
            @PathVariable Long contactPersonId,
            @PathVariable Long assessmentId,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "navigator") String reportType) {

        if (!contactPersonRepository.existsById(contactPersonId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("ContactPerson not found");
        }

        List<StudentContactAssignment> assignments = studentContactAssignmentRepository
                .findByContactPersonId(contactPersonId);

        List<Map<String, Object>> result = new ArrayList<>();
        for (StudentContactAssignment sca : assignments) {
            Long studentId = sca.getUserStudentId();
            Map<String, Object> entry = new HashMap<>();
            entry.put("userStudentId", studentId);

            // Get student name
            String studentName = userStudentRepository.getNameByUserID(studentId);
            entry.put("studentName", studentName != null ? studentName : "Student #" + studentId);

            String reportUrl = null;
            String reportStatus = "notGenerated";

            if ("navigator".equalsIgnoreCase(reportType)) {
                Optional<NavigatorReportData> rOpt = navigatorReportDataRepository
                        .findByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId);
                if (rOpt.isPresent()) {
                    reportStatus = rOpt.get().getReportStatus();
                    reportUrl = rOpt.get().getReportUrl();
                }
            } else if ("bet".equalsIgnoreCase(reportType)) {
                Optional<BetReportData> rOpt = betReportDataRepository
                        .findByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId);
                if (rOpt.isPresent()) {
                    reportStatus = rOpt.get().getReportStatus();
                    reportUrl = rOpt.get().getReportUrl();
                }
            }

            entry.put("reportStatus", reportStatus);
            entry.put("reportUrl", reportUrl);
            entry.put("hasReport", reportUrl != null && !reportUrl.isEmpty());
            result.add(entry);
        }

        return ResponseEntity.ok(result);
    }

    // ============ INSTITUTE-BASED REPORT ENDPOINTS ============

    /**
     * Get report status for all students in an institute for a given assessment.
     */
    @GetMapping("/report-status-by-institute/{instituteCode}/{assessmentId}")
    public ResponseEntity<?> getReportStatusByInstitute(
            @PathVariable int instituteCode,
            @PathVariable Long assessmentId,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "navigator") String reportType) {

        List<com.kccitm.api.model.career9.UserStudent> students = userStudentRepository
                .findByInstituteInstituteCode(instituteCode);

        List<Map<String, Object>> result = new ArrayList<>();
        for (com.kccitm.api.model.career9.UserStudent us : students) {
            Long studentId = us.getUserStudentId();
            Map<String, Object> entry = new HashMap<>();
            entry.put("userStudentId", studentId);

            String studentName = userStudentRepository.getNameByUserID(studentId);
            entry.put("studentName", studentName != null ? studentName : "Student #" + studentId);

            String reportUrl = null;
            String reportStatus = "notGenerated";

            if ("navigator".equalsIgnoreCase(reportType)) {
                Optional<NavigatorReportData> rOpt = navigatorReportDataRepository
                        .findByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId);
                if (rOpt.isPresent()) {
                    reportStatus = rOpt.get().getReportStatus();
                    reportUrl = rOpt.get().getReportUrl();
                }
            } else if ("bet".equalsIgnoreCase(reportType)) {
                Optional<BetReportData> rOpt = betReportDataRepository
                        .findByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId);
                if (rOpt.isPresent()) {
                    reportStatus = rOpt.get().getReportStatus();
                    reportUrl = rOpt.get().getReportUrl();
                }
            }

            entry.put("reportStatus", reportStatus);
            entry.put("reportUrl", reportUrl);
            entry.put("hasReport", reportUrl != null && !reportUrl.isEmpty());
            result.add(entry);
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Send reports for all students in an institute (for a given assessment)
     * to a contact person via email as a ZIP file.
     * Body: { contactPersonId, instituteCode, assessmentId, reportType }
     */
    @PostMapping("/send-reports-by-institute")
    public ResponseEntity<?> sendReportsByInstitute(@RequestBody Map<String, Object> payload) {
        Long contactPersonId = payload.get("contactPersonId") != null
                ? ((Number) payload.get("contactPersonId")).longValue() : null;
        Integer instituteCode = payload.get("instituteCode") != null
                ? ((Number) payload.get("instituteCode")).intValue() : null;
        Long assessmentId = payload.get("assessmentId") != null
                ? ((Number) payload.get("assessmentId")).longValue() : null;
        String reportType = payload.get("reportType") != null
                ? payload.get("reportType").toString() : null;

        if (contactPersonId == null || instituteCode == null || assessmentId == null || reportType == null) {
            return ResponseEntity.badRequest().body("contactPersonId, instituteCode, assessmentId, and reportType are required");
        }

        Optional<ContactPerson> cpOpt = contactPersonRepository.findById(contactPersonId);
        if (!cpOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("ContactPerson not found");
        }
        ContactPerson cp = cpOpt.get();

        if (cp.getEmail() == null || cp.getEmail().isEmpty()) {
            return ResponseEntity.badRequest().body("Contact person does not have an email address");
        }

        // Get students - filter by selected IDs if provided
        @SuppressWarnings("unchecked")
        List<Integer> selectedStudentIds = (List<Integer>) payload.get("selectedStudentIds");

        List<com.kccitm.api.model.career9.UserStudent> students;
        if (selectedStudentIds != null && !selectedStudentIds.isEmpty()) {
            List<com.kccitm.api.model.career9.UserStudent> allStudents = userStudentRepository
                    .findByInstituteInstituteCode(instituteCode);
            java.util.Set<Long> selectedSet = new java.util.HashSet<>();
            for (Integer id : selectedStudentIds) {
                selectedSet.add(id.longValue());
            }
            students = new ArrayList<>();
            for (com.kccitm.api.model.career9.UserStudent us : allStudents) {
                if (selectedSet.contains(us.getUserStudentId())) {
                    students.add(us);
                }
            }
        } else {
            students = userStudentRepository.findByInstituteInstituteCode(instituteCode);
        }
        if (students.isEmpty()) {
            return ResponseEntity.badRequest().body("No students found for this institute");
        }

        // Collect report URLs
        List<Map<String, String>> reportEntries = new ArrayList<>();
        int noReportCount = 0;
        String reportTypeLabel = "navigator".equalsIgnoreCase(reportType) ? "Navigator" : "BET";

        for (com.kccitm.api.model.career9.UserStudent us : students) {
            Long studentId = us.getUserStudentId();

            if ("navigator".equalsIgnoreCase(reportType)) {
                Optional<NavigatorReportData> reportOpt = navigatorReportDataRepository
                        .findByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId);
                if (reportOpt.isPresent() && reportOpt.get().getReportUrl() != null
                        && !reportOpt.get().getReportUrl().isEmpty()) {
                    Map<String, String> entry = new HashMap<>();
                    entry.put("studentName", reportOpt.get().getStudentName() != null
                            ? reportOpt.get().getStudentName() : "Student_" + studentId);
                    entry.put("reportUrl", reportOpt.get().getReportUrl());
                    reportEntries.add(entry);
                } else {
                    noReportCount++;
                }
            } else if ("bet".equalsIgnoreCase(reportType)) {
                Optional<BetReportData> reportOpt = betReportDataRepository
                        .findByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId);
                if (reportOpt.isPresent() && reportOpt.get().getReportUrl() != null
                        && !reportOpt.get().getReportUrl().isEmpty()) {
                    Map<String, String> entry = new HashMap<>();
                    entry.put("studentName", reportOpt.get().getStudentName() != null
                            ? reportOpt.get().getStudentName() : "Student_" + studentId);
                    entry.put("reportUrl", reportOpt.get().getReportUrl());
                    reportEntries.add(entry);
                } else {
                    noReportCount++;
                }
            } else {
                return ResponseEntity.badRequest().body("reportType must be 'navigator' or 'bet'");
            }
        }

        if (reportEntries.isEmpty()) {
            return ResponseEntity.badRequest().body("No generated reports found for students of this institute in this assessment");
        }

        // Get institute name
        InstituteDetail institute = instituteDetailRepository.findById(instituteCode.intValue());
        String instituteName = institute != null ? institute.getInstituteName() : "your school";

        // Build ZIP in memory
        ByteArrayOutputStream zipBaos = new ByteArrayOutputStream();
        int downloadedCount = 0;
        List<String> failedDownloads = new ArrayList<>();

        try (ZipOutputStream zipOut = new ZipOutputStream(zipBaos)) {
            for (Map<String, String> entry : reportEntries) {
                String studentName = entry.get("studentName").replaceAll("[^a-zA-Z0-9_\\- ]", "").trim();
                String reportUrl = entry.get("reportUrl");
                String fileName = studentName.replaceAll("\\s+", "_") + "_" + reportTypeLabel + "_Report.html";

                try {
                    URL url = new URL(reportUrl);
                    try (InputStream in = url.openStream()) {
                        zipOut.putNextEntry(new ZipEntry(fileName));
                        byte[] buffer = new byte[8192];
                        int bytesRead;
                        while ((bytesRead = in.read(buffer)) != -1) {
                            zipOut.write(buffer, 0, bytesRead);
                        }
                        zipOut.closeEntry();
                        downloadedCount++;
                    }
                } catch (Exception e) {
                    failedDownloads.add(entry.get("studentName"));
                }
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to create ZIP file: " + e.getMessage());
        }

        if (downloadedCount == 0) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Could not download any report files from storage");
        }

        // Get assessment name
        String assessmentName = "Assessment";
        Optional<com.kccitm.api.model.career9.AssessmentTable> assessmentOpt = assessmentTableRepository.findById(assessmentId);
        if (assessmentOpt.isPresent()) {
            assessmentName = assessmentOpt.get().getAssessmentName();
        }

        // Build email
        String contactName = cp.getName() != null ? cp.getName() : "Contact Person";
        String htmlContent = buildReportEmailHtml(
                contactName, instituteName, assessmentName, reportTypeLabel,
                downloadedCount, noReportCount, reportEntries, failedDownloads
        );

        String subject = reportTypeLabel + " Reports | " + assessmentName + " | " + instituteName + " – Career-9";
        String zipFileName = reportTypeLabel + "_Reports_" + instituteName.replaceAll("[^a-zA-Z0-9]", "_") + ".zip";

        SmtpEmailRequest emailRequest = new SmtpEmailRequest();
        emailRequest.setTo(Arrays.asList(cp.getEmail()));
        emailRequest.setSubject(subject);
        emailRequest.setHtmlContent(htmlContent);
        emailRequest.setAttachments(Arrays.asList(
                new SmtpEmailRequest.EmailAttachment(zipFileName, zipBaos.toByteArray(), "application/zip")
        ));
        odooEmailService.sendEmail(emailRequest);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Reports ZIP sent successfully to " + cp.getEmail());
        response.put("reportsSent", downloadedCount);
        response.put("reportsNotAvailable", noReportCount);
        response.put("downloadFailed", failedDownloads.size());
        response.put("contactPersonName", cp.getName());
        response.put("contactPersonEmail", cp.getEmail());
        return ResponseEntity.ok(response);
    }

    // ============ EMAIL TEMPLATE ============

    private String buildReportEmailHtml(
            String contactName, String instituteName, String assessmentName,
            String reportTypeLabel, int downloadedCount, int noReportCount,
            List<Map<String, String>> reportEntries, List<String> failedDownloads) {

        StringBuilder sb = new StringBuilder();

        // Email wrapper
        sb.append("<!DOCTYPE html><html><head><meta charset='UTF-8'></head>");
        sb.append("<body style='margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;'>");
        sb.append("<table width='100%' cellpadding='0' cellspacing='0' style='background-color:#f4f6f9;padding:32px 0;'>");
        sb.append("<tr><td align='center'>");

        // Main card
        sb.append("<table width='600' cellpadding='0' cellspacing='0' style='background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);'>");

        // Header banner
        sb.append("<tr><td style='background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:32px 40px;text-align:center;'>");
        sb.append("<h1 style='margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;'>Career-9</h1>");
        sb.append("<p style='margin:6px 0 0;color:#a8b5cc;font-size:13px;'>Ensuring Career Success</p>");
        sb.append("</td></tr>");

        // Body content
        sb.append("<tr><td style='padding:36px 40px;'>");

        // Greeting
        sb.append("<p style='margin:0 0 20px;font-size:16px;color:#1a1a2e;'>Dear <strong>").append(contactName).append("</strong>,</p>");
        sb.append("<p style='margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;'>Greetings from Career-9!</p>");

        // Report details card
        sb.append("<div style='background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;margin-bottom:24px;'>");
        sb.append("<p style='margin:0 0 12px;font-size:14px;color:#6b7280;'>Report Details</p>");
        sb.append("<table cellpadding='4' cellspacing='0' style='font-size:14px;color:#1a1a2e;'>");
        sb.append("<tr><td style='padding:4px 16px 4px 0;color:#6b7280;font-weight:600;'>School / Institute:</td><td style='font-weight:600;'>").append(instituteName).append("</td></tr>");
        sb.append("<tr><td style='padding:4px 16px 4px 0;color:#6b7280;font-weight:600;'>Assessment:</td><td style='font-weight:600;'>").append(assessmentName).append("</td></tr>");
        sb.append("<tr><td style='padding:4px 16px 4px 0;color:#6b7280;font-weight:600;'>Report Type:</td><td style='font-weight:600;'>").append(reportTypeLabel).append("</td></tr>");
        sb.append("<tr><td style='padding:4px 16px 4px 0;color:#6b7280;font-weight:600;'>Reports Included:</td><td style='font-weight:600;'>").append(downloadedCount).append(" student(s)</td></tr>");
        sb.append("</table>");
        sb.append("</div>");

        // Instructions
        sb.append("<p style='margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;'>");
        sb.append("Please find the <strong>").append(reportTypeLabel).append("</strong> assessment reports attached as a ZIP file. ");
        sb.append("You can download and extract the ZIP to access individual student reports.");
        sb.append("</p>");

        // Student list
        sb.append("<div style='margin-bottom:24px;'>");
        sb.append("<p style='margin:0 0 8px;font-size:14px;font-weight:700;color:#1a1a2e;'>Students Included:</p>");
        sb.append("<table width='100%' cellpadding='0' cellspacing='0' style='border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:13px;'>");
        sb.append("<tr style='background:#f1f5f9;'><th style='padding:8px 14px;text-align:left;color:#374151;border-bottom:1px solid #e5e7eb;'>#</th>");
        sb.append("<th style='padding:8px 14px;text-align:left;color:#374151;border-bottom:1px solid #e5e7eb;'>Student Name</th></tr>");
        int idx = 1;
        for (Map<String, String> entry : reportEntries) {
            if (!failedDownloads.contains(entry.get("studentName"))) {
                String bg = idx % 2 == 0 ? "#f9fafb" : "#ffffff";
                sb.append("<tr style='background:").append(bg).append(";'>");
                sb.append("<td style='padding:6px 14px;border-bottom:1px solid #f0f0f0;color:#6b7280;'>").append(idx).append("</td>");
                sb.append("<td style='padding:6px 14px;border-bottom:1px solid #f0f0f0;color:#1a1a2e;font-weight:500;'>").append(entry.get("studentName")).append("</td>");
                sb.append("</tr>");
                idx++;
            }
        }
        sb.append("</table>");
        sb.append("</div>");

        // Warnings
        if (!failedDownloads.isEmpty()) {
            sb.append("<p style='margin:0 0 8px;font-size:13px;color:#d97706;background:#fffbeb;padding:10px 14px;border-radius:6px;border:1px solid #fde68a;'>");
            sb.append("Note: Could not download reports for: ").append(String.join(", ", failedDownloads));
            sb.append("</p>");
        }
        if (noReportCount > 0) {
            sb.append("<p style='margin:0 0 8px;font-size:13px;color:#6b7280;background:#f9fafb;padding:10px 14px;border-radius:6px;border:1px solid #e5e7eb;'>");
            sb.append(noReportCount).append(" student(s) do not have a generated report yet and are not included.");
            sb.append("</p>");
        }

        // Divider
        sb.append("<hr style='border:none;border-top:1px solid #e5e7eb;margin:28px 0;'>");

        // Contact section
        sb.append("<p style='margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;'>");
        sb.append("For any queries or assistance, feel free to reach us:");
        sb.append("</p>");
        sb.append("<table cellpadding='2' cellspacing='0' style='font-size:14px;color:#374151;'>");
        sb.append("<tr><td style='padding:2px 12px 2px 0;color:#6b7280;'>Email:</td>");
        sb.append("<td><a href='mailto:support@career-9.com' style='color:#4361ee;text-decoration:none;font-weight:500;'>support@career-9.com</a></td></tr>");
        sb.append("<tr><td style='padding:2px 12px 2px 0;color:#6b7280;'>Phone:</td>");
        sb.append("<td style='font-weight:500;'>+91 70000 70256</td></tr>");
        sb.append("</table>");

        // Sign-off
        sb.append("<div style='margin-top:28px;'>");
        sb.append("<p style='margin:0 0 4px;font-size:14px;color:#374151;'>Warm Regards,</p>");
        sb.append("<p style='margin:0 0 2px;font-size:15px;font-weight:700;color:#1a1a2e;'>Career-9 Team</p>");
        sb.append("<p style='margin:0;font-size:13px;color:#6b7280;font-style:italic;'>Ensuring Career Success</p>");
        sb.append("</div>");

        sb.append("</td></tr>");

        // Footer
        sb.append("<tr><td style='background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;'>");
        sb.append("<p style='margin:0 0 4px;font-size:12px;color:#9ca3af;'>This is an automated email from Career-9.</p>");
        sb.append("<p style='margin:0;font-size:12px;color:#9ca3af;'>Please do not reply directly to this email.</p>");
        sb.append("</td></tr>");

        sb.append("</table>");
        sb.append("</td></tr></table>");
        sb.append("</body></html>");

        return sb.toString();
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
