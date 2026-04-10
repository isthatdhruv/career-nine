package com.kccitm.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;

@Service
public class PaymentEmailService {

    private static final Logger logger = LoggerFactory.getLogger(PaymentEmailService.class);

    @Autowired
    private SmtpEmailService emailService;

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Value("${app.razorpay.callback-base-url:}")
    private String callbackBaseUrl;

    private String getRegistrationUrl(PaymentTransaction txn) {
        String base = (callbackBaseUrl != null && !callbackBaseUrl.isEmpty())
                ? callbackBaseUrl : "https://dashboard.career-9.com";
        return base + "/payment-register/" + txn.getTransactionId();
    }

    @Async
    public void sendWelcomeEmail(String email, String name, String username,
            String dob, String assessmentName, PaymentTransaction txn) {
        try {
            String subject = "Payment Successful - " + assessmentName;
            String safeName = escapeHtml(name);
            String safeAssessmentName = escapeHtml(assessmentName);
            String safeUsername = escapeHtml(username);
            String safeDob = escapeHtml(dob);

            String htmlContent = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                    + "<div style='background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                    + "<h2 style='margin: 0;'>Payment Successful!</h2>"
                    + "</div>"
                    + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                    + "<p>Dear <strong>" + safeName + "</strong>,</p>"
                    + "<p>Your payment for <strong>" + safeAssessmentName + "</strong> has been received. Your assessment has been allotted.</p>"
                    + "<div style='background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;'>"
                    + "<p style='margin: 4px 0;'><strong>Username:</strong> <span style='color: #059669; font-size: 1.1em;'>" + safeUsername + "</span></p>"
                    + "<p style='margin: 4px 0;'><strong>Password:</strong> <span style='color: #059669; font-size: 1.1em;'>" + safeDob + "</span> (Your Date of Birth)</p>"
                    + "</div>"
                    + "<p>Please log in and complete your assessment at your earliest convenience.</p>"
                    + "<div style='text-align: center; margin: 24px 0;'>"
                    + "<a href='https://assessment.career-9.com/' style='display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1em;'>Go To Assessment</a>"
                    + "</div>"
                    + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                    + "</div></div>";

            emailService.sendHtmlEmail(email, subject, htmlContent);

            txn.setWelcomeEmailSent(true);
            paymentTransactionRepository.save(txn);

            logger.info("Welcome email sent to: {} for transaction: {}", email, txn.getTransactionId());
        } catch (Exception e) {
            logger.error("Failed to send welcome email to: {}", email, e);
        }
    }

    @Async
    public void sendFailedOrPendingEmail(PaymentTransaction txn, String assessmentName, String status) {
        try {
            long amountRupees = txn.getAmount() / 100;
            String studentName = escapeHtml(txn.getStudentName() != null ? txn.getStudentName() : "Student");
            String safeAssessmentName = escapeHtml(assessmentName);

            String subject;
            String headerBg;
            String headerTitle;
            String bodyMessage;

            if ("failed".equals(status)) {
                subject = "Payment Failed - " + assessmentName;
                headerBg = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
                headerTitle = "Payment Failed";
                bodyMessage = "Your payment of <strong>INR " + amountRupees + "</strong> for <strong>" + safeAssessmentName + "</strong> could not be processed.";
            } else if ("expired".equals(status)) {
                subject = "Payment Link Expired - " + assessmentName;
                headerBg = "linear-gradient(135deg, #64748b 0%, #475569 100%)";
                headerTitle = "Payment Link Expired";
                bodyMessage = "The payment link for <strong>" + safeAssessmentName + "</strong> (INR " + amountRupees + ") has expired.";
            } else {
                subject = "Payment Cancelled - " + assessmentName;
                headerBg = "linear-gradient(135deg, #db2777 0%, #be185d 100%)";
                headerTitle = "Payment Cancelled";
                bodyMessage = "Your payment of <strong>INR " + amountRupees + "</strong> for <strong>" + safeAssessmentName + "</strong> was cancelled.";
            }

            String htmlContent = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                    + "<div style='background: " + headerBg + "; padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                    + "<h2 style='margin: 0;'>" + headerTitle + "</h2>"
                    + "</div>"
                    + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                    + "<p>Dear <strong>" + studentName + "</strong>,</p>"
                    + "<p>" + bodyMessage + "</p>"
                    + "<p>Please try again using the link below:</p>"
                    + "<div style='text-align: center; margin: 24px 0;'>"
                    + "<a href='" + getRegistrationUrl(txn) + "' style='background: linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1.1em;'>Retry Payment</a>"
                    + "</div>"
                    + "<p style='color: #666; font-size: 0.85em;'>If the amount was deducted, it will be refunded within 5-7 business days.</p>"
                    + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                    + "</div></div>";

            emailService.sendHtmlEmail(txn.getStudentEmail(), subject, htmlContent);
            txn.setNudgeEmailSent(true);
            paymentTransactionRepository.save(txn);
            logger.info("Automated {} email sent to: {} for transaction: {}", status, txn.getStudentEmail(), txn.getTransactionId());
        } catch (Exception e) {
            logger.error("Failed to send {} email to: {}", status, txn.getStudentEmail(), e);
        }
    }

