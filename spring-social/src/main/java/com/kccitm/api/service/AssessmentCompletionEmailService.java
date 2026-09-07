package com.kccitm.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.text.SimpleDateFormat;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.service.b2c.LinkBuilder;
import com.kccitm.api.service.email.EmailDispatchService;
import com.kccitm.api.service.email.mails.AccountMails;
import com.kccitm.api.service.email.mails.ReportMails;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLinks;

/**
 * Sends a styled assessment-completion email to the student via Gmail.
 */
@Service
public class AssessmentCompletionEmailService {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentCompletionEmailService.class);

    @Autowired
    private EmailDispatchService emailDispatchService;

    @Autowired
    private LinkBuilder linkBuilder;

    @Autowired
    private MailLinks mailLinks;

    /**
     * Send assessment completion email to the student.
     * Called after async processing completes successfully.
     */
    public void sendCompletionEmail(UserStudent userStudent, AssessmentTable assessment,
                                     int answersSaved, int scoresSaved) {
        try {
            String studentName = "Student";
            String studentEmail = null;
            String username = null;
            String dob = null;

            if (userStudent.getStudentInfo() != null) {
                StudentInfo info = userStudent.getStudentInfo();
                if (info.getName() != null) {
                    studentName = info.getName();
                }
                studentEmail = info.getEmail();

                // Login credentials come from the User entity (username + dobDate)
                if (info.getUser() != null) {
                    if (info.getUser().getUsername() != null) {
                        username = info.getUser().getUsername();
                    }
                    if (info.getUser().getDobDate() != null) {
                        dob = new SimpleDateFormat("dd-MM-yyyy").format(info.getUser().getDobDate());
                    }
                }
            }

            if (studentEmail == null || studentEmail.isBlank()) {
                logger.warn("No email found for student {} — skipping completion email", userStudent.getUserStudentId());
                return;
            }

            String assessmentName = assessment.getAssessmentName() != null
                    ? assessment.getAssessmentName()
                    : "Assessment";
            String firstName = AccountMails.firstName(studentName);

            Mail mail = ReportMails.assessmentCompletion(firstName, assessmentName, username, dob,
                    mailLinks.of(linkBuilder.studentLogin(), "student_login"));

            EmailSendRequest req = EmailSendRequest.mail(EmailType.ASSESSMENT_COMPLETION, studentEmail, mail);
            req.setUserStudentId(userStudent.getUserStudentId());
            if (userStudent.getInstitute() != null && userStudent.getInstitute().getInstituteCode() != null) {
                req.setInstituteCode(userStudent.getInstitute().getInstituteCode());
            }
            req.put("student_name", studentName);
            req.put("assessment_name", assessmentName);
            if (username != null) req.put("username", username);
            if (dob != null) req.put("password", dob);
            emailDispatchService.send(req);
            logger.info("Assessment completion email dispatched to {} for assessment '{}'",
                    studentEmail, assessmentName);

        } catch (Exception e) {
            logger.error("Failed to send completion email for student={} assessment={}: {}",
                    userStudent.getUserStudentId(), assessment.getId(), e.getMessage());
        }
    }
}
