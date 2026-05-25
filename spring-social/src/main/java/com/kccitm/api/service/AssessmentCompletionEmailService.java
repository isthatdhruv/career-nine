package com.kccitm.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.text.SimpleDateFormat;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;

/**
 * Sends a styled assessment-completion email to the student via Odoo.
 */
@Service
public class AssessmentCompletionEmailService {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentCompletionEmailService.class);

    @Autowired
    private OdooEmailService odooEmailService;

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

            String subject = "You've completed " + assessmentName + " — Career-9";
            String html = buildEmailHtml(studentName, assessmentName, username, dob);

            odooEmailService.sendHtmlEmail(studentEmail, subject, html);
            logger.info("Assessment completion email sent to {} for assessment '{}'", studentEmail, assessmentName);

        } catch (Exception e) {
            logger.error("Failed to send completion email for student={} assessment={}: {}",
                    userStudent.getUserStudentId(), assessment.getId(), e.getMessage());
        }
    }

    private String buildEmailHtml(String studentName, String assessmentName,
                                   String username, String dob) {
        String firstName = studentName.contains(" ") ? studentName.substring(0, studentName.indexOf(' ')) : studentName;

        return "<!DOCTYPE html>\n"
            + "<html lang=\"en\">\n"
            + "<head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"></head>\n"
            + "<body style=\"margin:0;padding:0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:linear-gradient(135deg,#e8eaf6 0%,#e0f2e9 50%,#f3e5f5 100%);\">\n"
            + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"padding:40px 20px;\">\n"
            + "<tr><td align=\"center\">\n"

            // — Outer card (glassmorphism) —
            + "<table role=\"presentation\" width=\"580\" cellpadding=\"0\" cellspacing=\"0\" style=\""
            + "background:rgba(255,255,255,0.65);"
            + "backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);"
            + "border-radius:24px;"
            + "border:1px solid rgba(255,255,255,0.5);"
            + "box-shadow:0 8px 32px rgba(0,0,0,0.08);"
            + "overflow:hidden;\">\n"

            // — Top gradient bar —
            + "<tr><td style=\"height:6px;background:linear-gradient(90deg,#4ECDC4,#44B78B,#A0D585);\"></td></tr>\n"

            // — Logo row —
            + "<tr><td align=\"center\" style=\"padding:32px 40px 16px;\">\n"
            + "  <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
            + "    <td style=\"background:linear-gradient(135deg,#4ECDC4,#44B78B);width:42px;height:42px;border-radius:12px;text-align:center;vertical-align:middle;\">\n"
            + "      <span style=\"color:#fff;font-size:20px;font-weight:700;line-height:42px;\">C9</span>\n"
            + "    </td>\n"
            + "    <td style=\"padding-left:12px;font-size:20px;font-weight:700;color:#1a2a3a;letter-spacing:-0.3px;\">Career-9</td>\n"
            + "  </tr></table>\n"
            + "</td></tr>\n"

            // — Celebration icon —
            + "<tr><td align=\"center\" style=\"padding:8px 40px 0;\">\n"
            + "  <div style=\"width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,rgba(78,205,196,0.15),rgba(160,213,133,0.2));display:inline-block;text-align:center;line-height:80px;\">\n"
            + "    <span style=\"font-size:36px;\">&#10003;</span>\n"
            + "  </div>\n"
            + "</td></tr>\n"

            // — Heading —
            + "<tr><td align=\"center\" style=\"padding:20px 40px 4px;\">\n"
            + "  <h1 style=\"margin:0;font-size:26px;font-weight:800;background:linear-gradient(135deg,#4ECDC4,#44B78B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;\">Assessment Complete!</h1>\n"
            + "</td></tr>\n"

            // — Greeting —
            + "<tr><td align=\"center\" style=\"padding:4px 40px 20px;\">\n"
            + "  <p style=\"margin:0;font-size:16px;color:#4a5568;line-height:1.6;\">Great work, <strong style=\"color:#1a2a3a;\">" + escapeHtml(firstName) + "</strong>! You've successfully completed <strong style=\"color:#1a2a3a;\">" + escapeHtml(assessmentName) + "</strong>.</p>\n"
            + "</td></tr>\n"

            // — Login credentials card —
            + (username != null || dob != null
                ? "<tr><td style=\"padding:0 40px 16px;\">\n"
                + "  <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\""
                + "    background:rgba(255,255,255,0.55);"
                + "    border-radius:16px;"
                + "    border:1px solid rgba(78,205,196,0.2);"
                + "    box-shadow:0 2px 12px rgba(0,0,0,0.04);\">\n"
                + "    <tr><td style=\"padding:20px 24px 8px;\">\n"
                + "      <div style=\"font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#78909c;font-weight:600;\">Your Login Details</div>\n"
                + "    </td></tr>\n"
                + (username != null
                    ? "    <tr><td style=\"padding:4px 24px;\">\n"
                    + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
                    + "        <td style=\"font-size:13px;color:#64748b;width:90px;\">Username</td>\n"
                    + "        <td style=\"font-size:15px;font-weight:600;color:#1a2a3a;font-family:'Courier New',monospace;background:rgba(78,205,196,0.08);padding:6px 12px;border-radius:8px;\">" + escapeHtml(username) + "</td>\n"
                    + "      </tr></table>\n"
                    + "    </td></tr>\n"
                    : "")
                + (dob != null
                    ? "    <tr><td style=\"padding:4px 24px " + (dob != null ? "16px" : "4px") + ";\">\n"
                    + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
                    + "        <td style=\"font-size:13px;color:#64748b;width:90px;\">DOB</td>\n"
                    + "        <td style=\"font-size:15px;font-weight:600;color:#1a2a3a;font-family:'Courier New',monospace;background:rgba(78,205,196,0.08);padding:6px 12px;border-radius:8px;\">" + escapeHtml(dob) + "</td>\n"
                    + "      </tr></table>\n"
                    + "    </td></tr>\n"
                    : "")
                + "  </table>\n"
                + "</td></tr>\n"
                : "")

            // — Inner glass card: What Happens Next —
            + "<tr><td style=\"padding:0 40px;\">\n"
            + "  <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\""
            + "    background:rgba(255,255,255,0.55);"
            + "    border-radius:16px;"
            + "    border:1px solid rgba(78,205,196,0.2);"
            + "    box-shadow:0 2px 12px rgba(0,0,0,0.04);\">\n"

            // Section heading
            + "    <tr><td style=\"padding:24px 24px 16px;\">\n"
            + "      <div style=\"font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#78909c;font-weight:600;\">What Happens Next</div>\n"
            + "    </td></tr>\n"

            // Step 1
            + "    <tr><td style=\"padding:0 24px 14px;\">\n"
            + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
            + "        <td style=\"vertical-align:top;padding-right:14px;\">\n"
            + "          <div style=\"width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,rgba(78,205,196,0.2),rgba(68,183,139,0.15));text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#44B78B;\">1</div>\n"
            + "        </td>\n"
            + "        <td style=\"vertical-align:top;\">\n"
            + "          <div style=\"font-size:15px;font-weight:600;color:#1a2a3a;\">Your report is being generated</div>\n"
            + "          <div style=\"font-size:13px;color:#64748b;line-height:1.5;margin-top:3px;\">Our AI engine is analysing your responses across 6 career dimensions to build your personalised Career Report.</div>\n"
            + "        </td>\n"
            + "      </tr></table>\n"
            + "    </td></tr>\n"

            // Step 2
            + "    <tr><td style=\"padding:0 24px 14px;\">\n"
            + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
            + "        <td style=\"vertical-align:top;padding-right:14px;\">\n"
            + "          <div style=\"width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,rgba(78,205,196,0.2),rgba(68,183,139,0.15));text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#44B78B;\">2</div>\n"
            + "        </td>\n"
            + "        <td style=\"vertical-align:top;\">\n"
            + "          <div style=\"font-size:15px;font-weight:600;color:#1a2a3a;\">Check your dashboard</div>\n"
            + "          <div style=\"font-size:13px;color:#64748b;line-height:1.5;margin-top:3px;\">Log in to your Student Dashboard to view your career matches, strengths, and detailed insights once the report is ready.</div>\n"
            + "        </td>\n"
            + "      </tr></table>\n"
            + "    </td></tr>\n"

            // Step 3
            + "    <tr><td style=\"padding:0 24px 22px;\">\n"
            + "      <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>\n"
            + "        <td style=\"vertical-align:top;padding-right:14px;\">\n"
            + "          <div style=\"width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,rgba(78,205,196,0.2),rgba(68,183,139,0.15));text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#44B78B;\">3</div>\n"
            + "        </td>\n"
            + "        <td style=\"vertical-align:top;\">\n"
            + "          <div style=\"font-size:15px;font-weight:600;color:#1a2a3a;\">Talk to a career expert</div>\n"
            + "          <div style=\"font-size:13px;color:#64748b;line-height:1.5;margin-top:3px;\">Our counsellors are available to walk you through your results and help you plan your next steps. You can book a session anytime from your dashboard.</div>\n"
            + "        </td>\n"
            + "      </tr></table>\n"
            + "    </td></tr>\n"

            + "  </table>\n"
            + "</td></tr>\n"

            // — CTA Button —
            + "<tr><td align=\"center\" style=\"padding:28px 40px 32px;\">\n"
            + "  <a href=\"https://dashboard.career-9.com/student/login\" style=\""
            + "    display:inline-block;padding:14px 36px;"
            + "    background:linear-gradient(135deg,#4ECDC4,#44B78B);"
            + "    color:#ffffff;font-size:15px;font-weight:700;"
            + "    text-decoration:none;border-radius:12px;"
            + "    box-shadow:0 4px 16px rgba(68,183,139,0.35);"
            + "    letter-spacing:0.3px;\">Go to My Dashboard</a>\n"
            + "</td></tr>\n"

            // — Bottom gradient bar —
            + "<tr><td style=\"height:4px;background:linear-gradient(90deg,#A0D585,#4ECDC4,#44B78B);\"></td></tr>\n"

            + "</table>\n"

            // — Footer —
            + "<table role=\"presentation\" width=\"580\" cellpadding=\"0\" cellspacing=\"0\">\n"
            + "<tr><td align=\"center\" style=\"padding:24px 40px;\">\n"
            + "  <p style=\"margin:0;font-size:12px;color:#90a4ae;line-height:1.6;\">"
            + "    Career-9 &mdash; AI-Powered &middot; NEP-Aligned &middot; Science-Backed<br/>"
            + "    &copy; 2026 Career-9. All rights reserved."
            + "  </p>\n"
            + "</td></tr>\n"
            + "</table>\n"

            + "</td></tr></table>\n"
            + "</body></html>";
    }

    private String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;");
    }
}
