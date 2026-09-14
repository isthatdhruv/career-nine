package com.kccitm.api.service.dashboard.principal;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.ContactPerson;
import com.kccitm.api.model.career9.PrincipalDashboardReleaseLog;
import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.model.email.EmailSendResult;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.repository.ContactPersonRepository;
import com.kccitm.api.service.email.EmailDispatchService;
import com.kccitm.api.service.email.mails.ReportMails;
import com.kccitm.api.service.email.theme.Mail;
import com.kccitm.api.service.email.theme.MailLinks;

/**
 * Tells a school its dashboard is live, and how to use it.
 *
 * <p>Sent by hand, to chosen recipients. Nothing is mailed as a side effect of generating:
 * a release can be re-run several times while an admin gets a school's data right, and
 * each of those runs mailing the principal would train them to ignore the mail. The admin
 * decides when the dashboard is worth announcing.
 *
 * <p>Every send is written to the release log, so "did anyone tell the school?" has an
 * answer that does not depend on someone remembering.
 */
@Service
public class PrincipalDashboardNotificationService {

    private static final Logger log =
            LoggerFactory.getLogger(PrincipalDashboardNotificationService.class);

    @Autowired
    private ContactPersonRepository contactPersonRepository;

    @Autowired
    private EmailDispatchService emailDispatch;

    @Autowired
    private PrincipalDashboardReleaseLogger trace;

    @Autowired
    private MailLinks mailLinks;

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    /** One recipient's outcome, so the page can show exactly who got it and who did not. */
    public static final class SendOutcome {
        public Long contactPersonId;
        public String name;
        public String email;
        public boolean sent;
        public String error;
    }

    /** A contact person as the recipient picker needs them. */
    public static final class Recipient {
        public Long id;
        public String name;
        public String email;
        public String designation;
        /** False when there is no address to send to — shown, but not selectable. */
        public boolean emailable;
    }

    public List<Recipient> recipientsFor(Long instituteCode) {
        List<Recipient> out = new ArrayList<>();
        // The derived finder, not findAll() with a filter: this table holds every school's
        // contacts. instituteCode is an int on the entity, so the narrowing happens here
        // rather than through an equals() between Long and Integer that is always false.
        for (ContactPerson person : contactPersonRepository
                .findByInstitute_InstituteCode(instituteCode.intValue())) {
            Recipient r = new Recipient();
            r.id = person.getId();
            r.name = person.getName();
            r.email = person.getEmail();
            r.designation = person.getDesignation();
            r.emailable = person.getEmail() != null && person.getEmail().contains("@");
            out.add(r);
        }
        return out;
    }

    /**
     * Mail the chosen contacts.
     *
     * <p>Sends are attempted one at a time and a failure is recorded rather than thrown:
     * one bad address among five must not stop the other four, and the admin needs to see
     * which one it was.
     */
    public List<SendOutcome> notify(Long instituteCode, String instituteName,
            String assessmentName, List<Long> contactPersonIds) {

        List<Recipient> all = recipientsFor(instituteCode);
        List<SendOutcome> outcomes = new ArrayList<>();
        // assessmentName is an optional request param (PrincipalDashboardReleaseController);
        // the old body() guarded a missing value the same way — keep that fallback at the caller.
        String assessmentLabel = (assessmentName == null || assessmentName.isBlank())
                ? "the assessment" : assessmentName;

        for (Recipient recipient : all) {
            if (!contactPersonIds.contains(recipient.id)) {
                continue;
            }
            SendOutcome outcome = new SendOutcome();
            outcome.contactPersonId = recipient.id;
            outcome.name = recipient.name;
            outcome.email = recipient.email;

            if (!recipient.emailable) {
                outcome.sent = false;
                outcome.error = "No email address on file";
                outcomes.add(outcome);
                continue;
            }

            try {
                Mail mail = ReportMails.schoolDashboardReady(recipient.name, instituteName, assessmentLabel,
                        mailLinks.of(frontendUrl + "/school-dashboard", "school_dashboard"));
                EmailSendRequest req = EmailSendRequest.mail(
                        EmailType.SCHOOL_DASHBOARD_READY, recipient.email, mail);
                // Rule 11: the shell decides branding, from a hint the caller supplies. This mail
                // goes to a school's own contacts, so a whitelabel school must see its own header.
                req.setInstituteCode(instituteCode == null ? null : instituteCode.intValue());
                EmailSendResult result = emailDispatch.send(req);
                outcome.sent = result.isSuccess();
                outcome.error = result.isSuccess() ? null : result.getError();
            } catch (Exception e) {
                outcome.sent = false;
                outcome.error = PrincipalDashboardReleaseLogger.describe(e);
                log.warn("Dashboard notification to {} failed: {}", recipient.email, e.toString());
            }
            outcomes.add(outcome);
        }

        // Recorded against the school rather than a run: this is an act on the published
        // dashboard, not a step of any one generation.
        long sent = outcomes.stream().filter(o -> o.sent).count();
        trace.run("notify-" + instituteCode, instituteCode, null,
                PrincipalDashboardReleaseLog.STEP_EMAILED,
                sent == outcomes.size() ? PrincipalDashboardReleaseLog.OUTCOME_OK
                                        : PrincipalDashboardReleaseLog.OUTCOME_FAILED,
                describe(outcomes, sent));

        return outcomes;
    }

    private static String describe(List<SendOutcome> outcomes, long sent) {
        StringBuilder sb = new StringBuilder();
        sb.append(sent).append(" of ").append(outcomes.size()).append(" notified");
        for (SendOutcome o : outcomes) {
            if (!o.sent) {
                sb.append(" · failed: ").append(o.email).append(" (").append(o.error).append(")");
            }
        }
        return sb.toString();
    }
}
