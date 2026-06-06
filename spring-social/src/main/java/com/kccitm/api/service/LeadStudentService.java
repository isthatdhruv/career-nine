package com.kccitm.api.service;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.Lead;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.service.b2c.StudentInstituteMembershipService;

/**
 * Turns a captured STUDENT {@link Lead} (from the public career-9.com student
 * form, handled by {@code LeadController.captureLead}) into a real, loginable
 * student account and emails the student their credentials.
 *
 * <p>The flow mirrors the canonical student-creation sites
 * (e.g. {@code SchoolRegistrationController.register}): persist a
 * {@link User} (login identity) + {@link StudentInfo} (profile) + a
 * {@link UserStudent} (the "is a student" marker), then route through
 * {@link StudentProvisioningService}/{@link StudentInstituteMembershipService}
 * for ABAC authorization, and finally queue the credentials email.
 *
 * <h3>Credential model</h3>
 * Students authenticate with <strong>username + date of birth</strong>; the DOB
 * is the secret and is NOT hashed (see {@code UserRepository.findByUsernameAndDobDate}).
 * So a lead-created student is loginable iff it has a non-null {@code User.username}
 * and {@code User.dobDate}. The DOB comes from the lead ({@link Lead#getDob()});
 * the username is a generated numeric handle, unique within the student's DOB.
 *
 * <h3>Uniqueness</h3>
 * A parent may register several children under the SAME email, so email alone is
 * not the identity. The dedup key is <strong>(email, DOB)</strong>: if a student
 * already exists for that pair we skip (idempotent); a different DOB under the
 * same email is treated as a different child and provisioned separately.
 *
 * <h3>Failure isolation</h3>
 * Runs {@code @Async} (like {@code OdooLeadService.syncLeadToOdoo}) so a
 * provisioning/email failure never breaks the public lead-capture 201 response.
 * All work is wrapped in a try/catch; partial state is recoverable because the
 * (email, DOB) guard makes a re-run a no-op once a student exists.
 */
@Service
public class LeadStudentService {

    private static final Logger logger = LoggerFactory.getLogger(LeadStudentService.class);

    /** Membership-history source tag for lead-origin enrolments. */
    private static final String SOURCE = "lead-capture";

    /** DOB is emailed as the password in this format (matches the email template copy). */
    private static final String DOB_DISPLAY_PATTERN = "dd-MM-yyyy";

    /** Reads the signup form's free-form fields (e.g. grade) out of Lead.extras JSON. */
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Institute these lead-students are enrolled into, configured per environment
     * via {@code app.b2c.leadInstituteCode}. Blank/unset → create with no institute
     * (B2C wildcard scope), matching the existing campaign-student convention.
     */
    @Value("${app.b2c.leadInstituteCode:}")
    private String leadInstituteCodeRaw;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentInfoRepository studentInfoRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private InstituteDetailRepository instituteDetailRepository;

    @Autowired
    private StudentProvisioningService studentProvisioningService;

    @Autowired
    private StudentInstituteMembershipService studentInstituteMembershipService;

    @Autowired
    private LoginCredentialsEmailService loginCredentialsEmailService;

