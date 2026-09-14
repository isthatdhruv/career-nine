package com.kccitm.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.service.b2c.LinkBuilder;
import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.branding.InstituteBrandingService;
import com.kccitm.api.service.email.EmailDispatchService;
import com.kccitm.api.service.email.mails.AccountMails;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLinks;
import com.kccitm.api.service.email.theme.MailShell;

/**
 * Sends a styled "here are your login credentials" email to a student through the central
 * {@link EmailDispatchService} (Phase 3), built from the theme via {@link AccountMails}. The
 * send is logged and honours per-institute account routing.
 */
@Service
public class LoginCredentialsEmailService {

    private static final Logger logger = LoggerFactory.getLogger(LoginCredentialsEmailService.class);

    @Autowired
    private EmailDispatchService emailDispatchService;

    @Autowired
    private LinkBuilder linkBuilder;

    @Autowired
    private MailLinks mailLinks;

    @Autowired
    private InstituteBrandingService brandingService;

    /** Backwards-compatible overload — standard (non-whitelabel) Career-9 branding. */
    public void send(String studentName, String recipientEmail, String username, String dob) {
        send(studentName, recipientEmail, username, dob, null);
    }

    /**
     * Dispatch a login-credentials email. Branding (whitelabel school name) is resolved from
     * {@code institute}; the sending identity comes from the institute's configured account
     * (or the global default) — see Phase 2 routing.
     *
     * @param institute the student's institute (may be null for B2C / lead students)
     */
    public void send(String studentName, String recipientEmail, String username, String dob,
                     InstituteDetail institute) {
        if (recipientEmail == null || recipientEmail.isBlank()) {
            throw new IllegalArgumentException("recipientEmail is required");
        }
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("username is required");
        }
        if (dob == null || dob.isBlank()) {
            throw new IllegalArgumentException("dob (used as password) is required");
        }

        BrandingDto brand = brandingService.forInstitute(institute);
        Mail mail = AccountMails.loginCredentials(brand.isWhitelabel() ? brand.getSchoolName() : "Career-9",
                AccountMails.firstName(studentName), username, dob, mailLinks.of(linkBuilder.studentLogin(), "student_login"));
        EmailSendRequest req = EmailSendRequest.mail(EmailType.LOGIN_CREDENTIALS, recipientEmail, mail);
        if (institute != null && institute.getInstituteCode() != null) {
            req.setInstituteCode(institute.getInstituteCode());
        }
        req.put("student_name", studentName);
        req.put("username", username);
        req.put("password", dob);

        emailDispatchService.send(req);
        logger.info("Login-credentials email dispatched for {} (whitelabel={})",
                recipientEmail, brand.isWhitelabel());
    }

    // ─── seed helpers ────────────────────────────────────────────────────

    /** Subject for the seeded default template ({{school_name}} → school or "Career-9"). */
    public static String defaultSubjectTemplate() {
        return "Your {{school_name}} login details";
    }

    /** Body for the seeded default template — the themed mail, tokenised, blocks only (the dispatcher wraps it in the shell at send time). */
    public static String defaultBodyTemplate() {
        return MailShell.bodyHtml(AccountMails.loginCredentialsSeed());
    }
}