    @Async
    public void sendNudgeEmail(PaymentTransaction txn, String assessmentName) {
        try {
            long amountRupees = txn.getAmount() / 100;
            String studentName = escapeHtml(txn.getStudentName() != null ? txn.getStudentName() : "Student");
            String safeAssessmentName = escapeHtml(assessmentName);

            String subject = "Complete Your Payment - " + assessmentName;
            String htmlContent = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                    + "<div style='background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                    + "<h2 style='margin: 0;'>Payment Pending</h2>"
                    + "</div>"
                    + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                    + "<p>Dear <strong>" + studentName + "</strong>,</p>"
                    + "<p>Your payment of <strong>INR " + amountRupees + "</strong> for <strong>" + safeAssessmentName + "</strong> is still pending.</p>"
                    + "<p>Please complete your payment using the link below:</p>"
                    + "<div style='text-align: center; margin: 24px 0;'>"
                    + "<a href='" + getRegistrationUrl(txn) + "' style='background: #f59e0b; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1.1em;'>Complete Payment</a>"
                    + "</div>"
                    + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated reminder. Please do not reply.</p>"
                    + "</div></div>";

            emailService.sendHtmlEmail(txn.getStudentEmail(), subject, htmlContent);
            logger.info("Nudge email sent to: {} for transaction: {}", txn.getStudentEmail(), txn.getTransactionId());
        } catch (Exception e) {
            logger.error("Failed to send nudge email to: {}", txn.getStudentEmail(), e);
        }
    }

    @Async
    public void sendPaymentLinkEmail(String email, String studentName, PaymentTransaction txn, String assessmentName) {
        long amountRupees = txn.getAmount() / 100;
        String safeName = escapeHtml(studentName);
        String safeAssessmentName = escapeHtml(assessmentName);

        String subject = "Payment Link - " + assessmentName + " (INR " + amountRupees + ")";
        String htmlContent = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                + "<div style='background: linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                + "<h2 style='margin: 0;'>Assessment Payment</h2>"
                + "</div>"
                + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                + "<p>Dear <strong>" + safeName + "</strong>,</p>"
                + "<p>Please complete your payment of <strong>INR " + amountRupees + "</strong> for <strong>" + safeAssessmentName + "</strong>.</p>"
                + "<div style='text-align: center; margin: 28px 0;'>"
                + "<a href='" + getRegistrationUrl(txn) + "' style='background: linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 1.1em; display: inline-block;'>Pay Now</a>"
                + "</div>"
                + "<p style='color: #666; font-size: 0.85em;'>Or copy this link: <a href='" + getRegistrationUrl(txn) + "'>" + getRegistrationUrl(txn) + "</a></p>"
                + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                + "</div></div>";

        emailService.sendHtmlEmail(email, subject, htmlContent);
        logger.info("Payment link email sent to: {} for transaction: {}", email, txn.getTransactionId());
    }

    @Async
    public void sendWelcomeEmailResend(PaymentTransaction txn, String assessmentName) {
        try {
            String studentName = escapeHtml(txn.getStudentName() != null ? txn.getStudentName() : "Student");
            String safeAssessmentName = escapeHtml(assessmentName);

            String subject = "Welcome! Complete Your Assessment - " + assessmentName;
            String htmlContent = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                    + "<div style='background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                    + "<h2 style='margin: 0;'>Payment Successful!</h2>"
                    + "</div>"
                    + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                    + "<p>Dear <strong>" + studentName + "</strong>,</p>"
                    + "<p>Your payment for <strong>" + safeAssessmentName + "</strong> has been received successfully.</p>"
                    + "<p>Your assessment has been allotted. Please log in to complete it at your earliest convenience.</p>"
                    + "<div style='text-align: center; margin: 24px 0;'>"
                    + "<a href='https://assessment.career-9.com/' style='display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1em;'>Go To Assessment</a>"
                    + "</div>"
                    + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                    + "</div></div>";

            emailService.sendHtmlEmail(txn.getStudentEmail(), subject, htmlContent);
            logger.info("Welcome resend email sent to: {} for transaction: {}", txn.getStudentEmail(), txn.getTransactionId());
        } catch (Exception e) {
            logger.error("Failed to resend welcome email to: {}", txn.getStudentEmail(), e);
        }
    }

    private String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