    /**
     * Provision a student account from a captured STUDENT lead and email the
     * credentials. Safe to call for any lead — it validates its own inputs and
     * is a no-op when a matching student already exists.
     */
    @Async
    public void createStudentFromLead(Lead lead) {
        try {
            if (lead == null) {
                return;
            }
            String email = lead.getEmail() == null ? null : lead.getEmail().trim();
            String fullName = lead.getFullName();
            Date dob = lead.getDob();

            if (email == null || email.isEmpty()) {
                logger.warn("Lead {} has no email — cannot provision a student", lead.getId());
                return;
            }
            if (dob == null) {
                // DOB is the login password; without it the student could never sign in.
                logger.warn("Lead {} ({}) has no DOB — skipping student provisioning "
                        + "(student login requires username + DOB)", lead.getId(), email);
                return;
            }

            // Dedup on (email, DOB). A student already provisioned for this pair → stop.
            // An existing User with this exact (email, DOB) but no student marker is
            // reused so we never create a duplicate identity for the same person.
            User user = null;
            List<User> matches = userRepository.findAllByEmailAndDobDate(email, dob);
            for (User candidate : matches) {
                if (userStudentRepository.getByUserId(candidate.getId()).isPresent()) {
                    logger.info("Lead {}: student already exists for email={} + DOB — skipping (idempotent)",
                            lead.getId(), email);
                    return;
                }
                user = candidate; // reuse a non-student user row with the same (email, DOB)
            }

            // Resolve the configured target institute (null = B2C wildcard).
            Integer instituteCode = resolveInstituteCode();
            InstituteDetail institute = null;
            if (instituteCode != null) {
                institute = instituteDetailRepository.findById(instituteCode.intValue());
                if (institute == null) {
                    logger.warn("Configured app.b2c.leadInstituteCode={} does not exist — "
                            + "creating lead-student with no institute (wildcard)", instituteCode);
                    instituteCode = null;
                }
            }

            // 1. User (login identity). DOB is the password — never hashed.
            if (user == null) {
                user = new User(generateUsername(dob), dob); // sets username, dobDate, provider=custom_student
                user.setName(fullName);
                user.setEmail(email);
                user.setPhone(lead.getPhone());
                user = userRepository.save(user);
            } else {
                ensureLoginableUsername(user, dob);
            }

            // 2. StudentInfo (profile row the rest of the app reads).
            StudentInfo studentInfo = new StudentInfo();
            studentInfo.setName(fullName);
            studentInfo.setEmail(email);
            studentInfo.setPhoneNumber(lead.getPhone());
            studentInfo.setStudentDob(dob);
            studentInfo.setInstituteId(instituteCode); // null ok (B2C wildcard)
            // Pre-fill what the signup form already collected, so the one-time
            // student-info step shows these filled in (student confirms/edits):
            //   grade  → studentClass (form sends it in Lead.extras)
            //   school → schoolName   (form sends it as Lead.schoolName)
            // gender + schoolBoard aren't sent by the form, so the student fills them.
            studentInfo.setSchoolName(lead.getSchoolName());
            studentInfo.setStudentClass(parseGradeFromExtras(lead.getExtras()));
            studentInfo.setUser(user);
            studentInfo = studentInfoRepository.save(studentInfo);

            // 3. UserStudent (the "is a student" gate checked at login).
            UserStudent userStudent = new UserStudent(user, studentInfo, institute);
            userStudent = userStudentRepository.save(userStudent);

            // 4. ABAC authorization (student role group + institute scope + provider marker).
            if (instituteCode != null) {
                // Keeps student_info.institute_id, user_student.institute_id, the
                // membership-history row AND the ABAC scope in sync; calls provision() internally.
                studentInstituteMembershipService.setPrimaryInstitute(userStudent, instituteCode, null, SOURCE);
            } else {
                studentProvisioningService.provision(userStudent); // wildcard scope
            }

            // 5. Email the credentials (username + DOB-as-password + dashboard link).
            String dobDisplay = new SimpleDateFormat(DOB_DISPLAY_PATTERN).format(dob);
            loginCredentialsEmailService.send(fullName, email, user.getUsername(), dobDisplay, institute);

            logger.info("Lead {}: provisioned student userId={} userStudentId={} institute={} and queued credentials email to {}",
                    lead.getId(), user.getId(), userStudent.getUserStudentId(), instituteCode, email);

        } catch (Exception e) {
            logger.error("Failed to provision student from lead {}: {}",
                    lead != null ? lead.getId() : null, e.getMessage(), e);
        }
    }

    /** Pull the numeric grade/class the signup form sent in the lead's extras JSON. */
    private Integer parseGradeFromExtras(String extrasJson) {
        if (extrasJson == null || extrasJson.isBlank()) {
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(extrasJson).get("grade");
            if (node == null || node.isNull()) {
                return null;
            }
            String raw = node.asText().trim();
            return raw.isEmpty() ? null : Integer.valueOf(raw);
        } catch (Exception e) {
            logger.warn("Could not parse grade from lead extras: {}", e.getMessage());
            return null;
        }
    }

    /** Parse the configured institute code; blank/garbage → null (no institute). */
    private Integer resolveInstituteCode() {
        if (leadInstituteCodeRaw == null || leadInstituteCodeRaw.trim().isEmpty()) {
            return null;
        }
        try {
            return Integer.valueOf(leadInstituteCodeRaw.trim());
        } catch (NumberFormatException e) {
            logger.warn("Invalid app.b2c.leadInstituteCode='{}' (not an integer) — ignoring", leadInstituteCodeRaw);
            return null;
        }
    }

    /**
     * Generate a numeric username unique within this DOB. Login keys on
     * (username, DOB), so a collision only matters among students sharing the
     * exact same date of birth — vanishingly unlikely, but we still verify and
     * retry a handful of times before falling back.
     */
    private int generateUsername(Date dob) {
        for (int attempt = 0; attempt < 10; attempt++) {
            int candidate = ThreadLocalRandom.current().nextInt(100000, 1000000);
            if (userRepository.findByUsernameAndDobDate(String.valueOf(candidate), dob).isEmpty()) {
                return candidate;
            }
        }
        return ThreadLocalRandom.current().nextInt(100000, 1000000);
    }

    /** A reused user row may have no username; give it one so username+DOB login works. */
    private void ensureLoginableUsername(User user, Date dob) {
        if (user.getUsername() == null || user.getUsername().trim().isEmpty()) {
            user.setUsername(String.valueOf(generateUsername(dob)));
            userRepository.save(user);
        }
    }
}
